import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyQrs, type MyQrsResult, type FoodQr } from '../../api/public'
import { apiErrorMessage } from '../../api/client'
import { Btn, TextInput, Err } from '../../components/common'

function qrImg(b64: string): string {
  return `data:image/png;base64,${b64}`
}

export default function MyQrsPage() {
  const [regNo, setRegNo] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<MyQrsResult | null>(null)

  function handleSubmit() {
    if (submitting) return
    if (!regNo.trim() || !email.trim()) {
      setError('Please enter both your registration number and email.')
      return
    }
    setError(null)
    setResult(null)
    setSubmitting(true)
    getMyQrs({ registration_number: regNo.trim(), email: email.trim() })
      .then((d) => setResult(d))
      .catch((e) => setError(apiErrorMessage(e, 'Unable to find your QR codes')))
      .finally(() => setSubmitting(false))
  }

  function renderFood(f: FoodQr) {
    return (
      <div
        key={f.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: 18,
          borderRadius: 14,
          background: '#f4f8fc',
          border: '1px solid var(--border)',
        }}
      >
        <img src={qrImg(f.qr)} alt={`Food QR ${f.service}`} width={160} height={160} style={{ borderRadius: 8 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{f.service}{f.service_name ? ` · ${f.service_name}` : ''}</div>
          <div className="muted2" style={{ fontSize: 12.5 }}>
            Day {f.day_number ?? '—'}{f.day_date ? ` · ${f.day_date}` : ''}
          </div>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${f.is_claimed ? 'danger' : ''}`}>
              {f.is_claimed ? 'Already claimed' : 'Unclaimed'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  function renderProgram(p: MyQrsResult['programs'][number]) {
    return (
      <section
        key={p.program_id}
        style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}
      >
        <div className="muted2" style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase' }}>{p.short_code}</div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 19 }}>{p.program_title}</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Registration: <b style={{ color: 'var(--text)' }}>{p.registration_number}</b> · Status: {p.status}
        </div>

        {p.attendance_qrs.length > 0 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              Attendance QRs ({p.attendance_qrs.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))', gap: 12, marginBottom: 16 }}>
              {p.attendance_qrs.map((a) => (
                <div
                  key={a.day_number}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    padding: 18,
                    borderRadius: 14,
                    background: '#f4f8fc',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img src={qrImg(a.qr)} alt={`Attendance QR day ${a.day_number}`} width={160} height={160} style={{ borderRadius: 8 }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Attendance</div>
                    <div className="muted2" style={{ fontSize: 12.5 }}>
                      Day {a.day_number}{a.day_date ? ` · ${a.day_date}` : ''}
                    </div>
                    <div className="muted2" style={{ fontSize: 12 }}>Show at the attendance counter.</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {p.food_qrs.length > 0 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Food QRs ({p.food_qrs.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))', gap: 12 }}>
              {p.food_qrs.map(renderFood)}
            </div>
          </>
        )}
      </section>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>My QR Codes</h1>
        <p className="muted2" style={{ fontSize: 13, margin: '0 0 18px' }}>
          Enter the registration number and email you used while registering to view all your scannable QR codes.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <TextInput value={regNo} onChange={setRegNo} placeholder="e.g. CAMPUSTO-0004" label="Registration number" id="myqrs-reg-no" />
          <TextInput value={email} onChange={setEmail} placeholder="Email address" type="email" label="Email address" id="myqrs-email" />
          <Err msg={error} />
          <div>
            <Btn type={submitting ? 'button' : 'submit'} onClick={() => {}} disabled={submitting}>
              {submitting ? 'Loading…' : 'Show my QR codes'}
            </Btn>
          </div>
        </form>
      </section>

      {result && (
        <>
          <section style={{ background: '#fff', borderRadius: 18, padding: 18, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{result.participant_name}</div>
            <div className="muted2" style={{ fontSize: 12.5 }}>{result.email}</div>
          </section>
          {result.programs.map(renderProgram)}
        </>
      )}

      <div style={{ textAlign: 'center' }}>
        <Link to="/" style={{ color: '#2563eb', fontSize: 13.5 }}>← Back to home</Link>
      </div>
    </div>
  )
}
