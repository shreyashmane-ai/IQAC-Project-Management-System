// Shared types mirroring the Django REST API contracts (core + programs).

export interface TokenPair {
  access: string
  refresh: string
  [key: string]: unknown
}

export interface LoginResponse {
  access: string
  refresh: string
  // When 2FA is enabled the server returns these instead of tokens:
  '2fa_required'?: boolean
  challenge_id?: number | string
  message?: string
}

export interface UserProfile {
  id: number | string
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  role_display: string
  is_active: boolean
  [key: string]: unknown
}

export interface UserMe extends UserProfile {
  permissions: {
    can_create_program: boolean
    can_manage_users: boolean
    can_manage_master_data: boolean
    can_view_audit_log: boolean
    can_manage_roles: boolean
    program_scopes: string[] | null
  }
}

// ----- Programs -----

export interface MasterData {
  id: string
  category: string
  category_display: string
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
}

export interface ProgramListItem {
  id: string
  title: string
  short_code: string
  academic_session: string
  academic_session_code: string
  program_type: string
  program_type_name: string
  organizing_departments: string[]
  organizing_departments_detail: MasterData[]
  start_date: string
  end_date: string
  number_of_days: number
  status: string
  status_display: string
  max_participants: number | null
  registration_count: number
  day_count: number
  public_token: string
  registration_link_enabled: boolean
  created_at: string
  updated_at: string
  program_coordinator: string | null
  venue: string | null
  venue_details: string | null
  start_time: string | null
  end_time: string | null
  objective: string | null
  description: string | null
}

export interface ProgramDay {
  id: string
  day_number: number
  date: string
  title: string | null
  start_time: string | null
  end_time: string | null
  is_cancelled: boolean
  cancellation_reason: string | null
  attendance_enabled: boolean
  food_enabled: boolean
  quiz_enabled: boolean
  other_enabled: boolean
  other_description: string | null
  food_type: string | null
  resource_persons?: { name: string; designation?: string; institution?: string; email?: string; phone?: string }[]
}

export interface ProgramServiceConfig {
  id: string
  service_type: string
  service_type_display: string
  is_enabled: boolean
  status: string | null
  status_display: string | null
  opens_at: string | null
  closes_at: string | null
}

export interface ProgramDetail {
  id: string
  title: string
  short_code: string
  academic_session: string
  academic_session_code: string
  academic_session_name: string
  program_type: string
  program_type_name: string
  organizing_departments: string[]
  organizing_departments_detail: MasterData[]
  collaborating_departments_detail: MasterData[]
  target_departments_detail: MasterData[]
  start_date: string
  end_date: string
  number_of_days: number
  venue: string | null
  venue_name: string | null
  venue_details: string | null
  start_time: string | null
  end_time: string | null
  program_coordinator: number | string
  coordinator_name: string
  coordinator_email: string
  max_participants: number | null
  objective: string | null
  expected_outcomes: string | null
  description: string | null
  contact_info: string | null
  status: string
  status_display: string
  registration_requires_approval: boolean
  registration_identity_key: string | null
  days: ProgramDay[]
  service_configs: ProgramServiceConfig[]
  registration_count: number
  public_url: string | null
  registration_url: string | null
  feedback_url: string | null
  [key: string]: unknown
}

// ----- Dashboard & aggregation -----

export interface ProgramDashboard {
  registration_count: number
  approved_count: number
  waitlist_count: number
  attendance_rate: number
  food_eligible: number
  food_claimed: number
  feedback_count: number
  feedback_rate: number
  certificates_issued: number
  certificates_pending: number
  upcoming_days: { day_number: number; date: string }[]
  recent_activity: unknown[]
}

