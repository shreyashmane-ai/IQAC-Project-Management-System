import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getProgram, updateProgramDay, updateProgramStatus, type ProgramDayPayload } from '../api/programs'
import type { ProgramDay, ProgramDetail } from '../types'
import { useToast } from '../components/Overlay'
import { htmlToPlainText } from '../utils/html'

const TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  DRAFT: [
    { to: 'PUBLISHED', label: 'Publish' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  PUBLISHED: [
    { to: 'REG_OPEN', label: 'Open registration' },
    { to: 'POSTPONED', label: 'Postpone' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  REG_OPEN: [
    { to: 'REG_CLOSED', label: 'Close registration' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  REG_CLOSED: [
    { to: 'ONGOING', label: 'Mark ongoing' },
    { to: 'POSTPONED', label: 'Postpone' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  ONGOING: [
    { to: 'COMPLETED', label: 'Complete' },
    { to: 'RESCHEDULED', label: 'Reschedule' },
  ],
  POSTPONED: [
    { to: 'RESCHEDULED', label: 'Reschedule' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  RESCHEDULED: [
    { to: 'ONGOING', label: 'Mark ongoing' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  COMPLETED: [{ to: 'ARCHIVED', label: 'Archive' }],
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState<string | null>(null)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [dayBusy, setDayBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setProgram(await getProgram(id))
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load program'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function changeStatus(to: string, label: string) {
    if (!id) return
    const reason = label.includes('Cancel')
      ? window.prompt('Reason for cancelling (optional):') ?? ''
      : ''
    if (label.includes('Cancel') && reason === null) return
    setChanging(to)
    setChangeError(null)
    try {
      await updateProgramStatus(id, { to, reason })
      await load()
    } catch (err) {
      setChangeError(apiErrorMessage(err, 'Failed to change status'))
    } finally {
      setChanging(null)
    }
  }

  async function toggleDayService(day: ProgramDay, key: 'attendance' | 'food', enabled: boolean) {
    if (!id) return
    const label = key === 'attendance' ? 'Attendance' : 'Food'
    const fieldKey = key === 'attendance' ? 'attendance_enabled' : 'food_enabled'
    setDayBusy(`${day.id}:${key}`)
    try {
      await updateProgramDay(day.id, {
        program: id,
        day_number: day.day_number,
        date: day.date,
        title: day.title,
        start_time: day.start_time,
        end_time: day.end_time,
        [fieldKey]: enabled,
      } as ProgramDayPayload)
      toast.success(`${label} ${enabled ? 'enabled' : 'disabled'} for Day ${day.day_number}`)
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, `Failed to update ${label.toLowerCase()} for this day`))
    } finally {
      setDayBusy(null)
    }
  }

  if (loading) return <div className="loading">Loading…</div>
  if (error) return <div className="errorbox">{error}</div>
  if (!program) return <p className="muted">Program not found.</p>

  return (
    <div>
      <Link to="/programs" className="backlink">← Back to programs</Link>

      <div className="pagehead">
        <div>
          <div style={styles.headerBadges}>
            <span className={`badge ${program.status}`}>{program.status_display}</span>
            <span className="muted2" style={styles.code}>{program.short_code}</span>
          </div>
          <h1>{program.title}</h1>
          <p>
            {program.academic_session_name} • {program.program_type_name} • {(program.organizing_departments_detail || []).map((d: any) => d.name).join(', ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/programs/${program.id}/links`} className="btn">
            Links & QR
          </Link>
          <Link to={`/programs/wizard/${program.id}`} className="btn">
            Edit wizard
          </Link>
        </div>
      </div>

      {(TRANSITIONS[program.status]?.length > 0 || changeError) && (
        <section className="card" style={styles.section}>
          <h3 style={styles.panelTitle}>Change status</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Current: <b>{program.status_display}</b> →</span>
            {TRANSITIONS[program.status]?.map((t) => (
              <button
                key={t.to}
                onClick={() => changeStatus(t.to, t.label)}
                disabled={changing !== null}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: t.to === 'CANCELLED' ? '#fff' : 'var(--primary)',
                  color: t.to === 'CANCELLED' ? 'var(--danger)' : '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: changing !== null ? 'wait' : 'pointer',
                }}
              >
                {changing === t.to ? '…' : t.label}
              </button>
            ))}
          </div>
          {changeError && <div className="errorbox" style={{ marginTop: 10 }}>{changeError}</div>}
        </section>
      )}

      <div style={styles.grid}>
        <section className="card">
          <h3 style={styles.panelTitle}>Overview</h3>
          <dl style={styles.list}>
            <Row
              label="Dates"
              value={`${new Date(program.start_date).toLocaleDateString()} – ${new Date(program.end_date).toLocaleDateString()}`}
            />
            <Row label="Days" value={`${program.number_of_days} day(s)`} />
            <Row label="Venue" value={program.venue_name || program.venue || '—'} />
            <Row label="Coordinator" value={program.coordinator_name} />
            <Row label="Max participants" value={program.max_participants?.toString() ?? '—'} />
            <Row label="Registered" value={program.registration_count.toString()} />
          </dl>
        </section>

        <section className="card">
          <h3 style={styles.panelTitle}>Objective</h3>
          <p style={styles.objective}>{htmlToPlainText(program.objective) || 'No objective provided.'}</p>
        </section>
      </div>

      <section className="card" style={styles.section}>
        <h3 style={styles.panelTitle}>Program Days</h3>
        {program.days.length === 0 ? (
          <p className="muted">No days scheduled.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Title</th>
                <th>Time</th>
                <th>Services</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {program.days.map((d) => (
                <tr key={d.id}>
                  <td>Day {d.day_number}</td>
                  <td>{new Date(d.date).toLocaleDateString()}</td>
                  <td>{d.title || '—'}</td>
                  <td>
                    {d.start_time || ''}
                    {d.start_time && d.end_time ? ' – ' : ''}
                    {d.end_time || (d.start_time ? '' : '—')}
                  </td>
                  <td>
                    {[
                      d.attendance_enabled && 'Attendance',
                      d.food_enabled && 'Food',
                      d.quiz_enabled && 'Quiz',
                      d.other_enabled && 'Other',
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                      {([
                        ['attendance', 'A'],
                        ['food', 'F'],
                      ] as const).map(([key, label]) => (
                        <label
                          key={key}
                          title={`${key === 'attendance' ? 'Attendance' : 'Food'} enabled`}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={!!d[`${key}_enabled`]}
                            disabled={dayBusy !== null}
                            onChange={(e) => toggleDayService(d, key, e.target.checked)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <dt className="muted" style={styles.dt}>{label}</dt>
      <dd style={styles.dd}>{value}</dd>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  headerBadges: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  code: { fontSize: '12px', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  panelTitle: { marginBottom: '0.9rem' },
  list: { margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '1rem' },
  dt: { fontSize: '13px' },
  dd: { margin: 0, fontSize: '13.5px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' },
  objective: { color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  section: { padding: '18px' },
}
