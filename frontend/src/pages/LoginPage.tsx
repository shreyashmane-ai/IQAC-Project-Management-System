import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { verify2fa } from '../api/auth'
import { tokenStore } from '../api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/programs'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [pending2fa, setPending2fa] = useState<{ challenge_id: string | number; email: string } | null>(null)
  const [code, setCode] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await login(email, password)
      if (response['2fa_required'] && response.challenge_id) {
        setPending2fa({ challenge_id: response.challenge_id, email })
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pending2fa) return
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await verify2fa(pending2fa.challenge_id, code.trim())
      tokenStore.set({ access: tokens.access, refresh: tokens.refresh })
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Verification failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.wrap}>
      {pending2fa ? (
        <form onSubmit={handleOtpSubmit} className="card" style={styles.card}>
          <div style={styles.brand}>
            <div className="logo"><span></span></div>
            <b>IQAC&nbsp;PMS</b>
          </div>
          <h1 style={styles.title}>Two-factor code</h1>
          <p className="muted" style={styles.subtitle}>
            Enter the 6-digit code from your authenticator app {pending2fa.email && <>for <b>{pending2fa.email}</b></>}.
          </p>

          <label className="field">
            Authentication code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              placeholder="000 000"
              style={{ letterSpacing: '0.3em', fontSize: '1.25rem' }}
            />
          </label>

          {error && <div className="errorbox">{error}</div>}

          <button type="submit" className="btn primary" style={styles.button} disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify & sign in'}
          </button>
          <button
            type="button"
            className="btn"
            style={styles.button}
            onClick={() => { setPending2fa(null); setCode(''); setError(null) }}
          >
            Back
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={styles.card}>
          <div style={styles.brand}>
            <div className="logo"><span></span></div>
            <b>IQAC&nbsp;PMS</b>
          </div>
          <h1 style={styles.title}>Sign in</h1>
          <p className="muted" style={styles.subtitle}>Enter your credentials to access the dashboard.</p>

          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div className="errorbox">{error}</div>}

          <button type="submit" className="btn primary" style={styles.button} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #eef2f8 0%, #f4f7fb 40%, #e7f3fb 100%)',
    fontFamily: 'inherit',
  },
  card: { width: 'min(380px, calc(100% - 32px))', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: 'var(--shadow-lg)' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.25rem' },
  title: { fontSize: '1.5rem', letterSpacing: '-.3px', margin: 0 },
  subtitle: { fontSize: '13.5px', margin: 0 },
  button: { justifyContent: 'center', marginTop: '0.25rem' },
}
