import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { creativeApi } from '../../api/creative'
import { mintboxApi } from '../../api/mintbox'
import { socialApi } from '../../api/social'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'
import { StatusBadge, statusAccent } from '../../components/ui/StatusBadge'

const GB = 1024 * 1024 * 1024

const formatBytes = (bytes = 0) => {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function MiniCalendar({ events = [], tasks = [], onOpenCalendar }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = first.getDay()
  const cells = [
    ...Array.from({ length: leading }, (_, i) => ({ key: `blank-${i}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1)
      const dayEvents = events.filter(event => event.event_date && sameDay(event.event_date, date) && !event.selection?.task_id)
      const dayTasks = tasks.filter(task => task.due_date && sameDay(task.due_date, date))
      return { key: date.toISOString(), date, dayEvents, dayTasks }
    }),
  ]
  const describeCell = (cell) => {
    if (cell.blank) return ''
    const dayEvents = cell.dayEvents || []
    const dayTasks = cell.dayTasks || []
    const lines = [
      cell.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
      ...dayEvents.map(event => `${event.title} - ${event.asset_type?.replace(/_/g, ' ') || 'creative'}`),
      ...dayTasks.map(task => `${task.title} - ${task.client_status || task.status}`),
    ]
    return lines.join('\n')
  }

  return (
    <div className="card mini-calendar-card">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="h-eyebrow">This month</div>
          <div style={{ fontWeight: 650 }}>{now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
        </div>
        <button className="btn ghost sm" onClick={onOpenCalendar}>Open</button>
      </div>
      <div className="mini-calendar-weekdays">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => <div key={`${day}-${idx}`} style={{ textAlign: 'center' }}>{day}</div>)}
      </div>
      <div className="mini-calendar-grid">
        {cells.map(cell => {
          const dayEvents = cell.dayEvents || []
          const dayTasks = cell.dayTasks || []
          const details = [
            ...dayEvents.map(event => ({ title: event.title, meta: event.asset_type?.replace(/_/g, ' ') || 'creative', tone: 'event' })),
            ...dayTasks.map(task => ({ title: task.title, meta: task.client_status || task.status, tone: 'task' })),
          ]
          return (
          <button
            key={cell.key}
            title={describeCell(cell)}
            type="button"
            className={`mini-calendar-cell${cell.blank ? ' blank' : ''}${!cell.blank && sameDay(cell.date, now) ? ' today' : ''}${details.length ? ' has-items' : ''}`}
            disabled={cell.blank}
            onContextMenu={(event) => {
              if (!cell.blank && details.length) {
                event.preventDefault()
                onOpenCalendar()
              }
            }}
          >
            {!cell.blank && cell.date.getDate()}
            {!cell.blank && (dayEvents.length > 0 || dayTasks.length > 0) && (
              <span style={{
                position: 'absolute',
                bottom: 4,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: dayTasks.length ? 'var(--mint-500)' : 'var(--amber)',
              }} />
            )}
            {!cell.blank && details.length > 0 && (
              <div
                className="mini-calendar-tooltip"
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 'calc(100% + 8px)',
                  transform: 'translateX(-50%)',
                  width: 220,
                  padding: 10,
                  border: '1px solid var(--hairline)',
                  background: 'var(--paper)',
                  boxShadow: 'var(--shadow-md)',
                  borderRadius: 8,
                  zIndex: 5,
                  display: 'none',
                  textAlign: 'left',
                  pointerEvents: 'none',
                }}
              >
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>
                  {cell.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {details.map((item, index) => (
                    <div key={`${item.title}-${index}`} style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                      <strong>{item.title}</strong>
                      <div className="muted" style={{ fontSize: 10.5 }}>{item.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushToast = useUIStore(s => s.pushToast)
  const { user, isGuest } = useAuthStore()

  const { data: workData } = useQuery({
    queryKey: ['creative-work'],
    queryFn: () => creativeApi.work().then(r => r.data.data),
    enabled: !isGuest,
  })
  const { data: calendarData } = useQuery({
    queryKey: ['creative-calendar', monthKey()],
    queryFn: () => creativeApi.calendar({ month: monthKey() }).then(r => r.data.data),
    enabled: !isGuest,
  })
  const { data: mintboxData } = useQuery({
    queryKey: ['mintbox'],
    queryFn: () => mintboxApi.getFolders().then((r) => r.data.data),
    enabled: !isGuest,
  })
  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then((r) => r.data.data),
    enabled: !isGuest,
  })
  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
    enabled: !isGuest,
  })
  const { data: analyticsData } = useQuery({
    queryKey: ['social-analytics-summary'],
    queryFn: () => socialApi.getAnalyticsSummary().then(r => r.data.data),
    enabled: !isGuest,
  })

  useEffect(() => {
    const socialError = searchParams.get('social_error')
    const connected = searchParams.get('social_connected')
    if (socialError) {
      pushToast({
        title: socialError === 'access_denied' ? 'Social connection cancelled' : 'Social connection failed',
        body: socialError === 'access_denied' ? 'No problem, you can connect it later from Insights.' : socialError,
        tone: 'amber',
      })
      setSearchParams({})
    } else if (connected) {
      pushToast({ title: 'Social account connected', body: 'Insights will update as data comes in.' })
      setSearchParams({})
    }
  }, [pushToast, searchParams, setSearchParams])

  const profile = profileData?.profile || profileData || {}
  const accounts = accountsData?.accounts || []
  const connectedAccounts = accounts.filter(account => account.is_active)
  const onboarding = profile.onboarding_checklist || {}
  const setupItems = [
    Boolean(onboarding.profile),
    Boolean(onboarding.language),
    connectedAccounts.length > 0,
    profile.kyc_status === 'verified',
  ]
  const setupDone = setupItems.filter(Boolean).length
  const quota = mintboxData?.quota || { used: 0, limit: 10 * GB }
  const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0

  const tasks = useMemo(() => workData?.tasks || [], [workData?.tasks])
  const requests = useMemo(() => workData?.requests || [], [workData?.requests])
  const events = calendarData?.events || []
  const today = useMemo(() => startOfDay(new Date()), [])
  const tomorrow = useMemo(() => {
    const next = new Date(today)
    next.setDate(next.getDate() + 1)
    return next
  }, [today])

  const todayTasks = useMemo(() => tasks.filter(task => task.due_date && sameDay(task.due_date, today)), [tasks, today])
  const tomorrowTasks = useMemo(() => tasks.filter(task => task.due_date && sameDay(task.due_date, tomorrow)), [tasks, tomorrow])
  const inProgress = tasks.filter(task => ['assigned', 'in_progress', 'revision', 'pending'].includes(task.status))
  const done = tasks.filter(task => ['delivered', 'completed'].includes(task.status))
  const taskSourceIds = new Set(tasks.map(task => `${task.source_type}-${task.source_id}`))
  const activeRequests = requests
    .filter(request => !taskSourceIds.has(`custom_request-${request.id}`))
    .filter(request => !['completed', 'cancelled', 'rejected'].includes(request.status))
    .slice(0, 4)
  const summary = analyticsData?.summary

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 className="h-display" style={{ fontSize: 30, margin: 0, lineHeight: 1.15 }}>
          {greeting}, {user?.full_name?.split(' ')[0] || 'there'}.
        </h1>
      </div>

      <div className="dashboard-hero-grid">
        <div className="card-ink reveal dashboard-hero-card">
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 86% 18%, rgba(16,185,129,.22), transparent 46%)' }} />
          <div className="dashboard-hero-inner">
            <div>
              <div className="row between" style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.64)', textTransform: 'uppercase', letterSpacing: .04 }}>CREATYV calendar</span>
                <span className="badge mint" style={{ background: 'rgba(16,185,129,.18)', border: '1px solid rgba(16,185,129,.3)', color: 'var(--mint-200)' }}>
                  <span className="bdot" /> Internal creative team
                </span>
              </div>
              <div className="dashboard-hero-title">
                {todayTasks.length ? `${todayTasks.length} creative${todayTasks.length === 1 ? '' : 's'} due today` : 'Your creative calendar is clear today'}
              </div>
              <p style={{ color: 'rgba(255,255,255,.68)', margin: '8px 0 0', maxWidth: 520 }}>
                Track what CREATYV is creating, what is due next, and which calendar moments are already handled.
              </p>
              <div className="row wrap" style={{ marginTop: 22, gap: 8 }}>
                <button className="btn mint" onClick={() => navigate('/calendar')}>
                  <Icon name="calendar" /> View full calendar
                </button>
                <button className="btn link" style={{ color: 'rgba(255,255,255,.85)' }} onClick={() => navigate('/jobs/new')}>
                  New custom request <Icon name="arrowRight" />
                </button>
              </div>
            </div>
            <div className="dashboard-hero-metrics">
              {[
                ['In progress', inProgress.length],
                ['Done', done.length],
                ['Tomorrow', tomorrowTasks.length],
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,.05)' }}>
                  <div style={{ color: 'rgba(255,255,255,.58)', fontSize: 12 }}>{label}</div>
                  <div className="mono" style={{ fontSize: 25, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <MiniCalendar events={events} tasks={tasks} onOpenCalendar={() => navigate('/calendar')} />
      </div>

      {setupDone < setupItems.length && (
        <div className="card reveal" style={{ padding: 18 }}>
          <div className="row between" style={{ gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="h-eyebrow" style={{ marginBottom: 5 }}>Setup</div>
              <div style={{ fontSize: 16, fontWeight: 650 }}>Make CREATYV work around your business</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{setupDone} of {setupItems.length} steps complete</div>
              <div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ width: `${(setupDone / setupItems.length) * 100}%`, height: '100%', background: 'var(--mint-500)' }} />
              </div>
            </div>
            <button className="btn primary" onClick={() => navigate('/settings?section=setup')}>
              Continue setup <Icon name="arrowRight" size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-main-grid">
        <section className="stack" style={{ gap: 12 }}>
          <div className="row between">
            <h2 className="h-display h-3" style={{ margin: 0 }}>In production</h2>
            <button className="btn link sm" onClick={() => navigate('/jobs')}>See all <Icon name="arrowRight" size={12} /></button>
          </div>
          {inProgress.length === 0 && activeRequests.length === 0 ? (
            <div className="empty">
              <div className="empty-glyph"><Icon name="calendar" size={22} /></div>
              <h3>No creatives queued yet</h3>
              <p>Pick calendar events or send a custom request to CREATYV.</p>
              <button className="btn primary" onClick={() => navigate('/calendar')}><Icon name="plus" /> Choose creatives</button>
            </div>
          ) : (
            [...inProgress, ...activeRequests].slice(0, 6).map(item => (
              <button
                key={`${item.id}-${item.title}`}
                className="job-card task-card-shell"
                style={{ padding: 16, '--task-status-color': statusAccent(item.status) }}
                onClick={() => navigate('/jobs')}
              >
                <div className="row between">
                  <span className="badge neutral">{item.source_type ? 'Production task' : 'Custom request'}</span>
                  {['assigned', 'in_progress', 'delivered', 'revision', 'blocked'].includes(item.status)
                    ? <StatusBadge status={item.status} />
                    : <span className="badge neutral">{item.client_status || item.status?.replace(/_/g, ' ')}</span>}
                </div>
                <div className="title" style={{ marginTop: 8 }}>{item.title}</div>
                <div className="description">{item.description || 'CREATYV is reviewing this item.'}</div>
              </button>
            ))
          )}
        </section>

        <aside className="stack" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="h-eyebrow">Social growth</div>
              <button className="btn ghost sm" onClick={() => navigate('/social')}>Open</button>
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{Number(summary?.reach || 0).toLocaleString('en-IN')}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>people reached in the last {summary?.period_days || 30} days</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
              <span className="badge neutral">{connectedAccounts.length} connected</span>
              <span className="badge mint">{summary?.engagement_rate_percent || 0}% engagement</span>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="h-eyebrow">Mintbox</div>
              <button className="btn ghost sm" onClick={() => navigate('/mintbox')}>Open</button>
            </div>
            <div className="row between muted" style={{ fontSize: 12, marginBottom: 8 }}>
              <span>{formatBytes(quota?.used || 0)} used</span>
              <span>{formatBytes(quota?.limit || 10 * GB)}</span>
            </div>
            <div style={{ height: 7, background: 'var(--hairline)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 90 ? 'var(--rose)' : 'var(--mint-500)' }} />
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="h-eyebrow" style={{ marginBottom: 12 }}>Next actions</div>
            <div className="stack" style={{ gap: 8 }}>
              <button className="nav-item" onClick={() => navigate('/calendar')}><Icon name="calendar" /> Choose monthly creatives</button>
              <button className="nav-item" onClick={() => navigate('/jobs/new')}><Icon name="briefcase" /> Request custom design</button>
              <button className="nav-item" onClick={() => navigate('/social')}><Icon name="trending" /> View insights</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
