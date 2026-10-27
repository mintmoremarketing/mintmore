// Shared building blocks for the admin console: one page width, one header,
// one panel surface. Panels carry a 1px border and no resting shadow.

export function AdminPage({ children, wide = false }) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 px-4 pb-24 pt-5 md:px-8 md:pb-12 md:pt-7 ${wide ? 'max-w-[1440px]' : 'max-w-[1200px]'}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink-950 md:text-[28px] md:leading-9">{title}</h1>
        {description && <p className="mt-1 max-w-[65ch] text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ title, description, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-ink-100 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink-950">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** An empty state that says what is missing and what will fill it. */
export function EmptyState({ title, body, action }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="text-sm font-semibold text-ink-800">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-ink-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-50" />
          </div>
        </div>
      ))}
    </div>
  )
}
