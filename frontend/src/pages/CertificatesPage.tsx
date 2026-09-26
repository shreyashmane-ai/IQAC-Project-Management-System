import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { cancelCertificate, deleteCertificate, getCertificateConfig, listCertificates, resendCertificate } from '../api/certificates'
import { listPrograms } from '../api/programs'
import type { Certificate, CertificateConfig, ProgramListItem } from '../types'
import {
  Err,
  PageHeader,
  Stat,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { fmtDateTime, titleCase } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

export default function CertificatesPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [search, setSearch] = useState('')
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [config, setConfig] = useState<CertificateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const confirmAsk = useConfirm()
  const toast = useToast()

  const loadPrograms = useCallback(async () => {
    try {
      const data = await listPrograms()
      setPrograms(data.results)
      if (data.results.length > 0) setProgramId(data.results[0].id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadPrograms)
  }, [loadPrograms])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [certs, cfg] = await Promise.all([
        listCertificates({ program: programId || undefined, search: search || undefined }),
        programId ? getCertificateConfig(programId).catch(() => null) : Promise.resolve(null),
      ])
      setCertificates(certs.results)
      setConfig(cfg)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load certificates'))
    } finally {
      setLoading(false)
    }
  }, [programId, search])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function handleDelete(c: Certificate) {
    if (
      !(await confirmAsk({
        title: 'Delete certificate',
        body: `Delete certificate "${c.certificate_number}" for ${c.participant_name}? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(c.id)
    setError(null)
    try {
      await deleteCertificate(c.id)
      toast.success('Certificate deleted')
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete certificate'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleResend(c: Certificate) {
    setBusyId(c.id)
    setError(null)
    try {
      await resendCertificate(c.id)
      toast.success(`Email queued for ${c.participant_email}`)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to queue resend'))
    } finally {
      setBusyId(null)
      await load()
    }
  }

  async function handleCancel(c: Certificate) {
    if (
      !(await confirmAsk({
        title: 'Cancel certificate',
        body: `Cancel certificate "${c.certificate_number}" for ${c.participant_name}? This marks it as cancelled and cannot be undone.`,
        confirmLabel: 'Cancel certificate',
        danger: true,
        needType: true,
      }))
    )
      return
    setBusyId(c.id)
    setError(null)
    try {
      await cancelCertificate(c.id)
      toast.success('Certificate cancelled')
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to cancel certificate'))
    } finally {
      setBusyId(null)
      await load()
    }
  }

  const counts = certificates.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div>
      <PageHeader title="Certificates" sub="Generated certificates and program-level configuration." />
      <div style={styles.toolbar}>
        <TSelect
          value={programId}
          onChange={setProgramId}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 320 }}
          allLabel="All programs"
        />
        <TextInput placeholder="Search name / number…" value={search} onChange={setSearch} style={{ flex: 1 }} />
      </div>
      <Err msg={error} />

      {config && (
        <div className="statgrid" style={styles.mb}>
          <Stat label="Prefix" value={config.certificate_prefix || '—'} />
          <Stat label="Current Number" value={config.current_number} />
          <Stat label="Auto-generate" value={config.auto_generate ? 'Yes' : 'No'} />
          <Stat label="Auto-send" value={config.auto_send ? 'Yes' : 'No'} />
          <Stat label="Manual approval" value={config.require_manual_approval ? 'Yes' : 'No'} />
        </div>
      )}

      {Object.keys(counts).length > 0 && (
        <p className="muted" style={styles.mb}>
          {Object.entries(counts).map(([s, n]) => `${titleCase(s)}: ${n}`).join('   •   ')}
        </p>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : certificates.length === 0 ? (
        <EmptyState icon="document" title="No certificates yet" body="Certificates appear here once generated for a program." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            rows={certificates}
            rowKey={(c) => c.id}
            pageSize={8}
            searchPlaceholder="Search certificates…"
            search={(c, q) =>
              [c.certificate_number, c.participant_name, c.participant_email, c.program_short_code || '', c.status]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              {
                key: 'no',
                label: 'Certificate No.',
                sort: (c) => c.certificate_number,
                render: (c) => <span className="muted2">{c.certificate_number}</span>,
              },
              {
                key: 'participant',
                label: 'Participant',
                sort: (c) => c.participant_name,
                render: (c) => (
                  <>
                    <b>{c.participant_name}</b>
                    <div className="muted2" style={{ fontSize: 12 }}>{c.participant_email}</div>
                  </>
                ),
              },
              { key: 'program', label: 'Program', render: (c) => <span className="muted">{c.program_short_code}</span> },
              { key: 'status', label: 'Status', render: (c) => <span className="badge">{c.status_display || titleCase(c.status)}</span> },
              { key: 'email', label: 'Email', render: (c) => <span className="muted">{c.email_status ? titleCase(c.email_status) : '—'}</span> },
              {
                key: 'generated',
                label: 'Generated',
                sort: (c) => (c.pdf_generated_at ? String(c.pdf_generated_at) : ''),
                render: (c) => <span className="muted">{fmtDateTime(c.pdf_generated_at)}</span>,
              },
            ]}
            actions={(c) => (
              <div className="tbl-acts">
                {c.status !== 'CANCELLED' && (
                  <>
                    <RowBtn kind="ok" onClick={() => handleResend(c)} disabled={busyId === c.id} title="Queue certificate email">
                      {busyId === c.id ? '…' : 'Resend'}
                    </RowBtn>
                    <RowBtn kind="plain" onClick={() => handleCancel(c)} disabled={busyId === c.id} title="Cancel certificate">
                      {busyId === c.id ? '…' : 'Cancel'}
                    </RowBtn>
                  </>
                )}
                <RowBtn kind="del" onClick={() => handleDelete(c)} disabled={deletingId === c.id || busyId === c.id} title="Delete certificate">
                  {deletingId === c.id ? 'Deleting…' : 'Delete'}
                </RowBtn>
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  mb: { marginBottom: '1rem' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
