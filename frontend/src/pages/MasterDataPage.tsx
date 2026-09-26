import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import {
  createMaster,
  deleteMaster,
  listMaster,
  updateMaster,
} from '../api/programs'
import {
  findMaster,
  MASTERS,
  type MasterData,
  type MasterDef,
  type MasterFieldDef,
} from '../types'
import {
  Btn,
  Err,
  PageHeader,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { titleCase } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

function toStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function fromStr(value: string, def: MasterFieldDef): unknown {
  switch (def.type) {
    case 'number':
      return value === '' ? null : Number(value)
    case 'boolean':
      return value === 'true'
    case 'json':
      if (!value.trim()) return {}
      try {
        return JSON.parse(value)
      } catch {
        return value.trim()
      }
    default:
      return value
  }
}

function initValue(def: MasterFieldDef): string {
  if (def.type === 'boolean') return 'false'
  return ''
}

const BASE_DEFS: MasterFieldDef[] = [
  { key: 'code', label: 'Code', type: 'text', placeholder: 'e.g. CSE' },
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Display name' },
  { key: 'description', label: 'Description (optional)', type: 'textarea' },
]

export default function MasterDataPage() {
  const { key = '' } = useParams()
  const master = useMemo<MasterDef>(() => findMaster(key) || MASTERS[0], [key])
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [items, setItems] = useState<MasterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<MasterData | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const baseDefs = BASE_DEFS
  const allDefs = [...baseDefs, ...master.fields]
  const tableFields = master.fields.some((f) => f.table) ? master.fields.filter((f) => f.table) : master.fields

  const blankForm = useCallback(() => {
    const f: Record<string, string> = { code: '', name: '', description: '' }
    for (const d of master.fields) f[d.key] = initValue(d)
    return f
  }, [master.fields])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await listMaster(master.key, { search: search || undefined })
      setItems(page.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load records'))
    } finally {
      setLoading(false)
    }
  }, [master.key, search])

  useEffect(() => {
    setForm(blankForm())
    resetFormState()
    setSearch('')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master.key])

  function resetFormState() {
    setEditing(null)
    setCreating(false)
    setSaveError(null)
  }

  function resetForm() {
    setForm(blankForm())
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startCreate() {
    if (creating || editing) return resetForm()
    resetForm()
    setCreating(true)
  }

  function startEdit(it: MasterData) {
    setCreating(false)
    setEditing(it)
    const f: Record<string, string> = {}
    for (const d of allDefs) f[d.key] = toStr(it[d.key])
    setForm(f)
    setSaveError(null)
  }

  function buildPayload(): Record<string, unknown> {
    const p: Record<string, unknown> = { code: form.code?.trim() || '', name: form.name?.trim() || '' }
    if (form.description != null) p.description = form.description.trim()
    for (const d of master.fields) p[d.key] = fromStr(form[d.key] ?? '', d)
    return p
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = buildPayload()
      if (editing) {
        await updateMaster(master.key, editing.id, payload)
      } else {
        await createMaster(master.key, payload)
      }
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update' : 'Failed to create'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(it: MasterData) {
    if (
      !(await confirmAsk({
        title: `Delete ${master.label.toLowerCase()}`,
        body: `Delete "${it.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(it.id)
    setError(null)
    try {
      await deleteMaster(master.key, it.id)
      toast.success(`${master.label} deleted`)
      if (editing?.id === it.id) resetForm()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete'))
    } finally {
      setDeletingId(null)
    }
  }

  function renderInput(def: MasterFieldDef, value: string) {
    const set = (v: string) => setForm((f) => ({ ...f, [def.key]: v }))
    const style = def.type === 'textarea' || def.type === 'json' ? { minHeight: 70, resize: 'vertical' as const } : undefined
    switch (def.type) {
      case 'boolean':
        return (
          <TSelect
            value={value}
            onChange={set}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
        )
      case 'select':
        return (
          <TSelect
            value={value}
            onChange={set}
            options={def.options ?? []}
            allLabel={(def.options ?? []).some((o) => o.value === '') ? undefined : '— Select —'}
          />
        )
      case 'json':
      case 'textarea':
        return <TextInput value={value} onChange={set} style={{ ...style, width: '100%' }} />
      case 'number':
        return (
          <TextInput
            type="number"
            value={value}
            onChange={set}
            placeholder={def.placeholder}
          />
        )
      default:
        return <TextInput type={def.type} value={value} onChange={set} placeholder={def.placeholder} />
    }
  }

  return (
    <div>
      <PageHeader
        title={`Master Data — ${master.label}`}
        sub={master.description}
        actions={
          <Btn onClick={startCreate}>{creating || editing ? 'Cancel' : `Add ${titleCase(master.label)}`}</Btn>
        }
      />

      <div style={styles.subnav}>
        {MASTERS.map((m) => (
          <NavLink
            key={m.key}
            to={`/master-data/${m.key}`}
            className={({ isActive }) => (isActive ? 'subnav-link active' : 'subnav-link')}
          >
            {m.plural}
          </NavLink>
        ))}
      </div>

      <div style={styles.toolbar}>
        <TextInput
          placeholder="Search name / code…"
          value={search}
          onChange={(v) => setSearch(v)}
          style={{ flex: 1 }}
        />
      </div>

      <Err msg={error} />

      {(creating || editing) && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>
            {editing ? `Edit ${master.label}` : `Add ${master.label}`}
          </h3>
          <div style={styles.formGrid}>
            {allDefs.map((d) => (
              <label
                key={d.key}
                style={
                  d.type === 'textarea'
                    ? { ...styles.field, gridColumn: '1 / -1' }
                    : styles.field
                }
              >
                <span style={styles.label}>
                  {d.label}
                  {d.help ? <em style={styles.help}>{d.help}</em> : null}
                </span>
                {renderInput(d, form[d.key] ?? '')}
              </label>
            ))}
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn onClick={handleSave} disabled={saving || !form.code?.trim() || !form.name?.trim()}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <EmptyState icon="inbox" title={`No ${master.plural.toLowerCase()} yet`} body="Records you add will appear here." />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
<DataTable
              rows={items}
              rowKey={(it) => it.id}
              searchPlaceholder={`Search ${master.plural}…`}
              search={(it, q) =>
                [it.name, it.code, ...master.fields.map((f) => toStr(it[f.key]) || '')]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(q))
              }
              columns={[
                { key: 'name', label: 'Name', sort: (it) => it.name, render: (it) => <b>{it.name}</b> },
                { key: 'code', label: 'Code', sort: (it) => it.code, render: (it) => <span className="muted2">{it.code}</span> },
                ...tableFields.map((f) => ({
                  key: f.key,
                  label: f.label,
                  render: (it: MasterData) => (f.type === 'boolean' ? (it[f.key] ? 'Yes' : 'No') : toStr(it[f.key]) || '—'),
                })),
                {
                  key: 'status',
                  label: 'Status',
                  render: (it) => (
                    <span className={`badge ${it.is_active ? '' : 'muted'}`}>
                      {it.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ),
                },
              ]}
              actions={(it) => (
                <>
                  <RowBtn kind="edit" onClick={() => startEdit(it)}>Edit</RowBtn>
                  <RowBtn
                    kind="del"
                    onClick={() => handleDelete(it)}
                    disabled={deletingId === it.id}
                  >
                    {deletingId === it.id ? 'Deleting…' : 'Delete'}
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
  subnav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginBottom: '1.25rem',
  },
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' },
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  help: { fontSize: '11.5px', fontWeight: 400, color: 'var(--muted)', marginLeft: 6 },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
