import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { StatusBadge } from '../../components/ui/StatusBadge'

const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const statusLabel = {
  approved: 'Queued',
  pending_review: 'Review',
  in_production: 'In production',
  delivered: 'Delivered',
  completed: 'Completed',
  rejected: 'Not approved',
}

const selectionBadge = (status, fallback) => {
  if (status === 'delivered') return <StatusBadge status="delivered" />
  if (status === 'in_production') return <StatusBadge status="in_progress">In production</StatusBadge>
  if (status === 'revision') return <StatusBadge status="revision" />
  return <span className={`badge ${status === 'pending_review' ? 'amber' : fallback || 'neutral'}`}>{statusLabel[status] || status}</span>
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()

export default function Calendar() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [month, setMonth] = useState(monthKey())
  const [pendingIds, setPendingIds] = useState([])
  const [activeDateKey, setActiveDateKey] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['creative-calendar', month],
    queryFn: () => creativeApi.calendar({ month }).then(r => r.data.data),
  })

  const select = useMutation({
    mutationFn: async (eventIds) => {
      const results = []
      for (const eventId of eventIds) {
        const res = await creativeApi.selectEvent(eventId)
        results.push(res.data?.data)
      }
      return results
    },
    onSuccess: (results) => {
      const reviewCount = results.filter(result => result?.selection?.status === 'pending_review').length
      pushToast({
        title: reviewCount ? 'Selections sent for review' : 'Creatives queued',
        body: reviewCount
          ? `${reviewCount} selection${reviewCount === 1 ? '' : 's'} need CREATYV approval.`
          : 'Your selected creatives have been queued with CREATYV.',
      })
      setPendingIds([])
      queryClient.invalidateQueries({ queryKey: ['creative-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['creative-work'] })
      queryClient.invalidateQueries({ queryKey: ['mint-credits'] })
    },
    onError: err => pushToast({ title: 'Could not confirm selections', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const events = useMemo(() => data?.events || [], [data?.events])
  const available = events.filter(event => !event.selection)
  const selectedPending = events.filter(event => pendingIds.includes(event.id))
  const pendingCost = selectedPending.reduce((sum, event) => sum + Number(event.coin_cost || 1), 0)
  const balance = Number(data?.balance || 0)
  const overBalance = pendingCost > balance

  const calendarCells = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    const first = new Date(year, monthNum - 1, 1)
    const days = new Date(year, monthNum, 0).getDate()
    const leading = first.getDay()
    return [
      ...Array.from({ length: leading }, (_, i) => ({ key: `blank-${i}`, blank: true })),
      ...Array.from({ length: days }, (_, i) => {
        const date = new Date(year, monthNum - 1, i + 1)
        return {
          key: date.toISOString(),
          date,
          events: events.filter(event => event.event_date && sameDay(event.event_date, date)),
        }
      }),
    ]
  }, [events, month])
  const todayKey = startOfDay(new Date()).toISOString()
  const activeCell = useMemo(() => (
    calendarCells.find(cell => !cell.blank && cell.key === activeDateKey) ||
    calendarCells.find(cell => !cell.blank && cell.key === todayKey) ||
    calendarCells.find(cell => !cell.blank && cell.events?.length) ||
    null
  ), [activeDateKey, calendarCells, todayKey])

  const togglePending = (eventId) => {
    setPendingIds(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId])
  }
  const describeCell = (cell) => {
    if (cell.blank) return ''
    const header = cell.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const lines = cell.events.map(event => `${event.title} - ${event.asset_type?.replace(/_/g, ' ') || 'creative'} - ${Number(event.coin_cost || 1)} coin`)
    return [header, ...lines].join('\n')
  }
  const pressSelect = (eventId) => {
    togglePending(eventId)
    pushToast({ title: 'Selection updated', body: 'Tap Confirm selections when your list is ready.' })
  }

  return (
    <div className="stack-6 creative-calendar-page">
      <div className="row between reveal calendar-page-head" style={{ gap: 16 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Creative calendar</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Plan this month&apos;s creatives</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Pick moments first, review the list, then confirm once.
          </p>
        </div>
        <div className="card" style={{ padding: '12px 16px', minWidth: 190 }}>
          <div className="h-eyebrow">Available coins</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{balance.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="card reveal" style={{ padding: 16 }}>
        <div className="row between calendar-toolbar" style={{ gap: 12, alignItems: 'center' }}>
          <input
            className="input"
            type="month"
            value={month}
            onChange={event => { setMonth(event.target.value); setPendingIds([]) }}
            style={{ maxWidth: 220 }}
          />
          <div className="row wrap" style={{ gap: 8 }}>
            <span className={`badge ${overBalance ? 'amber' : 'mint'}`}>
              {pendingIds.length} selected - {pendingCost} coin{pendingCost === 1 ? '' : 's'}
            </span>
            <button className="btn ghost" disabled={!pendingIds.length || select.isPending} onClick={() => setPendingIds([])}>
              Clear
            </button>
            <button className="btn primary" disabled={!pendingIds.length || select.isPending} onClick={() => select.mutate(pendingIds)}>
              <Icon name="check" /> Confirm selections
            </button>
          </div>
        </div>
        {overBalance && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--amber)' }}>
            This is above your current MintCoin balance. CREATYV will still receive it for review.
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 24 }}>Loading calendar...</div>
      ) : events.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="calendar" size={22} /></div>
          <h3>No calendar creatives published yet</h3>
          <p>Once CREATYV publishes this month&apos;s options, they will appear here.</p>
        </div>
      ) : (
        <div className="card calendar-shell">
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="h-eyebrow">{day}</div>
            ))}
          </div>
          <div className="calendar-month-grid">
            {calendarCells.map(cell => (
              <div
                key={cell.key}
                title={describeCell(cell)}
                role={cell.blank ? undefined : 'button'}
                tabIndex={cell.blank ? undefined : 0}
                className={`calendar-day-cell${cell.blank ? ' blank' : ''}${!cell.blank && sameDay(cell.date, new Date()) ? ' today' : ''}${activeCell?.key === cell.key ? ' active' : ''}${cell.events?.length ? ' has-events' : ''}`}
                onClick={() => !cell.blank && setActiveDateKey(cell.key)}
                onKeyDown={(keyEvent) => {
                  if (!cell.blank && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
                    keyEvent.preventDefault()
                    setActiveDateKey(cell.key)
                  }
                }}
              >
                {!cell.blank && (
                  <>
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>{cell.date.getDate()}</strong>
                      {sameDay(cell.date, new Date()) && <span className="badge mint">Today</span>}
                    </div>
                    <div className="calendar-event-stack">
                      {cell.events.map(event => {
                        const saved = Boolean(event.selection)
                        const staged = pendingIds.includes(event.id)
                        const status = event.selection?.status
                        return (
                          <button
                            key={event.id}
                            type="button"
                            disabled={saved}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              togglePending(event.id)
                            }}
                            onContextMenu={(contextEvent) => {
                              contextEvent.preventDefault()
                              contextEvent.stopPropagation()
                              if (!saved) pressSelect(event.id)
                            }}
                            className={`calendar-event-chip${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                          >
                            <div style={{ fontWeight: 650, fontSize: 12.5, lineHeight: 1.25 }}>{event.title}</div>
                            <div className="row between" style={{ marginTop: 6, gap: 6 }}>
                              <span className="muted" style={{ fontSize: 11 }}>{event.asset_type?.replace(/_/g, ' ')}</span>
                              {saved ? selectionBadge(status, 'neutral') : <span className={`badge ${staged ? 'mint' : 'neutral'}`}>{staged ? 'Selected' : `${Number(event.coin_cost || 1)} coin`}</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {activeCell && (
            <div className="calendar-day-details">
              <div>
                <div className="h-eyebrow">Selected day</div>
                <h3>{activeCell.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              </div>
              {activeCell.events.length === 0 ? (
                <p className="muted">No creatives published for this day.</p>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {activeCell.events.map(event => {
                    const saved = Boolean(event.selection)
                    const staged = pendingIds.includes(event.id)
                    const status = event.selection?.status
                    return (
                      <button
                        key={event.id}
                        type="button"
                        disabled={saved}
                        className={`calendar-detail-row${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                        onClick={() => !saved && togglePending(event.id)}
                        onContextMenu={(contextEvent) => {
                          contextEvent.preventDefault()
                          if (!saved) pressSelect(event.id)
                        }}
                      >
                        <div>
                          <strong>{event.title}</strong>
                          <span>{event.asset_type?.replace(/_/g, ' ') || 'creative'}</span>
                        </div>
                        {saved ? selectionBadge(status, 'neutral') : <span className={`badge ${staged ? 'mint' : 'neutral'}`}>{staged ? 'Selected' : `${Number(event.coin_cost || 1)} coin`}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {available.length > 0 && (
        <div className="card" style={{ padding: 18 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Selection summary</div>
          {pendingIds.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Choose one or more calendar moments above. Nothing is sent until you press confirm.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {selectedPending.map(event => (
                <div key={event.id} className="row between" style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: 8 }}>
                  <span>{event.title}</span>
                  <span className="mono">{Number(event.coin_cost || 1)} coin</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
