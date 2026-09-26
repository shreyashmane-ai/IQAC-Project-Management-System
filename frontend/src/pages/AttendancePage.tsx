import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { deleteAttendance, listAttendance, markAttendance, getRoster, getDaySelfQr, type RosterEntry, type DaySelfQr } from '../api/attendance'
import { listProgramDays, listPrograms, type ProgramDay } from '../api/programs'
import type { AttendanceRecord, ProgramListItem } from '../types'
import {
  Btn,
  Err,
  PageHeader,
  Stat,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { fmtDateTime } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

export default function AttendancePage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [day, setDay] = useState('')
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [captureDay, setCaptureDay] = useState('')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [capLoading, setCapLoading] = useState(false)
  const [capError, setCapError] = useState<string | null>(null)
  const [quickReg, setQuickReg] = useState('')
  const [capMsg, setCapMsg] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [days, setDays] = useState<ProgramDay[]>([])

  const [qrDay, setQrDay] = useState<DaySelfQr | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    try {
      const data = await listPrograms()
      setPrograms(data.results)
      if (data.results.length > 0) setProgramId(data.results[0].id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadPrograms)
  }, [loadPrograms])

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      const recs = await listAttendance({ program: programId, day: day || undefined, search: search || undefined })
      setRecords(recs.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load attendance'))
    } finally {
      setLoading(false)
    }
  }, [programId, day, search])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function handleDelete(r: AttendanceRecord) {
    if (
      !(await confirmAsk({
        title: 'Delete attendance record',
        body: `Delete the attendance entry for "${r.participant_name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(r.id)
    setError(null)
    try {
      await deleteAttendance(r.id)
      toast.success('Attendance record deleted')
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete attendance record'))
    } finally {
      setDeletingId(null)
    }
  }

  const loadDays = useCallback(async () => {
    if (!programId) return
    try {
      setDays(await listProgramDays(programId))
    } catch {
      setDays([])
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(loadDays)
  }, [loadDays])

  const [prevDaysLen, setPrevDaysLen] = useState(days.length)
  if (prevDaysLen !== days.length) {
    setPrevDaysLen(days.length)
    if (days.length > 0 && !captureDay) setCaptureDay(days[0].id)
  }

  const loadRoster = useCallback(async () => {
    if (!programId || !captureDay) return
    setCapLoading(true)
    setCapError(null)
    try {
      setRoster(await getRoster(programId, captureDay))
    } catch (err) {
      setCapError(apiErrorMessage(err, 'Failed to load roster'))
    } finally {
      setCapLoading(false)
    }
  }, [programId, captureDay])

  useEffect(() => {
    void Promise.resolve().then(loadRoster)
  }, [loadRoster])

  async function toggleMark(entry: RosterEntry) {
    if (!programId || !captureDay) return
    setMarkingId(entry.participant_id)
    setCapError(null)
    setCapMsg(null)
    try {
      await markAttendance(programId, captureDay, { participant_id: entry.participant_id })
      await Promise.all([loadRoster(), load()])
    } catch (err) {
      setCapError(apiErrorMessage(err, 'Failed to mark attendance'))
    } finally {
      setMarkingId(null)
    }
  }

  async function quickMark() {
    if (!programId || !captureDay || !quickReg.trim()) return
    setMarkingId('quick')
    setCapError(null)
    setCapMsg(null)
    try {
      const res = await markAttendance(programId, captureDay, { registration_number: quickReg.trim() })
      setCapMsg(res.message)
      setQuickReg('')
      await Promise.all([loadRoster(), load()])
    } catch (err) {
      setCapError(apiErrorMessage(err, 'Failed to mark attendance'))
    } finally {
      setMarkingId(null)
    }
  }

  async function loadSelfQr() {
    if (!programId || !captureDay) return
    setQrLoading(true)
    setQrError(null)
    try {
      setQrDay(await getDaySelfQr(programId, captureDay))
    } catch (err) {
      setQrError(apiErrorMessage(err, 'Failed to generate QR'))
    } finally {
      setQrLoading(false)
    }
  }

  const stats = useMemo(() => {
    const present = records.filter((r) => r.is_present).length
    const late = records.filter((r) => r.is_late).length
    const absent = records.length - present
    const rate = records.length ? Math.round((present / records.length) * 100) : 0
    return { present, absent, late, attendance_rate: rate }
  }, [records])

  return (
    <div>
      <PageHeader title="Attendance" sub="Day-wise attendance records and per-day statistics." />
      <div style={styles.toolbar}>
        <TSelect
          value={programId}
          onChange={setProgramId}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 320 }}
        />
        <TSelect
          value={day}
          onChange={setDay}
          options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number} • ${new Date(d.date + 'T00:00:00').toLocaleDateString()}` }))}
          allLabel="All days"
        />
        <TextInput placeholder="Search participant…" value={search} onChange={setSearch} style={{ flex: 1 }} />
      </div>
      <Err msg={error} />

      <div className="card" style={styles.markCard}>
        <h3 style={styles.markCardTitle}>Mark / correct attendance</h3>
        <div style={styles.toolbar}>
          <TSelect
            value={captureDay}
            onChange={setCaptureDay}
            options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number} • ${new Date(d.date + 'T00:00:00').toLocaleDateString()}` }))}
            style={{ maxWidth: 260 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TextInput value={quickReg} onChange={setQuickReg} placeholder="Registration number…" style={{ minWidth: 180 }} />
            <Btn onClick={quickMark} disabled={markingId === 'quick' || !quickReg.trim()}>Mark</Btn>
          </div>
          <Btn kind="ghost" onClick={loadSelfQr} disabled={!captureDay || qrLoading} style={{ marginLeft: 'auto' }}>
            {qrLoading ? 'Generating…' : 'Self check-in QR'}
          </Btn>
        </div>
        {capMsg && <div className="successbox" style={styles.mb}>{capMsg}</div>}
        <Err msg={capError} />
        {capLoading ? (
          <TableSkeleton rows={3} />
        ) : roster.length === 0 ? (
          <EmptyState icon="users" title="No approved participants" body="No approved participants to mark for this day." />
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
            {roster.map((entry) => (
              <div
                key={entry.participant_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 4px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <button
                  onClick={() => toggleMark(entry)}
                  disabled={markingId === entry.participant_id}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: entry.is_present ? 'rgba(34,197,94,.18)' : '#fff',
                    color: entry.is_present ? 'var(--success-d)' : 'transparent',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {entry.is_present ? '✓' : ''}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5 }}>{entry.participant_name}</b>
                  <div className="muted2" style={{ fontSize: 11.5 }}>
                    {entry.registration_number}
                    {entry.is_late ? ' • late' : ''}
                    {entry.scanned_by ? ` • by ${entry.scanned_by}` : ''}
                  </div>
                </div>
                {markingId === entry.participant_id ? <span className="muted2" style={{ fontSize: 12 }}>saving…</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="statgrid" style={styles.mb}>
        <Stat label="Present" value={stats.present} />
        <Stat label="Late" value={stats.late} />
        <Stat label="Absent" value={stats.absent} />
        <Stat label="Attendance Rate" value={`${stats.attendance_rate}%`} />
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : records.length === 0 ? (
        <EmptyState icon="calendar" title="No attendance records" body="Nothing recorded for this selection yet." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            rows={records}
            rowKey={(r) => r.id}
            searchPlaceholder="Search attendance…"
            search={(r, q) =>
              [r.participant_name, r.participant_email, `Day ${r.day_number}`, r.source_display || r.source]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              {
                key: 'day',
                label: 'Day',
                sort: (r) => r.day_number,
                render: (r) => <span className="muted2">Day {r.day_number}</span>,
              },
              {
                key: 'participant',
                label: 'Participant',
                sort: (r) => r.participant_name,
                render: (r) => (
                  <>
                    <b>{r.participant_name}</b>
                    <div className="muted2" style={{ fontSize: 12 }}>{r.participant_email}</div>
                  </>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <>
                    {r.is_present ? <span className="badge">Present</span> : <span className="badge muted">Absent</span>}
                    {r.is_late && <span style={styles.late}>late</span>}
                  </>
                ),
              },
              {
                key: 'source',
                label: 'Source',
                render: (r) => <span className="muted">{r.source_display || r.source}</span>,
              },
              {
                key: 'marked',
                label: 'Marked At',
                sort: (r) => (r.marked_at ? String(r.marked_at) : ''),
                render: (r) => <span className="muted">{fmtDateTime(r.marked_at)}</span>,
              },
            ]}
            actions={(r) => (
              <RowBtn kind="del" onClick={() => handleDelete(r)} disabled={deletingId === r.id}>
                {deletingId === r.id ? 'Deleting…' : 'Delete'}
              </RowBtn>
            )}
          />
        </div>
      )}
    {qrDay && (
        <div style={styles.backdrop} onClick={() => setQrDay(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Self check-in QR</div>
                <div className="muted2" style={{ fontSize: 12.5 }}>
                  {qrDay.program_title} ({qrDay.short_code}) · Day {qrDay.day_number} •{' '}
                  {new Date(qrDay.day_date + 'T00:00:00').toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => setQrDay(null)} title="Close" style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {qrError && <p style={{ color: '#dc2626', margin: 0 }}>{qrError}</p>}
              {!qrDay.attendance_enabled && (
                <div className="errorbox" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
                  Attendance is not enabled for this day. Participants will be rejected until it is turned on in the
                  program's day settings.
                </div>
              )}
              <img
                src={`data:image/png;base64,${qrDay.qr}`}
                alt="Self check-in QR"
                style={{ width: 240, height: 240, borderRadius: 12, border: '1px solid var(--border)' }}
              />
              <div className="muted2" style={{ fontSize: 12.5, textAlign: 'center', maxWidth: 320 }}>
                Participants scan this to open the check-in form, then enter their registration number and email.
              </div>
              <Btn
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = `data:image/png;base64,${qrDay.qr}`
                  a.download = `self-checkin-${qrDay.short_code}-day${qrDay.day_number}.png`
                  a.click()
                }}
                kind="ghost"
              >
                Download
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  mb: { marginBottom: '1rem' },
  late: { marginLeft: 6, fontSize: 12, color: '#92400e', fontWeight: 600 },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
  markCard: { padding: '18px', marginBottom: '1.25rem' },
  markCardTitle: { margin: '0 0 12px' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 16, padding: 22, maxWidth: 400, width: '100%', boxShadow: '0 20px 50px -20px rgba(0,0,0,.4)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  closeBtn: { border: 'none', background: 'transparent', fontSize: 16, color: '#64748b', cursor: 'pointer', lineHeight: 1 },
}
