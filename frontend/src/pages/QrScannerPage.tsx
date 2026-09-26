import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { scanAttendance } from '../api/attendance'
import { scanFoodClaim } from '../api/food'
import { listFoodServices } from '../api/food'
import { listProgramDays, listPrograms, type ProgramDay } from '../api/programs'
import type { FoodService, ProgramListItem } from '../types'
import { Btn, Err, PageHeader, TSelect, TextInput } from '../components/common'

type Mode = 'attendance' | 'food'

interface DetectorResult {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement | HTMLImageElement | Blob) => Promise<DetectorResult[]>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

export default function QrScannerPage() {
  const [mode, setMode] = useState<Mode>('attendance')
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [days, setDays] = useState<ProgramDay[]>([])
  const [dayId, setDayId] = useState('')
  const [services, setServices] = useState<FoodService[]>([])
  const [serviceId, setServiceId] = useState('')
  const [gateName, setGateName] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; name?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanActive = useRef(false)

  useEffect(() => {
    listPrograms()
      .then((d) => {
        setPrograms(d.results)
        if (d.results.length) setProgramId(d.results[0].id)
      })
      .catch((e) => setError(apiErrorMessage(e, 'Failed to load programs')))
  }, [])

  useEffect(() => {
    if (!programId) return
    Promise.all([
      listProgramDays(programId),
      mode === 'food' ? listFoodServices({ program: programId }).then((r) => r.results) : Promise.resolve([]),
    ])
      .then(([d, sv]) => {
        setDays(d)
        setServices(sv)
        if (d.length) setDayId((prev) => prev || d[0].id)
        if (sv.length) setServiceId((prev) => prev || sv[0].id)
      })
      .catch(() => {})
  }, [programId, mode])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
    scanActive.current = false
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function startCamera() {
    setCamError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Camera not available on this browser. Use manual entry below.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      scanActive.current = true
      requestAnimationFrame(scanLoop)
    } catch {
      setCamError('Unable to access camera. Use manual entry below.')
      setCameraOn(false)
    }
  }

  function scanLoop() {
    if (!scanActive.current || !videoRef.current) return
    const detector = typeof window !== 'undefined' ? window.BarcodeDetector : undefined
    if (!detector) {
      setCamError('QR camera decoding is not supported in this browser. Use manual entry below.')
      scanActive.current = false
      setCameraOn(false)
      return
    }
    const d = new detector({ formats: ['qr_code'] })
    d.detect(videoRef.current)
      .then((codes) => {
        if (scanActive.current && codes.length > 0) {
          const raw = codes[0]?.rawValue || ''
          if (raw) {
            void submitRaw(raw, true)
            scanActive.current = false
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (scanActive.current) requestAnimationFrame(scanLoop)
      })
  }

  async function submitRaw(raw: string, fromCamera: boolean) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (fromCamera) stopCamera()
      let res: { result: string; message: string; participant_name?: string }
      if (mode === 'attendance') {
        if (!dayId) throw new Error('Select a day first')
        res = await scanAttendance({
          attendance_token: raw,
          day_id: dayId,
          gate_name: gateName || undefined,
        })
      } else {
        if (!serviceId && !dayId) throw new Error('Select a food service or day first')
        res = await scanFoodClaim({
          token: raw,
          food_service_id: serviceId || undefined,
          day_id: dayId || undefined,
          gate_name: gateName || undefined,
        })
      }
      setResult({ ok: true, message: res.message, name: res.participant_name })
      setManual('')
      if (fromCamera) {
        // re-arm for continuous scanning
        scanActive.current = true
        requestAnimationFrame(scanLoop)
      }
    } catch (e) {
      setResult({ ok: false, message: apiErrorMessage(e, 'Scan failed') })
      if (fromCamera) {
        scanActive.current = true
        requestAnimationFrame(scanLoop)
      }
    } finally {
      setBusy(false)
    }
  }

  function manualSubmit() {
    if (!manual.trim()) return
    void submitRaw(manual.trim(), false)
  }

  return (
    <div>
      <PageHeader title="QR Scanner" sub="Scan participant or food QR codes." />

      <div style={styles.toolbar}>
        {(['attendance', 'food'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setResult(null); stopCamera() }}
            style={{
              ...styles.modeBtn,
              background: mode === m ? '#2563eb' : '#fff',
              color: mode === m ? '#fff' : 'var(--text)',
            }}
          >
            {m === 'attendance' ? 'Attendance' : 'Food claim'}
          </button>
        ))}
        <TSelect value={programId} onChange={setProgramId} options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))} style={{ maxWidth: 300 }} />
        <TSelect value={dayId} onChange={setDayId} options={days.map((d) => ({ value: d.id, label: `Day ${d.day_number} • ${new Date(d.date + 'T00:00:00').toLocaleDateString()}` }))} allLabel="Day…" style={{ maxWidth: 180 }} />
        {mode === 'food' && (
          <TSelect value={serviceId} onChange={setServiceId} options={services.map((s) => ({ value: s.id, label: s.name || s.service_type }))} allLabel="Any service…" style={{ maxWidth: 180 }} />
        )}
        <TextInput value={gateName} onChange={setGateName} placeholder="Gate name (opt)" ariaLabel="Gate name" style={{ maxWidth: 120 }} />
      </div>

      <Err msg={error} />
      {camError && <div className="errorbox" style={styles.mb}>{camError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 12px' }}>Camera scan</h3>
          <div style={{ position: 'relative', background: '#111', borderRadius: 14, overflow: 'hidden', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={videoRef}
              style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: cameraOn ? 'block' : 'none' }}
              muted
              playsInline
            />
            {!cameraOn && <span className="muted" style={{ color: '#888', fontSize: 13 }}>Camera preview</span>}
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? 'Stop camera' : 'Start camera'}</Btn>
          </div>
        </section>

        <section className="card">
          <h3 style={{ margin: '0 0 12px' }}>Manual entry</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextInput value={manual} onChange={setManual} placeholder="Paste or type QR token…" ariaLabel="QR token" style={{ flex: 1 }} />
            <Btn onClick={manualSubmit} disabled={busy || !manual.trim()}>Submit</Btn>
          </div>

          {result && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: `1px solid ${result.ok ? 'rgba(34,197,94,.4)' : 'var(--danger)'}`, background: result.ok ? 'rgba(34,197,94,.08)' : 'rgba(220,38,38,.06)' }}>
              {result.ok ? <div style={{ fontSize: 22 }}>✅ {result.name || 'Verified'}</div> : <div style={{ fontSize: 22 }}>❌ Failed</div>}
              <div style={{ marginTop: 4, fontSize: 13, color: result.ok ? 'var(--success-d)' : 'var(--danger)' }}>{result.message}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' },
  mb: { marginBottom: '1rem' },
  modeBtn: {
    padding: '9px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}