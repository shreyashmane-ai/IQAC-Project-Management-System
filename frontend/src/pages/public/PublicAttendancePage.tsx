import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { getPublicSelfAttendance, submitSelfAttendance, type PublicSelfAttendanceResult } from '../../api/public'
import { apiErrorMessage } from '../../api/client'
import { Loading, Err, Btn } from '../../components/common'

export default function PublicAttendancePage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getPublicSelfAttendance>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [regNo, setRegNo] = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone] = useState<PublicSelfAttendanceResult | null>(null)

  useEffect(() => {
    let active = true
    getPublicSelfAttendance(token)
      .then((d) => { if (active) setInfo(d) })
      .catch((e) => { if (active) setError(apiErrorMessage(e, 'Unable to load attendance')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) return <Loading />
  if (error || !info) return <Err msg={error || 'Program not found'} />

  function handleSubmit() {
    if (submitting) return
    const dayId = params.get('day')
    if (!regNo.trim() || !email.trim()) {
      setFieldError('Enter your registration number and email.')
      return
    }
    if (!dayId) {
      setFieldError('No day was selected. Please scan the QR again or check the link.')
      setError(null)
      return
    }
    setSubmitting(true)
    setError(null)
    setFieldError(null)
    submitSelfAttendance(token, { registration_number: regNo.trim(), email: email.trim(), day_id: dayId })
      .then((d) => setDone(d))
      .catch((e) => {
        const msg = apiErrorMessage(e, 'Attendance could not be marked')
        if (msg.toLowerCase().includes('format') || msg.toLowerCase().includes('Required')) setFieldError(msg)
        else setError(msg)
      })
      .finally(() => setSubmitting(false))
  }

  if (done) {
    const already = done.result === 'ALREADY_MARKED'
    return (
      <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <div style={{ fontSize: 40 }}>{already ? '☑️' : '✅'}</div>
        <h2 style={{ margin: '10px 0 6px' }}>{already ? 'Already marked' : 'Attendance confirmed!'}</h2>
        <p className="muted">
          {done.participant.name}
          <br />
          <span style={{ fontWeight: 600 }}>{done.participant.registration_number}</span>
          <br />
          Day {done.day.day_number}{done.day.title ? ` — ${done.day.title}` : ''}
        </p>
        <div style={{ marginTop: 22 }}>
          <Link to={`/p/${token}`} className="btn ghost">Back to program</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Attendance Check-in</h1>
        <p className="muted" style={{ margin: '0 0 18px' }}>{info.program.title}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <label className="lbl" htmlFor="att-reg-no">Registration number</label>
            <input
              className="inp"
              id="att-reg-no"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              placeholder="e.g. DEEKSHAR-0001"
              autoCapitalize="characters"
              aria-required="true"
            />
          </div>
          <div>
            <label className="lbl" htmlFor="att-email">Email used at registration</label>
            <input
              className="inp"
              id="att-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-required="true"
            />
          </div>

          {fieldError && <p style={{ color: 'var(--danger)', margin: 0 }}>{fieldError}</p>}
          {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}

          <Btn type={submitting ? 'button' : 'submit'} onClick={() => {}} disabled={submitting} style={{ alignSelf: 'flex-start' }}>
            {submitting ? 'Marking…' : 'Mark my attendance'}
          </Btn>
        </form>
      </div>
    </div>
  )
}