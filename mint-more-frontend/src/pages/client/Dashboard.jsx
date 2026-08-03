import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { creativeApi } from '../../api/creative'
import { mintboxApi } from '../../api/mintbox'
import { socialApi } from '../../api/social'
import { aiApi } from '../../api/ai'
import { walletApi } from '../../api/wallet'
import { api } from '../../api/client'
import { useEntitlements } from '../../hooks/useEntitlements'
import Icon from '../../components/ui/Icon'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusAccent } from '../../components/ui/statusMeta'

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

function MiniCalendar({ events = [], tasks = [], posts = [], onOpenCalendar }) {
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
      const dayPosts = posts.filter(post => {
        const ts = post.publish_at || post.published_at
        return ts && sameDay(ts, date)
      })
      return { key: date.toISOString(), date, dayEvents, dayTasks, dayPosts }
    }),
  ]
  const describeCell = (cell) => {
    if (cell.blank) return ''
    const dayEvents = cell.dayEvents || []
    const dayTasks = cell.dayTasks || []
    const dayPosts = cell.dayPosts || []
    const lines = [
      cell.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
      ...dayEvents.map(event => `${event.title} - ${event.asset_type?.replace(/_/g, ' ') || 'creative'}`),
      ...dayTasks.map(task => `${task.title} - ${task.client_status || task.status}`),
      ...dayPosts.map(post => `${post.caption || post.title || 'Social post'} - ${post.status}`),
    ]
    return lines.join('\n')
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-1">This month</div>
          <div className="text-lg font-bold text-ink-900">{now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
        </div>
        <button className="text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" onClick={onOpenCalendar}>
          Open
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-400 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => <div key={`${day}-${idx}`}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {cells.map(cell => {
          const dayEvents = cell.dayEvents || []
          const dayTasks = cell.dayTasks || []
          const dayPosts = cell.dayPosts || []
          const details = [
            ...dayEvents.map(event => ({ title: event.title, meta: event.asset_type?.replace(/_/g, ' ') || 'creative', tone: 'event' })),
            ...dayTasks.map(task => ({ title: task.title, meta: task.client_status || task.status, tone: 'task' })),
            ...dayPosts.map(post => ({ title: post.caption || post.title || 'Social post', meta: post.status, tone: 'post' })),
          ]
          const isToday = !cell.blank && sameDay(cell.date, now)
          const hasItems = !cell.blank && details.length > 0
          
          return (
          <button
            key={cell.key}
            title={describeCell(cell)}
            type="button"
            className={`relative flex items-center justify-center rounded-xl text-sm font-medium transition-all group ${
              cell.blank ? 'opacity-0 cursor-default' : 
              isToday ? 'bg-orange-500 text-white shadow-md' :
              hasItems ? 'bg-ink-50 text-ink-900 hover:bg-ink-100' :
              'text-ink-600 hover:bg-ink-50'
            } min-h-[44px]`}
            disabled={cell.blank}
            onContextMenu={(event) => {
              if (!cell.blank && details.length) {
                event.preventDefault()
                onOpenCalendar()
              }
            }}
          >
            {!cell.blank && cell.date.getDate()}
            {!cell.blank && (dayEvents.length > 0 || dayTasks.length > 0 || dayPosts.length > 0) && (
              <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                dayTasks.length ? (isToday ? 'bg-white' : 'bg-orange-500') :
                dayPosts.length ? (isToday ? 'bg-white' : 'bg-mint-500') : 'bg-amber-500'
              }`} />
            )}
            {hasItems && (
              <div
                className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-56 p-3 bg-ink-900 text-white rounded-xl shadow-xl z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none text-left"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-ink-400 mb-2">
                  {cell.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div className="flex flex-col gap-2">
                  {details.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="text-xs leading-snug">
                      <strong className="block font-semibold text-white">{item.title}</strong>
                      <span className="text-[10px] text-ink-400">{item.meta}</span>
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

  const { data: access } = useEntitlements()
  const flags = access?.feature_flags || {}

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
    enabled: !isGuest && flags.social_insights !== false,
  })

  const { data: postsData } = useQuery({
    queryKey: ['social-posts-scheduled'],
    queryFn: () => socialApi.listPosts({ status: 'scheduled', limit: 50 }).then(r => r.data.data),
    enabled: !isGuest && flags.posting !== false,
  })

  const { data: aiData } = useQuery({
    queryKey: ['ai-generations'],
    queryFn: () => aiApi.getGenerations({ limit: 6 }).then(r => r.data.data),
    enabled: !isGuest,
  })

  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => walletApi.get().then(r => r.data.data),
    enabled: !isGuest,
  })

  const [promptText, setPromptText] = useState('')
  const handlePromptSubmit = (e) => {
    e.preventDefault()
    if (promptText.trim()) {
      navigate(`/ai?prompt=${encodeURIComponent(promptText)}`)
    }
  }

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

  useEffect(() => {
    if (profileData && !isGuest) {
      const prof = profileData.profile || profileData || {}
      if (!prof.onboarding_checklist?.profile && !prof.business_name) {
        navigate('/onboarding')
      }
    }
  }, [profileData, isGuest, navigate])

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
  const socialPosts = postsData?.items || []
  
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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">
          {greeting}, {user?.full_name?.split(' ')[0] || 'there'}.
        </h1>
      </div>

      {/* Brand Profile Completion Reach Boost Banner */}
      {user?.role === 'client' && setupDone < 4 && (
        <div className="bg-gradient-to-r from-mint-500/10 via-mint-500/5 to-transparent border border-mint-500/20 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_rgba(16,185,129,0.05),_transparent_50%)]" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-mint-500/20 text-mint-600 flex items-center justify-center shrink-0">
              <Icon name="trending" size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-950 m-0">Boost Your Reach by 45% 🚀</h3>
              <p className="text-sm text-ink-600 m-0 mt-1 max-w-2xl leading-relaxed">
                Complete your brand profile details (brand colors, logos, local occasion preferences) to let our AI auto-generate highly customized creatives and caption schedules for your business.
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings?section=brand-assets')}
            className="btn primary relative z-10 shrink-0 self-start md:self-auto"
          >
            Complete Brand Setup
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {flags.calendar_creatives !== false ? (
          <>
            <div className="lg:col-span-2 relative bg-ink-950 rounded-2xl overflow-hidden text-white p-6 md:p-8 shadow-lg flex flex-col justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,_rgba(247,127,0,0.22),_transparent_46%)]" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <span className="text-xs font-bold tracking-widest uppercase text-white/60">CREATYV calendar</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-200 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Internal creative team
                    </span>
                  </div>
                  <div className="text-2xl md:text-3xl font-display font-bold leading-tight mb-3">
                    {todayTasks.length ? `${todayTasks.length} creative${todayTasks.length === 1 ? '' : 's'} due today` : 'Your creative calendar is clear today'}
                  </div>
                  <p className="text-white/70 text-sm md:text-base max-w-lg mb-8 leading-relaxed">
                    Track what CREATYV is creating, what is due next, and which calendar moments are already handled.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm" onClick={() => navigate('/calendar')}>
                      <Icon name="calendar" size={18} /> View full calendar
                    </button>
                    {flags.custom_requests !== false && (
                      <button className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl font-medium transition-colors" onClick={() => navigate('/jobs/new')}>
                        New custom request <Icon name="arrowRight" size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mt-8">
                  {[
                    ['In progress', inProgress.length],
                    ['Done', done.length],
                    ['Tomorrow', tomorrowTasks.length],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur-sm">
                      <div className="text-white/60 text-xs font-medium mb-1">{label}</div>
                      <div className="font-mono text-2xl md:text-3xl font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 min-h-[380px]">
              <MiniCalendar events={events} tasks={tasks} posts={socialPosts} onOpenCalendar={() => navigate('/calendar')} />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-3 relative bg-ink-950 rounded-2xl overflow-hidden text-white p-6 md:p-10 shadow-lg flex flex-col justify-between mb-2">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(247,127,0,0.25),_transparent_60%)]" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Your AI creative assistant is ready.</h2>
                <p className="text-white/70 text-lg max-w-xl mb-8">Generate stunning designs, craft engaging copy, and bring your ideas to life instantly with Mint AI.</p>
                
                <form onSubmit={handlePromptSubmit} className="relative max-w-2xl flex items-center">
                  <Icon name="sparkles" size={20} className="absolute left-4 text-orange-500" />
                  <input
                    type="text"
                    placeholder="What do you want to create today?"
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-4 pl-12 pr-32 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 backdrop-blur-sm"
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                  />
                  <button type="submit" className="absolute right-2 top-2 bottom-2 bg-orange-500 hover:bg-orange-600 text-white px-5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
                    Create <Icon name="arrowRight" size={16} />
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-[13px] font-bold tracking-widest uppercase text-ink-500">Recent AI Generations</h3>
                <button onClick={() => navigate('/ai')} className="text-sm font-medium text-orange-600 hover:text-orange-700">View all</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
                {aiData?.items?.length > 0 ? (
                  aiData.items.slice(0, 5).map(gen => (
                    <div key={gen.id} className="min-w-[200px] h-[200px] bg-ink-100 rounded-xl overflow-hidden shadow-sm flex-shrink-0 snap-start relative group cursor-pointer" onClick={() => navigate('/ai')}>
                      {gen.asset_url || gen.thumbnail_url ? (
                        <img src={gen.asset_url || gen.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full p-4 text-xs text-ink-600 font-medium break-words bg-white border border-ink-200">
                          {gen.prompt_text?.substring(0, 100)}...
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span className="text-white text-xs font-medium truncate">{gen.model_id}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="min-w-[200px] h-[200px] bg-white border border-ink-200 border-dashed rounded-xl flex-shrink-0 snap-start flex flex-col items-center justify-center text-ink-400 gap-2 cursor-pointer hover:bg-ink-50 transition-colors" onClick={() => navigate('/ai')}>
                      <Icon name="image" size={24} />
                      <span className="text-xs font-medium">Try a prompt</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {setupDone < setupItems.length && (
        <div className="bg-white rounded-2xl border border-ink-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-1">Setup</div>
            <div className="text-lg font-bold text-ink-900 mb-1">Make CREATYV work around your business</div>
            <div className="text-sm text-ink-500 mb-3">{setupDone} of {setupItems.length} steps complete</div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${(setupDone / setupItems.length) * 100}%` }} />
            </div>
          </div>
          <button className="shrink-0 inline-flex items-center gap-2 bg-ink-900 hover:bg-ink-950 text-white px-5 py-2.5 rounded-xl font-medium transition-colors" onClick={() => navigate('/settings?section=setup')}>
            Continue setup <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <section className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-ink-900 m-0">In production</h2>
            <button className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center gap-1" onClick={() => navigate('/jobs')}>
              See all <Icon name="arrowRight" size={14} />
            </button>
          </div>
          
          {inProgress.length === 0 && activeRequests.length === 0 ? (
            <div className="bg-ink-50 border border-dashed border-ink-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-ink-400 mb-4">
                <Icon name="calendar" size={24} />
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-2">No creatives queued yet</h3>
              <p className="text-ink-500 text-sm mb-6 max-w-sm">Pick calendar events or send a custom request to CREATYV to get started.</p>
              <button className="inline-flex items-center gap-2 bg-ink-900 hover:bg-ink-950 text-white px-5 py-2.5 rounded-xl font-medium transition-colors" onClick={() => navigate('/calendar')}>
                <Icon name="plus" size={16} /> Choose creatives
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...inProgress, ...activeRequests].slice(0, 6).map(item => (
                <button
                  key={`${item.id}-${item.title}`}
                  className="bg-white rounded-xl border border-ink-200 p-5 shadow-sm hover:shadow-md transition-shadow text-left group"
                  onClick={() => navigate('/jobs')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded-md">{item.source_type ? 'Production task' : 'Custom request'}</span>
                    {['assigned', 'in_progress', 'delivered', 'revision', 'blocked'].includes(item.status)
                      ? <StatusBadge status={item.status} />
                      : <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded-md capitalize">{item.client_status || item.status?.replace(/_/g, ' ')}</span>}
                  </div>
                  <div className="text-base font-semibold text-ink-900 mb-1 group-hover:text-orange-600 transition-colors">{item.title}</div>
                  <div className="text-sm text-ink-500 line-clamp-2">{item.description || 'CREATYV is reviewing this item.'}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="lg:col-span-1 flex flex-col gap-5">
          {/* MintCoins */}
          <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500">MintCoins</div>
              <Icon name="zap" size={16} className="text-orange-500" />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-mono text-3xl font-bold text-ink-900">{wallet?.balance || 0}</span>
              <span className="text-sm font-medium text-ink-500">coins</span>
            </div>
            <button onClick={() => navigate('/wallet')} className="w-full bg-ink-900 hover:bg-ink-800 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
              Buy More Coins
            </button>
          </div>

          {flags.social_insights !== false && (
            <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500">Social growth</div>
                <button className="text-orange-600 hover:bg-orange-50 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors" onClick={() => navigate('/social')}>Open</button>
              </div>
              <div className="font-mono text-3xl font-bold text-ink-900">{Number(summary?.reach || 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-ink-500 mt-1 mb-4">people reached in the last {summary?.period_days || 30} days</div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex text-xs font-medium bg-ink-100 text-ink-600 px-2.5 py-1 rounded-md">{connectedAccounts.length} connected</span>
                <span className="inline-flex text-xs font-medium bg-orange-50 text-orange-700 px-2.5 py-1 rounded-md">{summary?.engagement_rate_percent || 0}% engagement</span>
              </div>
            </div>
          )}

          {flags.mintbox !== false && (
            <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500">Mintbox Storage</div>
                <button className="text-orange-600 hover:bg-orange-50 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors" onClick={() => navigate('/mintbox')}>Open</button>
              </div>
              <div className="flex items-center justify-between text-xs font-medium text-ink-600 mb-2.5">
                <span>{formatBytes(quota?.used || 0)} used</span>
                <span>{formatBytes(quota?.limit || 10 * GB)}</span>
              </div>
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${usedPct > 90 ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${usedPct}%` }} />
              </div>
            </div>
          )}

          {/* Custom Requests */}
          {flags.custom_requests !== false && (
            <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
              <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-3">Custom Requests</div>
              <div className="flex flex-col items-center py-4 text-ink-400 gap-3">
                <Icon name="briefcase" size={32} />
              </div>
              <button onClick={() => navigate('/jobs/new')} className="w-full bg-ink-900 hover:bg-ink-800 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Request custom design
              </button>
            </div>
          )}

          {/* Quick Actions (only show if any action is available) */}
          {(flags.calendar_creatives !== false || flags.custom_requests !== false || flags.social_insights !== false) && (
            <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
              <div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-4">Quick Actions</div>
              <div className="flex flex-col gap-2">
                {flags.calendar_creatives !== false && (
                  <button className="flex items-center gap-3 w-full text-left p-2.5 hover:bg-ink-50 rounded-xl transition-colors text-sm font-medium text-ink-700" onClick={() => navigate('/calendar')}>
                    <Icon name="calendar" size={18} className="text-orange-500" /> Choose monthly creatives
                  </button>
                )}
                {flags.custom_requests !== false && (
                  <button className="flex items-center gap-3 w-full text-left p-2.5 hover:bg-ink-50 rounded-xl transition-colors text-sm font-medium text-ink-700" onClick={() => navigate('/jobs/new')}>
                    <Icon name="briefcase" size={18} className="text-orange-500" /> Request custom design
                  </button>
                )}
                {flags.social_insights !== false && (
                  <button className="flex items-center gap-3 w-full text-left p-2.5 hover:bg-ink-50 rounded-xl transition-colors text-sm font-medium text-ink-700" onClick={() => navigate('/social')}>
                    <Icon name="trending" size={18} className="text-orange-500" /> View insights
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
