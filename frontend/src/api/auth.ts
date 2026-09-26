import api from './client'
import type { LoginResponse, TokenPair, UserMe } from '../types'

export interface LoginCredentials {
  email: string
  password: string
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login/', credentials)
  return data
}

export async function logout(refresh: string | null): Promise<void> {
  try {
    await api.post('/auth/logout/', { refresh })
  } catch {
    // Logout is best-effort; ignore failures.
  }
}

export function refreshAccessToken(refresh: string): Promise<TokenPair> {
  return api.post('/auth/refresh/', { refresh })
}

export async function fetchMe(): Promise<UserMe> {
  const { data } = await api.get<UserMe>('/auth/me/')
  return data
}

export async function verify2fa(challengeId: string | number, code: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>('/auth/2fa/verify/', { challenge_id: challengeId, code })
  return data
}

export async function get2faSetup(): Promise<{
  secret: string
  qr_code: string
  provisioning_uri: string
  totp_enabled?: boolean
}> {
  const { data } = await api.get('/auth/2fa/setup/')
  return data
}

export async function enable2fa(code: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/2fa/setup/', { code })
  return data
}

export async function disable2fa(code: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/2fa/disable/', { code })
  return data
}
