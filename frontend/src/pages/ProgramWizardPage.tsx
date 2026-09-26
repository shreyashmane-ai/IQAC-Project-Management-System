import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import {
  createProgram,
  getProgram,
  updateProgram,
  listSessions,
  listMasterActive,
  listProgramDays,
  createProgramDay,
  updateProgramDay,
  deleteProgramDay,
  getRegistrationForm,
  putRegistrationForm,
  getFeedbackForm,
  putFeedbackForm,
  type ProgramDayPayload,
  type DayResourcePerson,
  type ProgramPayload,
} from '../api/programs'
import { listUsers } from '../api/users'
import { Loading, Err, TextInput, TSelect, Btn, RichTextEditor, MultiSelect } from '../components/common'
import { useToast } from '../components/Overlay'
import type { AcademicSession, MasterData, ProgramDetail, UserRow } from '../types'

type MasterKey = 'academic-departments' | 'admin-departments' | 'program-types' | 'venues'

const STEPS = ['Basics', 'Organisation', 'Schedule', 'People', 'Capacity', 'Content', 'Registration Form', 'Feedback Form', 'Days & Services', 'Review']

interface WizardDay extends ProgramDayPayload {
  id?: string
}

export default function ProgramWizardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)

  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [masters, setMasters] = useState<Record<MasterKey, MasterData[]>>({
    'academic-departments': [],
    'admin-departments': [],
    'program-types': [],
    venues: [],
  })

  const [deptType, setDeptType] = useState<'academic' | 'admin'>('academic')

  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [days, setDays] = useState<WizardDay[]>([])
  const [regSchema, setRegSchema] = useState<Record<string, unknown>>({})
  const [fbSchema, setFbSchema] = useState<Record<string, unknown>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const loadMasters = useCallback(async () => {
    const [s, u, dept, addept, types, venues] = await Promise.all([
      listSessions(),
      listUsers(),
      listMasterActive('academic-departments'),
      listMasterActive('admin-departments'),
      listMasterActive('program-types'),
      listMasterActive('venues'),
    ])
    setSessions(s.results)
    setUsers(u.results)
    setMasters({ 'academic-departments': dept, 'admin-departments': addept, 'program-types': types, venues })
  }, [])

  const loadProgram = useCallback(async () => {
    if (!id) return
    const p = await getProgram(id)
    setProgram(p)
    setDraft(p as unknown as Record<string, any>)
    setDays(p.days.map((d: any) => ({ ...d, program: p.id })))
    setRegSchema(await getRegistrationForm(id))
    setFbSchema(await getFeedbackForm(id))
  }, [id])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await loadMasters()
        if (!active) return
        if (id) await loadProgram()
        else setDraft({ number_of_days: 1, max_participants: null })
      } catch (e) {
        if (active) setError(apiErrorMessage(e, 'Failed to load wizard data'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [id, loadMasters, loadProgram])

  const set = (key: string, value: any) => setDraft((d) => ({ ...d, [key]: value }))

  async function saveCurrentStep(): Promise<boolean> {
    setSaving(true)
    setError(null)
    const academicIds = new Set(masters['academic-departments'].map((m) => m.id))
    const organizing_departments = (draft.organizing_departments || []).filter((id: string) => academicIds.has(id))
    const dropped = ((draft.organizing_departments as string[]) || []).filter((id) => !academicIds.has(id))
    try {
      const required: any = {
        title: draft.title,
        short_code: draft.short_code,
        academic_session: draft.academic_session,
        program_type: draft.program_type,
        organizing_departments,
        program_coordinator: draft.program_coordinator,
        start_date: draft.start_date,
        end_date: draft.end_date,
        start_time: draft.start_time,
        end_time: draft.end_time,
        number_of_days: draft.number_of_days ?? 1,
      }
      let saved: ProgramDetail
      if (id) {
        saved = await updateProgram(id, { ...draft, organizing_departments } as Partial<ProgramPayload>)
      } else {
        saved = await createProgram(required as ProgramPayload)
        // navigate to the new program's wizard
        navigate(`/programs/wizard/${saved.id}`, { replace: true })
        await loadProgram()
        if (dropped.length) toast.info('Administrative departments were removed from Organising departments — only academic departments can be saved there.')
        return true
      }
      if (dropped.length) toast.info('Administrative departments were removed from Organising departments — only academic departments can be saved there.')
      setProgram(saved)
      setDraft(saved as unknown as Record<string, any>)
      return true
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to save'))
      return false
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />
  if (error && !program) return <Err msg={error} />

  function next() {
    setMsg(null)
    if (step === STEPS.length - 1) return
    setStep((s) => s + 1)
  }
  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="pagehead">
        <div>
          <h1>{id ? `Edit ${program?.short_code || ''}` : 'New Program'}</h1>
          <p>Guided setup wizard</p>
        </div>
        <Link to={id ? `/programs/${id}` : '/programs'} className="btn ghost">Exit wizard</Link>
      </div>

      <StepNav steps={STEPS} current={step} onSelect={(i) => setStep(i)} />

      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <Err msg={error} />
        {msg && <div className="successbox" style={{ marginBottom: 16 }}>{msg}</div>}

        {step === 0 && <BasicsStep draft={draft} set={set} sessions={sessions} />}
        {step === 1 && <OrganisationStep draft={draft} set={set} masters={masters} deptType={deptType} setDeptType={setDeptType} />}
        {step === 2 && <ScheduleStep draft={draft} set={set} />}
        {step === 3 && <PeopleStep draft={draft} set={set} users={users} />}
        {step === 4 && <CapacityStep draft={draft} set={set} />}
        {step === 5 && <ContentStep draft={draft} set={set} />}
        {step === 6 && <FormSchemaStep title="Registration form" schema={regSchema} onChange={setRegSchema} onSave={async () => { if (program) await putRegistrationForm(program.id, regSchema) }} />}
        {step === 7 && <FormSchemaStep title="Feedback form" schema={fbSchema} onChange={setFbSchema} onSave={async () => { if (program) await putFeedbackForm(program.id, fbSchema) }} />}
        {step === 8 && <DaysStep programId={program?.id} days={days} setDays={setDays} saveDays={async () => { if (program) await saveDays(program.id, days) }} />}
        {step === 9 && <ReviewStep draft={draft} program={program} />}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <Btn onClick={back} kind="ghost" disabled={step === 0}>← Back</Btn>
          <div style={{ display: 'flex', gap: 10 }}>
            {program && (
              <Btn
                onClick={async () => {
                  const ok = await saveCurrentStep()
                  if (ok) setMsg('Changes saved.')
                }}
                disabled={saving}
                kind="ghost"
              >
                {saving ? 'Saving…' : 'Save progress'}
              </Btn>
            )}
            {step < STEPS.length - 1 ? (
              <Btn
                onClick={async () => {
                  if (!id && step === 5) {
                    const ok = await saveCurrentStep()
                    if (ok) next()
                  } else {
                    next()
                  }
                }}
                disabled={saving}
              >
                Next →
              </Btn>
            ) : (
              <Btn
                onClick={async () => {
                  if (!id) {
                    const ok = await saveCurrentStep()
                    if (!ok) return
                  }
                  navigate('/programs')
                }}
                disabled={saving}
              >
                {saving ? 'Creating…' : 'Finish'}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

async function saveDays(programId: string, days: WizardDay[]) {
  const existing = await listProgramDays(programId)
  const existingById = new Map(existing.map((d: any) => [d.id, d]))
  const keptIds = new Set<string>()
  for (const day of days) {
    const payload: ProgramDayPayload = {
      program: programId,
      day_number: day.day_number,
      date: day.date,
      title: day.title,
      start_time: day.start_time,
      end_time: day.end_time,
      attendance_enabled: day.attendance_enabled,
      food_enabled: day.food_enabled,
      resource_persons: day.resource_persons,
    }
    if (day.id && existingById.has(day.id)) {
      keptIds.add(day.id)
      await updateProgramDay(day.id, payload)
    } else {
      const created = await createProgramDay(payload)
      day.id = created.id
      keptIds.add(created.id)
    }
  }
  for (const d of existing) {
    if (!keptIds.has(d.id)) await deleteProgramDay(d.id)
  }
}

function StepNav({ steps, current, onSelect }: { steps: string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {steps.map((s, i) => (
        <button
          key={s}
          onClick={() => onSelect(i)}
          style={{
            padding: '7px 13px',
            borderRadius: 999,
            border: `1px solid ${i === current ? '#2563eb' : 'var(--border)'}`,
            background: i === current ? 'rgba(37,99,235,.1)' : '#fff',
            color: i === current ? '#2563eb' : 'var(--text)',
            fontWeight: 600,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {i + 1}. {s}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children, required, width }: { label: string; children: React.ReactNode; required?: boolean; width?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180, flexBasis: width || undefined }}>
      <label style={{ fontSize: 13, fontWeight: 600 }}>
        {label}
        {required ? <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span> : null}
      </label>
      {children}
    </div>
  )
}

const grid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 16 }

function BasicsStep({ draft, set, sessions }: { draft: Record<string, any>; set: (k: string, v: any) => void; sessions: AcademicSession[] }) {
  return (
    <div style={grid}>
      <Field label="Program title" required>
        <TextInput value={draft.title || ''} onChange={(v) => set('title', v)} placeholder="e.g. FDP on AI in Higher Education" />
      </Field>
      <Field label="Short code" required>
        <TextInput value={draft.short_code || ''} onChange={(v) => set('short_code', v)} placeholder="e.g. FDP-AI-2026" />
      </Field>
      <Field label="Academic session" required>
        <TSelect value={draft.academic_session || ''} onChange={(v) => set('academic_session', v)} options={sessions.map((s: any) => ({ value: s.id, label: `${s.code} - ${s.name}` }))} allLabel="Select session…" />
      </Field>
      <Field label="Description" required={false} width="100%">
        <RichTextEditor value={draft.description || ''} onChange={(v) => set('description', v)} placeholder="Describe the program — objectives, agenda highlights, target audience, and any other details…" />
      </Field>
    </div>
  )
}

function OrganisationStep({ draft, set, masters, deptType, setDeptType }: { draft: Record<string, any>; set: (k: string, v: any) => void; masters: Record<MasterKey, MasterData[]>; deptType: 'academic' | 'admin'; setDeptType: (t: 'academic' | 'admin') => void }) {
  const selected = draft.organizing_departments || []
  const typeOptions = [
    { value: 'academic', label: 'Academic departments' },
    { value: 'admin', label: 'Administrative departments' },
  ]
  const deptOptions = masters[deptType === 'academic' ? 'academic-departments' : 'admin-departments'].map(opt)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={grid}>
        <Field label="Program type" required>
          <TSelect value={draft.program_type || ''} onChange={(v) => set('program_type', v)} options={masters['program-types'].map(opt)} allLabel="Select type…" />
        </Field>
        <Field label="Organising department type" required>
          <TSelect
            value={deptType}
            onChange={(v) => setDeptType((v === 'admin' ? 'admin' : 'academic'))}
            options={typeOptions}
          />
        </Field>
      </div>
      <Field label="Organising departments" required>
        <MultiSelect
          value={selected}
          onChange={(v) => set('organizing_departments', v)}
          options={deptOptions}
          placeholder="Select one or more departments…"
        />
      </Field>
      <div style={grid}>
        <Field label="Venue">
          <TSelect value={draft.venue || ''} onChange={(v) => set('venue', v)} options={[{ value: '', label: 'No venue' }, ...masters.venues.map(opt)]} />
        </Field>
      </div>
      {draft.venue ? (
        <Field label="Venue details (optional)">
          <TextInput value={draft.venue_details || ''} onChange={(v) => set('venue_details', v)} placeholder="Room no / floor / notes" />
        </Field>
      ) : (
        <Field label="Venue details">
          <TextInput value={draft.venue_details || ''} onChange={(v) => set('venue_details', v)} placeholder="Venue name / address" />
        </Field>
      )}
    </div>
  )
}

function ScheduleStep({ draft, set }: { draft: Record<string, any>; set: (k: string, v: any) => void }) {
  return (
    <div style={grid}>
      <Field label="Start date" required>
        <TextInput type="date" value={draft.start_date || ''} onChange={(v) => set('start_date', v)} />
      </Field>
      <Field label="End date" required>
        <TextInput type="date" value={draft.end_date || ''} onChange={(v) => set('end_date', v)} />
      </Field>
      <Field label="Number of days">
        <TextInput type="number" value={draft.number_of_days ?? 1} onChange={(v) => set('number_of_days', Number(v) || 1)} />
      </Field>
      <Field label="Start time" required>
        <TextInput type="time" value={draft.start_time || ''} onChange={(v) => set('start_time', v)} />
      </Field>
      <Field label="End time" required>
        <TextInput type="time" value={draft.end_time || ''} onChange={(v) => set('end_time', v)} />
      </Field>
    </div>
  )
}

function PeopleStep({ draft, set, users }: { draft: Record<string, any>; set: (k: string, v: any) => void; users: UserRow[] }) {
  return (
    <div style={grid}>
      <Field label="Program coordinator" required>
        <TSelect value={draft.program_coordinator || ''} onChange={(v) => set('program_coordinator', v)} options={users.map((u: any) => ({ value: String(u.id), label: u.full_name || u.username }))} allLabel="Select coordinator…" />
      </Field>
    </div>
  )
}

function CapacityStep({ draft, set }: { draft: Record<string, any>; set: (k: string, v: any) => void }) {
  return (
    <div style={grid}>
      <Field label="Max participants (leave blank for unlimited)">
        <TextInput type="number" value={draft.max_participants ?? ''} onChange={(v) => set('max_participants', v === '' ? null : Number(v))} />
      </Field>
      <Field label="Registration approval">
        <TSelect value={draft.registration_requires_approval ? 'yes' : 'no'} onChange={(v) => set('registration_requires_approval', v === 'yes')} options={[{ value: 'no', label: 'Auto-approve' }, { value: 'yes', label: 'Require approval' }]} />
      </Field>
    </div>
  )
}

function ContentStep({ draft, set }: { draft: Record<string, any>; set: (k: string, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Objective" width="100%">
        <RichTextEditor value={draft.objective || ''} onChange={(v) => set('objective', v)} placeholder="What is the objective of this program?" />
      </Field>
      <Field label="Expected outcomes" width="100%">
        <RichTextEditor value={draft.expected_outcomes || ''} onChange={(v) => set('expected_outcomes', v)} placeholder="What outcomes do participants achieve?" />
      </Field>
    </div>
  )
}

function FormSchemaStep({ title, schema, onChange, onSave }: { title: string; schema: Record<string, unknown>; onChange: (s: Record<string, unknown>) => void; onSave: () => Promise<void> }) {
  const fields = (Array.isArray(schema.fields) ? schema.fields : []) as {
    name: string
    type: string
    label?: string
    required?: boolean
    options?: string[]
  }[]

  const [masterOptions, setMasterOptions] = useState<Record<string, string[]>>({})

  useEffect(() => {
    let active = true
    Promise.all([
      listMasterActive('academic-departments'),
      listMasterActive('designations'),
    ])
      .then(([dept, desig]) => {
        if (!active) return
        setMasterOptions({
          'academic-departments': dept.map((m) => m.name),
          designations: desig.map((m) => m.name),
        })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  function addField() {
    const f = [...fields, { name: `field_${fields.length + 1}`, type: 'text', label: `Field ${fields.length + 1}`, required: false, options: [] as string[] }]
    onChange({ fields: f })
  }

  function addStandardFields() {
    const existing = new Set(fields.map((f) => f.name))
    const next = [...fields]
    const push = (name: string, label: string, type: string, required: boolean, options?: string[]) => {
      if (existing.has(name)) return
      next.push({ name, type, label, required, options: options || [] })
      existing.add(name)
    }
    push('Full Name', 'Full Name', 'text', true)
    push('Email', 'Email', 'email', true)
    push('Contact No.', 'Contact No.', 'phone', true)
    push('Department', 'Department', 'select', false, masterOptions['academic-departments'])
    push('Designation', 'Designation', 'select', false, masterOptions['designations'])
    onChange({ fields: next })
  }
  function update(i: number, patch: Partial<(typeof fields)[number]>) {
    const f = fields.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
    onChange({ fields: f })
  }
  function remove(i: number) {
    onChange({ fields: fields.filter((_, idx) => idx !== i) })
  }
  const needsOptions = (t: string) => ['select', 'radio', 'checkbox'].includes(t)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={addStandardFields}>+ Add standard fields</Btn>
          <Btn onClick={addField} kind="ghost">+ Add field</Btn>
        </div>
      </div>
      {fields.length === 0 ? (
        <p className="muted">No fields yet. Add your first field.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#fff' }}>
              <TextInput value={f.name} onChange={(v) => update(i, { name: v })} placeholder="field_name" style={{ minWidth: 130, flex: 1 }} />
              <TextInput value={f.label || ''} onChange={(v) => update(i, { label: v })} placeholder="Label" style={{ minWidth: 130, flex: 1 }} />
              <TSelect
                value={f.type}
                onChange={(v) => update(i, { type: v, options: needsOptions(v) ? f.options || [] : [] })}
                options={['text', 'longtext', 'email', 'phone', 'number', 'select', 'radio', 'checkbox', 'date', 'yesno'].map((t) => ({ value: t, label: t }))}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} /> Required
              </label>
              {needsOptions(f.type) && (
                <TextInput
                  value={(f.options || []).join(', ')}
                  onChange={(v) => update(i, { options: v.split(',').map((x) => x.trim()).filter(Boolean) })}
                  placeholder="options, comma, separated"
                  style={{ minWidth: 220 }}
                />
              )}
              <Btn onClick={() => remove(i)} kind="danger">Remove</Btn>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Btn onClick={onSave}>Save {title.toLowerCase()}</Btn>
      </div>
    </div>
  )
}

function DayResourcePersonsEditor({ day, i, update }: { day: WizardDay; i: number; update: (i: number, patch: Partial<ProgramDayPayload>) => void }) {
  const persons: DayResourcePerson[] = day.resource_persons || []
  function setPerson(idx: number, patch: Partial<DayResourcePerson>) {
    const next = persons.map((p, j) => (j === idx ? { ...p, ...patch } : p))
    update(i, { resource_persons: next })
  }
  function addPerson() {
    update(i, { resource_persons: [...persons, { name: '' }] })
  }
  function removePerson(idx: number) {
    update(i, { resource_persons: persons.filter((_, j) => j !== idx) })
  }
  return (
    <div style={{ width: '100%', borderTop: '1px dashed var(--border2)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Resource person(s)</span>
        <Btn onClick={addPerson}>+ Add person</Btn>
      </div>
      {persons.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>No resource persons for this day.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {persons.map((p, j) => (
            <div key={j} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
              <TextInput value={p.name} onChange={(v) => setPerson(j, { name: v })} placeholder="Name *" style={{ minWidth: 150, flex: 1 }} />
              <TextInput value={p.designation || ''} onChange={(v) => setPerson(j, { designation: v })} placeholder="Designation" style={{ minWidth: 130, flex: 1 }} />
              <TextInput value={p.institution || ''} onChange={(v) => setPerson(j, { institution: v })} placeholder="Institution" style={{ minWidth: 150, flex: 1 }} />
              <TextInput value={p.email || ''} onChange={(v) => setPerson(j, { email: v })} placeholder="Email" style={{ minWidth: 140, flex: 1 }} />
              <TextInput value={p.phone || ''} onChange={(v) => setPerson(j, { phone: v })} placeholder="Phone" style={{ minWidth: 120 }} />
              <Btn onClick={() => removePerson(j)} kind="danger">Remove</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DaysStep({ programId, days, setDays, saveDays }: { programId?: string; days: WizardDay[]; setDays: (d: WizardDay[]) => void; saveDays: () => Promise<void> }) {
  function update(i: number, patch: Partial<ProgramDayPayload>) {
    setDays(days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }
  if (!programId) {
    return <p className="muted">Save the program first to manage days.</p>
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Program days</h3>
        <Btn onClick={() => setDays([...days, { program: programId, day_number: days.length + 1, date: '', attendance_enabled: false, food_enabled: false }])}>+ Add day</Btn>
      </div>
      {days.length === 0 ? (
        <p className="muted">No days configured.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {days.map((d, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#fff' }}>
              <span className="badge" style={{ minWidth: 56, textAlign: 'center' }}>Day {d.day_number}</span>
              <TextInput type="date" value={d.date || ''} onChange={(v) => update(i, { date: v })} style={{ minWidth: 140 }} />
              <TextInput value={d.title || ''} onChange={(v) => update(i, { title: v })} placeholder="Title (optional)" style={{ minWidth: 160, flex: 1 }} />
              <TextInput type="time" value={d.start_time || ''} onChange={(v) => update(i, { start_time: v || undefined })} style={{ minWidth: 96 }} />
              <TextInput type="time" value={d.end_time || ''} onChange={(v) => update(i, { end_time: v || undefined })} style={{ minWidth: 96 }} />
              <Btn onClick={() => setDays(days.filter((_, idx) => idx !== i))} kind="danger">Remove</Btn>
              <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', borderTop: '1px dashed var(--border2)', paddingTop: 10, marginTop: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Services</span>
                {([
                  ['attendance', 'Attendance'],
                  ['food', 'Food'],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!d[`${key}_enabled`]}
                      onChange={(e) => update(i, { [`${key}_enabled`]: e.target.checked } as Partial<ProgramDayPayload>)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <DayResourcePersonsEditor day={d} i={i} update={update} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Btn onClick={saveDays}>Save days</Btn>
      </div>
    </div>
  )
}

function ReviewStep({ draft, program }: { draft: Record<string, any>; program: ProgramDetail | null }) {
  const rows: [string, any][] = [
    ['Title', draft.title],
    ['Short code', draft.short_code],
    ['Session', program?.academic_session_name],
    ['Type', program?.program_type_name],
    ['Organising dept', (program?.organizing_departments_detail || []).map((d: any) => d.name).join(', ') || draft.organizing_departments?.length],
    ['Venue', program?.venue_name || draft.venue_details],
    ['Dates', draft.start_date && draft.end_date ? `${draft.start_date} – ${draft.end_date}` : program?.start_date && program?.end_date ? `${program.start_date} – ${program.end_date}` : '—'],
    ['Days', draft.number_of_days ?? program?.number_of_days],
    ['Coordinator', program?.coordinator_name],
    ['Max participants', draft.max_participants ?? program?.max_participants ?? 'Unlimited'],
  ]
  return (
    <div>
      <h3 style={{ margin: '0 0 16px' }}>Review</h3>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted2" style={{ fontSize: 13 }}>{k}</span>
            <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{v || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function opt(m: MasterData): { value: string; label: string } {
  return { value: m.id, label: m.name }
}
