import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRegisterInfo, submitRegistration } from '../../api/public'
import { apiErrorMessage } from '../../api/client'
import { Loading, Err, Btn } from '../../components/common'
import { DynamicForm } from '../../components/DynamicForm'
import { validateForm, type FormValues } from '../../utils/dynamicForm'

export default function PublicRegisterPage() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getRegisterInfo>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState<FormValues>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [done, setDone] = useState<{ registration_number: string } | null>(null)

  useEffect(() => {
    let active = true
    getRegisterInfo(token)
      .then((d) => { if (active) setInfo(d) })
      .catch((e) => { if (active) setError(apiErrorMessage(e, 'Unable to load registration form')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) return <Loading />
  if (error || !info) return <Err msg={error || 'Program not found'} />
  const infoSafe = info

  if (done) {
    return (
      <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <h2 style={{ margin: '10px 0 6px' }}>You are registered!</h2>
        <p className="muted">Your registration number:</p>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', letterSpacing: 1 }}>{done.registration_number}</div>
        <div style={{ marginTop: 22 }}>
          <Link to={`/p/${token}`} className="btn ghost">Back to program</Link>
        </div>
      </div>
    )
  }

  if (!infoSafe.registration_open) {
    return (
      <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h2>Registration is closed</h2>
        <p className="muted">This program is not currently accepting registrations.</p>
        <Link to={`/p/${token}`} className="btn ghost">Back to program</Link>
      </div>
    )
  }

  function handleSubmit() {
    if (!consent) {
      setConsentError('Please accept the privacy policy to register.')
      return
    }
    setConsentError(null)
    const errs = validateForm(infoSafe.registration_schema as Record<string, unknown> as any, values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    setError(null)
    submitRegistration(token, { form_data: values, consent: true })
      .then((d) => setDone({ registration_number: d.registration_number }))
      .catch((e) => setError(apiErrorMessage(e, 'Registration failed')))
      .finally(() => setSubmitting(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Registration</h1>
        <p className="muted2" style={{ fontSize: 13, margin: 0 }}>{infoSafe.program.title}</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          noValidate
        >
          <DynamicForm schema={infoSafe.registration_schema as any} values={values} onChange={setValues} errors={fieldErrors} />

          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', margin: '4px 0 10px' }}>
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked)
                if (e.target.checked) setConsentError(null)
              }}
              aria-invalid={consentError ? true : undefined}
              aria-describedby={consentError ? 'consent-error' : undefined}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
            />
            <label htmlFor="consent" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-soft)' }}>
              I consent to IQAC PMS collecting and processing the information I provide in this form so my
              registration and participation can be managed, as described in the{' '}
              <Link to="/privacy" style={{ color: 'var(--link)' }}>Privacy Policy</Link>. Required.
            </label>
          </div>
          {(consentError || error) && (
            <div id={consentError ? 'consent-error' : undefined}>
              <Err msg={consentError || error} />
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <Btn type="submit" onClick={() => {}} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit registration'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}