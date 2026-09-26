import api from './client'
import type { Participant, Registration } from '../types'

export interface ParticipantListParams {
  search?: string
  type?: string
  department?: string
}

export async function listParticipants(
  params: ParticipantListParams = {},
): Promise<{ count: number; results: Participant[] }> {
  const { data } = await api.get('/participants/', { params })
  return data
}

export async function getParticipant(id: string): Promise<Participant> {
  const { data } = await api.get(`/participants/${id}/`)
  return data
}

export async function listRegistrations(
  params: { program?: string; status?: string; search?: string } = {},
): Promise<{ count: number; results: Registration[] }> {
  const { data } = await api.get('/participants/registrations/', { params })
  return data
}

export interface ParticipantPayload {
  email: string
  full_name: string
  mobile?: string
  department?: string
  designation?: string
  employee_id?: string
  institution?: string
  institution_department?: string
  institution_designation?: string
  city?: string
  state?: string
  country?: string
  consent_given?: boolean
  extra_data?: Record<string, unknown>
}

export async function createParticipant(
  payload: ParticipantPayload,
): Promise<Participant> {
  const { data } = await api.post<Participant>('/participants/', payload)
  return data
}

export async function updateParticipant(
  id: string,
  payload: Partial<ParticipantPayload>,
): Promise<Participant> {
  const { data } = await api.patch<Participant>(`/participants/${id}/`, payload)
  return data
}

export async function deleteParticipant(id: string): Promise<void> {
  await api.delete(`/participants/${id}/`)
}

export interface RegistrationPayload {
  program: string
  participant: string
  form_data?: Record<string, unknown>
}

export async function adminCreateRegistration(
  payload: RegistrationPayload,
): Promise<Registration> {
  const { data } = await api.post<Registration>('/participants/registrations/', payload)
  return data
}

export async function updateRegistrationStatus(
  id: string,
  status: string,
  note?: string,
): Promise<Registration> {
  const { data } = await api.patch<Registration>(
    `/participants/registrations/${id}/`,
    { status, rejection_reason: note },
  )
  return data
}

export interface StatusMatrixDay {
  id: string
  day_number: number
  date: string
  attendance_enabled: boolean
  food_enabled: boolean
}

export interface StatusMatrixRow {
  participant_id: string
  participant_name: string
  participant_email: string
  department: string
  registration_status: string
  registration_number: string
  attendance: Record<string, { present: boolean; late: boolean }>
  food: Record<string, { eligible: boolean; qr_sent: boolean; claimed: boolean }>
  feedback: { submitted: boolean }
  certificate: { status: string | null; number: string | null }
}

export interface StatusMatrix {
  program: { id: string; title: string; short_code: string }
  days: StatusMatrixDay[]
  participants: StatusMatrixRow[]
}

export async function getStatusMatrix(programId: string): Promise<StatusMatrix> {
  const { data } = await api.get<StatusMatrix>(`/participants/program/${programId}/matrix/`)
  return data
}
