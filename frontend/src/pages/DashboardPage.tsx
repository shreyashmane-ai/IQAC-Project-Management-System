import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { getProgramDashboard, listPrograms } from '../api/programs'
import type { FunnelStep, ProgramDashboard, ProgramListItem } from '../types'
import { CountUp } from '../components/common'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  REG_OPEN: 'Registration Open',
  REG_CLOSED: 'Registration Closed',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
  POSTPONED: 'Postponed',
  RESCHEDULED: 'Rescheduled',
}

export default function DashboardPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [dash, setDash] = useState<ProgramDashboard | null>(null)
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [loadingDash, setLoadingDash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoadingPrograms(true)
    setError(null)
    try {
      const data = await listPrograms()
      setPrograms(data.results)
      if (data.results.length > 0 && !selectedId) setSelectedId(data.results[0].id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    } finally {
      setLoadingPrograms(false)
    }
  }, [selectedId])

  useEffect(() => {
    void Promise.resolve().then(loadPrograms)
  }, [loadPrograms])

  const loadDash = useCallback(async () => {
    if (!selectedId) return
    setLoadingDash(true)
    setError(null)
    try {
      setDash(await getProgramDashboard(selectedId))
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load dashboard'))
    } finally {
      setLoadingDash(false)
    }
  }, [selectedId])

  useEffect(() => {
    void Promise.resolve().then(loadDash)
  }, [loadDash])

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of programs) {
      counts.set(p.status, (counts.get(p.status) ?? 0) + 1)
    }
    return counts
  }, [programs])

  const totalRegistered = useMemo(
    () => programs.reduce((sum, p) => sum + (p.registration_count || 0), 0),
    [programs],
  )
  const totalDays = useMemo(
    () => programs.reduce((sum, p) => sum + (p.day_count || 0), 0),
    [programs],
  )

  const selectedProgram = programs.find((p) => p.id === selectedId) || null

  const funnel: FunnelStep[] = useMemo(() => {
    if (!dash) return []
    const steps: FunnelStep[] = [
      { label: 'Registered', value: String(dash.registration_count), pct: 100 },
      {
        label: 'Attended',
        value: String(dash.approved_count),
        pct: dash.registration_count ? Math.round((dash.approved_count / dash.registration_count) * 100) : 0,
      },
      {
        label: 'Food Eligible',
        value: String(dash.food_eligible),
        pct: dash.registration_count ? Math.round((dash.food_eligible / dash.registration_count) * 100) : 0,
      },
      {
        label: 'Food Claimed',
        value: String(dash.food_claimed),
        pct: dash.registration_count ? Math.round((dash.food_claimed / dash.registration_count) * 100) : 0,
      },
      {
        label: 'Certified',
        value: String(dash.certificates_issued),
        pct: dash.registration_count ? Math.round((dash.certificates_issued / dash.registration_count) * 100) : 0,
      },
    ]
    return steps
  }, [dash])

  function onSelect(e: ChangeEvent<HTMLSelectElement>) {
    setSelectedId(e.target.value)
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h1>Dashboard</h1>
          <p>Overall picture and per-program drill-down, from live data.</p>
        </div>
      </div>

      {error && <div className="errorbox" style={styles.mb}>{error}</div>}

      {loadingPrograms ? (
        <div className="loading">Loading…</div>
      ) : programs.length === 0 ? (
        <p className="muted">No programs yet. Create your first program to populate the dashboard.</p>
      ) : (
        <>
          {/* Global overview stats */}
          <div className="statgrid" style={styles.mb}>
            <div className="card" style={styles.pad}>
              <div className="cardhead">
                <h3>Programs</h3>
              </div>
              <div style={styles.big}><CountUp value={programs.length} /></div>
              <div className="muted" style={styles.small}>across the session</div>
              <div style={styles.statusWrap}>
                {[...statusCounts.entries()].slice(0, 5).map(([status, count]) => (
                  <div key={status} style={styles.statusRow}>
                    <span className={`badge ${status}`}>{STATUS_LABELS[status] || status}</span>
                    <span style={styles.statusCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={styles.pad}>
              <div className="cardhead"><h3>Registrations</h3></div>
              <div style={styles.big}><CountUp value={totalRegistered} /></div>
              <div className="muted" style={styles.small}>approved + submitted</div>
            </div>

            <div className="card" style={styles.pad}>
              <div className="cardhead"><h3>Program Days</h3></div>
              <div style={styles.big}><CountUp value={totalDays} /></div>
              <div className="muted" style={styles.small}>scheduled across programs</div>
            </div>
          </div>

          {/* Program selector + detailed dashboard */}
          <div className="card" style={styles.mb}>
            <div className="cardhead">
              <div><h3>Program Details</h3><div className="sub muted">Select a program to see its live dashboard</div></div>
            </div>
            <select value={selectedId} onChange={onSelect} style={styles.select}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.short_code})</option>
              ))}
            </select>
          </div>

          {selectedProgram && (
            <div className="card" style={styles.mb}>
              <div className="cardhead">
                <div>
                  <h3>{selectedProgram.title}</h3>
                  <div className="sub muted">
                    {selectedProgram.short_code} • {selectedProgram.academic_session_code} • {selectedProgram.status_display}
                  </div>
                </div>
                <span className="pill"><span className="live"></span>Live</span>
              </div>

              {loadingDash ? (
                <div className="loading">Loading…</div>
              ) : dash ? (
                <>
                  <div className="statgrid" style={styles.mb}>
                    <MiniStat label="Registration Rate" value={`${dash.attendance_rate}%`} />
                    <MiniStat label="Food Claimed" value={String(dash.food_claimed)} sub={`${dash.food_eligible} eligible`} />
                    <MiniStat label="Feedback Rate" value={`${dash.feedback_rate}%`} sub={`${dash.feedback_count} responses`} />
                    <MiniStat label="Certificates" value={String(dash.certificates_issued)} sub={`${dash.certificates_pending} pending`} />
                  </div>

                  <Funnel rows={funnel} />

                  {dash.upcoming_days.length > 0 && (
                    <div style={styles.upcoming}>
                      <span className="muted2" style={styles.upcomingLabel}>Upcoming days</span>
                      <div style={styles.upcomingChips}>
                        {dash.upcoming_days.map((d) => (
                          <div key={d.day_number} style={styles.upcomingChip}>
                            <b>Day {d.day_number}</b>
                            <span className="muted2">{new Date(d.date).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div className="val"><CountUp value={value} /></div>
      {sub && <div className="muted2" style={styles.small}>{sub}</div>}
    </div>
  )
}

const FUNNEL_PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#14b8a6', '#6366f1']

function Funnel({ rows }: { rows: FunnelStep[] }) {
  return (
    <div style={styles.funnel}>
      {rows.map((row, i) => (
        <div key={row.label} style={styles.funnelStep}>
          <span style={{ ...styles.funnelDot, background: FUNNEL_PALETTE[i % FUNNEL_PALETTE.length] }}></span>
          <div className="muted" style={styles.funnelLabel}>{row.label}</div>
          <div style={styles.funnelValue}>{row.value}</div>
          <div style={styles.funnelTrack}>
            <div style={{ ...styles.funnelFill, width: `${row.pct}%`, background: FUNNEL_PALETTE[i % FUNNEL_PALETTE.length] }}></div>
          </div>
          <div className="muted2" style={styles.funnelPct}>{row.pct}%</div>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  mb: { marginBottom: '1rem' },
  pad: { padding: '18px' },
  big: { fontSize: '30px', fontWeight: 750, letterSpacing: '-.5px' },
  small: { fontSize: '12px', marginTop: 2 },
  statusWrap: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  statusCount: { fontWeight: 700 },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
  },
  funnel: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 0, marginTop: 8 },
  funnelStep: { padding: '8px 14px' },
  funnelDot: { width: 34, height: 6, borderRadius: 999, display: 'block', marginBottom: 10 },
  funnelLabel: { fontSize: '12.5px' },
  funnelValue: { fontSize: '22px', fontWeight: 750, letterSpacing: '-.5px', marginTop: 2 },
  funnelTrack: { height: 5, borderRadius: 999, background: '#eef2f7', marginTop: 12, overflow: 'hidden' },
  funnelFill: { height: '100%', borderRadius: 999 },
  funnelPct: { fontSize: '11px', marginTop: 7 },
  upcoming: { marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border2)' },
  upcomingLabel: { fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' },
  upcomingChips: { display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  upcomingChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    border: '1px solid var(--border)',
    borderRadius: 11,
    padding: '10px 14px',
    fontSize: '12.5px',
  },
}
