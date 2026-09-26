import { useState } from 'react'
import { verifyCertificate, type CertificateVerifyResult } from '../../api/public'
import { apiErrorMessage } from '../../api/client'
import { Err, Btn, TextInput } from '../../components/common'

export default function CertificateVerifyPage() {
  const [number, setNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CertificateVerifyResult | null>(null)

  function run() {
    const n = number.trim()
    if (!n || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    verifyCertificate(n)
      .then((r) => setResult(r))
      .catch((e) => setError(apiErrorMessage(e, 'Unable to verify certificate')))
      .finally(() => setLoading(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Verify a certificate</h1>
        <p className="muted2" style={{ fontSize: 13, margin: '0 0 16px' }}>
          Enter the certificate number printed on the document to confirm its authenticity.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
          noValidate
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextInput
                value={number}
                onChange={setNumber}
                placeholder="e.g. IQAC-CERT-2026-0001"
                label="Certificate number"
                id="cert-number"
                style={{ width: '100%' }}
              />
            </div>
            <Btn type={loading ? 'button' : 'submit'} onClick={() => {}} disabled={loading || !number.trim()}>{loading ? 'Checking…' : 'Verify'}</Btn>
          </div>
        </form>
        <Err msg={error} />
      </div>

      {result && (
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: 28,
            textAlign: 'center',
            boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)',
            border: `2px solid ${result.valid ? 'var(--success-d)' : 'var(--danger-d)'}`,
          }}
        >
          <div style={{ fontSize: 44 }}>{result.valid ? '✅' : '⚠️'}</div>
          <h2 style={{ margin: '8px 0 2px' }}>
            {result.valid ? 'Certificate verified' : result.status === 'NOT_FOUND' ? 'Certificate not found' : 'Certificate invalid'}
          </h2>
          <div className="muted2" style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            {result.certificate_number}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380, margin: '0 auto', textAlign: 'left' }}>
            <Row label="Status" value={result.valid ? 'Valid' : result.status} />
            {result.valid && (
              <>
                <Row label="Issued to" value={result.participant_name} />
                <Row label="Program" value={result.program_title} />
                <Row label="Program dates" value={result.program_date} />
                <Row label="Issued by" value={result.issued_by} />
                <Row label="Issued on" value={result.issued_date} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted2" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}
