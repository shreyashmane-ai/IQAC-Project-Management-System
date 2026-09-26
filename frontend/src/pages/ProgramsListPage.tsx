import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import {
  createProgram,
  deleteProgram,
  listMasterActive,
  listMasterDataCategory,
  listPrograms,
  listSessions,
  updateProgram,
  type ProgramListParams,
} from '../api/programs'
import { listUsers } from '../api/users'
import type { AcademicSession, MasterData, ProgramListItem, UserRow } from '../types'
import { Btn, Err, MultiSelect, PageHeader, RichTextEditor, RowBtn, TSelect, TextInput } from '../components/common'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REG_OPEN', label: 'Registration Open' },
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'COMPLETED', label: 'Completed' },
]

interface FormState {
  title: string
  academic_session: string
  program_type: string
  organizing_departments: string[]
  venue: string
  start_date: string
  end_date: string
  number_of_days: string
  start_time: string
  end_time: string
  program_coordinator: string
  max_participants: string
  objective: string
  description: string
}

const EMPTY: FormState = {
  title: '',
  academic_session: '',
  program_type: '',
  organizing_departments: [],
  venue: '',
  start_date: '',
  end_date: '',
  number_of_days: '1',
  start_time: '',
  end_time: '',
  program_coordinator: '',
  max_participants: '',
  objective: '',
  description: '',
}

