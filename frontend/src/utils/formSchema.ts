/**
 * Form schema and validation types for DynamicForm
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'file'
  | 'hidden';

export interface FieldOption {
  value: string | number | boolean;
  label: string;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: (value: unknown, allValues: Record<string, unknown>) => string | true;
}

export interface FormField {
  name: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: FieldValidation;
  dependsOn?: string; // Field name to conditionally show
  dependsValue?: unknown; // Value that triggers visibility
  gridCol?: number; // 1-12 for responsive layout
}

export interface FormSchema {
  fields: FormField[];
  sections?: FormSection[];
}

export interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormSubmitPayload {
  [fieldName: string]: unknown;
  _meta?: {
    submittedAt: string;
    completionTimeSeconds?: number;
  };
}

/**
 * Default field configurations for common types
 */
export const DEFAULT_FIELD_CONFIG: Record<FieldType, Partial<FormField>> = {
  text: { type: 'text', placeholder: 'Enter text' },
  textarea: { type: 'textarea', placeholder: 'Enter details', gridCol: 12 },
  email: { type: 'email', placeholder: 'email@example.com', validation: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', patternMessage: 'Invalid email format' } },
  number: { type: 'number', placeholder: 'Enter number', validation: { min: 0 } },
  select: { type: 'select', options: [] },
  radio: { type: 'radio', options: [] },
  checkbox: { type: 'checkbox', options: [] },
  date: { type: 'date' },
  datetime: { type: 'datetime' },
  file: { type: 'file' },
  hidden: { type: 'hidden' },
};

/**
 * Validates a form value against its field validation rules
 */
export function validateField(value: unknown, validation?: FieldValidation, allValues?: Record<string, unknown>): string | true {
  if (!validation) return true;

  if (validation.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
    return 'This field is required';
  }

  if (value === undefined || value === null || value === '') {
    return true; // Skip other validations if empty and not required
  }

  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      return `Must be at least ${validation.minLength} characters`;
    }
    if (validation.maxLength && value.length > validation.maxLength) {
      return `Must be no more than ${validation.maxLength} characters`;
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return validation.patternMessage || 'Invalid format';
      }
    }
  }

  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      return `Must be at least ${validation.min}`;
    }
    if (validation.max !== undefined && value > validation.max) {
      return `Must be no more than ${validation.max}`;
    }
  }

  if (validation.custom) {
    return validation.custom(value, allValues || {});
  }

  return true;
}

/**
 * Validates entire form schema
 */
export function validateForm(schema: FormSchema, values: FormSubmitPayload): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of schema.fields) {
    const value = values[field.name];
    const error = validateField(value, field.validation, values);
    if (error !== true) {
      errors[field.name] = error;
    }
  }

  return errors;
}

/**
 * Checks if a field should be visible based on dependencies
 */
export function isFieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  if (!field.dependsOn) return true;
  const depValue = values[field.dependsOn];
  if (field.dependsValue === undefined) return Boolean(depValue);
  return depValue === field.dependsValue;
}

/**
 * Gets default value for a field
 */
export function getFieldDefault(field: FormField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;

  switch (field.type) {
    case 'checkbox':
      return false;
    case 'number':
      return 0;
    case 'select':
    case 'radio':
      return field.options?.[0]?.value ?? '';
    default:
      return '';
  }
}