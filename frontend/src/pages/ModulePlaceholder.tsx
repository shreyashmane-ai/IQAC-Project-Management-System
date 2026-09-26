import { useParams } from 'react-router-dom'

const BLURBS: Record<string, string> = {
  sessions: 'Manage academic sessions and run session-level analysis.',
  'master-data': 'Maintain departments, program types, venues, resource persons and more.',
  participants: 'Manage participants and their program registrations.',
  attendance: 'Run day-wise attendance sessions, rosters and stats.',
  food: 'Configure food services, eligibility and QR claim workflows.',
  feedback: 'Create feedback instances and review analytics.',
  certificates: 'Design templates, generate and send certificates.',
  reports: 'Build and export custom reports across the system.',
  documents: 'Store circulars, permission letters, evidence and other program documents.',
  users: 'Manage users, roles and program assignments.',
  audit: 'Review the system audit log.',
}

export default function ModulePlaceholder() {
  const { module } = useParams<{ module: string }>()
  const label = (module || 'module')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const blurb = BLURBS[module || ''] || 'This module is part of IQAC PMS.'

  return (
    <div>
      <div className="pagehead">
        <div>
          <h1>{label}</h1>
          <p>{blurb}</p>
        </div>
      </div>

      <div className="card">
        <h3>Coming soon</h3>
        <p className="muted" style={styles.text}>
          The <b>{label}</b> module page is scaffolded and will be wired to its live API endpoints next.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  text: { marginTop: 8, fontSize: '13.5px', lineHeight: 1.5 },
}