export default function ProgramsListPage() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [programTypes, setProgramTypes] = useState<MasterData[]>([])
  const [venues, setVenues] = useState<MasterData[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  const [deptType, setDeptType] = useState('')
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [academicDepts, setAcademicDepts] = useState<MasterData[]>([])
  const [adminDepts, setAdminDepts] = useState<MasterData[]>([])

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProgramListItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formDeptType, setFormDeptType] = useState<'academic' | 'admin'>('academic')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params: ProgramListParams = {}
    if (status) params.status = status
    if (debouncedSearch) params.search = debouncedSearch
    if (selectedDepts.length) params.departments = selectedDepts
    try {
      const data = await listPrograms(params)
      setPrograms(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    } finally {
      setLoading(false)
    }
  }, [status, debouncedSearch, selectedDepts])

  const [prevDeptType, setPrevDeptType] = useState(deptType)
  if (prevDeptType !== deptType) {
    setPrevDeptType(deptType)
    setSelectedDepts([])
  }

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  useEffect(() => {
    ;(async () => {
      try {
        const [s, t, v, u, acad, adm] = await Promise.all([
          listSessions({ active: true }),
          listMasterDataCategory('PROGRAM_TYPE'),
          listMasterDataCategory('VENUE'),
          listUsers(),
          listMasterActive('academic-departments'),
          listMasterActive('admin-departments'),
        ])
        setSessions(s.results)
        setProgramTypes(t)
        setVenues(v)
        setUsers(u.results)
        setAcademicDepts(acad)
        setAdminDepts(adm)
      } catch {
        /* non-fatal */
      }
    })()
  }, [])

  function onSearch(e: ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
  }

  function onStatus(e: ChangeEvent<HTMLSelectElement>) {
    setStatus(e.target.value)
  }

  function onDeptType(e: ChangeEvent<HTMLSelectElement>) {
    setDeptType(e.target.value)
  }

  function resetForm() {
    setForm(EMPTY)
    setFormDeptType('academic')
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startEdit(p: ProgramListItem) {
    setCreating(false)
    setEditing(p)
    setForm({
      title: p.title,
      academic_session: p.academic_session,
      program_type: p.program_type,
      organizing_departments: p.organizing_departments || [],
      venue: p.venue || '',
      start_date: p.start_date,
      end_date: p.end_date,
      number_of_days: String(p.number_of_days),
      start_time: p.start_time || '',
      end_time: p.end_time || '',
      program_coordinator: p.program_coordinator ? String(p.program_coordinator) : '',
      max_participants: p.max_participants ? String(p.max_participants) : '',
      objective: p.objective || '',
      description: p.description || '',
    })
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const academicIds = new Set(academicDepts.map((d) => d.id))
    const organizing = (form.organizing_departments || []).filter((id) => academicIds.has(id))
    const dropped = (form.organizing_departments || []).filter((id) => !academicIds.has(id))
    const number_of_days = form.number_of_days ? Number(form.number_of_days) : 1
    const base = {
      title: form.title.trim(),
      academic_session: form.academic_session || undefined,
      program_type: form.program_type || undefined,
      organizing_departments: organizing.length ? organizing : undefined,
      venue: form.venue || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      number_of_days,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      program_coordinator: form.program_coordinator || undefined,
      max_participants: form.max_participants ? Number(form.max_participants) : undefined,
      objective: form.objective.trim() || undefined,
      description: form.description.trim() || undefined,
    }
    try {
      if (editing) {
        await updateProgram(editing.id, base)
      } else {
        await createProgram(base)
      }
      if (dropped.length) toast.info('Administrative departments were removed from Organising departments — only academic departments can be saved there.')
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update program' : 'Failed to create program'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: ProgramListItem) {
    if (
      !(await confirmAsk({
        title: 'Delete program',
        body: `Delete program "${p.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(p.id)
    setError(null)
    try {
      await deleteProgram(p.id)
      toast.success('Program deleted')
      if (editing?.id === p.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete program'))
    } finally {
      setDeletingId(null)
    }
  }

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <PageHeader
        title="Programs"
        sub={`${programs.length} program(s) in the system.`}
        actions={<Btn onClick={() => navigate('/programs/wizard')}>New program</Btn>}
      />

      <div style={styles.toolbar}>
        <input
          type="search"
          placeholder="Search by title or short code…"
          value={search}
          onChange={onSearch}
          style={styles.search}
        />
        <select value={status} onChange={onStatus} style={styles.select}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={deptType} onChange={onDeptType} style={styles.select}>
          <option value="">All departments</option>
          <option value="ACADEMIC">Academic departments</option>
          <option value="ADMINISTRATIVE">Administrative departments</option>
        </select>
        <div style={styles.deptFilter}>
          <MultiSelect
            value={selectedDepts}
            onChange={setSelectedDepts}
            options={
              (deptType === 'ADMINISTRATIVE' ? adminDepts : deptType === 'ACADEMIC' ? academicDepts : [...academicDepts, ...adminDepts]).map((d) => ({ value: d.id, label: d.name }))
            }
            placeholder="Pick organizing department(s)…"
          />
        </div>
      </div>

      {error && <div className="errorbox" style={styles.marginBottom}>{error}</div>}

      {(creating || editing) && (
        <div className="card" style={styles.formCard}>
          <h3 style={styles.formTitle}>{editing ? `Edit ${editing.short_code}` : 'New program'}</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Title *</span>
              <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Program title" />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Academic session *</span>
              <TSelect
                value={form.academic_session}
                onChange={(v) => set('academic_session', v)}
                options={sessions.map((s) => ({ value: s.id, label: `${s.code}${s.is_active ? ' (active)' : ''}` }))}
                allLabel="— Select session —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Program type *</span>
              <TSelect
                value={form.program_type}
                onChange={(v) => set('program_type', v)}
                options={programTypes.map((t) => ({ value: t.id, label: t.name }))}
                allLabel="— Select type —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Organizing dept type *</span>
              <TSelect
                value={formDeptType}
                onChange={(v) => setFormDeptType(v === 'admin' ? 'admin' : 'academic')}
                options={[
                  { value: 'academic', label: 'Academic departments' },
                  { value: 'admin', label: 'Administrative departments' },
                ]}
              />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Organizing departments *</span>
              <MultiSelect
                value={form.organizing_departments}
                onChange={(v) => setForm((f) => ({ ...f, organizing_departments: v }))}
                options={(formDeptType === 'admin' ? adminDepts : academicDepts).map((d) => ({ value: d.id, label: d.name }))}
                placeholder="Select one or more departments…"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Venue</span>
              <TSelect
                value={form.venue}
                onChange={(v) => set('venue', v)}
                options={venues.map((v) => ({ value: v.id, label: v.name }))}
                allLabel="— None —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Program coordinator *</span>
              <TSelect
                value={form.program_coordinator}
                onChange={(v) => set('program_coordinator', v)}
                options={users.map((u) => ({ value: String(u.id), label: u.full_name || u.username }))}
                allLabel="— Select coordinator —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Number of days *</span>
              <TextInput type="number" value={form.number_of_days} onChange={(v) => set('number_of_days', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Start date *</span>
              <TextInput type="date" value={form.start_date} onChange={(v) => set('start_date', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>End date *</span>
              <TextInput type="date" value={form.end_date} onChange={(v) => set('end_date', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Start time *</span>
              <TextInput type="time" value={form.start_time} onChange={(v) => set('start_time', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>End time *</span>
              <TextInput type="time" value={form.end_time} onChange={(v) => set('end_time', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Max participants</span>
              <TextInput type="number" value={form.max_participants} onChange={(v) => set('max_participants', v)} />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Objective</span>
              <RichTextEditor value={form.objective} onChange={(v) => set('objective', v)} placeholder="What is the objective of this program?" />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Description</span>
              <RichTextEditor value={form.description} onChange={(v) => set('description', v)} placeholder="Describe the program…" />
            </label>
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              onClick={handleSave}
              disabled={
                saving ||
                !form.title.trim() ||
                !form.academic_session ||
                !form.program_type ||
                !form.organizing_departments?.length ||
                !form.program_coordinator ||
                !form.start_date ||
                !form.end_date ||
                !form.start_time ||
                !form.end_time
              }
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : programs.length === 0 ? (
        <EmptyState icon="inbox" title="No programs found" body="Try adjusting your search or status filter." />
      ) : (
        <div style={styles.grid}>
          {programs.map((p) => (
            <div key={p.id} className="card" style={styles.card}>
              <div style={styles.cardTop}>
                <span className={`badge ${p.status}`}>{p.status_display}</span>
                <span className="muted2" style={styles.code}>{p.short_code}</span>
              </div>
              <Link to={`/programs/${p.id}`} style={styles.cardLink}>
                <h3 style={styles.cardTitle}>{p.title}</h3>
              </Link>
              <div className="muted" style={styles.meta}>
                <span>{p.academic_session_code}</span>
                <span>•</span>
                <span>{p.program_type_name}</span>
              </div>
              <div className="muted" style={styles.meta}>
                <span>{(p.organizing_departments_detail || []).map((d) => d.name).join(', ')}</span>
              </div>
              <div style={styles.cardFooter}>
                <span>
                  {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                </span>
                <span style={styles.stats}>
                  {p.day_count} days • {p.registration_count} registered
                </span>
              </div>
<div className="tbl-acts" style={{ marginTop: 8 }}>
                <RowBtn kind="edit" onClick={() => startEdit(p)}>Edit</RowBtn>
                <RowBtn kind="del" onClick={() => handleDelete(p)} disabled={deletingId === p.id}>
                  {deletingId === p.id ? 'Deleting…' : 'Delete'}
                </RowBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' },
  search: {
    flex: 1,
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
  },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
  },
  deptFilter: {
    flex: '1 1 100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: '#fff',
  },
  marginBottom: { marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '16px',
  },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: '12px', fontWeight: 600 },
  cardLink: { textDecoration: 'none', color: 'inherit' },
  cardTitle: { fontSize: '16px', letterSpacing: '-.2px' },
  meta: { fontSize: '13px', display: 'flex', gap: 6, flexWrap: 'wrap' },
  cardFooter: {
    paddingTop: '12px',
    borderTop: '1px solid var(--border2)',
    color: 'var(--muted)',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  stats: { color: 'var(--muted2)', fontSize: '12px' },
  formCard: { padding: '18px', marginBottom: '1rem' },
  formTitle: { marginBottom: '0.75rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  cardActions: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '8px' },
  open: {
    marginLeft: 'auto',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--primary)',
    textDecoration: 'none',
  },
}
