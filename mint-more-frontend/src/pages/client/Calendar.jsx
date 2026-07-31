import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { socialApi } from '../../api/social'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'

const statusLabel = {
  approved: 'Queued',
  pending_review: 'Review',
  in_production: 'In production',
  delivered: 'Delivered',
  completed: 'Completed',
  rejected: 'Not approved',
}
import Icon from '../../components/ui/Icon'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const PLATFORM_META = {
  instagram: { icon: 'instagram', color: '#E1306C', label: 'Instagram' },
  facebook:  { icon: 'facebook',  color: '#1877F2', label: 'Facebook'  },
  youtube:   { icon: 'youtube',   color: '#FF0000', label: 'YouTube'   },
}

const STATUS_META = {
  draft:       { label: 'Draft',       color: '#888' },
  scheduled:   { label: 'Scheduled',   color: '#f59e0b' },
  published:   { label: 'Published',   color: '#22c55e' },
  failed:      { label: 'Failed',      color: '#ef4444' },
  cancelled:   { label: 'Cancelled',   color: '#888' },
  processing:  { label: 'Processing',  color: '#a78bfa' },
}

const HOUR_RANGE_START = 6   // 6 AM
const HOUR_RANGE_END   = 23  // 11 PM

// ── Helpers ───────────────────────────────────────────────────────────────────

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const parseMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  return { year: y, monthNum: m - 1 }
}

const startOfDay = (date) => {
  const d = new Date(date); d.setHours(0,0,0,0); return d
}
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const isPastDay = (date) => startOfDay(date).getTime() < startOfDay(new Date()).getTime()

