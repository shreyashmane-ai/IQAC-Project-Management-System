import api from './client'

export interface NotificationTemplate {
  id: string
  name: string
  trigger: string
  trigger_display: string
  channel: string
  channel_display: string
  subject_template: string
  html_template: string
  text_template: string
  attach_qr: boolean
  attach_certificate: boolean
  is_active: boolean
  created_at: string
}

export interface NotificationBatch {
  id: string
  program: string | null
  program_title: string | null
  template: string | null
  template_name: string | null
  trigger_display: string | null
  total: number
  sent: number
  failed: number
  pending: number
  status: string
  status_display: string
  created_at: string
}

export async function listNotificationTemplates(
  params: { channel?: string } = {},
): Promise<{ count: number; results: NotificationTemplate[] }> {
  const { data } = await api.get('/notifications/templates/', { params })
  return data
}

export async function listNotificationBatches(
  params: { program?: string } = {},
): Promise<{ count: number; results: NotificationBatch[] }> {
  const { data } = await api.get('/notifications/batches/', { params })
  return data
}

export async function sendNotificationBatch(payload: {
  program_id: string
  title?: string
  body?: string
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH'
  trigger?: string
  participant_filter?: Record<string, unknown>
  registration_filter?: Record<string, unknown>
}): Promise<{ batch_id: string }> {
  const { data } = await api.post('/notifications/program/send/', payload)
  return data
}