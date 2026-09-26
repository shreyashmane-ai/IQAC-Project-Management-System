import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { createReportExport, getReportColumnCatalog, listReportExports } from '../api/reports'
import { listPrograms } from '../api/programs'
import { REPORT_TYPES, type ProgramListItem, type ReportColumn, type ReportExport } from '../types'
import {
  Btn,
  Err,
  Loading,
  PageHeader,
  TSelect,
} from '../components/common'
import { fmtDateTime, titleCase } from '../utils/date'

const FORMATS = ['xlsx', 'csv', 'pdf'] as const

export default function ReportsPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0])
  const [format, setFormat] = useState<string>('xlsx')
  const [exports, setExports] = useState<ReportExport[]>([])
  const [columns, setColumns] = useState<ReportColumn[]>([])
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    try {
      const data = await listPrograms()
      setPrograms(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load programs'))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadPrograms)
  }, [loadPrograms])

  useEffect(() => {
    getReportColumnCatalog(reportType)
      .then((d) => {
        setColumns(d.columns)
        setSelectedCols(d.columns.filter((c) => c.is_default).map((c) => c.field_name))
      })
      .catch(() => setColumns([]))
  }, [reportType])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReportExports({ program: programId || undefined })
      setExports(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load report exports'))
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function handleCreate() {
    setSaving(true)
    setSaveError(null)
    try {
      await createReportExport({
        report_type: reportType,
        format: format as (typeof FORMATS)[number],
        program: programId || null,
        columns: selectedCols.length ? selectedCols : undefined,
      })
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to create export'))
    } finally {
      setSaving(false)
    }
  }

  function toggleCol(field: string) {
    setSelectedCols((prev) =>
      prev.includes(field) ? prev.filter((c) => c !== field) : [...prev, field],
    )
  }

  return (
    <div>
      <PageHeader title="Reports" sub="Build and export reports across the system." />
      <Err msg={error} />

      <div className="card" style={styles.card}>
        <h3 style={styles.cardTitle}>Create Export</h3>
        <div style={styles.toolbar}>
          <TSelect
            value={reportType}
            onChange={setReportType}
            options={REPORT_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
            allLabel="Select report type…"
          />
          <select
            value={format}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value)}
            style={styles.select}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
          <TSelect
            value={programId}
            onChange={setProgramId}
            options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
            allLabel="All programs"
            style={{ flex: 1 }}
          />
        </div>

        {columns.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>Columns ({selectedCols.length} selected)</b>
              <span style={{ fontSize: 12 }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setSelectedCols(columns.map((c) => c.field_name)) }} style={{ color: '#2563eb' }}>Select all</a>
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); setSelectedCols(columns.filter((c) => c.is_default).map((c) => c.field_name)) }} style={{ color: '#2563eb' }}>Defaults</a>
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {columns.map((c) => (
                <label
                  key={c.field_name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: `1px solid ${selectedCols.includes(c.field_name) ? '#2563eb' : 'var(--border)'}`,
                    background: selectedCols.includes(c.field_name) ? 'rgba(37,99,235,.08)' : '#fff',
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(c.field_name)}
                    onChange={() => toggleCol(c.field_name)}
                  />
                  <span>{c.display_name}</span>
                  {c.is_pii && <span className="muted2" style={{ fontSize: 10 }}>(PII)</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <Err msg={saveError} />
        <Btn onClick={handleCreate} disabled={saving || !reportType}>
          {saving ? 'Creating…' : 'Generate export'}
        </Btn>
      </div>

      <h3 style={styles.subhead}>Report Types</h3>
      <div style={styles.catalog}>
        {REPORT_TYPES.map((t) => (
          <div key={t} className="card" style={styles.catCard}>
            <b>{titleCase(t)}</b>
            <span className="muted2" style={styles.small}>{t}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : exports.length === 0 ? (
        <p className="muted">No exports generated yet.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="cardhead">
            <h3>Recent Exports</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Program</th>
                <th>Format</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.report_type_display || titleCase(e.report_type)}</b></td>
                  <td className="muted">{e.program_title || 'All'}</td>
                  <td className="muted2">{e.format.toUpperCase()}</td>
                  <td><span className="badge">{e.status_display || titleCase(e.status)}</span></td>
                  <td className="muted2">{e.row_count ?? '—'}</td>
                  <td className="muted">{fmtDateTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { padding: '18px', marginBottom: '1.25rem' },
  cardTitle: { marginBottom: '0.75rem' },
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    background: '#fff',
    outline: 0,
  },
  subhead: { fontSize: '14px', margin: '0 0 0.75rem' },
  catalog: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: '1.25rem' },
  catCard: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  small: { fontSize: 11 },
}
