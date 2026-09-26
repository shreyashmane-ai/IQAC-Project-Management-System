/**
 * DynamicForm types and validation - shared with backend schema format
 */

export interface FormFieldDef {
  name: string
  type: string
  label?: string
  required?: boolean
  options?: string[]
  validation?: {
    min_length?: number
    max_length?: number
    min?: number
    max?: number
    decimal_places?: number
    min_select?: number
    max_select?: number
  }
  [key: string]: unknown
}

export interface FormSchema {
  fields?: FormFieldDef[]
  [key: string]: unknown
}

export interface FormValues {
  [key: string]: unknown
}

export function getFieldOptions(field: FormFieldDef): { value: string; label: string }[] {
  return (field.options || []).map((o) => ({ value: o, label: o }))
}

function validateField(field: FormFieldDef, value: unknown): string | null {
  const label = field.label || field.name
  const isPresent = value != null && value !== '' && !(Array.isArray(value) && value.length === 0)
  if (!isPresent) {
    return field.required ? `${label} is required.` : null
  }

  const v = field.validation || {}
  const type = field.type

  if (type === 'checkbox' && Array.isArray(value)) {
    if (v.min_select && value.length < v.min_select) {
      return `Select at least ${v.min_select} option(s) for ${label}.`
    }
    if (v.max_select && value.length > v.max_select) {
      return `Select at most ${v.max_select} option(s) for ${label}.`
    }
    if (field.options) {
      for (const item of value) {
        if (!field.options.includes(item as string)) return `${label} contains an invalid option.`
      }
    }
    return null
  }

  if (type === 'number' || type === 'decimal' || type === 'rating') {
    const num = Number(value)
    if (isNaN(num)) return `${label} must be a number.`
    if (v.min != null && num < v.min) return `${label} must be at least ${v.min}.`
    if (v.max != null && num > v.max) return `${label} must be at most ${v.max}.`
    if (type === 'decimal' && v.decimal_places != null && num !== Number(num.toFixed(v.decimal_places))) {
      return `${label} allows at most ${v.decimal_places} decimal place(s).`
    }
    return null
  }

  if (type === 'email') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) return `${label} must be a valid email address.`
    return null
  }

  if (type === 'phone') {
    const digits = String(value).replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) return `${label} must be a valid mobile number.`
    return null
  }

  if (field.options && (type === 'select' || type === 'radio')) {
    if (!field.options.includes(String(value))) return `${label} must be one of the provided options.`
    return null
  }

  if (type === 'text' || type === 'longtext') {
    const len = String(value).length
    if (v.min_length != null && len < v.min_length) return `${label} must be at least ${v.min_length} character(s).`
    if (v.max_length != null && len > v.max_length) return `${label} must be at most ${v.max_length} character(s).`
    return null
  }

  return null
}

export function validateForm(schema: FormSchema | undefined, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of schema?.fields || []) {
    const err = validateField(field, values[field.name])
    if (err) errors[field.name] = err
  }
  return errors
}