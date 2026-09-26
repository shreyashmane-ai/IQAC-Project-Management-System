import api from './client'
import type { FeedbackAnalytics, FeedbackInstance } from '../types'

export async function listFeedbackInstances(
  params: { program?: string; status?: string; scope?: string } = {},
): Promise<{ count: number; results: FeedbackInstance[] }> {
  const { data } = await api.get('/feedback/instances/', { params })
  return data
}

export async function getFeedbackAnalytics(
  instanceId: string,
): Promise<FeedbackAnalytics> {
  const { data } = await api.get(`/feedback/analytics/${instanceId}/`)
  return data
}

export interface FeedbackInstancePayload {
  program: string
  day?: string | null
  scope: string
  title: string
  description?: string
  schema?: Record<string, unknown>
  is_anonymous?: boolean
  allow_multiple?: boolean
  opens_at?: string | null
  closes_at?: string | null
}

export async function createFeedbackInstance(
  payload: FeedbackInstancePayload,
): Promise<FeedbackInstance> {
  const { data } = await api.post<FeedbackInstance>('/feedback/instances/', payload)
  return data
}

export async function updateFeedbackInstance(
  id: string,
  payload: Partial<FeedbackInstancePayload>,
): Promise<FeedbackInstance> {
  const { data } = await api.patch<FeedbackInstance>(
    `/feedback/instances/${id}/`,
    payload,
  )
  return data
}

export async function deleteFeedbackInstance(id: string): Promise<void> {
  await api.delete(`/feedback/instances/${id}/`)
}
