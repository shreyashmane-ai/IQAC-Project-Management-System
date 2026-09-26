import { useMemo } from 'react'

import type { FormSchema, FormValues } from '../utils/dynamicForm'
import { getFieldOptions } from '../utils/dynamicForm'

const styles: Record<string, React.CSSProperties> = {
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' },
  label: { fontSize: '13px', fontWeight: 600 },
  req: { color: 'var(--danger)', marginLeft: 3 },
  input: {
    padding: '10px 13px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontSize: '13.5px',
    color: 'var(--text)',
    background: '#fff',
    outline: 0,
    fontFamily: 'inherit',
  },
  err: { fontSize: '12px', color: 'var(--danger)' },
  optionRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' },
  checkOption: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '13.5px' },
  section: { fontWeight: 700, margin: '0.75rem 0 0.5rem', paddingBottom: 4, borderBottom: '1px solid var(--border)' },
}

function Value({ value }: { value: unknown }) {
  if (value == null || value === '') return <span className="muted">—</span>
  if (Array.isArray(value)) return <span>{value.join(', ')}</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  return <span>{String(value)}</span>
}

export function DynamicForm({
  schema,
  values,
  onChange,
  errors,
}: {
  schema?: FormSchema
  values: FormValues
  onChange: (values: FormValues) => void
  errors?: Record<string, string>
}) {
  const fields = useMemo(
    () => (schema && Array.isArray(schema.fields) ? schema.fields : []),
    [schema],
  )

  if (fields.length === 0) {
    return <p className="muted2">This form has no fields configured yet.</p>
  }

  function setValue(name: string, value: unknown) {
    onChange({ ...values, [name]: value })
  }

  function controlId(name: string) {
    return `dyn-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  }

  return (
    <div>
      {fields.map((field) => {
        const type = field.type || 'text'
        const label = field.label || field.name
        const err = errors ? errors[field.name] : undefined
        const id = controlId(field.name)
        const required = !!field.required
        const inputProps = {
          id,
          'aria-invalid': err ? true : undefined,
          'aria-describedby': err ? `${id}-error` : undefined,
          'aria-required': required || undefined,
          style: { ...styles.input, ...(err ? { borderColor: 'var(--danger)' } : {}) } as React.CSSProperties,
        }

        if (type === 'section') {
          return (
            <div key={field.name} style={styles.section}>
              {label}
            </div>
          )
        }

        return (
          <div key={field.name} style={styles.field}>
            <label htmlFor={id} style={styles.label}>
              {label}
              {required ? <span style={styles.req}>*</span> : null}
            </label>

            {type === 'longtext' || type === 'textarea' ? (
              <textarea
                rows={4}
                placeholder={type === 'textarea' ? '' : undefined}
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            ) : type === 'select' ? (
              <select value={(values[field.name] as string) || ''} onChange={(e) => setValue(field.name, e.target.value)} {...inputProps}>
                <option value="">Select…</option>
                {getFieldOptions(field).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : type === 'radio' ? (
              <div>
                {getFieldOptions(field).map((o) => (
                  <label key={o.value} style={styles.optionRow}>
                    <input
                      type="radio"
                      name={`radio-${field.name}`}
                      checked={(values[field.name] as string) === o.value}
                      onChange={() => setValue(field.name, o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            ) : type === 'checkbox' || type === 'msq' ? (
              <div>
                {getFieldOptions(field).map((o) => {
                  const arr = (values[field.name] as string[]) || []
                  return (
                    <label key={o.value} style={styles.checkOption}>
                      <input
                        type="checkbox"
                        checked={arr.includes(o.value)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value)
                          setValue(field.name, next)
                        }}
                      />
                      <span>{o.label}</span>
                    </label>
                  )
                })}
              </div>
            ) : type === 'yesno' ? (
              <div style={styles.optionRow}>
                {['yes', 'no'].map((o) => (
                  <label key={o} style={styles.optionRow}>
                    <input
                      type="radio"
                      name={`yn-${field.name}`}
                      checked={(values[field.name] as string) === o}
                      onChange={() => setValue(field.name, o)}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{o}</span>
                  </label>
                ))}
              </div>
            ) : type === 'rating' ? (
              <select value={(values[field.name] as string) || ''} onChange={(e) => setValue(field.name, e.target.value)} {...inputProps}>
                <option value="">Select…</option>
                {Array.from({ length: (field.validation?.max || 5) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : type === 'number' || type === 'decimal' ? (
              <input
                type="number"
                step={type === 'decimal' ? 'any' : undefined}
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            ) : type === 'date' ? (
              <input
                type="date"
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            ) : type === 'email' ? (
              <input
                type="email"
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            ) : type === 'phone' ? (
              <input
                type="tel"
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            ) : (
              <input
                type="text"
                value={(values[field.name] as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                {...inputProps}
              />
            )}

            {err ? <div style={styles.err}>{err}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

export { Value, Value as FormValue }
