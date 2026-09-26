import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import {
  activateSession,
  createSession,
  deleteSession,
  listSessions,
  updateSession,
} from '../api/programs'
import type { AcademicSession } from '../types'
import {
  Btn,
  Err,
  PageHeader,
  TextInput,
  RowBtn,
} from '../components/common'
import { fmtDate } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AcademicSession | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await listSessions()
      setSessions(page.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load sessions'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function handleActivate(id: string) {
    setActivating(id)
    setError(null)
    setNotice(null)
    try {
      await activateSession(id)
      setNotice('Session activated. Other sessions have been marked inactive.')
      toast.success('Session activated')
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to activate session'))
    } finally {
      setActivating(null)
    }
  }

  function resetForm() {
    setForm({ code: '', name: '', description: '', start_date: '', end_date: '' })
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startCreate() {
    if (creating || editing) {
      resetForm()
      return
    }
    setEditing(null)
    setCreating(true)
    setForm({ code: '', name: '', description: '', start_date: '', end_date: '' })
    setSaveError(null)
  }

  function startEdit(s: AcademicSession) {
    setCreating(false)
    setEditing(s)
    setForm({
      code: s.code,
      name: s.name,
      description: s.description || '',
      start_date: s.start_date || '',
      end_date: s.end_date || '',
    })
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        await updateSession(editing.id, {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
        })
      } else {
        await createSession({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update session' : 'Failed to create session'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: AcademicSession) {
    if (
      !(await confirmAsk({
        title: 'Delete session',
        body: `Delete session "${s.code}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(s.id)
    setError(null)
    try {
      await deleteSession(s.id)
      toast.success('Session deleted')
      if (editing?.id === s.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete session'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sessions"
        sub="Academic sessions that group programs. One session is active at a time."
        actions={<Btn onClick={startCreate}>{creating || editing ? 'Cancel' : 'New session'}</Btn>}
      />
      <Err msg={error} />
      {notice && <div className="noticebox" style={styles.mb}>{notice}</div>}

      {(creating || editing) && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>{editing ? `Edit session ${editing.code}` : 'New academic session'}</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Code *</span>
              <TextInput
                value={form.code}
                onChange={(v) => setForm((f) => ({ ...f, code: v }))}
                placeholder="e.g. 2026-27 (YYYY-YY)"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Name *</span>
              <TextInput
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Academic Year 2026-27"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Start date</span>
              <TextInput
                type="date"
                value={form.start_date}
                onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>End date</span>
              <TextInput
                type="date"
                value={form.end_date}
                onChange={(v) => setForm((f) => ({ ...f, end_date: v }))}
              />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Description (optional)</span>
              <TextInput
                value={form.description}
                onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              />
            </label>
          </div>
          <p className="muted2" style={styles.hint}>Leave dates blank to auto-derive from the code (Apr 1 – Mar 31).</p>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn onClick={handleSave} disabled={saving || !form.code.trim() || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : sessions.length === 0 ? (
        <EmptyState icon="calendar" title="No academic sessions yet" body="Create your first academic session to group programs." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
<DataTable
            rows={sessions}
            rowKey={(s) => s.id}
            searchPlaceholder="Search academic sessions…"
            search={(s, q) => [s.code, s.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))}
            columns={[
              { key: 'code', label: 'Code', sort: (s) => s.code, render: (s) => <b>{s.code}</b> },
              {
                key: 'name',
                label: 'Name',
                sort: (s) => s.name,
                render: (s) => (
                  <>
                    {s.name} {s.is_current && <span className="muted2" style={styles.current}>(current)</span>}
                  </>
                ),
              },
              {
                key: 'period',
                label: 'Period',
                sort: (s) => (s.start_date ? String(s.start_date) : ''),
                render: (s) => (
                  <span className="muted">
                    {fmtDate(s.start_date)} – {fmtDate(s.end_date)}
                  </span>
                ),
              },
              {
                key: 'programs',
                label: 'Programs',
                align: 'right',
                sort: (s) => s.program_count,
                render: (s) => <span className="muted2">{s.program_count}</span>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (s) =>
                  s.is_active ? (
                    <span className="pill"><span className="live"></span>Active</span>
                  ) : (
                    <span className="badge muted">Inactive</span>
                  ),
              },
            ]}
            actions={(s) => (
              <>
                {!s.is_active && !s.is_archived && (
                  <RowBtn kind="ok" onClick={() => handleActivate(s.id)} disabled={activating === s.id}>
                    {activating === s.id ? 'Activating…' : 'Activate'}
                  </RowBtn>
                )}
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
  mb: { marginBottom: '1rem' },
  current: { fontSize: '12px' },
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  hint: { fontSize: '12px', marginBottom: '0.75rem' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