const fmt12 = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const fmtHourLabel = (h) => {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

const toLocalDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateKeyFromTs = (ts) => toLocalDateKey(ts)

// ── Sub-components ────────────────────────────────────────────────────────────

function PlatformDot({ platform, size = 11 }) {
  const meta = PLATFORM_META[platform]
  if (!meta) return null
  return (
    <span className="cal-platform-dot" style={{ color: meta.color }} title={meta.label}>
      <Icon name={meta.icon} size={size} />
    </span>
  )
}

function StatusDot({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft
  return (
    <span
      className="cal-status-dot"
      style={{ background: meta.color }}
      title={meta.label}
    />
  )
}

// Calendar cell chip — one per post
function PostChip({ post, onClick }) {
  const ts = post.publish_at || post.published_at
  return (
    <button type="button" className="cal-post-chip" onClick={onClick}>
      {/* Platform icons row */}
      <div className="cal-chip-platforms">
        {(post.platforms || []).map(p => (
          <PlatformDot key={p} platform={p} size={10} />
        ))}
      </div>
      {/* Thumbnail */}
      {post.media?.[0]?.thumbnail_url && (
        <img
          src={post.media[0].thumbnail_url}
          alt=""
          className="cal-chip-thumb"
        />
      )}
      {/* Caption */}
      <span className="cal-chip-caption">
        {(post.caption || post.title || 'Untitled').slice(0, 26)}
        {(post.caption || post.title || '').length > 26 ? '…' : ''}
      </span>
      {/* Time */}
      {ts && <span className="cal-chip-time">{fmt12(ts)}</span>}
      {/* Status dot */}
      <StatusDot status={post.status} />
    </button>
  )
}

// Platform summary bar at top of cell
function PlatformBar({ posts }) {
  const counts = useMemo(() => {
    const acc = {}
    posts.forEach(p => (p.platforms || []).forEach(pl => { acc[pl] = (acc[pl] || 0) + 1 }))
    return acc
  }, [posts])

  return (
    <div className="cal-cell-platform-bar">
      {Object.entries(counts).map(([p, count]) => {
        const meta = PLATFORM_META[p]
        if (!meta) return null
        return (
          <span key={p} className="cal-cell-platform-tag" style={{ borderColor: meta.color }}>
            <Icon name={meta.icon} size={9} style={{ color: meta.color }} />
            {count > 1 && <sup>{count}</sup>}
          </span>
        )
      })}
    </div>
  )
}

// Timeline hour row
function TimelineRow({ hour, posts, onPostClick }) {
  const postsHere = posts.filter(p => {
    const ts = p.publish_at || p.published_at
    return ts && new Date(ts).getHours() === hour
  })

  return (
    <div className={`timeline-hour-row${postsHere.length ? ' has-posts' : ''}`}>
      <span className="timeline-hour-label">{fmtHourLabel(hour)}</span>
      <div className="timeline-hour-track">
        {postsHere.map(post => (
          <button
            key={post.id}
            type="button"
            className="timeline-post-block"
            onClick={() => onPostClick(post)}
          >
            <div className="timeline-post-platforms">
              {(post.platforms || []).map(p => (
                <PlatformDot key={p} platform={p} size={12} />
              ))}
            </div>
            <div className="timeline-post-info">
              <span className="timeline-post-caption">
                {(post.caption || post.title || 'Untitled').slice(0, 50)}
              </span>
              <span className="timeline-post-time">
                {post.publish_at || post.published_at ? fmt12(post.publish_at || post.published_at) : '—'}
              </span>
            </div>
            <StatusDot status={post.status} />
          </button>
        ))}
      </div>
    </div>
  )
}

// Day panel (side drawer)
function DayPanel({ date, posts, events, pendingIds, togglePending, onClose, onEdit, onDelete, onNavigateToCompose, onNavigateToRequest }) {
  const timelineRef  = useRef(null)
  const [showFull, setShowFull] = useState(false)
  const [focusPost, setFocusPost] = useState(null)

  const displayedHours = useMemo(() => {
    if (showFull) return Array.from({ length: 24 }, (_, i) => i)
    return Array.from({ length: HOUR_RANGE_END - HOUR_RANGE_START + 1 }, (_, i) => i + HOUR_RANGE_START)
  }, [showFull])

  useEffect(() => {
    if (!timelineRef.current || !posts.length) return
    const firstTs = posts.reduce((earliest, p) => {
      const ts = p.publish_at || p.published_at
      return ts && (!earliest || new Date(ts) < new Date(earliest)) ? ts : earliest
    }, null)
    if (!firstTs) return
    const h = new Date(firstTs).getHours()
    const idx = displayedHours.indexOf(h)
    if (idx < 0) return
    const rows = timelineRef.current.querySelectorAll('.timeline-hour-row')
    if (rows[idx]) rows[idx].scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [posts, displayedHours])

  const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const isToday  = sameDay(date, new Date())

  return (
    <div className="w-full lg:w-[380px] flex flex-col shrink-0 bg-gradient-to-b from-ink-950 to-ink-900 text-white relative overflow-hidden border-l border-ink-800">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="p-6 pb-4 border-b border-white/10 shrink-0 relative z-10 flex justify-between items-start">
        <div>
          <div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            {isToday && <span className="bg-orange-500/20 px-2 py-0.5 rounded text-[10px] mr-2">Today</span>}
            {posts.length === 0 ? 'No posts' : `${posts.length} post${posts.length !== 1 ? 's' : ''} scheduled`}
          </div>
          <h3 className="text-xl font-bold">{dayLabel}</h3>
        </div>
        <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/10 transition-colors" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
        
        {/* Quick actions */}
        {!isPastDay(date) && (
          <div className="flex items-center gap-3 mb-8">
            <button className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors" onClick={() => onNavigateToCompose(date)}>
              <Icon name="send" size={14} /> Schedule Post
            </button>
            <button className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors" onClick={() => onNavigateToRequest(date)}>
              <Icon name="sparkles" size={14} className="text-orange-400" /> Custom Request
            </button>
          </div>
        )}

        {/* Creative Moments */}
        {events && events.length > 0 && (
          <div className="mb-8">
            <h4 className="text-xs font-bold tracking-widest uppercase text-ink-400 mb-3 flex items-center gap-2">
              <Icon name="sparkles" size={12} className="text-orange-500" /> Creative Moments
            </h4>
            <div className="flex flex-col gap-2">
              {events.map(event => {
                const saved = Boolean(event.selection)
                const staged = pendingIds.includes(event.id)
                const status = event.selection?.status
                return (
                  <div
                    key={event.id}
                    onClick={() => !saved && togglePending(event.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      saved ? 'bg-white/5 border-transparent cursor-default opacity-80' : 
                      staged ? 'bg-orange-500/10 border-orange-500/40 cursor-pointer shadow-[0_0_15px_rgba(var(--orange-500),0.1)]' : 
                      'bg-white/5 border-white/10 hover:border-white/20 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[13px] text-white leading-tight">{event.title}</div>
                      <div className="text-[10px] text-ink-400 capitalize mt-0.5">{event.asset_type?.replace(/_/g, ' ') || 'creative'}</div>
                    </div>
                    <div>
                      {saved ? (
                        <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-md text-ink-300">{statusLabel[status] || status}</span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${staged ? 'bg-orange-500 text-white' : 'bg-white/10 text-ink-300'}`}>
                          {staged ? 'Selected' : `${Number(event.coin_cost || 1)} coin`}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        {posts.length === 0 && (!events || events.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
            <Icon name="calendar" size={32} className="mb-3 text-ink-500" />
            <p className="text-sm text-ink-300">No creative moments or scheduled posts for this day.</p>
          </div>
        ) : posts.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-widest uppercase text-ink-400">Time Chart</span>
              <button className="text-[10px] font-bold text-primary hover:text-white transition-colors" onClick={() => setShowFull(v => !v)}>
                {showFull ? 'Show 6AM–11PM' : 'Show full day'}
              </button>
            </div>
            
            <div className="flex flex-col gap-0 border-l border-white/10 ml-4 pl-4 relative" ref={timelineRef}>
              {displayedHours.map(h => {
                const postsHere = posts.filter(p => {
                  const ts = p.publish_at || p.published_at
                  return ts && new Date(ts).getHours() === h
                })
                
                return (
                  <div key={h} className={`timeline-hour-row relative py-3 ${postsHere.length ? '' : 'opacity-40'}`}>
                    <div className="absolute -left-[21px] top-4 w-2 h-2 rounded-full bg-ink-900 border border-white/20 z-10" />
                    <div className="text-[10px] font-bold text-ink-400 absolute -left-12 top-3 w-8 text-right">{fmtHourLabel(h)}</div>
                    
                    <div className="flex flex-col gap-2">
                      {postsHere.map(post => (
                        <button
                          key={post.id}
                          onClick={() => setFocusPost(post)}
                          className="text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors w-full group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-1">
                              {(post.platforms || []).map(p => {
                                const meta = PLATFORM_META[p]
                                return meta ? <span key={p} className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color }}><Icon name={meta.icon} size={8} className="text-white" /></span> : null
                              })}
                            </div>
                            <StatusDot status={post.status} />
                          </div>
                          <div className="text-[13px] font-semibold text-white leading-tight mb-1 group-hover:text-primary transition-colors">{(post.caption || post.title || 'Untitled').slice(0, 50)}...</div>
                          <div className="text-[10px] text-ink-400 font-medium">
                            {post.publish_at || post.published_at ? fmt12(post.publish_at || post.published_at) : '—'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
            <Icon name="send" size={20} className="text-ink-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-ink-300">No social posts scheduled yet.</p>
          </div>
        )}
        
        {/* Post Detail Modal */}
        {focusPost && (
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-ink-900 rounded-2xl border border-white/10 shadow-2xl p-5 w-full flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <div className="flex gap-1.5">
                  {(focusPost.platforms || []).map(p => {
                    const meta = PLATFORM_META[p]
                    return meta ? <span key={p} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color }}><Icon name={meta.icon} size={10} className="text-white" /></span> : null
                  })}
                </div>
                <button onClick={() => setFocusPost(null)} className="text-ink-400 hover:text-white"><Icon name="x" size={16} /></button>
              </div>
              
              <div className="text-sm text-white mb-4 leading-relaxed">{focusPost.caption || focusPost.title || 'Untitled'}</div>
              
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium text-ink-300 flex items-center gap-1.5">
                  <Icon name="clock" size={12} /> {focusPost.publish_at || focusPost.published_at ? fmt12(focusPost.publish_at || focusPost.published_at) : '—'}
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 text-white">
                  {STATUS_META[focusPost.status]?.label || focusPost.status}
                </span>
              </div>
              
              {focusPost.media?.[0]?.thumbnail_url && (
                <img src={focusPost.media[0].thumbnail_url} alt="" className="w-full h-32 object-cover rounded-xl mb-4 border border-white/10" />
              )}
              
              <div className="flex items-center gap-2 mt-auto">
                <button className="flex-1 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors" onClick={() => onEdit(focusPost)}>Edit</button>
                <button className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors" onClick={() => onDelete(focusPost)}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  const [month, setMonth]             = useState(monthKey())
  const [activeDateKey, setActiveDateKey] = useState('')
  const [openDayMenuKey, setOpenDayMenuKey] = useState('')
  const [panelOpen, setPanelOpen]     = useState(false)
  const menuRef = useRef(null)

  // Close day menu on outside click
  useEffect(() => {
    if (!openDayMenuKey) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenDayMenuKey('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDayMenuKey])

  const [pendingIds, setPendingIds] = useState([])

  // 1. Fetch creative calendar moments (admin published)
  const { data: creativeData, isLoading: isCreativeLoading } = useQuery({
    queryKey: ['creative-calendar', month],
    queryFn: () => creativeApi.calendar({ month }).then(r => r.data.data),
  })

  // 2. Fetch social calendar posts (scheduled posts)
  const { data: socialData, isLoading: isSocialLoading } = useQuery({
    queryKey: ['social-calendar', month],
    queryFn: () => socialApi.getCalendarPosts(month).then(r => r.data.data),
  })

  const isLoading = isCreativeLoading || isSocialLoading

  const deleteMutation = useMutation({
    mutationFn: (postId) => socialApi.deletePost(postId),
    onSuccess: () => {
      pushToast({ title: 'Post deleted' })
      queryClient.invalidateQueries({ queryKey: ['social-calendar'] })
    },
    onError: err => pushToast({ title: 'Delete failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
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
      queryClient.invalidateQueries({ queryKey: ['social-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['creative-work'] })
      queryClient.invalidateQueries({ queryKey: ['mint-credits'] })
    },
    onError: err => pushToast({ title: 'Could not confirm selections', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const togglePending = useCallback((id) => {
    setPendingIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const creativeEvents = creativeData?.events || []
  const availableEvents = creativeEvents.filter(e => !e.selection)
  const selectedPending = creativeEvents.filter(e => pendingIds.includes(e.id))
  const pendingCost = selectedPending.reduce((sum, e) => sum + Number(e.coin_cost || 1), 0)
  const overBalance = pendingCost > Number(creativeData?.balance || 0)

  const { year, monthNum } = parseMonth(month)

  const navigateMonth = (dir) => {
    const d = new Date(year, monthNum + dir, 1)
    setMonth(monthKey(d))
    setActiveDateKey('')
    setPanelOpen(false)
  }

  // Build calendar cells
  const calendarCells = useMemo(() => {
    const creativeEvents = creativeData?.events || []
    
    // Group social posts by local date key
    const postsList = socialData?.posts || []
    const byDate = {}
    postsList.forEach(post => {
      const ts = post.publish_at || post.published_at || post.created_at
      if (ts) {
        const dateKey = toLocalDateKey(ts)
        if (!byDate[dateKey]) byDate[dateKey] = []
        byDate[dateKey].push(post)
      }
    })

    const first  = new Date(year, monthNum, 1)
    const days   = new Date(year, monthNum + 1, 0).getDate()
    const leading = first.getDay()

    return [
      ...Array.from({ length: leading }, (_, i) => ({ key: `blank-${i}`, blank: true })),
      ...Array.from({ length: days }, (_, i) => {
        const date    = new Date(year, monthNum, i + 1)
        const dateKey = toLocalDateKey(date)
        return {
          key: date.toISOString(),
          dateKey,
          date,
          posts: byDate[dateKey] || [],
          events: creativeEvents.filter(e => e.event_date && sameDay(e.event_date, date)),
        }
      }),
    ]
  }, [creativeData, socialData, year, monthNum])

  const todayKey    = toLocalDateKey(new Date())
  const activeCell  = useMemo(() =>
    calendarCells.find(c => !c.blank && c.dateKey === activeDateKey) ||
    calendarCells.find(c => !c.blank && c.dateKey === todayKey) ||
    calendarCells.find(c => !c.blank && c.posts?.length > 0) ||
    null,
  [activeDateKey, calendarCells, todayKey])

  const openCell = useCallback((cell) => {
    if (cell.blank) return
    setActiveDateKey(cell.dateKey)
    setPanelOpen(true)
  }, [])

  const openCompose = useCallback((date) => {
    if (isPastDay(date)) {
      pushToast({ title: 'Choose today or later', body: 'Posts can only be scheduled for today or a future date.', tone: 'amber' })
      return
    }
    const formatted = toLocalDateKey(date)
    navigate(`/posts?compose=1&publish_at=${formatted}`)
  }, [navigate, pushToast])

  const openRequest = useCallback((date) => {
    if (isPastDay(date)) {
      pushToast({ title: 'Choose today or later', body: 'Custom requests can only be created for today or a future date.', tone: 'amber' })
      return
    }
    const formatted = toLocalDateKey(date)
    navigate(`/jobs/new?deadline=${formatted}`)
    pushToast({ title: 'Date selected', body: 'We opened a new request with this date already filled in.', icon: 'calendar' })
  }, [navigate, pushToast])

  const handleEdit = useCallback((post) => {
    navigate(`/posts?edit=${post.id}`)
  }, [navigate])

  const handleDelete = useCallback((post) => {
    if (window.confirm(`Delete "${post.caption || post.title || 'this post'}"?`)) {
      deleteMutation.mutate(post.id)
    }
  }, [deleteMutation])

  const totalPosts = socialData?.total || 0

  return (
    <div className="cal-page">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="cal-header">
        <div className="cal-header-left">
          <div className="cal-header-eyebrow">Social calendar</div>
          <h1 className="cal-header-title">Content Schedule</h1>
          <p className="cal-header-sub">Plan and manage your social media posts.</p>
        </div>
        <div className="cal-header-right">
          {!isLoading && (
            <div className="cal-balance-pill" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '20px', background: 'var(--paper-deep)', border: '1px solid var(--hairline)' }}>
              <Icon name="coin" size={14} style={{ color: 'var(--mint-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)' }}>Balance</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-900)' }}>{Number(creativeData?.balance || 0).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => navigateMonth(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="cal-nav-label">{MONTHS[monthNum]} {year}</span>
          <button className="cal-nav-btn" onClick={() => navigateMonth(1)} aria-label="Next month">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="cal-toolbar-meta">
          {pendingIds.length > 0 ? (
            <div className="cal-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`cal-selection-count ${overBalance ? 'over' : ''}`} style={{ fontSize: '12.5px', fontWeight: 650, color: overBalance ? 'var(--amber-700)' : 'var(--mint-700)' }}>
                <Icon name="check" size={12} style={{ marginRight: 4 }} />
                {pendingIds.length} selected · {pendingCost} coin{pendingCost !== 1 ? 's' : ''}
                {overBalance && <span className="cal-over-label"> · over balance</span>}
              </span>
              <button className="btn ghost small" disabled={select.isPending} onClick={() => setPendingIds([])} style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-700)' }}>
                Clear
              </button>
              <button className="btn primary small" disabled={select.isPending || overBalance} onClick={() => select.mutate(pendingIds)} style={{ background: 'var(--mint-500)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                {select.isPending ? (
                  <><Icon name="loader" size={14} /> Confirming...</>
                ) : (
                  <><Icon name="check" size={14} /> Confirm selections</>
                )}
              </button>
            </div>
          ) : (
            <>
              {!isLoading && (
                <span className="cal-toolbar-count">
                  {totalPosts} post{totalPosts !== 1 ? 's' : ''} this month
                </span>
              )}
              {/* Platform legend */}
              <div className="cal-legend">
                {Object.entries(PLATFORM_META).map(([p, meta]) => (
                  <span key={p} className="cal-legend-item" style={{ color: meta.color }}>
                    <Icon name={meta.icon} size={11} /> {meta.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className={`cal-shell${panelOpen && activeCell ? ' panel-open' : ''}`}>

        {/* ── Calendar grid ───────────────────────────────────────────────── */}
        <div className="cal-grid-wrap">
          {/* Weekday headers */}
          <div className="cal-weekdays">
            {WEEKDAYS.map(d => <div key={d} className="cal-weekday-label">{d}</div>)}
          </div>

          {/* Skeleton */}
          {isLoading ? (
            <div className="cal-month-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="cal-skeleton-cell" style={{ animationDelay: `${i * 18}ms` }} />
              ))}
            </div>
          ) : (
            <div className="cal-month-grid">
              {calendarCells.map(cell => {
                const isToday  = !cell.blank && sameDay(cell.date, new Date())
                const isActive = !cell.blank && cell.dateKey === activeCell?.dateKey
                const isPast   = !cell.blank && isPastDay(cell.date)
                const hasPosts = !cell.blank && cell.posts.length > 0

                return (
                  <div
                    key={cell.key}
                    role={cell.blank ? undefined : 'button'}
                    tabIndex={cell.blank ? undefined : 0}
                    className={[
                      'cal-day-cell',
                      cell.blank  && 'blank',
                      isToday     && 'today',
                      isActive    && 'active',
                      isPast      && 'past',
                      hasPosts    && 'has-posts',
                    ].filter(Boolean).join(' ')}
                    onClick={() => !cell.blank && openCell(cell)}
                    onKeyDown={e => { if (!cell.blank && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCell(cell) } }}
                  >
                    {!cell.blank && (
                      <>
                        {/* Day header row */}
                        <div className="cal-day-header">
                          <span className={`cal-day-num${isToday ? ' today' : ''}`}>
                            {cell.date.getDate()}
                          </span>
                          {/* + menu */}
                          {!isPast && (
                            <div className="cal-day-add-wrap" ref={openDayMenuKey === cell.key ? menuRef : null}>
                              <button
                                type="button"
                                className="cal-day-add"
                                aria-label="Add post to this day"
                                onClick={e => { e.stopPropagation(); setOpenDayMenuKey(prev => prev === cell.key ? '' : cell.key) }}
                              >
                                <Icon name="plus" size={11} />
                              </button>
                              {openDayMenuKey === cell.key && (
                                <div className="cal-day-menu" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="cal-day-menu-item"
                                    onClick={() => { setOpenDayMenuKey(''); openCompose(cell.date) }}
                                  >
                                    <Icon name="send" size={13} />
                                    <span>Schedule post</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="cal-day-menu-item"
                                    onClick={() => { setOpenDayMenuKey(''); openRequest(cell.date) }}
                                  >
                                    <Icon name="sparkles" size={13} />
                                    <span>Custom request</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Creative moments */}
                        {cell.events && cell.events.length > 0 && (
                          <div className="stack" style={{ gap: 4, marginTop: 4, marginBottom: 4 }}>
                            {cell.events.map(event => {
                              const saved = Boolean(event.selection)
                              const staged = pendingIds.includes(event.id)
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  disabled={saved}
                                  onClick={(e) => { e.stopPropagation(); if (!saved) togglePending(event.id) }}
                                  className={`cal-event-chip${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                                >
                                  <span className="cal-chip-dot" />
                                  <span className="cal-chip-title">{event.title}</span>
                                  <span className="cal-chip-meta">
                                    {saved ? (
                                      <span className="badge neutral small" style={{ fontSize: '9px', padding: '1px 5px' }}>Queued</span>
                                    ) : (
                                      <span className={`cal-chip-badge ${staged ? 'staged' : ''}`}>{staged ? '✓' : `${Number(event.coin_cost || 1)}c`}</span>
                                    )}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Platform summary bar */}
                        {hasPosts && <PlatformBar posts={cell.posts} />}

                        {/* Post chips — up to 3, then overflow */}
                        {hasPosts && (
                          <div className="cal-event-stack">
                            {cell.posts.slice(0, 3).map(post => (
                              <PostChip
                                key={post.id}
                                post={post}
                                onClick={e => { e.stopPropagation(); openCell(cell) }}
                              />
                            ))}
                            {cell.posts.length > 3 && (
                              <span className="cal-overflow-badge">+{cell.posts.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Day panel ───────────────────────────────────────────────────── */}
        {panelOpen && activeCell && (
          <DayPanel
            date={activeCell.date}
            posts={activeCell.posts}
            events={activeCell.events}
            pendingIds={pendingIds}
            togglePending={togglePending}
            onClose={() => setPanelOpen(false)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNavigateToCompose={openCompose}
            onNavigateToRequest={openRequest}
          />
        )}
      </div>

      {/* ── Selection summary strip ──────────────────────────────────────── */}
      {availableEvents.length > 0 && (
        <div className="cal-summary" style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-width, 240px)', right: 0, background: '#fff', borderTop: '1px solid var(--hairline-strong)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 40, boxShadow: '0 -4px 16px rgba(0,0,0,0.03)' }}>
          <div>
            <div className="cal-summary-label" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--mint-600)', letterSpacing: '0.05em' }}>Selection summary</div>
            {pendingIds.length === 0 ? (
              <p className="cal-summary-hint" style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-500)' }}>
                Choose <span className="cal-summary-accent" style={{ fontWeight: 600, color: 'var(--ink-700)' }}>one or more</span> calendar moments above. Nothing is sent until you press confirm.
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--ink-900)' }}>
                  {pendingIds.length} moment{pendingIds.length !== 1 ? 's' : ''} selected
                </span>
                <span className={overBalance ? 'cal-summary-total-over' : 'cal-summary-total-ok'} style={{ fontSize: '13.5px', fontWeight: 700, color: overBalance ? 'var(--amber-700)' : 'var(--mint-600)' }}>
                  Total cost: {pendingCost} coin{pendingCost !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          {pendingIds.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost small" disabled={select.isPending} onClick={() => setPendingIds([])} style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-700)' }}>
                Clear
              </button>
              <button className="btn primary small" disabled={select.isPending || overBalance} onClick={() => select.mutate(pendingIds)} style={{ background: 'var(--mint-500)', border: 'none', color: '#fff' }}>
                {select.isPending ? 'Confirming...' : 'Confirm selections'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
