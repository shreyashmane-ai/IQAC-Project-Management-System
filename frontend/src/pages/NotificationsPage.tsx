import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { listPrograms } from '../api/programs'
import {
  listNotificationBatches,
  listNotificationTemplates,
  sendNotificationBatch,
  type NotificationBatch,
  type NotificationTemplate,
} from '../api/notifications'
import type { ProgramListItem } from '../types'
import { Btn, Err, Loading, PageHeader, TSelect, TextInput } from '../components/common'
import { fmtDateTime } from '../utils/date'

const CHANNELS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PUSH', label: 'Push' },
] as const

export default function NotificationsPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [batches, setBatches] = useState<NotificationBatch[]>([])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [trigger, setTrigger] = useState('CUSTOM')

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    try {
      const data = await listPrograms()
      setPrograms(data.results)
      if (data.results.length) setProgramId(data.results[0].id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadPrograms)
  }, [loadPrograms])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, b] = await Promise.all([
        listNotificationTemplates(),
        listNotificationBatches({ program: programId || undefined }),
      ])
      setTemplates(t.results)
      setBatches(b.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load notifications'))
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function reset() {
    setTitle('')
    setBody('')
    setChannel('EMAIL')
    setTrigger('CUSTOM')
    setNotice(null)
    setError(null)
  }

  async function handleSend() {
    if (!programId) return
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      await sendNotificationBatch({
        program_id: programId,
        channel: channel as (typeof CHANNELS)[number]['value'],
        trigger: trigger === 'CUSTOM' ? undefined : trigger,
        title: (trigger === 'CUSTOM' && title.trim()) || undefined,
        body: (trigger === 'CUSTOM' && body.trim()) || undefined,
      })
      setNotice('Notification batch queued. All approved/submitted participants will be messaged.')
      reset()
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to send notification'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" sub="Compose and dispatch bulk notifications to program participants." />
      <Err msg={error} />
      {notice && <div className="noticebox" style={styles.mb}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <section className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>Send notifications</h3>
          <div style={styles.fieldGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Program *</span>
              <TSelect
                value={programId}
                onChange={setProgramId}
                options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
                allLabel="Select program…"
                style={{ width: '100%' }}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Channel</span>
              <TSelect value={channel} onChange={setChannel} options={[...CHANNELS]} style={{ width: '100%' }} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Trigger / template</span>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                style={styles.select}
              >
                <option value="CUSTOM">Custom message</option>
                {templates.filter((t) => t.is_active).map((t) => (
                  <option key={t.id} value={t.trigger}>{t.trigger_display}</option>
                ))}
              </select>
            </label>
            <span />
            {trigger === 'CUSTOM' && (
              <>
                <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <span style={styles.label}>Subject / title</span>
                  <TextInput value={title} onChange={setTitle} placeholder="e.g. Program reminder" />
                </label>
                <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
                  <span style={styles.label}>Body</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    placeholder="Message body…"
                    style={styles.textarea}
                  />
                </label>
              </>
            )}
          </div>
          <p className="muted2" style={styles.hint}>
            Sends to all participants with APPROVED or SUBMITTED registrations for this program.
          </p>
          <Btn onClick={handleSend} disabled={sending || !programId || (trigger === 'CUSTOM' && !body.trim())}>
            {sending ? 'Queueing…' : 'Send notification batch'}
          </Btn>
        </section>

        <section className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>How it works</h3>
          <ul style={styles.list}>
            <li>Pick the program and channel (Email is active by default).</li>
            <li>Either choose a system <b>template</b> (e.g. Registration Confirmation, Food QR, Certificate) or write a <b>custom</b> message.</li>
            <li>The batch creates an individual message per participant with deduplication, so participants never get the same notification twice for a batch.</li>
            <li>Delivery status is tracked per message and shown when you re-open this page (idempotent, with retries).</li>
          </ul>
        </section>
      </div>

      <h3 style={styles.subhead}>Recent batches</h3>
      {loading ? (
        <Loading />
      ) : batches.length === 0 ? (
        <p className="muted">No notification batches sent yet.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Template / Channel</th>
                <th>Status</th>
                <th>Total</th>
                <th>Sent / Failed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.program_title || '—'}</b></td>
                  <td className="muted">
                    {b.template_name || 'Custom'} <span className="muted2">({b.trigger_display || '–'})</span>
                  </td>
                  <td><span className="badge">{b.status_display}</span></td>
                  <td className="muted2">{b.total}</td>
                  <td>
                    <span style={{ color: 'var(--success-d)' }}>{b.sent} sent</span>
                    {b.failed > 0 && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>{b.failed} failed</span>}
                  </td>
                  <td className="muted">{fmtDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  mb: { marginBottom: '1rem' },
  card: { padding: '18px' },
  cardTitle: { margin: 0, marginBottom: '1rem' },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
    width: '100%',
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    outline: 0,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  hint: { fontSize: '12px', margin: '0.5rem 0 1rem' },
  subhead: { fontSize: '14px', margin: '1.25rem 0 0.75rem' },
  list: { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13.5px' },
}