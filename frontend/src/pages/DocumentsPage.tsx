import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { apiErrorMessage } from '../api/client'
import { listDocuments, updateDocument, deleteDocument, uploadDocument } from '../api/documents'
import { listPrograms } from '../api/programs'
import { DOCUMENT_CATEGORIES, type Document, type ProgramListItem } from '../types'
import {
  Btn,
  Err,
  PageHeader,
  TSelect,
  TextInput,
  RowBtn,
} from '../components/common'
import { fmtDate, fmtSize, titleCase } from '../utils/date'
import { DataTable } from '../components/DataTable'
import { useConfirm, useToast } from '../components/Overlay'
import { EmptyState } from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeleton'

export default function DocumentsPage() {
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [programId, setProgramId] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
      const data = await listDocuments({
        program: programId || undefined,
        category: category || undefined,
        search: search || undefined,
      })
      setDocs(data.results)
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load documents'))
    } finally {
      setLoading(false)
    }
  }, [programId, category, search])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function handleUpload() {
    if (!file || !title.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await uploadDocument(file, {
        program: programId,
        title: title.trim(),
        category: cat,
        description: desc.trim() || undefined,
      })
      setShowForm(false)
      setTitle('')
      setDesc('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to upload document'))
    } finally {
      setSaving(false)
    }
  }

  function startEditDoc(d: Document) {
    setEditingDoc(d)
    setEditForm({
      title: d.title,
      description: d.description || '',
      category: DOCUMENT_CATEGORIES.includes(d.category as (typeof DOCUMENT_CATEGORIES)[number])
        ? d.category
        : 'OTHER',
    })
    setSaveError(null)
  }

  async function saveEditDoc() {
    if (!editingDoc || !editForm.title.trim()) return
    setEditSaving(true)
    setSaveError(null)
    try {
      await updateDocument(editingDoc.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        category: editForm.category,
      })
      setEditingDoc(null)
      await load()
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to update document'))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteDoc(d: Document) {
    if (
      !(await confirmAsk({
        title: 'Delete document',
        body: `Delete document "${d.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        needType: true,
      }))
    )
      return
    setDeletingId(d.id)
    setError(null)
    try {
      await deleteDocument(d.id)
      toast.success('Document deleted')
      if (editingDoc?.id === d.id) setEditingDoc(null)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete document'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        sub="Circulars, permission letters, evidence and other program documents."
        actions={<Btn onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Upload file'}</Btn>}
      />

      <div style={styles.toolbar}>
        <TSelect
          value={programId}
          onChange={setProgramId}
          options={programs.map((p) => ({ value: p.id, label: `${p.title} (${p.short_code})` }))}
          style={{ maxWidth: 320 }}
          allLabel="All programs"
        />
        <TSelect
          value={category}
          onChange={setCategory}
          options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
          allLabel="All categories"
        />
        <TextInput placeholder="Search…" value={search} onChange={setSearch} style={{ flex: 1 }} />
      </div>

      <Err msg={error} />

      {showForm && programId && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>Upload document</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Title *</span>
              <TextInput value={title} onChange={setTitle} placeholder="Document title" />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Category</span>
              <TSelect
                value={cat}
                onChange={setCat}
                options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
              />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Description (optional)</span>
              <TextInput value={desc} onChange={setDesc} />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>File *</span>
              <input
                ref={fileRef}
                type="file"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {file && <p className="muted2" style={styles.file}>{file.name} • {fmtSize(file.size)}</p>}
          <Err msg={saveError} />
          <Btn onClick={handleUpload} disabled={saving || !file || !title.trim()}>
            {saving ? 'Uploading…' : 'Upload'}
          </Btn>
        </div>
      )}

      {editingDoc && (
        <div className="card" style={styles.card}>
          <h3 style={styles.cardTitle}>Edit document</h3>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Title *</span>
              <TextInput value={editForm.title} onChange={(v) => setEditForm((f) => ({ ...f, title: v }))} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Category</span>
              <TSelect
                value={editForm.category}
                onChange={(v) => setEditForm((f) => ({ ...f, category: v }))}
                options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))}
              />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.label}>Description (optional)</span>
              <TextInput value={editForm.description} onChange={(v) => setEditForm((f) => ({ ...f, description: v }))} />
            </label>
          </div>
          <Err msg={saveError} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn onClick={saveEditDoc} disabled={editSaving || !editForm.title.trim()}>
              {editSaving ? 'Saving…' : 'Save'}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditingDoc(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : docs.length === 0 ? (
        <EmptyState icon="folder" title="No documents yet" body="Uploaded circulars, letters and evidence will appear here." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            rows={docs}
            rowKey={(d) => d.id}
            searchPlaceholder="Search documents…"
            search={(d, q) =>
              [d.title, d.category_display || d.category, d.original_filename, d.uploaded_by_name]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
            }
            columns={[
              {
                key: 'title',
                label: 'Title',
                sort: (d) => d.title,
                render: (d) => (
                  <>
                    <b>{d.title}</b>
                    {d.is_validated && <span className="badge" style={styles.validated}>Validated</span>}
                  </>
                ),
              },
              { key: 'category', label: 'Category', render: (d) => <span className="muted">{d.category_display || titleCase(d.category)}</span> },
              {
                key: 'file',
                label: 'File',
                render: (d) =>
                  d.original_filename || d.file ? (
                    <a href={d.file_url || d.file || '#'} target="_blank" rel="noreferrer">
                      {d.original_filename || 'Download'}
                    </a>
                  ) : (
                    '—'
                  ),
              },
              { key: 'uploaded', label: 'Uploaded By', render: (d) => <span className="muted">{d.uploaded_by_name || '—'}</span> },
              {
                key: 'date',
                label: 'Date',
                sort: (d) => (d.created_at ? String(d.created_at) : ''),
                render: (d) => <span className="muted">{fmtDate(d.created_at)}</span>,
              },
            ]}
            actions={(d) => (
              <>
                <RowBtn kind="edit" onClick={() => startEditDoc(d)}>Edit</RowBtn>
                <RowBtn kind="del" onClick={() => handleDeleteDoc(d)} disabled={deletingId === d.id}>
                  {deletingId === d.id ? 'Deleting…' : 'Delete'}
                </RowBtn>
              </>
            )}
          />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  card: { padding: '18px', marginBottom: '1rem' },
  cardTitle: { marginBottom: '0.75rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.75rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '12.5px', fontWeight: 600 },
  file: { fontSize: '12.5px', marginBottom: '0.75rem' },
  validated: { marginLeft: 8, background: '#dcfce7', color: '#15803d', border: 'none' },
  actions: { textAlign: 'right', whiteSpace: 'nowrap' },
}
