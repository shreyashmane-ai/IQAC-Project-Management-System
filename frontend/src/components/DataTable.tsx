import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface DataColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  /** Optional numeric/string extractor enabling column sorting */
  sort?: (row: T) => string | number | null | undefined
  /** Optional explicit value used in CSV export (falls back to `sort`, then `row[key]`) */
  exportValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  className?: string
}

type Density = 'comfy' | 'compact'

const DENSITY_KEY = 'iqac-dt-density'

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchable,
  search,
  pageSize = 8,
  searchPlaceholder = 'Search…',
  empty,
  emptyAction,
  actions,
  actionsLabel = 'Actions',
  rowClassName,
  className,
  exportable = true,
}: {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  /** Simple value search across these row fields */
  searchable?: (keyof T)[]
  /** Custom search predicate; takes precedence over `searchable` */
  search?: (row: T, q: string) => boolean
  pageSize?: number
  searchPlaceholder?: string
  empty?: ReactNode
  emptyAction?: ReactNode
  /** Optional last column (right aligned) rendered per row */
  actions?: (row: T) => ReactNode
  actionsLabel?: string
  /** Optional per-row styling hook (e.g. active/selected row) */
  rowClassName?: (row: T) => string | undefined
  className?: string
  /** Show the CSV export button in the toolbar */
  exportable?: boolean
}) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const [size, setSize] = useState(pageSize)
  const [page, setPage] = useState(1)
  const [density, setDensity] = useState<Density>(() => {
    try {
      return (localStorage.getItem(DENSITY_KEY) as Density) || 'comfy'
    } catch {
      return 'comfy'
    }
  })
  const exportRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_KEY, density)
    } catch {
      /* ignore */
    }
  }, [density])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const needle = q.trim().toLowerCase()
    const matcher =
      search ||
      ((row: T) =>
        (searchable || []).some((k) => {
          const v = (row as Record<keyof T, unknown>)[k]
          return v != null ? String(v).toLowerCase().includes(needle) : false
        }))
    return rows.filter((row) => matcher(row, needle))
  }, [rows, q, search, searchable])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sort) return filtered
    const mult = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = col.sort!(a)
      const vb = col.sort!(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
      return String(va).localeCompare(String(vb)) * mult
    })
  }, [filtered, sortKey, dir, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / size))
  const onPage = Math.min(page, pageCount)
  const start = (onPage - 1) * size
  const slice = sorted.slice(start, start + size)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDir('asc')
    }
    setPage(1)
  }

  const pageNumbers: number[] = []
  const w = 2
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= onPage - w && i <= onPage + w)) pageNumbers.push(i)
  }

  function exportCsv() {
    const header = columns.map((c) => c.label)
    const body = sorted.map((row) =>
      columns.map((c) => {
        let v: string | number | null | undefined
        if (c.exportValue) v = c.exportValue(row)
        else if (c.sort) v = c.sort(row)
        else v = (row as Record<string, unknown>)[c.key] as string | number | null | undefined
        return v == null ? '' : String(v)
      }),
    )
    const csv = [header, ...body]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    if (exportRef.current) {
      exportRef.current.href = url
      exportRef.current.click()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className={`dt dt--${density} ${className || ''}`}>
      <div className="dt-toolbar">
        <div className="dt-search">
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {q && (
            <button type="button" className="dt-clear" onClick={() => {
              setQ('')
              setPage(1)
            }} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <span className="dt-count">
          {sorted.length} record{sorted.length === 1 ? '' : 's'}
        </span>
        <span className="dt-spacer"></span>
        {exportable && sorted.length > 0 && (
          <>
            <a ref={exportRef} href="#" download="export.csv" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true"></a>
            <button type="button" className="dt-toolbtn" onClick={exportCsv} title="Export current results to CSV">
              <ExportIcon />
              Export
            </button>
          </>
        )}
        <button
          type="button"
          className="dt-toolbtn dt-dens"
          onClick={() => setDensity((d) => (d === 'comfy' ? 'compact' : 'comfy'))}
          title={density === 'comfy' ? 'Switch to compact rows' : 'Switch to comfortable rows'}
          aria-pressed={density === 'compact'}
          aria-label="Toggle table density"
        >
          <DensityIcon />
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={c.sort ? () => toggleSort(c.key) : undefined}
                  style={{
                    textAlign: c.align || 'left',
                    cursor: c.sort ? 'pointer' : 'default',
                  }}
                >
                  <span className="dt-th">
                    {c.label}
                    {c.sort &&
                      (sortKey === c.key ? (
                        <span className={`dt-sort dt-sort--${dir}`}>
                          <SortIcon />
                        </span>
                      ) : (
                        <span className="dt-sort dt-sort--idle">
                          <SortIcon />
                        </span>
                      ))}
                  </span>
                </th>
              ))}
              {actions && <th className="dt-acts-th">{actionsLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={rowKey(row)} className={rowClassName?.(row)} style={{ animationDelay: `${i * 32}ms` }}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className} style={{ textAlign: c.align }}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && <td className="tbl-acts">{actions(row)}</td>}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="dt-empty">
                  <div className="dt-empty-box">
                    <EmptyIcon />
                    <div>{empty || 'No records found'}</div>
                    {emptyAction && <div className="dt-empty-action">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="dt-pager">
          <span className="dt-summary">
            {start + 1}–{Math.min(start + size, sorted.length)} of {sorted.length} · page {onPage} of {pageCount}
          </span>
          <label className="dt-pagesize">
            Per page
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setPage(1)
              }}
            >
              {[5, 8, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="dt-pagenav">
            <button type="button" disabled={onPage <= 1} onClick={() => setPage(onPage - 1)} aria-label="Previous page">
              ‹
            </button>
            {pageNumbers.map((n, i) => {
              const jump = i > 0 && pageNumbers[i - 1] !== n - 1
              return (
                <span key={n} className="dt-pagenums">
                  {jump && <span className="dt-ellipsis">…</span>}
                  <button
                    type="button"
                    className={n === onPage ? 'dt-pagebtn is-active' : 'dt-pagebtn'}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </span>
              )
            })}
            <button type="button" disabled={onPage >= pageCount} onClick={() => setPage(onPage + 1)} aria-label="Next page">
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

function DensityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}