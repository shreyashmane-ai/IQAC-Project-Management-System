import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { listAuditLog } from '../api/audit'
import type { AuditLogEntry } from '../types'
import {
  Err,
  Loading,
  PageHeader,
  TextInput,
} from '../components/common'
import { fmtDateTime, titleCase } from '../utils/date'
import { useToast } from '../components/Overlay'

const ENTITY_TYPES = [
  'program',
  'academicsession',
  'participant',
  'registration',
  'programday',
  'attendance',
  'foodservice',
  'foodclaim',
  'feedback',
  'certificate',
  'report',
  'document',
  'user',
  'role',
] as const

export default function AuditPage() {
  const toast = useToast()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAuditLog({
        entity_type: entity || undefined,
        action: action || undefined,
        search: search || undefined,
      })
      setLogs(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load audit log'))
    } finally {
      setLoading(false)
    }
  }, [entity, action, search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const actions = Array.from(new Set(logs.map((l) => l.action))).filter(Boolean)

  return (
    <div>
      <PageHeader title="Audit Log" sub="System audit trail — who did what, when." />
      <div style={styles.toolbar}>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} style={styles.select}>
          <option value="">All entities</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>{titleCase(e)}</option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={styles.select}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{titleCase(a)}</option>
          ))}
        </select>
        <TextInput placeholder="Search logs…" value={search} onChange={setSearch} style={{ flex: 1 }} />
      </div>
      <Err msg={error} />

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <p className="muted">No audit entries found.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{fmtDateTime(l.timestamp)}</td>
                  <td>
                    <b>{l.user_name || l.user_email || 'System'}</b>
                    <div className="muted2" style={{ fontSize: 12 }}>{l.user_role ? titleCase(l.user_role) : ''}</div>
                  </td>
                  <td><span className="badge">{titleCase(l.action)}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <b>{titleCase(l.entity_type)}</b>
                      <code className="muted2" style={{ fontSize: 11 }}>#{shortId(l.entity_id)}</code>
                      <button
                        onClick={() => setViewing(l)}
                        title="View full entity details"
                        style={styles.eyeBtn}
                      >
                        <EyeIcon />
                      </button>
                    </span>
                  </td>
                  <td className="muted">{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    {viewing && (
        <div style={styles.backdrop} onClick={() => setViewing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{titleCase(viewing.action)}</div>
                <div className="muted2" style={{ fontSize: 12.5 }}>{fmtDateTime(viewing.timestamp)} · {viewing.user_name || viewing.user_email || 'System'}</div>
              </div>
              <button onClick={() => setViewing(null)} title="Close" style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Entity" value={`${titleCase(viewing.entity_type)}`} />
              <Row
                label="Entity ID"
                value={viewing.entity_id}
                copyable
                onCopy={() => { if (viewing.entity_id) navigator.clipboard?.writeText(viewing.entity_id); toast.success('Entity ID copied') }}
              />
              <Row label="Program" value={viewing.program_id ? shortId(viewing.program_id) + ' (this program)' : 'N/A'} />
              <Row label="IP address" value={viewing.ip_address || '—'} />
              <Row label="Reason" value={viewing.reason || '—'} />
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={styles.diffLabel}>Before</div>
              <pre style={styles.pre}>{json(viewing.before)}</pre>
              <div style={styles.diffLabel}>After</div>
              <pre style={styles.pre}>{json(viewing.after)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function shortId(id?: string | null): string {
  if (!id) return '—'
  return id.length > 13 ? `${id.slice(0, 8)}…` : id
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value ?? 'null')
  }
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Row({ label, value, copyable, onCopy }: { label: string; value: string | number | null; copyable?: boolean; onCopy?: () => void }) {
  return (
    <div style={styles.mrow}>
      <span className="muted" style={{ fontSize: 12.5, minWidth: 90 }}>{label}</span>
      <code style={styles.mrowValue}>
        {value ?? '—'}
        {copyable && onCopy && (
          <button onClick={onCopy} style={styles.copyBtn}>Copy</button>
        )}
      </code>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
  },
  eyeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    color: '#64748b',
    cursor: 'pointer',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 60,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 'min(560px, 100%)',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 50px -20px rgba(15,23,42,.5)',
  },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--muted)',
    fontSize: 15,
    cursor: 'pointer',
    padding: 4,
  },
  mrow: { display: 'flex', alignItems: 'center', gap: 12 },
  mrowValue: { fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, wordBreak: 'break-all' },
  copyBtn: {
    marginLeft: 8,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: '#f8fafc',
    color: 'var(--link)',
    cursor: 'pointer',
  },
  diffLabel: {
    margin: '12px 0 4px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'var(--muted)',
  },
  pre: {
    margin: 0,
    padding: 10,
    background: '#f8fafc',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
}
