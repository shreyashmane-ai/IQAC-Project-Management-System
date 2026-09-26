import api from './client'
import type { Document } from '../types'

export async function listDocuments(
  params: { program?: string; category?: string; search?: string } = {},
): Promise<{ count: number; results: Document[] }> {
  const { data } = await api.get('/documents/', { params })
  return data
}

export async function uploadDocument(
  file: File,
  payload: { program: string; title: string; category: string; description?: string },
): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  form.append('program', payload.program)
  form.append('title', payload.title)
  form.append('category', payload.category)
  if (payload.description) form.append('description', payload.description)

  const { data } = await api.post('/documents/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateDocument(
  id: string,
  payload: {
    title?: string
    description?: string
    category?: string
    is_public?: boolean
  },
): Promise<Document> {
  const { data } = await api.patch<Document>(`/documents/${id}/`, payload)
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}/`)
}
