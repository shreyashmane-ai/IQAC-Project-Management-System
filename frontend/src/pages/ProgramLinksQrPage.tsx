import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import {
  closeProgram,
  getClosureReadiness,
  getProgram,
  getProgramLinks,
  regenerateProgramToken,
  setProgramLinkState,
  type ClosureReadiness,
  type ProgramLinks,
} from '../api/programs'
import type { ProgramDetail } from '../types'
import { Btn, Err, Loading, PageHeader } from '../components/common'
import { useConfirm, useToast } from '../components/Overlay'

export default function ProgramLinksQrPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [links, setLinks] = useState<ProgramLinks | null>(null)
  const [readiness, setReadiness] = useState<ClosureReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [p, l, r] = await Promise.all([
        getProgram(id),
        getProgramLinks(id),
        getClosureReadiness(id),
      ])
      setProgram(p)
      setLinks(l)
      setReadiness(r)
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to load program'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  if (loading) return <Loading />
  if (error || !program || !links) return <Err msg={error || 'Program not found'} />

  async function toggle(service: 'public' | 'registration' | 'feedback', enabled: boolean) {
    if (!id) return
    setBusy(`state-${service}`)
    setError(null)
    try {
      await setProgramLinkState(id, service, enabled)
      setMessage(`${service === 'public' ? 'Public' : service === 'registration' ? 'Registration' : 'Feedback'} link ${enabled ? 'enabled' : 'disabled'}.`)
      setLinks((l) => l && { ...l, [`${service}_link_enabled`]: enabled })
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to update link state'))
    } finally {
      setBusy(null)
    }
  }

  async function regenerate() {
    if (!id) return
    if (
      !(await confirmAsk({
        title: 'Regenerate public token',
        body: 'Regenerate the public token? All existing links will break.',
        confirmLabel: 'Regenerate',
        danger: true,
        needType: true,
      }))
    )
      return
    setBusy('regenerate')
    setError(null)
    try {
      const l = await regenerateProgramToken(id)
      setLinks(l)
      setMessage('Public token regenerated. Existing QR codes now point to the new token if they embed it.')
      toast.success('Public token regenerated')
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to regenerate token'))
    } finally {
      setBusy(null)
    }
  }

  async function doClose() {
    if (!id) return
    if (
      !(await confirmAsk({
        title: 'Close & archive program',
        body: 'Close (archive) this program? This is irreversible.',
        confirmLabel: 'Close program',
        danger: true,
        needType: true,
      }))
    )
      return
    setBusy('close')
    setError(null)
    try {
      await closeProgram(id)
      setMessage('Program closed and archived.')
      toast.success('Program closed and archived')
      await load()
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to close program'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Links & QR"
        sub={program?.title}
        actions={<Btn kind="ghost" onClick={() => navigate(`/programs/${id}`)}>← Back to program</Btn>}
      />
      <Err msg={error} />
      {message && <div className="successbox" style={{ marginBottom: '1rem' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="card">
            <h3 style={{ margin: '0 0 12px' }}>Public links</h3>
            <LinkRow label="Program page" url={links.public_url} enabled={links.public_link_enabled} onToggle={(v) => toggle('public', v)} busy={busy === 'state-public'} />
            <LinkRow label="Registration" url={links.registration_url} enabled={links.registration_link_enabled} onToggle={(v) => toggle('registration', v)} busy={busy === 'state-registration'} />
            <LinkRow label="Feedback" url={links.feedback_url} enabled={links.feedback_link_enabled} onToggle={(v) => toggle('feedback', v)} busy={busy === 'state-feedback'} />
          </section>

          <section className="card">
            <h3 style={{ margin: '0 0 12px' }}>Closure readiness</h3>
            {readiness ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}>
                  {readiness.can_close
                    ? 'All checks passed — ready to archive.'
                    : `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'} remain.`}
                </div>
                <Check label="Registration closed" ok={readiness.registration_closed} />
                <Check label="Attendance finalized" ok={readiness.attendance_finalized} />
                <Check label="Food finalized" ok={readiness.food_finalized} />
                <Check label="Feedback closed" ok={readiness.feedback_closed} />
                <Check label="Certificates handled" ok={readiness.certificates_handled} />
                <Check label="Documents uploaded" ok={readiness.documents_uploaded} />
                {readiness.blockers.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--danger)', fontSize: 13 }}>
                    {readiness.blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={doClose} disabled={!readiness.can_close || busy === 'close'} kind={readiness.can_close ? 'danger' : 'primary'}>
                    {busy === 'close' ? 'Closing…' : 'Close & archive program'}
                  </Btn>
                </div>
              </div>
            ) : (
              <p className="muted">Not available.</p>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <QrCard label="Program page" b64={links.qr_public} enabled={links.public_link_enabled} />
          <QrCard label="Registration" b64={links.qr_registration} enabled={links.registration_link_enabled} />
          <QrCard label="Feedback" b64={links.qr_feedback} enabled={links.feedback_link_enabled} />
          <section className="card" style={{ textAlign: 'center' }}>
            <Btn kind="ghost" onClick={regenerate} disabled={busy === 'regenerate'}>
              {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate token'}
            </Btn>
          </section>
        </div>
      </div>
    </div>
  )
}

function LinkRow({
  label,
  url,
  enabled,
  onToggle,
  busy,
}: {
  label: string
  url: string | null | undefined
  enabled: boolean
  onToggle: (v: boolean) => void
  busy: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</div>
        <a
          href={enabled ? url || '#' : undefined}
          style={{ fontSize: 12.5, color: enabled ? 'var(--link)' : 'var(--muted)', textDecoration: enabled ? 'underline' : 'none', wordBreak: 'break-all' }}
        >
          {enabled ? url : `${label} link is disabled`}
        </a>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        disabled={busy}
        aria-pressed={enabled}
        aria-label={`${label} link ${enabled ? 'enabled' : 'disabled'}`}
        style={{
          minWidth: 64,
          padding: '6px 10px',
          borderRadius: 999,
          border: '1px solid var(--border-strong)',
          background: enabled ? 'rgba(34,197,94,.15)' : '#fff',
          color: enabled ? 'var(--success-d)' : 'var(--muted)',
          fontSize: 12,
          fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? '…' : enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function QrCard({ label, b64, enabled }: { label: string; b64?: string | null; enabled: boolean }) {
  return (
    <section className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 12px' }}>{label}</h3>
      {!enabled ? (
        <div className="muted" style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '26px 10px' }}>
          Link is disabled
        </div>
      ) : b64 ? (
        <img
          src={`data:image/png;base64,${b64}`}
          alt={`${label} QR`}
          style={{ width: 170, height: 170, borderRadius: 12, border: '1px solid var(--border)' }}
        />
      ) : (
        <p className="muted">No QR generated.</p>
      )}
    </section>
  )
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
      <span style={{ color: ok ? 'var(--success-d)' : 'var(--danger)' }}>{ok ? '✓' : '✗'}</span>
      <span className={ok ? '' : 'muted'}>{label}</span>
    </div>
  )
}