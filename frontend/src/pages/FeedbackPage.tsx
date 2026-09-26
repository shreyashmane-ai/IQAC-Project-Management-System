import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import {
  createFeedbackInstance,
  deleteFeedbackInstance,
  getFeedbackAnalytics,
  listFeedbackInstances,
  updateFeedbackInstance,
} from '../api/feedback'
import { listProgramDays, listPrograms } from '../api/programs'
import type { FeedbackAnalytics, FeedbackInstance, ProgramListItem } from '../types'
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

const SCOPES = ['PROGRAM', 'DAY']

export default function FeedbackPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [days, setDays] = useState<{ id: string; day_number: number }[]>([])
  const [instances, setInstances] = useState<FeedbackInstance[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FeedbackInstance | null>(null)
  const [form, setForm] = useState({
    scope: SCOPES[0],
    title: '',
    description: '',
    day: '',
    is_anonymous: false,
    allow_multiple: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      const d = await listProgramDays(programId)
      setDays(d.map((x) => ({ id: x.id, day_number: x.day_number })))
    } catch {
      setDays([])
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(loadDays)
  }, [loadDays])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listFeedbackInstances({ program: programId || undefined })
      setInstances(data.results)
      if (data.results.length > 0) setSelectedId(data.results[0].id)
      else setSelectedId('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load feedback instances'))
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const loadAnalytics = useCallback(async () => {
    if (!selectedId) {
      setAnalytics(null)
      return
    }
    setAnalyticsLoading(true)
    setError(null)
    try {
      setAnalytics(await getFeedbackAnalytics(selectedId))
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load feedback analytics'))
    } finally {
      setAnalyticsLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void Promise.resolve().then(loadAnalytics)
  }, [loadAnalytics])

  const selected = instances.find((i) => i.id === selectedId) || null

  function resetForm() {
    setForm({
      scope: SCOPES[0],
      title: '',
      description: '',
      day: '',
      is_anonymous: false,
      allow_multiple: false,
    })
    setSaveError(null)
    setCreating(false)
    setEditing(null)
  }

  function startCreate() {
    setEditing(null)
    setCreating((s) => !s)
    setForm({
      scope: SCOPES[0],
      title: '',
      description: '',
      day: '',
      is_anonymous: false,
      allow_multiple: false,
    })
    setSaveError(null)
  }

  function startEdit(i: FeedbackInstance) {
    setCreating(false)
    setEditing(i)
    setForm({
      scope: SCOPES.includes(i.scope) ? i.scope : 'PROGRAM',
      title: i.title,
      description: i.description || '',
      day: i.day || '',
      is_anonymous: i.is_anonymous,
      allow_multiple: i.allow_multiple,
    })
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        await updateFeedbackInstance(editing.id, {
          scope: form.scope,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          day: form.scope === 'DAY' ? form.day || null : null,
          is_anonymous: form.is_anonymous,
          allow_multiple: form.allow_multiple,
        })
      } else {
        await createFeedbackInstance({
          program: programId,
          scope: form.scope,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          day: form.scope === 'DAY' ? form.day || null : null,
          is_anonymous: form.is_anonymous,
          allow_multiple: form.allow_multiple,
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, editing ? 'Failed to update feedback instance' : 'Failed to create feedback instance'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(i: FeedbackInstance) {
    if (
      !(await confirmAsk({
        title: 'Delete feedback instance',
        body: `Delete feedback instance "${i.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(i.id)
    setError(null)
    try {
      await deleteFeedbackInstance(i.id)
      toast.success('Feedback instance deleted')
      if (editing?.id === i.id) resetForm()
      if (selectedId === i.id) setSelectedId('')
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete feedback instance'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Feedback" sub="Feedback instances, responses and analytics." />
      <div style={styles.toolbar}>
        <TSelect
          value={programId}
          onChange={(v) => {
            setProgramId(v)
            setSelectedId('')
          }}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 320 }}
          allLabel="All programs"
        />
        <Btn onClick={startCreate}>{creating || editing ? 'Cancel' : 'Add instance'}</Btn>
      </div>
      <Err msg={error} />

      {(creating || editing) && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>{editing ? 'Edit feedback instance' : 'New feedback instance'}</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Scope *</span>
              <TSelect
                value={form.scope}
                onChange={(v) => setForm((f) => ({ ...f, scope: v, ...(v !== 'DAY' ? { day: '' } : {}) }))}
                options={SCOPES.map((s) => ({ value: s, label: titleCase(s) }))}
              />
            </label>
            {form.scope === 'DAY' && (
              <label style={styles.field}>
                <span style={styles.label}>Day *</span>
                <TSelect
                  value={form.day}
                  onChange={(v) => setForm((f) => ({ ...f, day: v }))}
                  options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number}` }))}
                  allLabel={days.length === 0 ? 'No days available' : undefined}
                />
              </label>
            )}
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Title *</span>
              <TextInput value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Description (optional)</span>
              <TextInput value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" checked={form.is_anonymous} onChange={(e) => setForm((f) => ({ ...f, is_anonymous: e.target.checked }))} />
              <span>Anonymous</span>
            </label>
            <label style={styles.checkbox}>
              <input type="checkbox" checked={form.allow_multiple} onChange={(e) => setForm((f) => ({ ...f, allow_multiple: e.target.checked }))} />
              <span>Allow multiple responses</span>
            </label>
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              onClick={handleSave}
              disabled={saving || !form.title.trim() || (form.scope === 'DAY' && !form.day)}
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Btn>
            <Btn kind="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : instances.length === 0 ? (
        <EmptyState icon="feedback" title="No feedback instances yet" body="Create a feedback instance to start collecting responses." />
      ) : (
        <>
          <div className="card" style={{ padding: 0 }}>
            <div className="cardhead">
              <h3>Instances</h3>
            </div>
            <DataTable
              rows={instances}
              rowKey={(i) => i.id}
              rowClassName={(i) => (selectedId === i.id ? 'dt-row-active' : undefined)}
              searchPlaceholder="Search feedback…"
              search={(i, q) => [i.title, i.scope].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))}
              columns={[
                {
                  key: 'title',
                  label: 'Title',
                  sort: (i) => i.title,
                  render: (i) => (
                    <>
                      <b>{i.title}</b>
                      {i.day_number ? <div className="muted2" style={styles.small}>Day {i.day_number}</div> : null}
                    </>
                  ),
                },
                { key: 'scope', label: 'Scope', render: (i) => <span className="muted">{titleCase(i.scope)}</span> },
                {
                  key: 'responses',
                  label: 'Responses',
                  align: 'right',
                  sort: (i) => i.response_count,
                  render: (i) => <span className="muted2">{i.response_count}</span>,
                },
                { key: 'status', label: 'Status', render: (i) => <span className="badge">{i.status_display || titleCase(i.status)}</span> },
              ]}
              actions={(i) => (
                <>
                  <RowBtn kind="edit" onClick={() => startEdit(i)}>Edit</RowBtn>
                  <RowBtn kind="del" onClick={() => handleDelete(i)} disabled={deletingId === i.id}>
                    {deletingId === i.id ? 'Deleting…' : 'Delete'}
                  </RowBtn>
                  <RowBtn kind="plain" icon="chart" onClick={() => setSelectedId(i.id)}>
                    Analytics
                  </RowBtn>
                </>
              )}
            />
          </div>

          {analyticsLoading ? (
            <Loading />
          ) : analytics && selected ? (
            <div className="card" style={styles.analyticsCard}>
              <div className="cardhead">
                <div>
                  <h3>{analytics.feedback_title || selected.title}</h3>
                  <div className="sub muted">Analytics</div>
                </div>
              </div>
              <div className="statgrid" style={styles.mb}>
                <Stat label="Responses" value={analytics.total_responses} />
                <Stat label="Completion Rate" value={`${analytics.completion_rate}%`} />
                <Stat label="Avg Rating" value={analytics.average_rating ?? '—'} sub="across rating questions" />
              </div>

              {analytics.rating_distribution && Object.keys(analytics.rating_distribution).length > 0 && (
                <div style={styles.mb}>
                  <h4 style={styles.subhead}>Rating Distribution</h4>
                  <div style={styles.ratingBars}>
                    {Object.entries(analytics.rating_distribution)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([rating, count]) => {
                        const max = Math.max(...Object.values(analytics.rating_distribution!))
                        return (
                          <div key={rating} style={styles.ratingRow}>
                            <span style={styles.ratingLabel}>{rating}★</span>
                            <div style={styles.barTrack}>
                              <div style={{ ...styles.barFill, width: `${max ? (Number(count) / max) * 100 : 0}%` }}></div>
                            </div>
                            <span className="muted2" style={styles.ratingCount}>{count}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {analytics.comments && analytics.comments.length > 0 && (
                <div>
                  <h4 style={styles.subhead}>Comments</h4>
                  <div style={styles.comments}>
                    {analytics.comments.map((c, idx) => (
                      <blockquote key={idx} style={styles.comment}>
                        <p>{c.comment}</p>
                        {c.participant && <footer className="muted2">— {c.participant}</footer>}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  mb: { marginBottom: '1rem' },
  small: { fontSize: 12 },
  activeRow: { background: '#f8fafc' },
  analyticsCard: { marginTop: '1rem', padding: '18px' },
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '13.5px' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
  subhead: { fontSize: '13px', fontWeight: 700, marginBottom: '0.75rem' },
  ratingBars: { display: 'flex', flexDirection: 'column', gap: 8 },
  ratingRow: { display: 'flex', alignItems: 'center', gap: 12 },
  ratingLabel: { width: 40, fontSize: 13, fontWeight: 600 },
  barTrack: { flex: 1, height: 8, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--primary)', borderRadius: 999 },
  ratingCount: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: 600 },
  comments: { display: 'flex', flexDirection: 'column', gap: 10 },
  comment: {
    borderLeft: '3px solid var(--primary)',
    background: '#f8fafc',
    padding: '10px 14px',
    borderRadius: 8,
    margin: 0,
  },
}
