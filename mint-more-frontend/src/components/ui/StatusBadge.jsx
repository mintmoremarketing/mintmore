import { TASK_STATUS_META, statusLabel } from './statusMeta'

export function StatusBadge({ status, children, className = '' }) {
  const meta = TASK_STATUS_META[status]
  if (!meta) {
    return <span className={`badge neutral ${className}`.trim()}>{children || statusLabel(status)}</span>
  }

  return (
    <span className={`status-badge ${meta.className} ${className}`.trim()}>
      <span className="status-badge-dot" />
      {children || meta.label}
    </span>
  )
}
