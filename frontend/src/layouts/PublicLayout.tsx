import { Link, Outlet } from 'react-router-dom'

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  padding: '12px 16px',
  background: 'rgba(255,255,255,.82)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 20,
}
const brandStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 17,
  color: 'var(--text)',
  textDecoration: 'none',
  letterSpacing: '-.3px',
}
const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}
const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '8px 13px',
  borderRadius: 11,
  color: '#2563eb',
  fontSize: 13,
  textDecoration: 'none',
  fontWeight: 600,
  background: '#eff6ff',
  transition: 'background .15s ease, color .15s ease',
}
const footerStyle: React.CSSProperties = {
  marginTop: 40,
  padding: '26px 18px 30px',
  borderTop: '1px solid var(--border)',
  background: 'rgba(255,255,255,.72)',
  backdropFilter: 'blur(10px)',
}
const footLinkStyle: React.CSSProperties = {
  color: 'var(--link)',
  fontWeight: 600,
  fontSize: 13,
}

function openCookieConsent() {
  window.dispatchEvent(new CustomEvent('iqac:open-consent'))
}

export default function PublicLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg,#f3f6fc 0%,#eef4fb 50%,#e7f3fb 100%)',
      }}
    >
      <header style={headerStyle}>
        <Link to="/" style={brandStyle}>
          IQAC <span style={{ color: '#2563eb' }}>PMS</span>
        </Link>
        <div style={navStyle}>
          <Link to="/verify" style={linkBtnStyle}>Verify a certificate</Link>
          <Link to="/my-qrs" style={linkBtnStyle}>My QR codes</Link>
        </div>
      </header>
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 860,
          margin: '22px auto 0',
          padding: '0 14px',
        }}
      >
        <Outlet />
      </main>
      <footer style={footerStyle}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
            IQAC <span style={{ color: '#2563eb' }}>PMS</span>
          </div>
          <div className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>
            Internal Quality Assurance Cell — Program Management System
            <br />
            Contact: <a href="mailto:shreyashmane.ai@gmail.com" style={{ color: 'var(--link)' }}>shreyashmane.ai@gmail.com</a>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <Link to="/privacy" style={footLinkStyle}>Privacy Policy</Link>
            <Link to="/terms" style={footLinkStyle}>Terms &amp; Conditions</Link>
            <Link to="/cookies" style={footLinkStyle}>Cookie Policy</Link>
            <Link to="/refunds" style={footLinkStyle}>Refund Policy</Link>
            <button
              type="button"
              onClick={openCookieConsent}
              style={{ ...footLinkStyle, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              Cookie Preferences
            </button>
          </div>
          <div className="muted2" style={{ fontSize: 12, marginTop: 14 }}>
            © {new Date().getFullYear()} IQAC PMS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
