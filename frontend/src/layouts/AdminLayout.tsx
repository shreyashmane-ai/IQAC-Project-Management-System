import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MASTERS } from '../types'
import { listNotificationBatches, type NotificationBatch } from '../api/notifications'
import { fmtDateTime } from '../utils/date'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/programs': 'Programs',
  '/sessions': 'Sessions',
  '/participants': 'Participants',
  '/attendance': 'Attendance',
  '/food': 'Food Services',
  '/feedback': 'Feedback',
  '/certificates': 'Certificates',
  '/reports': 'Reports',
  '/documents': 'Documents',
  '/master-data': 'Master Data',
  '/users': 'Users & Roles',
  '/audit': 'Audit Log',
  '/notifications': 'Notifications',
  '/account/security': 'Security',
}

type NavItem = { to: string; label: string; icon: string; end?: boolean }

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    programs: (
      <>
        <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 3v6h6" />
      </>
    ),
    sessions: (
      <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>
    ),
    participants: (
      <>
        <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0-1-5.8M21.5 20a5.5 5.5 0 0 0-4-5.3" />
      </>
    ),
    attendance: (
      <>
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    food: (
      <>
        <path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2M5 11v11M18 2c-2 0-3 2-3 5s1 4 3 4 3-1 3-4-1-5-3-5zM18 15v7" />
      </>
    ),
    feedback: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
    certificates: (
      <>
        <circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5" />
      </>
    ),
    matrix: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h7v7h-7zM16 14v-4M12 14v2" /><path d="M18 14v-4" />
      </>
    ),
    reports: (
      <>
        <path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="13" width="3" height="5" />
      </>
    ),
    documents: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </>
    ),
    'master-data': (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
    users: (
      <>
        <path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" />
      </>
    ),
    audit: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    qr: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="14" y="13" width="3" height="3" rx=".8" /><rect x="18" y="13" width="3" height="3" rx=".8" /><rect x="16" y="17" width="2" height="2" rx=".5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9.5 12l2 2 3.5-3.5" />
      </>
    ),
    bell: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" /><path d="M10.5 21a2 2 0 0 0 3 0" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18M6 6l12 12" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/programs', label: 'Programs', icon: 'programs' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/participants', label: 'Participants', icon: 'participants' },
  { to: '/participants/status', label: 'Status Matrix', icon: 'matrix' },
  { to: '/attendance', label: 'Attendance', icon: 'attendance' },
  { to: '/food', label: 'Food', icon: 'food' },
  { to: '/food/scan', label: 'QR Scanner', icon: 'qr' },
  { to: '/feedback', label: 'Feedback', icon: 'feedback' },
  { to: '/certificates', label: 'Certificates', icon: 'certificates' },
]

const MANAGE_NAV: NavItem[] = [
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/documents', label: 'Documents', icon: 'documents' },
  { to: '/users', label: 'Users & Roles', icon: 'users' },
  { to: '/audit', label: 'Audit Log', icon: 'audit' },
]

function breadFor(path: string): { parent: string; cur: string } {
  if (path.startsWith('/master-data/')) {
    const key = path.split('/')[2]
    const m = MASTERS.find((x) => x.key === key)
    return { parent: 'Master Data', cur: m ? m.plural : 'Settings' }
  }
  if (/^\/programs\/wizard\/?(\d*)/.test(path)) return { parent: 'Programs', cur: 'Wizard' }
  if (/^\/programs\/[^/]+\/links$/.test(path)) return { parent: 'Programs', cur: 'QR Links' }
  if (/^\/programs\/[^/]+$/.test(path)) return { parent: 'Programs', cur: 'Details' }
  if (/^\/participants\/[^/]+$/.test(path)) return { parent: 'Participants', cur: 'Details' }
  if (path === '/food/scan') return { parent: 'Food', cur: 'QR Scanner' }
  const label = PAGE_TITLES[path]
  if (label) return { parent: 'IQAC PMS', cur: label }
  const seg = path.split('/').filter(Boolean)[0]
  const parentLabel = PAGE_TITLES['/' + seg]
  return { parent: 'IQAC PMS', cur: parentLabel || 'IQAC PMS' }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
}

function HeaderToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="side-collapse" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle} aria-label="Toggle sidebar">
      {collapsed ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
          <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
          <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
        </svg>
      )}
    </button>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [masterOpen, setMasterOpen] = useState(() => pathname.startsWith('/master-data'))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifBatches, setNotifBatches] = useState<NotificationBatch[]>([])
  const [notifPending, setNotifPending] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
  const bread = breadFor(pathname)
  const { parent: breadParent, cur: breadCur } = bread

  const [prevPath, setPrevPath] = useState(pathname)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    setSidebarOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  useEffect(() => {
    let on = true
    listNotificationBatches()
      .then(({ results }) => {
        if (!on) return
        setNotifBatches(results.slice(0, 4))
        setNotifPending(results.filter((b) => b.pending > 0 || b.status === 'PENDING').length)
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    if (!notifOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    window.addEventListener('mousedown', onDocMouseDown)
    return () => window.removeEventListener('mousedown', onDocMouseDown)
  }, [notifOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        ;(document.querySelector('.dt-search input') as HTMLInputElement | null)?.focus()
      }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault()
        ;(document.querySelector('.dt-search input') as HTMLInputElement | null)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function closeNav() {
    setSidebarOpen(false)
    setMasterOpen(false)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={closeNav} aria-hidden="true" />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brandrow">
          <NavLink to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setSidebarOpen(false)}>
            <div className="logo"><span></span></div>
            <b>IQAC&nbsp;PMS</b>
          </NavLink>
          <HeaderToggle collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((s) => !s)} />
        </div>

        <div className="org">
          <div className="sq"></div>
          <div>
            <div className="t">IQAC</div>
            <div className="s">Program Management</div>
          </div>
        </div>

        <div className="navlabel">Main</div>
        <nav className="nav">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="navlabel">Manage</div>
        <nav className="nav">
          <button
            type="button"
            className={`subnav-toggle ${pathname.startsWith('/master-data') ? 'active' : ''}`}
            onClick={() => setMasterOpen((s) => !s)}
          >
            <span className="subnav-toggle-icon">
              <Icon name="master-data" />
            </span>
            <span>Master Data</span>
            <span className={`subnav-caret ${masterOpen ? 'open' : ''}`}>▾</span>
          </button>
          {masterOpen && (
            <div className="subnav-group">
              {MASTERS.map((m) => (
                <NavLink
                  key={m.key}
                  to={`/master-data/${m.key}`}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {m.plural}
                </NavLink>
              ))}
            </div>
          )}
          {MANAGE_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-spacer"></div>
        <nav className="nav">
          <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name="bell" />
            <span>Notifications</span>
          </NavLink>
          <NavLink to="/account/security" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name="shield" />
            <span>Security</span>
          </NavLink>
          <a href="#" onClick={handleLogout} title="Log out">
            <Icon name="logout" />
            <span>Log out</span>
          </a>
        </nav>
      </aside>

      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle navigation"
            onClick={() => setSidebarOpen((s) => !s)}
          >
            <span className="menu-icon" />
          </button>
          <div className="topbar-title">
            {breadParent !== 'IQAC PMS' && (
              <>
                <span className="crumb">{breadParent}</span>
                <span className="sep">/</span>
              </>
            )}
            <span className="cur">{breadCur}</span>
          </div>
          <div className="topbar-actions">
            <div className="notif-slot" ref={notifRef}>
              <button
                type="button"
                className={`icon-btn ${notifOpen ? 'is-open' : ''}`}
                title="Notifications"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Icon name="bell" />
                {notifPending > 0 && <span className="bubble">{notifPending}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-head">
                    <b>Notifications</b>
                    <NavLink to="/notifications" onClick={() => setNotifOpen(false)}>View all</NavLink>
                  </div>
                  <div className="notif-list">
                    {notifBatches.length === 0 ? (
                      <div className="notif-empty">No notifications yet.</div>
                    ) : (
                      notifBatches.map((b) => (
                        <div key={b.id} className="notif-item" role="menuitem">
                          <div className="t">{b.program_title || 'Broadcast'}</div>
                          <div className="m">
                            {b.template_name || 'Custom'} · {b.status_display}
                            {b.pending > 0 ? <span style={{ color: 'var(--accent-d)' }}> · {b.pending} pending</span> : null}
                          </div>
                          <div className="m2">{fmtDateTime(b.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="notif-foot">
                    <NavLink to="/notifications" onClick={() => setNotifOpen(false)}>Open Notifications</NavLink>
                  </div>
                </div>
              )}
            </div>
            <div className="userchip">
              <div className="av">{initials(fullName || user?.email || 'U')}</div>
              <div>
                <div className="n">{fullName || 'User'}</div>
                <div className="r">{(user?.role_display || user?.role || '').replaceAll('_', ' ')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}