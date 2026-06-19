export const TASK_STATUS_META = {
  assigned: {
    label: 'Assigned',
    className: 'status-assigned',
    color: '#3B82F6',
  },
  in_progress: {
    label: 'In progress',
    className: 'status-in-progress',
    color: '#F59E0B',
  },
  delivered: {
    label: 'Delivered',
    className: 'status-delivered',
    color: '#10B981',
  },
  revision: {
    label: 'Revision',
    className: 'status-revision',
    color: '#F97316',
  },
  blocked: {
    label: 'Blocked',
    className: 'status-blocked',
    color: '#EF4444',
  },
}

export const TASK_STATUS_OPTIONS = ['assigned', 'in_progress', 'delivered', 'revision', 'blocked']

export const statusLabel = (status = '') => (
  TASK_STATUS_META[status]?.label || String(status || '').replace(/_/g, ' ')
)

export const statusAccent = (status = '') => TASK_STATUS_META[status]?.color || '#94A3B8'

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
