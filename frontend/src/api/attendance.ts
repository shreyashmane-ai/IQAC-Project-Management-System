import api from './client'
import type { AttendanceRecord } from '../types'

export async function listAttendance(
  params: {
    program?: string
    day?: string
    status?: 'present' | 'absent' | 'late'
    search?: string
  } = {},
): Promise<{ count: number; results: AttendanceRecord[] }> {
  const { data } = await api.get('/attendance/records/', { params })
  return data
}

export async function deleteAttendance(id: string): Promise<void> {
  await api.delete(`/attendance/records/${id}/`)
}

export interface RosterEntry {
  participant_id: string
  participant_name: string
  participant_email: string
  registration_number: string
  is_present: boolean
  is_late: boolean
  marked_at: string | null
  scanned_by: string
}

export async function getRoster(programId: string, dayId: string): Promise<RosterEntry[]> {
  const { data } = await api.get<RosterEntry[]>(`/attendance/program/${programId}/day/${dayId}/roster/`)
  return data
}

export interface DayAttendanceStats {
  total_expected: number
  present: number
  absent: number
  late: number
  attendance_rate: number
}

export async function getDayAttendanceStats(programId: string, dayId: string): Promise<DayAttendanceStats> {
  const { data } = await api.get<DayAttendanceStats>(`/attendance/program/${programId}/day/${dayId}/stats/`)
  return data
}

export async function markAttendance(
  programId: string,
  dayId: string,
  payload: { participant_id?: string; registration_number?: string; token?: string; is_late?: boolean },
): Promise<{ result: 'marked' | 'already_marked'; message: string; participant_name?: string }> {
  const { data } = await api.post(`/attendance/program/${programId}/day/${dayId}/mark/`, payload)
  return data
}

export async function scanAttendance(payload: {
  attendance_token: string
  day_id: string
  session_id?: string
  gate_name?: string
}): Promise<{ result: string; message: string; participant_name?: string; marked_at?: string }> {
  const { data } = await api.post('/public/scan/attendance/', payload)
  return data
}

export interface DaySelfQr {
  program_id: string
  program_title: string
  short_code: string
  day_id: string
  day_number: number
  day_date: string
  attendance_enabled: boolean
  url: string
  qr: string
}

export async function getDaySelfQr(programId: string, dayId: string): Promise<DaySelfQr> {
  const { data } = await api.get<DaySelfQr>(`/attendance/program/${programId}/day/${dayId}/self-qr/`)
  return data
}
