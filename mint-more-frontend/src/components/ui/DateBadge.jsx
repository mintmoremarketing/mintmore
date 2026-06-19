const dayMs = 24 * 60 * 60 * 1000

const toneForDate = (value) => {
  if (!value) return 'date-muted'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / dayMs)
  if (diffDays < 0) return 'date-danger'
  if (diffDays <= 3) return 'date-warning'
  return 'date-muted'
}

const formatDate = (value, fallback = 'TBD') => {
  if (!value) return fallback
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DateBadge({ value, children, fallback = 'TBD', className = '' }) {
  return (
    <span className={`date-badge ${toneForDate(value)} ${className}`.trim()}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4.5h10v8H3zM3 7h10M5.5 2.5v3M10.5 2.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children || formatDate(value, fallback)}
    </span>
  )
}
