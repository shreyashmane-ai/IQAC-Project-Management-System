import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import {
  createFoodService,
  deleteFoodService,
  generateFoodQR,
  getDayFoodEligibility,
  getDayFoodSummary,
  listFoodServices,
  preSendSummary,
  sendNewEligible,
  updateFoodService,
} from '../api/food'
import { listProgramDays, listPrograms, type ProgramDay } from '../api/programs'
import type { FoodService, ProgramListItem } from '../types'
import {
  Btn,
  Err,
  Loading,
  PageHeader,
  Stat,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { titleCase } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

const SERVICE_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS', 'OTHER']

const RULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'attendance_present', label: 'Present that day (attendance)' },
  { value: 'registration_only', label: 'All registered participants' },
  { value: 'attendance_percentage', label: 'Attendance % (min days)' },
  { value: 'previous_day_present', label: 'Present on previous day' },
]

function ruleFromForm(ruleType: string, ruleValue: string): Record<string, unknown> | undefined {
  if (ruleType === 'registration_only') return { type: 'registration_only' }
  if (ruleType === 'attendance_percentage') {
    const value = Number(ruleValue)
    return { type: 'attendance_percentage', value: Number.isFinite(value) && value > 0 ? value : 50 }
  }
  if (ruleType === 'previous_day_present') return { type: 'previous_day_present' }
  return undefined
}

function ruleOf(rule?: Record<string, unknown> | null): { type: string; value: number } {
  const type = typeof rule?.type === 'string' ? rule.type : 'attendance_present'
  const value = typeof rule?.value === 'number' ? rule.value : 50
  return { type, value }
}

interface PivotRow {
  serviceName: string
  eligible: number
  sent: number
  claimed: number
}

