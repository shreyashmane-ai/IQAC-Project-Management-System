import api from './client'
import type { Certificate, CertificateConfig } from '../types'

export async function listCertificates(
  params: { program?: string; status?: string; search?: string } = {},
): Promise<{ count: number; results: Certificate[] }> {
  const { data } = await api.get('/certificates/', { params })
  return data
}

export async function getCertificateConfig(
  programId: string,
): Promise<CertificateConfig | null> {
  const { data } = await api.get(
    `/certificates/program/${programId}/config/`,
  )
  return data
}

export async function deleteCertificate(id: string): Promise<void> {
  await api.delete(`/certificates/${id}/`)
}

export async function resendCertificate(id: string): Promise<{ message: string }> {
  const { data } = await api.post(`/certificates/${id}/resend/`)
  return data
}

export async function cancelCertificate(id: string, reason = ''): Promise<{ message: string }> {
  const { data } = await api.post(`/certificates/${id}/cancel/`, { reason })
  return data
}
