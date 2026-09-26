import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublicProgram, getPublicDays, type PublicProgram, type PublicDay } from '../../api/public'
import { Loading, Err } from '../../components/common'
import { fmtDate } from '../../utils/date'

export default function PublicProgramPage() {
  const { token = '' } = useParams()
  const [program, setProgram] = useState<PublicProgram | null>(null)
  const [days, setDays] = useState<PublicDay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [prevToken, setPrevToken] = useState(token)
  if (prevToken !== token) {
    setPrevToken(token)
    setLoading(true)
  }

  useEffect(() => {
    let active = true
    Promise.allSettled([getPublicProgram(token), getPublicDays(token)])
      .then(([p, d]) => {
        if (!active) return
        if (p.status === 'fulfilled') setProgram(p.value)
        else setError('Unable to load program details.')
        if (d.status === 'fulfilled') setDays(d.value)
        setLoading(false)
      })
    return () => { active = false }
  }, [token])

  if (loading) return <Loading />
  if (error || !program) return <Err msg={error || 'Program not found'} />
  const isOpen = program.registration_status === 'REG_OPEN'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section style={{ background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <div className="muted2" style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase' }}>
          {program.program_type}
        </div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 26 }}>{program.title}</h1>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          {program.short_code} · {fmtDate(program.start_date)} – {fmtDate(program.end_date)}
        </div>
        {program.description && <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{program.description}</p>}
        {program.venue && (
          <div className="muted2" style={{ fontSize: 13, marginTop: 10 }}>📍 {program.venue}</div>
        )}
        {program.coordinator && (
          <div className="muted2" style={{ fontSize: 13, marginTop: 4 }}>
            Coordinator: {program.coordinator.name}
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          {isOpen ? (
            <Link to={`/p/${token}/register`} className="btn">Register for this program</Link>
          ) : (
            <span className="btn" style={{ opacity: 0.55, cursor: 'not-allowed' }} aria-disabled="true">Registration closed</span>
          )}
        </div>
      </section>

      {days.length > 0 && (
        <section style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Schedule</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {days.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="badge" style={{ minWidth: 70, textAlign: 'center' }}>Day {d.day_number}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{d.title || `Day ${d.day_number}`}</div>
                  <div className="muted2" style={{ fontSize: 12.5 }}>
                    {fmtDate(d.date)}
                    {d.start_time ? ` · ${String(d.start_time).slice(0, 5)}` : ''}
                    {d.end_time ? ` – ${String(d.end_time).slice(0, 5)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ textAlign: 'center' }}>
        <Link to={`/p/${token}/feedback`} style={{ color: '#2563eb', fontSize: 13.5 }}>Submit feedback →</Link>
      </div>
    </div>
  )
}
