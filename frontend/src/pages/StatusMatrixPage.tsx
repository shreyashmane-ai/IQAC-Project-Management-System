import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getStatusMatrix, type StatusMatrix } from '../api/participants'
import { listPrograms } from '../api/programs'
import type { ProgramListItem } from '../types'
import { Btn, Err, Loading, PageHeader, TSelect } from '../components/common'

export default function StatusMatrixPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [matrix, setMatrix] = useState<StatusMatrix | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPrograms()
      .then((d) => {
        setPrograms(d.results)
        if (d.results.length) setProgramId(d.results[0].id)
      })
      .catch((e) => setError(apiErrorMessage(e, 'Failed to load programs')))
  }, [])

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      setMatrix(await getStatusMatrix(programId))
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to load status matrix'))
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  return (
    <div>
      <PageHeader title="Participant Status" sub="Per-day attendance, food, feedback and certificate status." />
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <TSelect
          value={programId}
          onChange={setProgramId}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 340 }}
        />
        <Btn kind="ghost" onClick={load} disabled={!programId}>Refresh</Btn>
      </div>
      <Err msg={error} />

      {loading ? (
        <Loading />
      ) : !matrix ? (
        <p className="muted">Select a program to view the matrix.</p>
      ) : matrix.participants.length === 0 ? (
        <p className="muted">No approved/submitted registrations for this program yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <div className="cardhead" style={{ padding: '14px 18px' }}>
            <h3>{matrix.program.title}</h3>
            <span className="muted2" style={{ fontSize: 13 }}>{matrix.participants.length} participant(s)</span>
          </div>
          <table className="table fixed" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Participant</th>
                {matrix.days.map((d) => (
                  <th key={d.id} style={{ textAlign: 'center' }}>Day {d.day_number}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Feedback</th>
                <th style={{ textAlign: 'center' }}>Cert.</th>
              </tr>
              <tr>
                <th></th>
                {matrix.days.map((d) => (
                  <th key={d.id} className="muted2" style={{ fontSize: 11, textAlign: 'center' }}>
                    {[d.attendance_enabled && 'A', d.food_enabled && 'F'].filter(Boolean).join('·') || '—'}
                  </th>
                ))}
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matrix.participants.map((p) => (
                <tr key={p.participant_id}>
                  <td>
                    <Link to={`/participants/${p.participant_id}`}><b>{p.participant_name}</b></Link>
                    <div className="muted2" style={{ fontSize: 11 }}>{p.participant_email}</div>
                    <div className="muted2" style={{ fontSize: 11 }}>{p.registration_number}</div>
                  </td>
                  {matrix.days.map((d) => {
                    const a = p.attendance[d.id]
                    const f = p.food[d.id]
                    const cells: string[] = []
                    if (a) cells.push(a.present ? '✅' : '⚪')
                    if (f) cells.push(f.claimed ? '🍽️' : f.eligible ? (f.qr_sent ? '🔔' : '•') : '—')
                    return (
                      <td key={d.id} style={{ textAlign: 'center', fontSize: 13 }}>
                        {cells.length ? cells.join(' ') : '—'}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center' }}>{p.feedback.submitted ? '✅' : '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {p.certificate.status ? (
                      <span className="badge" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success-d)' }}>
                        {p.certificate.status}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}