export default function FoodPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [days, setDays] = useState<ProgramDay[]>([])
  const [services, setServices] = useState<FoodService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FoodService | null>(null)
  const [form, setForm] = useState({
    day: '',
    service_type: SERVICE_TYPES[0],
    name: '',
    service_time: '',
    ruleType: 'attendance_present',
    ruleValue: '50',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [opDay, setOpDay] = useState('')
  const [opData, setOpData] = useState<{ eligible: number; new_count: number; already_sent: number; claimed: number; pending: number } | null>(null)
  const [opLoading, setOpLoading] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [opAction, setOpAction] = useState<string | null>(null)

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

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      const svcs = await listFoodServices({ program: programId })
      setServices(svcs.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load food data'))
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const [prevDaysLen, setPrevDaysLen] = useState(days.length)
  if (prevDaysLen !== days.length) {
    setPrevDaysLen(days.length)
    if (days.length > 0 && !opDay) setOpDay(days[0].id)
  }

  const loadOp = useCallback(async () => {
    if (!programId || !opDay) return
    setOpLoading(true)
    setOpError(null)
    try {
      const [elig, summary] = await Promise.all([
        getDayFoodEligibility(programId, opDay),
        getDayFoodSummary(programId, opDay),
      ])
      setOpData({
        eligible: elig.eligible_count ?? 0,
        new_count: elig.new_count ?? 0,
        already_sent: (elig.already_sent_count ?? 0),
        claimed: summary.claimed_count ?? 0,
        pending: (elig.pending ?? Math.max(0, (elig.eligible_count ?? 0) - (elig.already_sent_count ?? 0) - (summary.claimed_count ?? 0))),
      })
    } catch (err) {
      setOpError(apiErrorMessage(err, 'Failed to load day operation data'))
    } finally {
      setOpLoading(false)
    }
  }, [programId, opDay])

  useEffect(() => {
    void Promise.resolve().then(loadOp)
  }, [loadOp])

  async function runGenerate() {
    if (!programId || !opDay) return
    setOpAction('generate')
    setOpError(null)
    try {
      await generateFoodQR(programId, opDay)
      await loadOp()
    } catch (err) {
      setOpError(apiErrorMessage(err, 'Failed to generate QR codes'))
    } finally {
      setOpAction(null)
    }
  }

  async function runSend() {
    if (!programId || !opDay) return
    setOpAction('send')
    setOpError(null)
    try {
      await sendNewEligible(programId, opDay)
      await loadOp()
    } catch (err) {
      setOpError(apiErrorMessage(err, 'Failed to send QR codes'))
    } finally {
      setOpAction(null)
    }
  }

  async function runPreSend() {
    if (!programId || !opDay) return
    setOpAction('presend')
    setOpError(null)
    try {
      const p = await preSendSummary(programId, opDay)
      setOpData((d) => d && { ...d, pending: p.pending ?? p.new_count ?? 0 })
    } catch (err) {
      setOpError(apiErrorMessage(err, 'Failed to preview send summary'))
    } finally {
      setOpAction(null)
    }
  }

  const pivot: PivotRow[] = services.map((s) => ({
    serviceName: s.name || `${titleCase(s.service_type)}${s.day_number ? ` • Day ${s.day_number}` : ''}`,
    eligible: s.eligible_count,
    sent: s.sent_count,
    claimed: s.claimed_count,
  }))

  const totals = pivot.reduce(
    (acc, r) => ({
      eligible: acc.eligible + r.eligible,
      sent: acc.sent + r.sent,
      claimed: acc.claimed + r.claimed,
    }),
    { eligible: 0, sent: 0, claimed: 0 },
  )

  const dayActiveServices = services.filter((s) => s.day === opDay && s.is_active)

  function resetForm() {
    setForm({
      day: days[0]?.id || '',
      service_type: SERVICE_TYPES[0],
      name: '',
      service_time: '',
      ruleType: 'attendance_present',
      ruleValue: '50',
      is_active: true,
    })
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startCreate() {
    setEditing(null)
    setCreating((s) => !s)
    setForm({
      day: days[0]?.id || '',
      service_type: SERVICE_TYPES[0],
      name: '',
      service_time: '',
      ruleType: 'attendance_present',
      ruleValue: '50',
      is_active: true,
    })
    setSaveError(null)
  }

  function startEdit(s: FoodService) {
    setCreating(false)
    setEditing(s)
    const r = ruleOf(s.eligibility_rule)
    setForm({
      day: s.day || days[0]?.id || '',
      service_type: SERVICE_TYPES.includes(s.service_type) ? s.service_type : 'OTHER',
      name: s.name || '',
      service_time: s.service_time || '',
      ruleType: r.type,
      ruleValue: String(r.value),
      is_active: s.is_active,
    })
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        await updateFoodService(editing.id, {
          day: form.day,
          service_type: form.service_type,
          name: form.name.trim() || undefined,
          service_time: form.service_time.trim() || null,
          eligibility_rule: ruleFromForm(form.ruleType, form.ruleValue),
          is_active: form.is_active,
        })
      } else {
        await createFoodService({
          program: programId,
          day: form.day,
          service_type: form.service_type,
          name: form.name.trim() || undefined,
          service_time: form.service_time.trim() || null,
          eligibility_rule: ruleFromForm(form.ruleType, form.ruleValue),
          is_active: form.is_active,
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update food service' : 'Failed to create food service'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: FoodService) {
    if (
      !(await confirmAsk({
        title: 'Delete food service',
        body: `Delete this ${titleCase(s.service_type)} service? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(s.id)
    setError(null)
    try {
      await deleteFoodService(s.id)
      toast.success('Food service deleted')
      if (editing?.id === s.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete food service'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Food"
        sub="Food services, eligibility and QR claim workflows."
        actions={<Btn onClick={startCreate}>{creating || editing ? 'Cancel' : 'Add service'}</Btn>}
      />
      <div style={styles.toolbar}>
        <TSelect
          value={programId}
          onChange={setProgramId}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 320 }}
        />
      </div>
      <Err msg={error} />

      {(creating || editing) && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>{editing ? 'Edit food service' : 'New food service'}</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Day *</span>
              <TSelect
                value={form.day}
                onChange={(v) => setForm((f) => ({ ...f, day: v }))}
                options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number} (${d.date})` }))}
                allLabel={days.length === 0 ? 'No days available' : undefined}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Service type *</span>
              <TSelect
                value={form.service_type}
                onChange={(v) => setForm((f) => ({ ...f, service_type: v }))}
                options={SERVICE_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Name</span>
              <TextInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Breakfast Buffet" />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Service time</span>
              <TextInput value={form.service_time} onChange={(v) => setForm((f) => ({ ...f, service_time: v }))} placeholder="e.g. 09:00" />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Eligibility rule</span>
              <TSelect
                value={form.ruleType}
                onChange={(v) => setForm((f) => ({ ...f, ruleType: v }))}
                options={RULE_OPTIONS}
              />
            </label>
            {form.ruleType === 'attendance_percentage' && (
              <label style={styles.field}>
                <span style={styles.label}>Min attendance %</span>
                <TextInput value={form.ruleValue} onChange={(v) => setForm((f) => ({ ...f, ruleValue: v }))} placeholder="50" type="number" />
              </label>
            )}
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <span>Active</span>
            </label>
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn onClick={handleSave} disabled={saving || !form.day}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {pivot.length > 0 && (
        <div className="statgrid" style={styles.mb}>
          <Stat label="Eligible" value={totals.eligible} />
          <Stat label="Sent" value={totals.sent} />
          <Stat label="Claimed" value={totals.claimed} />
          <Stat label="Remaining to claim" value={Math.max(0, totals.eligible - totals.claimed)} />
        </div>
      )}

      <div className="card" style={styles.card}>
        <h3 style={styles.cardTitle}>Day operations</h3>
        <div style={styles.toolbar}>
          <TSelect
            value={opDay}
            onChange={setOpDay}
            options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number} (${d.date})` }))}
            allLabel={days.length === 0 ? 'No days' : undefined}
            style={{ maxWidth: 260 }}
          />
        </div>
        <Err msg={opError} />
        {opDay && days.some((d) => d.id === opDay) && (
          dayActiveServices.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              No active food services for this day — add one with <b>Add service</b> below before generating QRs.
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              {dayActiveServices.length} active food service{dayActiveServices.length === 1 ? '' : 's'} for this day.
            </div>
          )
        )}
        {opLoading ? (
          <Loading />
        ) : opData ? (
          <div className="statgrid" style={styles.mb}>
            <Stat label="Eligible" value={opData.eligible} />
            <Stat label="New" value={opData.new_count} />
            <Stat label="Already sent" value={opData.already_sent} />
            <Stat label="Claimed" value={opData.claimed} />
            <Stat label="Pending" value={opData.pending} />
          </div>
        ) : (
          <p className="muted">Select a program with days to see QR operations.</p>
        )}
        {programId && opDay && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={runGenerate} disabled={opAction === 'generate' || dayActiveServices.length === 0}>
              {opAction === 'generate' ? 'Generating…' : 'Generate QR codes'}
            </Btn>
            <Btn onClick={runPreSend} kind="ghost" disabled={opAction === 'presend'}>
              {opAction === 'presend' ? 'Previewing…' : 'Preview send summary'}
            </Btn>
            <Btn onClick={runSend} kind="ghost" disabled={opAction === 'send'}>
              {opAction === 'send' ? 'Sending…' : 'Send to new eligible'}
            </Btn>
          </div>
        )}
      </div>

{loading ? (
          <TableSkeleton rows={6} />
        ) : services.length === 0 ? (
          <EmptyState icon="plate" title="No food services configured" body="Add a breakfast, lunch or dinner service for this program to get started." />
        ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="cardhead">
            <h3>Food Services</h3>
          </div>
          <DataTable
            rows={services}
            rowKey={(s) => s.id}
            searchPlaceholder="Search food services…"
            search={(s, q) =>
              [s.name, s.service_type_display || s.service_type, s.day_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              { key: 'service', label: 'Service', sort: (s) => s.name ?? '', render: (s) => <b>{s.name || '—'}</b> },
              { key: 'type', label: 'Type', render: (s) => <span className="muted">{s.service_type_display || titleCase(s.service_type)}</span> },
              {
                key: 'day',
                label: 'Day',
                render: (s) => (
                  <span className="muted2">
                    {s.day_number ? `Day ${s.day_number}` : '—'}
                    {s.service_time ? ` • ${s.service_time}` : ''}
                  </span>
                ),
              },
              { key: 'eligible', label: 'Eligible', align: 'right', render: (s) => s.eligible_count },
              { key: 'sent', label: 'Sent', align: 'right', render: (s) => s.sent_count },
              { key: 'claimed', label: 'Claimed', align: 'right', render: (s) => s.claimed_count },
              {
                key: 'remaining',
                label: 'Remaining',
                align: 'right',
                render: (s) => <span className="muted2">{Math.max(0, (s.eligible_count || 0) - (s.claimed_count || 0))}</span>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (s) => <span className="badge muted">{s.is_active ? 'Active' : 'Inactive'}</span>,
              },
            ]}
            actions={(s) => (
              <>
                <RowBtn kind="edit" onClick={() => startEdit(s)}>Edit</RowBtn>
                <RowBtn kind="del" onClick={() => handleDelete(s)} disabled={deletingId === s.id}>
                  {deletingId === s.id ? 'Deleting…' : 'Delete'}
                </RowBtn>
              </>
            )}
          />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  mb: { marginBottom: '1rem' },
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '13.5px', alignSelf: 'end' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
