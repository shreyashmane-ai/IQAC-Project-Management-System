import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import {
  createParticipant,
  deleteParticipant,
  listParticipants,
  updateParticipant,
} from '../api/participants'
import { listMasterDataCategory } from '../api/programs'
import type { MasterData, Participant } from '../types'
import {
  Avatar,
  Btn,
  Err,
  PageHeader,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

interface FormState {
  full_name: string
  email: string
  mobile: string
  department: string
  designation: string
  employee_id: string
  institution: string
  city: string
  state: string
  consent_given: boolean
}

const EMPTY: FormState = {
  full_name: '',
  email: '',
  mobile: '',
  department: '',
  designation: '',
  employee_id: '',
  institution: '',
  city: '',
  state: '',
  consent_given: false,
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [depts, setDepts] = useState<MasterData[]>([])
  const [designations, setDesignations] = useState<MasterData[]>([])

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Participant | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listParticipants({ search: debounced || undefined })
      setParticipants(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load participants'))
    } finally {
      setLoading(false)
    }
  }, [debounced])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  useEffect(() => {
    ;(async () => {
      try {
        const [d, ds] = await Promise.all([
          listMasterDataCategory('ACADEMIC_DEPT'),
          listMasterDataCategory('DESIGNATION'),
        ])
        setDepts(d)
        setDesignations(ds)
      } catch {
        /* non-fatal */
      }
    })()
  }, [])

  function resetForm() {
    setForm(EMPTY)
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startCreate() {
    setEditing(null)
    setCreating((s) => !s)
    setForm(EMPTY)
    setSaveError(null)
  }

  function startEdit(p: Participant) {
    setCreating(false)
    setEditing(p)
    setForm({
      full_name: p.full_name,
      email: p.email,
      mobile: p.mobile || '',
      department: p.department || '',
      designation: p.designation || '',
      employee_id: p.employee_id || '',
      institution: p.institution || '',
      city: p.city || '',
      state: p.state || '',
      consent_given: !!p.consent_given,
    })
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim() || undefined,
      department: form.department || undefined,
      designation: form.designation || undefined,
      employee_id: form.employee_id.trim() || undefined,
      institution: form.institution.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      consent_given: form.consent_given,
    }
    try {
      if (editing) {
        await updateParticipant(editing.id, payload)
      } else {
        await createParticipant(payload)
      }
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update participant' : 'Failed to create participant'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Participant) {
    if (
      !(await confirmAsk({
        title: 'Delete participant',
        body: `Delete participant "${p.full_name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(p.id)
    setError(null)
    try {
      await deleteParticipant(p.id)
      toast.success('Participant deleted')
      if (editing?.id === p.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete participant'))
    } finally {
      setDeletingId(null)
    }
  }

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <PageHeader
        title="Participants"
        sub="Registered participants and their program registrations."
        actions={
          <>
            <TextInput placeholder="Search name / email / mobile…" value={search} onChange={setSearch} />
            <Btn onClick={startCreate}>{creating || editing ? 'Cancel' : 'Add participant'}</Btn>
          </>
        }
      />
      <Err msg={error} />

      {(creating || editing) && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>{editing ? `Edit ${editing.full_name}` : 'New participant'}</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Full name *</span>
              <TextInput value={form.full_name} onChange={(v) => set('full_name', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Email *</span>
              <TextInput value={form.email} onChange={(v) => set('email', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Mobile</span>
              <TextInput value={form.mobile} onChange={(v) => set('mobile', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Department</span>
              <TSelect
                value={form.department}
                onChange={(v) => set('department', v)}
                options={depts.map((d) => ({ value: d.id, label: d.name }))}
                allLabel="— None —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Designation</span>
              <TSelect
                value={form.designation}
                onChange={(v) => set('designation', v)}
                options={designations.map((d) => ({ value: d.id, label: d.name }))}
                allLabel="— None —"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Employee ID</span>
              <TextInput value={form.employee_id} onChange={(v) => set('employee_id', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Institution</span>
              <TextInput value={form.institution} onChange={(v) => set('institution', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>City</span>
              <TextInput value={form.city} onChange={(v) => set('city', v)} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>State</span>
              <TextInput value={form.state} onChange={(v) => set('state', v)} />
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={form.consent_given}
                onChange={(e) => set('consent_given', e.target.checked)}
              />
              <span>Consent given</span>
            </label>
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              onClick={handleSave}
              disabled={saving || !form.full_name.trim() || !form.email.trim()}
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : participants.length === 0 ? (
        <EmptyState icon="users" title="No participants yet" body="Registered participants will appear here." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
<DataTable
            rows={participants}
            rowKey={(p) => p.id}
            searchPlaceholder="Search participants…"
            search={(p, q) =>
              [p.full_name, p.email, p.department_name, p.registration_numbers?.join(' ')]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              {
                key: 'name',
                label: 'Name',
                sort: (p) => p.full_name,
                render: (p) => (
                  <Link to={`/participants/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="avatar-row">
                      <Avatar name={p.full_name} size={24} />
                      <b>{p.full_name}</b>
                    </span>
                  </Link>
                ),
              },
              { key: 'email', label: 'Email', render: (p) => <span className="muted">{p.email}</span> },
              { key: 'dept', label: 'Department', render: (p) => <span className="muted">{p.department_name || '—'}</span> },
              {
                key: 'regno',
                label: 'Registration No.',
                render: (p) => (
                  <span className="muted2">
                    {p.registration_numbers && p.registration_numbers.length > 0
                      ? p.registration_numbers.join(', ')
                      : '—'}
                  </span>
                ),
              },
              {
                key: 'consent',
                label: 'Consent',
                render: (p) =>
                  p.consent_given ? <span className="badge">Consented</span> : <span className="muted2">—</span>,
              },
            ]}
            actions={(p) => (
              <>
                <RowBtn kind="edit" onClick={() => startEdit(p)}>Edit</RowBtn>
                <RowBtn kind="del" onClick={() => handleDelete(p)} disabled={deletingId === p.id}>
                  {deletingId === p.id ? 'Deleting…' : 'Delete'}
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
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '13.5px' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
