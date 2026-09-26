import api from './client'

export interface PublicProgram {
  id: string
  title: string
  short_code: string
  description: string
  program_type: string
  start_date: string | null
  end_date: string | null
  registration_status: string
  status_display: string
  venue: string
  coordinator: { id: string; name: string; email: string } | null
}

export interface PublicDay {
  id: string
  day_number: number
  date: string | null
  start_time: string | null
  end_time: string | null
  title: string
  venue: string
}

export interface PublicRegisterInfo {
  program: { id: string; title: string; short_code: string }
  registration_open: boolean
  registration_schema: Record<string, unknown>
}

export interface PublicFeedbackInstance {
  id: string
  title: string
  description: string
  scope: string
  day_number: number | null
  is_anonymous: boolean
  schema: Record<string, unknown>
  closes_at: string | null
  public_token: string
}

export async function getPublicProgram(token: string): Promise<PublicProgram> {
  const { data } = await api.get<PublicProgram>(`/public/p/${token}/`)
  return data
}

export async function getPublicDays(token: string): Promise<PublicDay[]> {
  const { data } = await api.get<PublicDay[]>(`/public/p/${token}/days/`)
  return data
}

export async function getRegisterInfo(token: string): Promise<PublicRegisterInfo> {
  const { data } = await api.get<PublicRegisterInfo>(`/public/p/${token}/register/`)
  return data
}

export async function submitRegistration(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ registration_number: string; status: string; attendance_token: string; feedback_token: string; message: string }> {
  const { data } = await api.post(`/public/p/${token}/register/`, payload)
  return data
}

export async function getPublicFeedback(token: string): Promise<PublicFeedbackInstance[]> {
  const { data } = await api.get<PublicFeedbackInstance[]>(`/public/p/${token}/feedback/`)
  return data
}

export async function submitFeedback(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ status: string; response_id: string; message: string }> {
  const { data } = await api.post(`/public/p/${token}/feedback/`, payload)
  return data
}

export interface CertificateVerifyResult {
  certificate_number: string
  status: string
  valid: boolean
  participant_name?: string | null
  program_title?: string | null
  program_date?: string | null
  issued_by?: string | null
  issued_date?: string | null
}

export async function verifyCertificate(number: string): Promise<CertificateVerifyResult> {
  const { data } = await api.get<CertificateVerifyResult>(`/public/verify/${encodeURIComponent(number)}/`)
  return data
}

export function certificateDownloadUrl(token: string): string {
  return `/api/v1/public/certificates/${encodeURIComponent(token)}/`
}

export interface FoodQr {
  id: string
  service: string
  service_name: string
  day_number: number | null
  day_date: string | null
  is_claimed: boolean
  qr: string
}

export interface MyQrsProgram {
  program_id: string
  program_title: string
  short_code: string
  registration_number: string
  status: string
  attendance_qr: string | null
  attendance_token: string
  attendance_qrs: { day_number: number; day_date: string | null; qr: string }[]
  food_qrs: FoodQr[]
}

export interface MyQrsResult {
  participant_name: string
  email: string
  programs: MyQrsProgram[]
}

export async function getMyQrs(payload: { registration_number: string; email: string }): Promise<MyQrsResult> {
  const { data } = await api.post<MyQrsResult>(`/public/my-qrs/`, payload)
  return data
}

export interface PublicSelfAttendanceInfo {
  program: { id: string; title: string; short_code: string }
}

export interface PublicSelfAttendanceResult {
  result: string
  participant: { name: string; email: string; registration_number: string }
  day: { day_number: number; date: string | null; title: string }
  message: string
}

export async function getPublicSelfAttendance(token: string): Promise<PublicSelfAttendanceInfo> {
  const { data } = await api.get<PublicSelfAttendanceInfo>(`/public/p/${token}/attendance/`)
  return data
}

export async function submitSelfAttendance(
  token: string,
  payload: { registration_number: string; email: string; day_id: string },
): Promise<PublicSelfAttendanceResult> {
  const { data } = await api.post<PublicSelfAttendanceResult>(`/public/p/${token}/attendance/`, payload)
  return data
}
