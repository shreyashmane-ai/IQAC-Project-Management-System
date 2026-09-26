import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublicFeedback, submitFeedback, type PublicFeedbackInstance } from '../../api/public'
import { apiErrorMessage } from '../../api/client'
import { Loading, Err, Btn, TextInput } from '../../components/common'
import { DynamicForm } from '../../components/DynamicForm'
import { validateForm, type FormValues } from '../../utils/dynamicForm'

export default function PublicFeedbackPage() {
  const { token = '' } = useParams()
  const [instances, setInstances] = useState<PublicFeedbackInstance[]>([])
  const [selected, setSelected] = useState<PublicFeedbackInstance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [values, setValues] = useState<FormValues>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [regNo, setRegNo] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    getPublicFeedback(token)
      .then((d) => {
        if (!active) return
        setInstances(d)
        if (d.length === 1) setSelected(d[0])
      })
      .catch((e) => { if (active) setError(apiErrorMessage(e, 'Unable to load feedback forms')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) return <Loading />

  if (instances.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h2>No feedback currently open</h2>
        <p className="muted">There are no active feedback forms for this program right now.</p>
        <Link to={`/p/${token}`} className="btn ghost">Back to program</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <h2 style={{ margin: '10px 0 6px' }}>Feedback submitted</h2>
        <p className="muted">Thank you for your feedback.</p>
        <Link to={`/p/${token}`} className="btn ghost">Back to program</Link>
      </div>
    )
  }

  function handleSubmit() {
    if (!selected) return
    const errs = validateForm(selected.schema as any, values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    setError(null)
    submitFeedback(token, {
      instance_id: selected.id,
      answers: values,
      registration_number: regNo.trim(),
      is_anonymous: selected.is_anonymous,
    })
      .then(() => setDone(true))
      .catch((e) => setError(apiErrorMessage(e, 'Submission failed')))
      .finally(() => setSubmitting(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Feedback</h1>
        <p className="muted2" style={{ fontSize: 13, margin: 0 }}>Please share your experience</p>
      </div>

      {instances.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
          <SelectForm instances={instances} selected={selected} onSelect={setSelected} />
        </div>
      )}

      {selected && (
        <div style={{ background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 30px -18px rgba(29,78,216,.32)' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            noValidate
          >
            <h2 style={{ fontSize: 18, margin: '0 0 2px' }}>{selected.title}</h2>
            {selected.description && <p className="muted" style={{ fontSize: 13 }}>{selected.description}</p>}

            {!selected.is_anonymous && (
              <div style={{ marginBottom: 18 }}>
                <TextInput value={regNo} onChange={setRegNo} placeholder="e.g. IQAC-2026-0001" label="Registration number" id="fb-reg-no" />
              </div>
            )}

            <DynamicForm schema={selected.schema as any} values={values} onChange={setValues} errors={fieldErrors} />
            <Err msg={error} />
            <div style={{ marginTop: 8 }}>
              <Btn type="submit" onClick={() => {}} disabled={submitting || (!selected.is_anonymous && !regNo.trim())}>
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </Btn>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function SelectForm({
  instances,
  selected,
  onSelect,
}: {
  instances: PublicFeedbackInstance[]
  selected: PublicFeedbackInstance | null
  onSelect: (i: PublicFeedbackInstance) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Select a feedback form</div>
      {instances.map((i) => (
        <label
          key={i.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${selected?.id === i.id ? '#2563eb' : 'var(--border)'}`,
            cursor: 'pointer',
            background: selected?.id === i.id ? 'rgba(37,99,235,.06)' : '#fff',
          }}
        >
          <input type="radio" checked={selected?.id === i.id} onChange={() => onSelect(i)} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{i.title}</div>
            {i.day_number != null && <div className="muted2" style={{ fontSize: 12 }}>Day {i.day_number}</div>}
          </div>
        </label>
      ))}
    </div>
  )
}
