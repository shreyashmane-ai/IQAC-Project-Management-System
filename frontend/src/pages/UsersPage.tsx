import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  updateUser,
} from '../api/users'
import type { RoleOption, UserRow } from '../types'
import {
  Avatar,
  Btn,
  Err,
  PageHeader,
  TextInput,
  RowBtn,
} from '../components/common'
import { fmtDateTime, titleCase } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'V',
    password: '',
    password_confirm: '',
    is_active: true,
  })
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
      const [u, r] = await Promise.all([
        listUsers({ search: debounced || undefined }),
        listRoles(),
      ])
      setUsers(u.results)
      setRoles(r)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load users & roles'))
    } finally {
      setLoading(false)
    }
  }, [debounced])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function resetForm() {
    setForm({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: 'V',
      password: '',
      password_confirm: '',
      is_active: true,
    })
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
    setForm({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: 'V',
      password: '',
      password_confirm: '',
      is_active: true,
    })
    setSaveError(null)
  }

  function startEdit(u: UserRow) {
    setCreating(false)
    setEditing(u)
    setForm({
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      password: '',
      password_confirm: '',
      is_active: u.is_active,
    })
    setSaveError(null)
  }

  async function handleSave() {
    if (editing) {
      await handleUpdate()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
        password: form.password,
        password_confirm: form.password_confirm,
      })
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to create user'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateUser(editing.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
        is_active: form.is_active,
      })
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to update user'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserRow) {
    if (
      !(await confirmAsk({
        title: 'Delete user',
        body: `Delete user "${u.full_name || u.username}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(u.id)
    setError(null)
    try {
      await deleteUser(u.id)
      toast.success('User deleted')
      if (editing?.id === u.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete user'))
    } finally {
      setDeletingId(null)
    }
  }

  const roleOptions = roles.map((r) => ({ value: r.value, label: r.label }))

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        sub="System users, roles and track-program actions."
        actions={
          <>
            <TextInput placeholder="Search users…" value={search} onChange={setSearch} />
            <Btn onClick={startCreate}>{creating || editing ? 'Cancel' : 'Add user'}</Btn>
          </>
        }
      />
      <Err msg={error} />

      {roles.length > 0 && (
        <div style={styles.roles}>
          {roles.map((r) => (
            <div key={r.value} className="card" style={styles.roleCard}>
              <b>{r.label}</b>
              <span className="muted2" style={styles.small}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <div className="card" style={styles.formCard}>
          <h3 style={styles.cardTitle}>{editing ? `Edit ${editing.full_name || editing.username}` : 'New user'}</h3>
          <div style={styles.formGrid}>
            {!editing && (
              <>
                <label style={styles.field}>
                  <span style={styles.label}>Username *</span>
                  <TextInput value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Email *</span>
                  <TextInput value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                </label>
              </>
            )}
            <label style={styles.field}>
              <span style={styles.label}>First name *</span>
              <TextInput value={form.first_name} onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Last name *</span>
              <TextInput value={form.last_name} onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={styles.select}
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {!editing ? (
              <>
                <label style={styles.field}>
                  <span style={styles.label}>Password *</span>
                  <TextInput type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Confirm password *</span>
                  <TextInput type="password" value={form.password_confirm} onChange={(v) => setForm((f) => ({ ...f, password_confirm: v }))} />
                </label>
              </>
            ) : (
              <label style={styles.checkbox}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                <span>Active</span>
              </label>
            )}
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              onClick={handleSave}
              disabled={
                saving ||
                !form.first_name.trim() ||
                !form.last_name.trim() ||
                (!editing && (!form.username.trim() || !form.email.trim() || !form.password || form.password !== form.password_confirm))
              }
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : users.length === 0 ? (
        <EmptyState icon="users" title="No users yet" body="Users you add will appear here." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="cardhead">
            <h3>Users</h3>
          </div>
<DataTable
            rows={users}
            rowKey={(u) => u.id}
            searchPlaceholder="Search users…"
            search={(u, q) =>
              [u.full_name, u.username, u.email, u.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              {
                key: 'name',
                label: 'Name',
                sort: (u) => u.full_name || u.username,
                render: (u) => (
                  <span className="avatar-row">
                    <Avatar name={u.full_name || u.username} size={24} />
                    <b>{u.full_name || u.username}</b>
                  </span>
                ),
              },
              { key: 'email', label: 'Email', render: (u) => <span className="muted">{u.email}</span> },
              { key: 'role', label: 'Role', render: (u) => <span className="badge">{u.role_display || titleCase(u.role)}</span> },
              {
                key: 'status',
                label: 'Status',
                render: (u) =>
                  u.is_active ? <span className="badge">Active</span> : <span className="badge muted">Inactive</span>,
              },
              {
                key: 'lastlogin',
                label: 'Last Login',
                sort: (u) => (u.last_login ? String(u.last_login) : ''),
                render: (u) => <span className="muted">{fmtDateTime(u.last_login)}</span>,
              },
            ]}
            actions={(u) => (
              <>
                <RowBtn kind="edit" onClick={() => startEdit(u)}>Edit</RowBtn>
                <RowBtn
                  kind="del"
                  onClick={() => handleDelete(u)}
                  disabled={deletingId === u.id}
                >
                  {deletingId === u.id ? 'Deleting…' : 'Delete'}
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
  roles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: '1.25rem' },
  roleCard: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  small: { fontSize: 11 },
  tpCard: { marginTop: '1rem', padding: '18px' },
  cardTitle: { marginBottom: '0.5rem' },
  formCard: { padding: '18px', marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
  },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '13.5px' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
