import api from './client'
import type { ReportColumn, ReportExport } from '../types'

export async function listReportColumns(
  params: { report_type?: string; default_only?: boolean } = {},
): Promise<{ count: number; results: ReportColumn[] }> {
  const { data } = await api.get('/reports/columns/', { params })
  return data
}

export async function getReportColumnCatalog(reportType: string): Promise<{ report_type: string; columns: ReportColumn[] }> {
  const { data } = await api.get<{ report_type: string; columns: ReportColumn[] }>(`/reports/columns/${reportType}/`)
  return data
}

export async function listReportExports(
  params: { program?: string; report_type?: string; status?: string } = {},
): Promise<{ count: number; results: ReportExport[] }> {
  const { data } = await api.get('/reports/exports/', { params })
  return data
}

export async function createReportExport(
  payload: {
    report_type: string
    format: 'xlsx' | 'csv' | 'pdf'
    program?: string | null
    columns?: string[]
    filters?: Record<string, unknown>
  },
): Promise<ReportExport> {
  const { data } = await api.post('/reports/export/', payload)
  return data
}
