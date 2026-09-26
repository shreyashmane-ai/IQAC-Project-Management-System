import api from './client'
import type { RoleOption, UserRow } from '../types'

export async function listUsers(
  params: { search?: string; role?: string; is_active?: boolean } = {},
): Promise<{ count: number; results: UserRow[] }> {
  const { data } = await api.get('/users/', { params })
  return data
}

export async function listRoles(): Promise<RoleOption[]> {
  const { data } = await api.get<{ roles: RoleOption[] }>('/users/roles/')
  return data.roles
}

export interface UserPayload {
  username: string
  email: string
  password?: string
  password_confirm?: string
  first_name: string
  last_name: string
  role?: string
  phone?: string
  department?: string
  designation?: string
  employee_id?: string
  is_active?: boolean
}

export async function createUser(payload: UserPayload): Promise<UserRow> {
  const { data } = await api.post<UserRow>('/users/', payload)
  return data
}

export async function updateUser(
  id: number | string,
  payload: Partial<UserPayload>,
): Promise<UserRow> {
  const { data } = await api.patch<UserRow>(`/users/${id}/`, payload)
  return data
}

export async function deleteUser(id: number | string): Promise<void> {
  await api.delete(`/users/${id}/`)
}
