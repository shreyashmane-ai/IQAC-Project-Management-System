import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const CONSENT_KEY = 'iqac-consent'
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700;800&family=Fira+Code:wght@500;600&display=swap'

function applyFonts(enabled: boolean) {
  const existing = document.getElementById('iqac-gfonts')
  if (enabled) {
    if (existing) return
    const link = document.createElement('link')
    link.id = 'iqac-gfonts'
    link.rel = 'stylesheet'
    link.href = FONTS_URL
    document.head.appendChild(link)
  } else {
    existing?.remove()
  }
}

function readConsent(): { fonts: boolean } | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { fonts?: boolean }
    return { fonts: parsed.fonts === true }
  } catch {
    return null
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const sync = () => {
      const existing = readConsent()
      if (existing) {
        applyFonts(existing.fonts)
        setVisible(false)
      } else {
        setVisible(true)
      }
    }
    sync()
    window.addEventListener('iqac:open-consent', sync)
    return () => window.removeEventListener('iqac:open-consent', sync)
  }, [])

  function choose(fonts: boolean) {
    const record = { fonts, at: new Date().toISOString() }
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
    } catch {
      /* storage unavailable: still apply for this session */
    }
    applyFonts(fonts)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 14,
        zIndex: 400,
        maxWidth: 560,
        margin: '0 auto',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 22px 44px -18px rgba(15,23,42,.35)',
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Your privacy choices</div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        We store only what this portal needs: session tokens to keep you signed in (essential), your
        interface and consent preferences (optional), and — if you allow it — font files loaded from the
        Google Fonts CDN. No advertising or analytics cookies are used. See our{' '}
        <Link to="/cookies" style={{ color: 'var(--link)' }}>Cookie Policy</Link> for details.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <button
          type="button"
          onClick={() => choose(true)}
          style={{
            background: 'linear-gradient(135deg,#3b82f6 0%,#2563eb 55%,#1d4ed8 100%)',
            color: '#fff',
            border: '1px solid transparent',
            borderRadius: 12,
            padding: '10px 15px',
            minHeight: 42,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          style={{
            background: '#fff',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 15px',
            minHeight: 42,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Only required
        </button>
      </div>
    </div>
  )
}