export interface AcademicSession {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  is_archived: boolean
  description: string | null
  program_count: number
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface PageFilter {
  session?: string
  status?: string
  search?: string
}

export interface FunnelStep {
  label: string
  value: string
  pct: number
}

// ----- Master Data -----
export type MasterFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json'

export interface MasterFieldDef {
  key: string
  label: string
  type: MasterFieldType
  placeholder?: string
  help?: string
  options?: { value: string; label: string }[]
  /** Show as a table column. When no field in the master sets this, all fields are shown. */
  table?: boolean
}

export interface MasterDef {
  key: string
  label: string
  plural: string
  endpoint: string
  categoryCode: string
  description: string
  fields: MasterFieldDef[]
}

// Each master has the shared columns (code, name, description, is_active,
// sort_order) plus the extra fields listed below.
export const MASTERS: MasterDef[] = [
  {
    key: 'academic-departments',
    label: 'Academic Department',
    plural: 'Academic Departments',
    endpoint: 'academic-departments',
    categoryCode: 'ACADEMIC_DEPT',
    description: 'Academic departments used for organizing programs and participant affiliation.',
    fields: [
      { key: 'short_name', label: 'Short Name', type: 'text', placeholder: 'e.g. CSE' },
      { key: 'head_of_dept', label: 'Head of Dept', type: 'text' },
      { key: 'hod_email', label: 'HOD Email', type: 'email' },
      { key: 'hod_phone', label: 'HOD Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
    ],
  },
  {
    key: 'admin-departments',
    label: 'Administrative Department',
    plural: 'Administrative Departments',
    endpoint: 'admin-departments',
    categoryCode: 'ADMIN_DEPT',
    description: 'Administrative departments and their contact details.',
    fields: [
      { key: 'short_name', label: 'Short Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'in_charge', label: 'In-charge', type: 'text' },
    ],
  },
  {
    key: 'designations',
    label: 'Designation',
    plural: 'Designations',
    endpoint: 'designations',
    categoryCode: 'DESIGNATION',
    description: 'Staff designations, grouped by staff type (Teaching, Non-Teaching). Student is a Non-Teaching designation.',
    fields: [
      {
        key: 'staff_type', label: 'Staff Type', type: 'select',
        options: [
          { value: 'Teaching', label: 'Teaching' },
          { value: 'Non-Teaching', label: 'Non-Teaching' },
        ],
      },
    ],
  },
  {
    key: 'program-types',
    label: 'Program Type',
    plural: 'Program Types',
    endpoint: 'program-types',
    categoryCode: 'PROGRAM_TYPE',
    description: 'Type of programs (workshop, seminar, FDP, etc.).',
    fields: [
      { key: 'duration_label', label: 'Duration', type: 'text', placeholder: 'e.g. 1 day, 5 days' },
      { key: 'is_credit', label: 'Is Credit', type: 'boolean' },
      { key: 'credit_value', label: 'Credit Value', type: 'number' },
    ],
  },
  {
    key: 'venues',
    label: 'Venue',
    plural: 'Venues',
    endpoint: 'venues',
    categoryCode: 'VENUE',
    description: 'Physical or online venues where programs are held.',
    fields: [
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text', table: true },
      { key: 'capacity', label: 'Capacity', type: 'number', table: true },
      { key: 'contact_person', label: 'Contact Person', type: 'text', table: true },
      { key: 'contact_phone', label: 'Contact Phone', type: 'text', table: true },
      { key: 'is_online', label: 'Is Online', type: 'boolean', table: true },
      { key: 'meeting_link', label: 'Meeting Link', type: 'text' },
    ],
  },
  {
    key: 'question-types',
    label: 'Question Type',
    plural: 'Question Types',
    endpoint: 'question-types',
    categoryCode: 'QUESTION_TYPE',
    description: 'Rendering behaviour for dynamic form questions.',
    fields: [
      {
        key: 'render_component', label: 'Render Component', type: 'select',
        options: [
          { value: '', label: '— Default —' },
          { value: 'single_choice', label: 'Single Choice' },
          { value: 'multi_choice', label: 'Multi Choice' },
          { value: 'text', label: 'Text' },
          { value: 'textarea', label: 'Textarea' },
          { value: 'rating', label: 'Rating' },
          { value: 'scale', label: 'Scale' },
          { value: 'date', label: 'Date' },
        ],
      },
      { key: 'config', label: 'Config (JSON)', type: 'json', placeholder: '{"min":1,"max":5}' },
    ],
  },
  {
    key: 'food-types',
    label: 'Food Type',
    plural: 'Food Types',
    endpoint: 'food-types',
    categoryCode: 'FOOD_TYPE',
    description: 'Meal types served during programs.',
    fields: [
      { key: 'default_meal', label: 'Default Meal', type: 'text', placeholder: 'e.g. Breakfast, Lunch, Snacks' },
    ],
  },
]

export const CATEGORY_TO_MASTER: Record<string, string> = Object.fromEntries(
  MASTERS.map((m) => [m.categoryCode, m.key]),
)

export function findMaster(key: string): MasterDef | undefined {
  return MASTERS.find((m) => m.key === key)
}

export interface MasterData {
  id: string
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
  [key: string]: unknown
}

export interface MasterDataItem {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
  [key: string]: unknown
}

// ----- Academic Sessions -----
export interface SessionAnalysis {
  session_code: string
  total_programs: number
  programs_by_status: Record<string, number>
  total_registrations: number
  total_attendance: number
  total_food_claims: number
  total_feedback: number
  total_certificates: number
}

// ----- Participants -----
export interface ParticipantRegistration {
  id: string
  registration_number: string
  program_id: string
  program_title: string
  program_short_code: string
  status: string
}

export interface Participant {
  id: string
  email: string
  mobile: string
  full_name: string
  department: string | null
  department_name: string | null
  designation: string | null
  designation_name: string | null
  employee_id: string | null
  institution: string | null
  institution_department: string | null
  institution_designation: string | null
  city: string | null
  state: string | null
  country: string | null
  consent_given: boolean
  consent_date: string | null
  registration_count: number
  registration_numbers: string[]
  created_at: string
  updated_at: string
}

export interface Registration {
  id: string
  program: string
  program_title: string
  program_short_code: string
  participant: string
  participant_name: string
  participant_email: string
  registration_number: string
  status: string
  status_display: string
  form_data: Record<string, unknown> | null
  created_at: string
}

// ----- Attendance -----
export interface AttendanceRecord {
  id: string
  program: string
  program_title: string
  day: string
  day_number: number
  day_date: string
  participant: string
  participant_name: string
  participant_email: string
  is_present: boolean
  is_late: boolean
  source: string
  source_display: string
  gate_name: string | null
  marked_at: string | null
}

export interface AttendanceStats {
  total_expected: number
  present: number
  absent: number
  late: number
  attendance_rate: number
}

// ----- Food -----
export interface FoodService {
  id: string
  program: string
  program_title: string
  day: string | null
  day_number: number | null
  service_type: string
  service_type_display: string
  name: string | null
  service_time: string | null
  eligibility_rule?: Record<string, unknown> | null
  is_active: boolean
  eligible_count: number
  sent_count: number
  claimed_count: number
}

export interface FoodDaySummary {
  day: { id: string; day_number: number }
  program: { id: string }
  services: {
    food_service: { id: string; name: string }
    total_registered: number
    eligible: number
    generated: number
    sent: number
    claimed: number
    remaining_to_claim: number
    new_eligible_not_sent: number
  }[]
}

// ----- Feedback -----
export interface FeedbackInstance {
  id: string
  program: string
  program_title: string
  day: string | null
  day_number: number | null
  scope: string
  title: string
  description: string | null
  schema_version: number
  is_anonymous: boolean
  allow_multiple: boolean
  status: string
  status_display: string
  opens_at: string | null
  closes_at: string | null
  response_count: number
}

export interface FeedbackAnalytics {
  id: string
  feedback_instance: string
  feedback_title: string
  total_responses: number
  completion_rate: number
  average_rating: number | null
  question_analytics: Record<string, unknown> | null
  rating_distribution: Record<string, number> | null
  comments: { participant?: string; comment: string }[] | null
  last_computed: string | null
}

// ----- Certificates -----
export interface Certificate {
  id: string
  program: string
  program_title: string
  program_short_code: string
  participant: string
  participant_name: string
  participant_email: string
  certificate_number: string
  status: string
  status_display: string
  verification_url: string | null
  pdf_generated_at: string | null
  email_status: string | null
  created_at: string
}

export interface CertificateConfig {
  id?: string
  program: string
  program_title: string
  template: string | null
  template_name: string | null
  eligibility_rule: Record<string, unknown> | null
  certificate_prefix: string | null
  start_number: number
  current_number: number
  auto_generate: boolean
  auto_send: boolean
  require_manual_approval: boolean
}

// ----- Reports -----
export interface ReportColumn {
  id: string
  report_type: string
  report_type_display: string
  field_name: string
  display_name: string
  description: string | null
  data_type: string
  is_default: boolean
  is_pii: boolean
}

export interface ReportExport {
  id: string
  program: string | null
  program_title: string | null
  academic_session: string | null
  report_type: string
  report_type_display: string
  format: string
  status: string
  status_display: string
  file: string | null
  file_size: number | null
  row_count: number | null
  error_message: string | null
  created_at: string
}

export const REPORT_TYPES = [
  'REGISTRATION',
  'ATTENDANCE',
  'FOOD',
  'FEEDBACK',
  'CERTIFICATE',
  'PARTICIPANT_STATUS',
  'COMPLETE_PROGRAM',
  'DEPARTMENT_WISE',
  'ACADEMIC_SESSION',
  'CUSTOM',
] as const

// ----- Documents -----
export interface Document {
  id: string
  program: string
  program_title: string
  title: string
  description: string | null
  category: string
  category_display: string
  file: string | null
  file_url: string | null
  original_filename: string | null
  file_size: number | null
  mime_type: string | null
  tags: string[]
  version: number
  is_validated: boolean
  uploaded_by_name: string
  created_at: string
}

export const DOCUMENT_CATEGORIES = [
  'CIRCULAR',
  'POSTER',
  'PERMISSION_LETTER',
  'RESOURCE_PERSON_PROFILE',
  'PRESENTATION',
  'ATTENDANCE_EVIDENCE',
  'PHOTOGRAPHS',
  'FEEDBACK_REPORT',
  'PROGRAM_REPORT',
  'CERTIFICATE_TEMPLATE',
  'OTHER',
] as const

// ----- Users / Roles -----
export interface RoleOption {
  value: string
  label: string
}

export interface UserRow {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  role_display: string
  is_active: boolean
  last_login: string | null
  created_at: string
}

// ----- Audit -----
export interface AuditLogEntry {
  id: string
  timestamp: string
  user: string | null
  user_email: string | null
  user_name: string | null
  user_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  program_id: string | null
  ip_address: string | null
  before: unknown
  after: unknown
  reason: string | null
}

