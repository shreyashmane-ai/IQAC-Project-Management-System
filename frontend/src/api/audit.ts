import api from './client'
import type { AuditLogEntry } from '../types'

export async function listAuditLog(
  params: {
    entity_type?: string
    action?: string
    program?: string
    user?: string
    search?: string
  } = {},
): Promise<{ count: number; results: AuditLogEntry[] }> {
  const { data } = await api.get('/users/audit/', { params })
  return data
}
