import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { disable2fa, enable2fa, get2faSetup } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { Btn, Err, PageHeader } from '../components/common'

interface SetupData {
  secret: string
  qr_code: string
  provisioning_uri: string
}

export default function SecurityPage() {
  const { user } = useAuth()
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showDisable, setShowDisable] = useState(false)

  const enabled = !!user?.totp_enabled

  const loadSetup = useCallback(async () => {
    setError(null)
    try {
      setSetup(await get2faSetup())
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load 2FA setup'))
    }
  }, [])

  useEffect(() => {
    if (!enabled) void Promise.resolve().then(loadSetup)
  }, [enabled, loadSetup])

  async function handleEnable() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await enable2fa(code.trim())
      setNotice('Two-factor authentication enabled on your account.')
      setCode('')
      setSetup(null)
      window.location.reload()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to enable 2FA'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await disable2fa(code.trim())
      setNotice('Two-factor authentication disabled.')
      setCode('')
      setShowDisable(false)
      window.location.reload()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to disable 2FA'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Security" sub="Manage two-factor authentication for your account." />
      <Err msg={error} />
      {notice && <div className="noticebox" style={styles.mb}>{notice}</div>}

      <div className="card" style={styles.card}>
        <h3 style={styles.cardTitle}>Two-factor authentication (2FA)</h3>

        {enabled ? (
          <div>
            <div style={styles.statusRow}>
              <span style={styles.statusDot}></span>
              <span style={{ fontWeight: 600 }}>Enabled</span>
              <span className="muted2" style={styles.small}>Your account requires a 6-digit code at sign-in.</span>
            </div>
            {!showDisable ? (
              <div style={{ marginTop: 14 }}>
                <Btn kind="danger" onClick={() => setShowDisable(true)}>Disable 2FA</Btn>
              </div>
            ) : (
              <div style={{ marginTop: 14, maxWidth: 320 }}>
                <label style={styles.label}>
                  Authenticator code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000 000"
                    style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12, fontSize: '14px', outline: 0, maxWidth: 200, letterSpacing: '0.3em' }}
                  />
                </label>
                <p className="muted2" style={styles.small}>Enter a current code from your authenticator app to confirm.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn kind="danger" onClick={handleDisable} disabled={busy || code.length !== 6}>
                    {busy ? 'Disabling…' : 'Confirm disable'}
                  </Btn>
                  <Btn kind="ghost" onClick={() => { setShowDisable(false); setCode(''); setError(null) }}>Cancel</Btn>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="muted" style={styles.sub}>
              Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) then enter the 6-digit code to enable 2FA.
            </p>

            {setup ? (
              <>
                <div style={styles.qrWrap}>
                  <img
                    src={`data:image/png;base64,${setup.qr_code}`}
                    alt="2FA QR code"
                    style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid var(--border)' }}
                  />
                </div>
                <p style={styles.small}>
                  Secret: <code>{setup.secret}</code>
                </p>
                <label style={{ ...styles.label, marginTop: 6 }}>
                  Authenticator code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000 000"
                    style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12, fontSize: '14px', outline: 0, maxWidth: 200, letterSpacing: '0.3em' }}
                  />
                </label>
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={handleEnable} disabled={busy || code.length !== 6}>
                    {busy ? 'Enabling…' : 'Enable 2FA'}
                  </Btn>
                </div>
              </>
            ) : (
              <Loading />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Loading() {
  return <div className="loading">Loading…</div>
}

const styles: Record<string, React.CSSProperties> = {
  mb: { marginBottom: '1rem' },
  card: { padding: '18px', maxWidth: 640 },
  cardTitle: { marginBottom: '0.75rem' },
  sub: { marginBottom: '1rem' },
  qrWrap: { marginBottom: '0.75rem' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12.5px', fontWeight: 600 },
  small: { fontSize: '12.5px', marginTop: 4 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 999, background: '#10b981' },
}