export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skel-table" aria-hidden="true">
      <div className="skel-toolbar">
        <div className="skel"></div>
        <div className="skel pill"></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row" key={i}>
          <div className="skel"></div>
          <div className="skel"></div>
          <div className="skel"></div>
          <div className="skel"></div>
          <div className="skel"></div>
        </div>
      ))}
    </div>
  )
}

export function PageFallback() {
  return (
    <div className="page-fallback" role="status" aria-label="Loading">
      <div className="spinner" aria-hidden="true"></div>
      <span>Loading…</span>
    </div>
  )
}