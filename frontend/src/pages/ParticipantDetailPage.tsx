import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { getParticipant, listRegistrations } from '../api/participants'
import type { Participant, Registration } from '../types'
import {
  Err,
  Loading,
  PageHeader,
  Stat,
} from '../components/common'
import { fmtDate, titleCase } from '../utils/date'

export default function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const p = await getParticipant(id)
      setParticipant(p)
      const all = await listRegistrations({ search: p.email })
      setRegistrations(
        all.results.filter((r) => r.participant_email.toLowerCase() === p.email.toLowerCase()),
      )
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load participant'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  if (loading) return <Loading />
  if (error) return <Err msg={error} />
  if (!participant) return null

  const department = participant.department_name
    ? `Dept: ${participant.department_name}`
    : participant.institution_department
      ? `Institution Dept: ${participant.institution_department}`
      : null
  const designation = participant.designation_name
    ? `Designation: ${participant.designation_name}`
    : participant.institution_designation
      ? `Institution: ${participant.institution_designation}`
      : null

  return (
    <div>
      <PageHeader title={participant.full_name} sub={`${participant.email} • ${participant.mobile || 'no mobile'}`} />
      <Err msg={error} />

      <div className="statgrid" style={styles.mb}>
        <Stat label="Department" value={department || '—'} />
        <Stat label="Designation" value={designation || '—'} />
        <Stat label="Registrations" value={participant.registration_count} />
        <Stat label="Consent" value={participant.consent_given ? 'Given' : 'Not given'} sub={participant.consent_date ? fmtDate(participant.consent_date) : undefined} />
      </div>

      {(participant.city || participant.state || participant.country) && (
        <p className="muted" style={styles.mb}>
          {[participant.city, participant.state, participant.country].filter(Boolean).join(', ')}
        </p>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="cardhead" style={styles.cardhead}>
          <h3>Registrations</h3>
        </div>
        {registrations.length === 0 ? (
          <p className="muted" style={styles.mbPad}>No program registrations found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Reg. No.</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/programs/${r.program}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <b>{r.program_title}</b>
                    </Link>
                  </td>
                  <td className="muted2">{r.registration_number}</td>
                  <td><span className="badge">{r.status_display || titleCase(r.status)}</span></td>
                  <td className="muted">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  mb: { marginBottom: '1rem' },
  cardhead: { padding: '14px 18px', borderBottom: '1px solid var(--border2)', margin: 0 },
  mbPad: { padding: '18px' },
}
