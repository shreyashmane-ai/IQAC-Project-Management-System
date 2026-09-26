import api from './client'
import type { FoodService } from '../types'

export async function listFoodServices(
  params: { program?: string; service_type?: string; active?: boolean } = {},
): Promise<{ count: number; results: FoodService[] }> {
  const { data } = await api.get('/food/services/', { params })
  return data
}

export interface FoodServicePayload {
  program: string
  day: string
  service_type: string
  name?: string
  service_time?: string | null
  eligibility_rule?: Record<string, unknown>
  is_active?: boolean
}

export async function createFoodService(
  payload: FoodServicePayload,
): Promise<FoodService> {
  const { data } = await api.post<FoodService>('/food/services/', payload)
  return data
}

export async function updateFoodService(
  id: string,
  payload: Partial<FoodServicePayload>,
): Promise<FoodService> {
  const { data } = await api.patch<FoodService>(`/food/services/${id}/`, payload)
  return data
}

export async function deleteFoodService(id: string): Promise<void> {
  await api.delete(`/food/services/${id}/`)
}

export interface FoodEligibilityOverview {
  eligible_count: number
  new_count?: number
  already_sent_count?: number
  claimed_count?: number
  not_eligible_count?: number
  pending?: number
  total?: number
}

export async function getDayFoodEligibility(programId: string, dayId: string): Promise<FoodEligibilityOverview> {
  const { data } = await api.get<FoodEligibilityOverview>(`/food/program/${programId}/day/${dayId}/eligibility/`)
  return data
}

export async function generateFoodQR(programId: string, dayId: string): Promise<{ job_id: string; message: string }> {
  const { data } = await api.post<{ job_id: string; message: string }>(`/food/program/${programId}/day/${dayId}/generate/`)
  return data
}

export async function preSendSummary(programId: string, dayId: string): Promise<FoodEligibilityOverview> {
  const { data } = await api.get<FoodEligibilityOverview>(`/food/program/${programId}/day/${dayId}/pre-send/`)
  return data
}

export async function sendNewEligible(programId: string, dayId: string): Promise<{ job_id: string; message: string }> {
  const { data } = await api.post<{ job_id: string; message: string }>(`/food/program/${programId}/day/${dayId}/send-new/`)
  return data
}

export async function getDayFoodSummary(programId: string, dayId: string): Promise<FoodEligibilityOverview> {
  const { data } = await api.get<FoodEligibilityOverview>(`/food/program/${programId}/day/${dayId}/summary/`)
  return data
}

export async function scanFoodClaim(payload: {
  token: string
  food_service_id?: string
  day_id?: string
  gate_name?: string
}): Promise<{ result: string; message: string; participant_name?: string; claimed_at?: string }> {
  const { data } = await api.post('/public/scan/food/', payload)
  return data
}
