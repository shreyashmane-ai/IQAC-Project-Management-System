import api from './client'
import { CATEGORY_TO_MASTER } from '../types'
import type {
  AcademicSession,
  MasterData,
  ProgramDashboard,
  ProgramDetail,
  ProgramListItem,
} from '../types'

export interface ProgramListParams {
  session?: string
  status?: string
  search?: string
  type?: string
  department?: string
  departments?: string[]
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export async function listPrograms(
  params: ProgramListParams = {},
): Promise<Paginated<ProgramListItem>> {
  const q: Record<string, string> = {}
  if (params.session) q.session = params.session
  if (params.status) q.status = params.status
  if (params.search) q.search = params.search
  if (params.type) q.type = params.type
  if (params.department) q.department = params.department
  if (params.departments?.length) q.departments = params.departments.join(',')
  const { data } = await api.get<Paginated<ProgramListItem>>('/programs/', { params: q })
  return data
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  const { data } = await api.get<ProgramDetail>(`/programs/${id}/`)
  return data
}

export async function getProgramDashboard(id: string): Promise<ProgramDashboard> {
  const { data } = await api.get<ProgramDashboard>(`/programs/${id}/dashboard/`)
  return data
}

export async function listSessions(
  params: { active?: boolean } = {},
): Promise<Paginated<AcademicSession>> {
  const { data } = await api.get<Paginated<AcademicSession>>('/programs/sessions/', { params })
  return data
}

export async function listMaster(
  key: string,
  params: { active?: boolean; search?: string } = {},
): Promise<Paginated<MasterData>> {
  const { data } = await api.get<Paginated<MasterData>>(`/programs/masters/${key}/`, { params })
  return data
}

export async function listMasterActive(key: string): Promise<MasterData[]> {
  const page = await listMaster(key, { active: true })
  return page.results
}

export async function createMaster(
  key: string,
  payload: Record<string, unknown>,
): Promise<MasterData> {
  const { data } = await api.post<MasterData>(`/programs/masters/${key}/`, payload)
  return data
}

export async function updateMaster(
  key: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<MasterData> {
  const { data } = await api.patch<MasterData>(`/programs/masters/${key}/${id}/`, payload)
  return data
}

export async function deleteMaster(key: string, id: string): Promise<void> {
  await api.delete(`/programs/masters/${key}/${id}/`)
}

// Compatibility shim: legacy callers pass the old category code
// (e.g. 'ACADEMIC_DEPT') and receive the active records for that master.
export async function listMasterDataCategory(categoryCode: string): Promise<MasterData[]> {
  const key = CATEGORY_TO_MASTER[categoryCode]
  if (!key) return []
  return listMasterActive(key)
}

export interface ProgramDay {
  id: string
  day_number: number
  date: string
  is_cancelled?: boolean
}

export async function listProgramDays(
  programId: string,
): Promise<ProgramDay[]> {
  const { data } = await api.get<Paginated<ProgramDay>>('/programs/days/', {
    params: { program: programId },
  })
  return data.results
}

export interface ProgramDayPayload {
  program: string
  day_number: number
  date: string
  title?: string
  start_time?: string
  end_time?: string
  attendance_enabled?: boolean
  food_enabled?: boolean
  food_type?: string
  resource_persons?: DayResourcePerson[]
}

export interface DayResourcePerson {
  name: string
  designation?: string
  institution?: string
  email?: string
  phone?: string
}

export async function createProgramDay(payload: ProgramDayPayload): Promise<ProgramDay> {
  const { data } = await api.post<ProgramDay>('/programs/days/', payload)
  return data
}

export async function updateProgramDay(
  id: string,
  payload: Partial<ProgramDayPayload>,
): Promise<ProgramDay> {
  const { data } = await api.patch<ProgramDay>(`/programs/days/${id}/`, payload)
  return data
}

export async function deleteProgramDay(id: string): Promise<void> {
  await api.delete(`/programs/days/${id}/`)
}

export interface FormSchemaPayload {
  schema: Record<string, unknown>
}

export async function getRegistrationForm(programId: string): Promise<Record<string, unknown>> {
  const { data } = await api.get<FormSchemaPayload>(`/programs/${programId}/forms/registration/`)
  return data.schema ?? {}
}

export async function putRegistrationForm(programId: string, schema: Record<string, unknown>): Promise<void> {
  await api.put(`/programs/${programId}/forms/registration/`, { schema })
}

export async function getFeedbackForm(programId: string): Promise<Record<string, unknown>> {
  const { data } = await api.get<FormSchemaPayload>(`/programs/${programId}/forms/feedback/`)
  return data.schema ?? {}
}

export async function putFeedbackForm(programId: string, schema: Record<string, unknown>): Promise<void> {
  await api.put(`/programs/${programId}/forms/feedback/`, { schema })
}

export interface SessionPayload {
  code: string
  name: string
  description?: string
  start_date?: string
  end_date?: string
}

export async function createSession(payload: SessionPayload): Promise<AcademicSession> {
  const { data } = await api.post<AcademicSession>('/programs/sessions/', payload)
  return data
}

export async function updateSession(
  id: string,
  payload: Partial<SessionPayload> & { is_active?: boolean; is_archived?: boolean },
): Promise<AcademicSession> {
  const { data } = await api.patch<AcademicSession>(`/programs/sessions/${id}/`, payload)
  return data
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/programs/sessions/${id}/`)
}

export interface ProgramPayload {
  academic_session?: string
  title: string
  program_type?: string
  organizing_departments?: string[]
  start_date?: string
  end_date?: string
  number_of_days?: number
  venue?: string
  venue_details?: string
  start_time?: string
  end_time?: string
  program_coordinator?: string
  max_participants?: number
  objective?: string
  expected_outcomes?: string
  description?: string
}

export async function createProgram(payload: ProgramPayload): Promise<ProgramDetail> {
  const { data } = await api.post<ProgramDetail>('/programs/', payload)
  return data
}

export async function updateProgram(
  id: string,
  payload: Partial<ProgramPayload>,
): Promise<ProgramDetail> {
  const { data } = await api.patch<ProgramDetail>(`/programs/${id}/`, payload)
  return data
}

export async function deleteProgram(id: string): Promise<void> {
  await api.delete(`/programs/${id}/`)
}

export interface ProgramStatusPayload {
  to: string
  reason?: string
}

export async function updateProgramStatus(
  id: string,
  payload: ProgramStatusPayload,
): Promise<ProgramDetail> {
  const { data } = await api.post<ProgramDetail>(`/programs/${id}/status/`, payload)
  return data
}

export async function activateSession(sessionId: string): Promise<AcademicSession> {
  const { data } = await api.post<AcademicSession>(
    `/programs/sessions/${sessionId}/activate/`,
  )
  return data
}

export interface ProgramLinks {
  public_url: string
  registration_url: string
  feedback_url: string
  public_token: string
  public_link_enabled: boolean
  registration_link_enabled: boolean
  feedback_link_enabled: boolean
  qr_code?: string | null
  qr_public?: string | null
  qr_registration?: string | null
  qr_feedback?: string | null
}

export async function getProgramLinks(programId: string): Promise<ProgramLinks> {
  const { data } = await api.get<ProgramLinks>(`/programs/${programId}/link/`)
  return data
}

export async function regenerateProgramToken(programId: string): Promise<ProgramLinks> {
  const { data } = await api.post<ProgramLinks>(`/programs/${programId}/link/regenerate/`)
  return data
}

export async function setProgramLinkState(
  programId: string,
  service: 'public' | 'registration' | 'feedback',
  enabled: boolean,
): Promise<void> {
  await api.post(`/programs/${programId}/link/state/`, { service, enabled })
}

export interface ClosureReadiness {
  registration_closed: boolean
  attendance_finalized: boolean
  food_finalized: boolean
  feedback_closed: boolean
  certificates_handled: boolean
  documents_uploaded: boolean
  blockers: string[]
  can_close: boolean
}

export async function getClosureReadiness(programId: string): Promise<ClosureReadiness> {
  const { data } = await api.get<ClosureReadiness>(`/programs/${programId}/closure/readiness/`)
  return data
}

export async function closeProgram(programId: string): Promise<{ message: string }> {
  const { data } = await api.post(`/programs/${programId}/closure/close/`)
  return data
}

