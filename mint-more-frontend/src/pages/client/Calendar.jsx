import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { socialApi } from '../../api/social'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const statusLabel = {
  approved: 'Queued',
  pending_review: 'Review',
  in_production: 'In production',
  delivered: 'Delivered',
  completed: 'Completed',
  rejected: 'Not approved',
}

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

// Standard festival presets for Swap Modal
const FESTIVAL_PRESETS = [
  { id: 'f1', title: 'Independence Day Special Greeting', tag: 'National Holiday', format: 'post' },
  { id: 'f2', title: 'Diwali Festive Offer & Wishes', tag: 'Festival of Lights', format: 'carousel' },
  { id: 'f3', title: 'New Year Brand Celebration', tag: 'Holiday', format: 'reel' },
  { id: 'f4', title: 'Customer Appreciation Day', tag: 'Brand Event', format: 'post' },
]

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

const getPostFormat = (post) => {
  let format = 'post'
  if (post?.content_type) {
    format = post.content_type.toLowerCase()
  } else if (post?.format) {
    format = post.format.toLowerCase()
  } else if (post?.type) {
    format = post.type.toLowerCase()
  }

  if (['reel', 'video', 'short', 'story'].includes(format)) return 'reel'
  if (format === 'carousel') return 'carousel'
  if (format === 'image' || format === 'text' || format === 'social_post' || format.includes('post')) return 'post'

  if (post?.asset_type) {
    const at = post.asset_type.toLowerCase()
    if (at.includes('reel')) return 'reel'
    if (at.includes('carousel')) return 'carousel'
  }
  if (post?.media?.[0]?.media_type === 'video' || post?.media?.[0]?.type === 'video') return 'reel'
  if (post?.media && post.media.length > 1) return 'carousel'

  return format.length > 10 ? 'post' : format
}

const matchesFormatFilter = (item, filter) => {
  if (filter === 'all') return true
  const fmt = getPostFormat(item)
  return fmt === filter
}

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
  const format = getPostFormat(post)
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
      {/* Format Badge */}
      <span className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
        format === 'reel' ? 'bg-pink-500 text-white' :
        format === 'carousel' ? 'bg-blue-500 text-white' :
        'bg-mint-600 text-white'
      }`}>
        {format}
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

/* R4 LEGACY: Legacy DayPanel Subcomponent Preserved
function DayPanel({ date, posts, events, pendingIds, togglePending, onClose, onEdit, onDelete, onNavigateToCompose, onNavigateToRequest }) {
  const timelineRef  = useRef(null)
  const [isSubmitError, setIsSubmitError] = useState(false)
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')
  const [showFull, setShowFull] = useState(false)
  const [focusPost, setFocusPost] = useState(null)

  const displayedHours = useMemo(() => {
    if (showFull) return Array.from({ length: 24 }, (_, i) => i)
    return Array.from({ length: HOUR_RANGE_END - HOUR_RANGE_START + 1 }, (_, i) => i + HOUR_RANGE_START)
  }, [showFull])

  // Scroll to first post automatically
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
    <div className="cal-day-panel">
      // Panel header
      <div className="cal-panel-head">
        <div>
          <div className="cal-panel-eyebrow">
            {isToday && <span className="cal-today-badge">Today</span>}
          </div>
          <h3 className="cal-panel-title">{dayLabel}</h3>
          <p className="cal-panel-sub">
            {posts.length === 0 ? 'No posts' : `${posts.length} post${posts.length !== 1 ? 's' : ''} scheduled`}
          </p>
        </div>
        <button className="cal-panel-close" type="button" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      // Quick actions
      {!isPastDay(date) && (
        <div className="cal-panel-actions">
          <button
            className="btn dark small"
            type="button"
            onClick={() => onNavigateToCompose(date)}
          >
            <Icon name="plus" size={13} /> Schedule post
          </button>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => onNavigateToRequest(date)}
            style={{ color: 'var(--ink-800)', border: '1px solid var(--hairline-strong)' }}
          >
            <Icon name="sparkles" size={13} style={{ color: 'var(--mint-600)' }} /> Custom request
          </button>
        </div>
      )}

      // Creative Moments
      {events && events.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 18 }}>
          <div className="cal-panel-section-label" style={{ marginBottom: 8 }}>CREATIVE MOMENTS</div>
          <div className="stack" style={{ gap: 8 }}>
            {events.map(event => {
              const saved = Boolean(event.selection)
              const staged = pendingIds.includes(event.id)
              const status = event.selection?.status
              return (
                <div
                  key={event.id}
                  className={`cal-detail-row${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                  onClick={() => !saved && togglePending(event.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${staged ? 'var(--mint-500)' : 'var(--hairline-strong)'}`,
                    background: staged ? 'rgba(247,127,0,0.03)' : 'var(--paper)',
                    textAlign: 'left',
                    cursor: saved ? 'default' : 'pointer'
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--ink-900)' }}>{event.title}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                      {event.asset_type?.replace(/_/g, ' ') || 'creative'}
                    </span>
                  </div>
                  <div>
                    {saved ? (
                      <span className="badge neutral" style={{ textTransform: 'capitalize' }}>
                        {statusLabel[status] || status}
                      </span>
                    ) : (
                      <span className={`badge ${staged ? 'mint' : 'neutral'}`}>
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

      // Timeline or empty state
      {posts.length === 0 && (!events || events.length === 0) ? (
        <div className="cal-panel-empty">
          <Icon name="calendar" size={24} />
          <p>No creative moments or scheduled posts for this day.</p>
        </div>
      ) : (
        <>
          {posts.length > 0 ? (
            <>
              <div className="cal-panel-section-label">
                <span>TIME CHART</span>
                <button
                  type="button"
                  className="cal-panel-toggle-full"
                  onClick={() => setShowFull(v => !v)}
                >
                  {showFull ? 'Show 6AM–11PM' : 'Show full day'}
                </button>
              </div>
              <div className="day-panel-timeline" ref={timelineRef}>
                {displayedHours.map(h => (
                  <TimelineRow
                    key={h}
                    hour={h}
                    posts={posts}
                    onPostClick={setFocusPost}
                  />
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed var(--hairline-strong)', borderRadius: '12px', background: 'var(--paper)', margin: '0 16px 16px' }}>
              <Icon name="send" size={16} style={{ color: 'var(--ink-400)', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-500)', fontWeight: 550 }}>No social posts scheduled for this day yet.</p>
            </div>
          )}
        </>
      )}

      // Focused post detail
      {focusPost && (
        <div className="cal-focused-post">
          <div className="cal-focused-post-head">
            <div className="cal-focused-platforms">
              {(focusPost.platforms || []).map(p => (
                <PlatformDot key={p} platform={p} size={14} />
              ))}
            </div>
            <button type="button" className="icon-btn small" onClick={() => setFocusPost(null)}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <p className="cal-focused-caption">{focusPost.caption || focusPost.title || 'Untitled'}</p>
          {(focusPost.publish_at || focusPost.published_at) && (
            <p className="cal-focused-time">
              <Icon name="clock" size={12} />
              {fmt12(focusPost.publish_at || focusPost.published_at)}
            </p>
          )}
          <div className={`cal-focused-status cal-status-${focusPost.status}`}>
            <StatusDot status={focusPost.status} />
            {STATUS_META[focusPost.status]?.label || focusPost.status}
          </div>
          {focusPost.media?.[0]?.thumbnail_url && (
            <img src={focusPost.media[0].thumbnail_url} alt="" className="cal-focused-thumb" />
          )}
          <div className="cal-focused-btns">
            <button type="button" className="btn ghost small" onClick={() => onEdit(focusPost)}>
              <Icon name="edit" size={12} /> Edit
            </button>
            <button type="button" className="btn ghost small danger" onClick={() => onDelete(focusPost)}>
              <Icon name="trash" size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
*/

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  const [month, setMonth]                     = useState(monthKey())
  const [activeDateKey, setActiveDateKey]     = useState('')
  const [openDayMenuKey, setOpenDayMenuKey]   = useState('')
  const [panelOpen, setPanelOpen]             = useState(false)
  const menuRef = useRef(null)

  // R1 State additions
  const [formatFilter, setFormatFilter]       = useState('all') // 'all' | 'reel' | 'carousel' | 'post'
  const [hoveredDateKey, setHoveredDateKey]   = useState(null)
  const [expandedTopicId, setExpandedTopicId] = useState(null)

  // R2 Swap Topic Modal State
  const [swapModalState, setSwapModalState]   = useState({ isOpen: false, targetDateKey: null, targetDate: null })
  const [activeSwapTab, setActiveSwapTab]     = useState('brand') // 'brand' | 'festivals' | 'custom'
  const [selectedSwapTopicId, setSelectedSwapTopicId] = useState(null)
  const [selectedSwapFestival, setSelectedSwapFestival] = useState(null)
  const [customSwapText, setCustomSwapText]   = useState('')

  // R1 Auto-scroll Ref mapping
  const sidebarItemRefs = useRef({})

  const [portalTarget, setPortalTarget] = useState(null)
  useEffect(() => {
    setPortalTarget(document.getElementById('topbar-center-slot'))
  }, [])



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

  const { data: creativeData, isLoading: isCreativeLoading } = useQuery({
    queryKey: ['creative-calendar', month],
    queryFn: () => creativeApi.calendar({ month }).then(r => r.data.data),
  })

  const { data: socialData, isLoading: isSocialLoading } = useQuery({
    queryKey: ['social-calendar', month],
    queryFn: () => socialApi.getCalendarPosts(month).then(r => r.data.data),
  })

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
          ? `${reviewCount} selection${reviewCount === 1 ? '' : 's'} need Mint More approval.`
          : 'Your selected creatives have been queued with Mint More.',
      })
      setPendingIds([])
      queryClient.invalidateQueries({ queryKey: ['creative-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['social-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['creative-work'] })
      queryClient.invalidateQueries({ queryKey: ['mint-credits'] })
    },
    onError: err => pushToast({ title: 'Could not confirm selections', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const isLoading = isCreativeLoading || isSocialLoading
  const creativeEvents = creativeData?.events || []

  const { year, monthNum } = parseMonth(month)

  const navigateMonth = (dir) => {
    const d = new Date(year, monthNum + dir, 1)
    setMonth(monthKey(d))
    setActiveDateKey('')
    setPanelOpen(false)
  }

  // ── R3 Decoupled Base Grid & Indexed Data Maps ──────────────────────────────
  // 1. Synchronous Base Grid Cells (Frame 0 render, 0ms execution)
  const baseGridCells = useMemo(() => {
    const first = new Date(year, monthNum, 1)
    const days  = new Date(year, monthNum + 1, 0).getDate()
    const leading = first.getDay()

    const cells = []
    for (let i = 0; i < leading; i++) {
      cells.push({ key: `blank-${i}`, blank: true })
    }
    for (let i = 1; i <= days; i++) {
      const date = new Date(year, monthNum, i)
      const dateKey = toLocalDateKey(date)
      cells.push({
        key: dateKey,
        dateKey,
        date,
        blank: false,
      })
    }
    return cells
  }, [year, monthNum])

  // 2. Asynchronous Data Indexing Maps
  const postsByDateKey = useMemo(() => {
    const map = {}
    ;(socialData?.posts || []).forEach(post => {
      const ts = post.publish_at || post.published_at || post.created_at
      if (ts) {
        const key = toLocalDateKey(ts)
        if (!map[key]) map[key] = []
        
        const titleText = post.caption || post.title || 'Untitled Post'
        const existing = map[key].find(p => (p.caption || p.title || 'Untitled Post') === titleText)
        
        if (existing) {
          // Merge platforms if it's the same post
          if (post.platform) {
            existing.platforms = existing.platforms || (existing.platform ? [existing.platform] : ['instagram'])
            if (!existing.platforms.includes(post.platform)) {
              existing.platforms.push(post.platform)
            }
          }
        } else {
          if (post.platform && !post.platforms) {
            post.platforms = [post.platform]
          }
          map[key].push(post)
        }
      }
    })
    return map
  }, [socialData])

  const eventsByDateKey = useMemo(() => {
    const map = {}
    ;(creativeData?.events || []).forEach(event => {
      if (event.event_date) {
        const key = toLocalDateKey(event.event_date)
        if (!map[key]) map[key] = []
        
        const existing = map[key].find(e => e.title === event.title)
        if (!existing) {
          map[key].push(event)
        }
      }
    })
    return map
  }, [creativeData])

  const unusedBrandTopics = useMemo(() => {
    return (socialData?.posts || []).filter(p => !p.publish_at && !p.published_at && p.status === 'draft')
  }, [socialData])

  // R1 All scheduled items for interactive sidebar
  const allScheduledItems = useMemo(() => {
    const items = []
    baseGridCells.forEach(cell => {
      if (cell.blank) return
      const cellPosts  = postsByDateKey[cell.dateKey] || []
      const cellEvents = eventsByDateKey[cell.dateKey] || []

      cellPosts.forEach(post => {
        if (matchesFormatFilter(post, formatFilter)) {
          items.push({
            id: post.id,
            dateKey: cell.dateKey,
            date: cell.date,
            title: post.caption || post.title || 'Untitled Post',
            format: getPostFormat(post),
            type: 'post',
            raw: post,
          })
        }
      })

      cellEvents.forEach(event => {
        if (matchesFormatFilter(event, formatFilter)) {
          items.push({
            id: event.id,
            dateKey: cell.dateKey,
            date: cell.date,
            title: event.title,
            format: getPostFormat(event),
            type: 'event',
            raw: event,
          })
        }
      })
    })

    // Deduplicate by title + date to prevent repeated items (even if IDs differ)
    const seen = new Set()
    return items.filter(item => {
      const dedupKey = `${item.dateKey}_${item.title}`
      if (seen.has(dedupKey)) return false
      seen.add(dedupKey)
      return true
    })
  }, [baseGridCells, postsByDateKey, eventsByDateKey, formatFilter])

  const todayKey    = toLocalDateKey(new Date())

  useEffect(() => {
    if (!hoveredDateKey) {
      setExpandedTopicId(null)
      return
    }
    const matchingItem = allScheduledItems.find(item => item.dateKey === hoveredDateKey)
    if (matchingItem) {
      setExpandedTopicId(matchingItem.id)
      const refKey = matchingItem.id ? `${matchingItem.dateKey}_${matchingItem.id}` : matchingItem.dateKey
      const el = sidebarItemRefs.current[refKey]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setExpandedTopicId(null)
    }
  }, [hoveredDateKey, allScheduledItems])
  const activeCell  = useMemo(() => {
    if (!activeDateKey) return null
    return baseGridCells.find(c => !c.blank && c.dateKey === activeDateKey) || null
  }, [activeDateKey, baseGridCells])

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

  // R2 Swap Modal triggers
  const openSwapModal = useCallback((dateKey, date) => {
    if (isPastDay(date)) {
      pushToast({ title: 'Choose today or later', body: 'Topic swap can only be performed for today or future dates.', tone: 'amber' })
      return
    }
    setSwapModalState({ isOpen: true, targetDateKey: dateKey, targetDate: date })
    setActiveSwapTab('brand')
    setSelectedSwapTopicId(null)
    setSelectedSwapFestival(null)
    setCustomSwapText('')
  }, [pushToast])

  const closeSwapModal = useCallback(() => {
    setSwapModalState({ isOpen: false, targetDateKey: null, targetDate: null })
  }, [])

  const swapMutation = useMutation({
    mutationFn: async ({ type, id, targetDateKey }) => {
      // 1. Find all posts on the targetDateKey and delete them
      const postsToDelete = (socialData?.posts || []).filter(p => {
        const ts = p.publish_at || p.published_at || p.created_at
        return ts && toLocalDateKey(ts) === targetDateKey
      })

      // Since we just have the dateKey, we delete all scheduled posts for that day
      for (const p of postsToDelete) {
        await socialApi.deletePost(p.id)
      }

      // 2. Schedule the new topic
      if (type === 'brand') {
        // Schedule brand topic for the exact targetDateKey
        await socialApi.updatePost(id, {
          publish_at: `${targetDateKey}T10:00:00Z`, // Default time, or ideally keep original time if we had it
          status: 'scheduled'
        })
      } else if (type === 'festival') {
        // Schedule admin festival (which falls on its own actual date)
        await creativeApi.selectEvent(id)
      }
    },
    onSuccess: (_, { type, targetDateKey }) => {
      pushToast({
        title: 'Topic Swapped',
        body: type === 'brand' 
          ? `Swapped brand topic onto ${targetDateKey}.`
          : `Swapped festival (shifted to its actual date).`,
        tone: 'mint'
      })
      queryClient.invalidateQueries({ queryKey: ['creative-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['social-calendar'] })
      closeSwapModal()
    },
    onError: (err) => {
      pushToast({ title: 'Swap failed', body: err.response?.data?.message || 'Try again', tone: 'amber' })
    }
  })

  const handleConfirmSwap = useCallback(() => {
    if (activeSwapTab === 'custom') {
      if (customSwapText.trim()) {
        openRequest(swapModalState.targetDate)
        pushToast({ title: 'Custom Request Initiated', body: `Created custom request for ${swapModalState.targetDateKey}.`, tone: 'mint' })
        closeSwapModal()
      } else {
        pushToast({ title: 'Input required', body: 'Please describe the custom request prompt.', tone: 'amber' })
        return
      }
    } else if (activeSwapTab === 'brand') {
      if (!selectedSwapTopicId) {
        pushToast({ title: 'Selection required', body: 'Please select an unused brand topic to swap.', tone: 'amber' })
        return
      }
      swapMutation.mutate({ type: 'brand', id: selectedSwapTopicId, targetDateKey: swapModalState.targetDateKey })
    } else if (activeSwapTab === 'festivals') {
      if (!selectedSwapFestival) {
        pushToast({ title: 'Selection required', body: 'Please select a festival to swap.', tone: 'amber' })
        return
      }
      swapMutation.mutate({ type: 'festival', id: selectedSwapFestival, targetDateKey: swapModalState.targetDateKey })
    }
  }, [activeSwapTab, customSwapText, selectedSwapTopicId, selectedSwapFestival, swapModalState, openRequest, swapMutation, pushToast, closeSwapModal])

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
    <div className="absolute inset-0 flex flex-col lg:flex-row overflow-hidden bg-transparent">      {portalTarget && createPortal(
        <>
          <div className="flex flex-col min-w-0 pr-4">
            <h1 className="text-sm font-bold text-ink-950 tracking-tight truncate max-w-[200px] md:max-w-none pb-1 pt-1">
              Plan & Manage Monthly Content
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-auto">
            {/* Month Navigator */}
            <div className="flex items-center bg-paper-tint p-1 rounded-xl border border-hairline">
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-paper text-ink-600 hover:text-ink-900 transition-colors"
                onClick={() => navigateMonth(-1)}
                aria-label="Previous month"
              >
                <Icon name="chevronLeft" size={14} />
              </button>
              <span className="text-[11px] font-bold text-ink-900 px-1 min-w-[70px] md:min-w-[90px] text-center">
                {MONTHS[monthNum]} {year}
              </span>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-paper text-ink-600 hover:text-ink-900 transition-colors"
                onClick={() => navigateMonth(1)}
                aria-label="Next month"
              >
                <Icon name="chevronRight" size={14} />
              </button>
            </div>

            {/* R1 Format Filter Pills */}
            <div className="hidden md:flex items-center gap-0.5 bg-paper-tint p-1 rounded-xl border border-hairline">
              {[
                { id: 'all', label: 'All', icon: 'grid' },
                { id: 'reel', label: 'Reels', icon: 'video' },
                { id: 'carousel', label: 'Carousels', icon: 'image' },
                { id: 'post', label: 'Posts', icon: 'file' },
              ].map(pill => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFormatFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                    formatFilter === pill.id
                      ? 'bg-ink-950 text-white shadow-sm'
                      : 'text-ink-600 hover:text-ink-900 hover:bg-paper'
                  }`}
                >
                  <Icon name={pill.icon} size={12} className={formatFilter === pill.id ? "text-white" : "text-ink-400"} />
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </>,
        portalTarget
      )}

      {/* R4 LEGACY: Legacy Header & Toolbar Commented Out
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
                  {allScheduledItems.length} post{allScheduledItems.length !== 1 ? 's' : ''} this month
                </span>
              )}
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
      */}

      {/* Left Column: Calendar Grid */}
      <div className="flex flex-col flex-1 border-r border-hairline overflow-y-auto min-h-0 bg-paper">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-hairline bg-paper-tint sticky top-0 z-10">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="py-2.5 px-2 text-center text-[10px] font-bold text-ink-400 uppercase tracking-wider border-r last:border-r-0 border-hairline"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr flex-1 bg-white">
            {baseGridCells.map((cell) => {
              if (cell.blank) {
                return (
                  <div
                    key={cell.key}
                    className="min-h-[110px] p-2 border-b border-r border-hairline bg-ink-50/20 opacity-30 pointer-events-none"
                  />
                )
              }

              const isToday     = sameDay(cell.date, new Date())
              const isPast      = isPastDay(cell.date)
              const isHovered   = hoveredDateKey === cell.dateKey
              const isSelected  = activeDateKey === cell.dateKey

              const cellPosts   = (postsByDateKey[cell.dateKey] || []).filter(p => matchesFormatFilter(p, formatFilter))
              const cellEvents  = (eventsByDateKey[cell.dateKey] || []).filter(e => matchesFormatFilter(e, formatFilter))
              const hasPosts    = cellPosts.length > 0
              const hasEvents   = cellEvents.length > 0

              return (
                <div
                  key={cell.key}
                  onMouseEnter={() => setHoveredDateKey(cell.dateKey)}
                  onMouseLeave={() => setHoveredDateKey(null)}
                  onClick={() => openSwapModal(cell.dateKey, cell.date)}
                  className={`min-h-[110px] p-2 border-b border-r border-hairline flex flex-col transition-all cursor-pointer relative ${
                    isPast ? 'bg-ink-50/40 opacity-60' : 'bg-white'
                  } ${isToday ? 'bg-mint-50/20' : ''} ${
                    isHovered ? 'ring-2 ring-mint-500 ring-inset z-10 bg-mint-50/10' : ''
                  } ${isSelected ? 'ring-2 ring-ink-950 ring-inset z-10' : ''}`}
                >
                  {/* Cell Top Header Row - Always Rendered Synchronously (Frame 0) */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? 'bg-mint-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]'
                          : 'text-ink-600'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {/* R2 Action Button Dropdown Menu inside Day Cell */}
                    {!isPast && (
                      <div className="relative" ref={openDayMenuKey === cell.key ? menuRef : null}>
                        <button
                          type="button"
                          className="w-5 h-5 rounded-md border border-hairline bg-white text-ink-500 hover:text-ink-950 hover:bg-paper-tint flex items-center justify-center transition-colors"
                          aria-label="Add options for this day"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDayMenuKey(prev => prev === cell.key ? '' : cell.key)
                          }}
                        >
                          <Icon name="plus" size={11} />
                        </button>
                        {openDayMenuKey === cell.key && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 p-1 rounded-xl bg-white border border-hairline shadow-xl z-30 flex flex-col gap-0.5 animate-fade-in"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-800 hover:bg-paper-tint flex items-center gap-2 text-left transition-colors"
                              onClick={() => {
                                setOpenDayMenuKey('')
                                openCompose(cell.date)
                              }}
                            >
                              <Icon name="send" size={13} className="text-mint-600" />
                              <span>Schedule post</span>
                            </button>
                            <button
                              type="button"
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-800 hover:bg-paper-tint flex items-center gap-2 text-left transition-colors"
                              onClick={() => {
                                setOpenDayMenuKey('')
                                openRequest(cell.date)
                              }}
                            >
                              <Icon name="sparkles" size={13} className="text-orange-500" />
                              <span>Custom request</span>
                            </button>
                            <button
                              type="button"
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-800 hover:bg-paper-tint flex items-center gap-2 text-left transition-colors"
                              onClick={() => {
                                setOpenDayMenuKey('')
                                openSwapModal(cell.dateKey, cell.date)
                              }}
                            >
                              <Icon name="refresh" size={13} className="text-blue-500" />
                              <span>Swap topic</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* R3 Inline Skeleton Hydration / Content Slot */}
                  {isLoading ? (
                    <div className="cal-cell-skeleton-wrap mt-2 space-y-1.5">
                      <div className="cal-inline-skeleton-bar w-[85%] h-3 rounded bg-hairline-strong animate-pulse" />
                      <div className="cal-inline-skeleton-bar w-[60%] h-3 rounded bg-hairline-strong animate-pulse" />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-1 mt-1 overflow-hidden">
                      {/* Creative Moments */}
                      {hasEvents && (
                        <div className="flex flex-col gap-1">
                          {cellEvents.map(event => (
                              <button
                                key={event.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openSwapModal(cell.dateKey, cell.date)
                                }}
                                className="text-left p-1 rounded border text-[10px] font-bold truncate transition-all bg-paper-tint border-hairline text-ink-800 hover:border-mint-400"
                              >
                                {event.title}
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {/* Platform summary bar */}
                      {hasPosts && <PlatformBar posts={cellPosts} />}

                      {/* Post Chips */}
                      {hasPosts && (
                        <div className="flex flex-col gap-1 mt-auto">
                          {cellPosts.slice(0, 2).map(post => (
                            <PostChip
                              key={post.id}
                              post={post}
                              onClick={(e) => {
                                e.stopPropagation()
                                openCell(cell)
                              }}
                            />
                          ))}
                          {cellPosts.length > 2 && (
                            <span className="text-[9px] font-bold text-ink-400 text-right">
                              +{cellPosts.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      {/* Right Column: Interactive Dual-Mode Sidebar */}
      <div className="bg-paper-tint flex flex-col overflow-hidden shrink-0 w-full lg:w-[360px] lg:m-4 lg:rounded-2xl lg:border lg:border-hairline lg:shadow-sm">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-hairline bg-paper flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-950 flex items-center gap-1.5">
                <Icon name="sparkles" size={13} className="text-mint-500" />
                {hoveredDateKey ? `Focused: ${hoveredDateKey}` : 'Scheduled Topics'}
              </h3>
              <p className="text-[11px] text-ink-500 mt-0.5">
                {allScheduledItems.length} topic{allScheduledItems.length !== 1 ? 's' : ''} planned
              </p>
            </div>
            {hoveredDateKey && (
              <button
                type="button"
                onClick={() => setHoveredDateKey(null)}
                className="text-[10px] font-semibold text-ink-400 hover:text-ink-800"
              >
                Clear Focus
              </button>
            )}
          </div>

          {/* Scrollable Topics List */}
          <div className="flex-1 overflow-y-auto">
            {allScheduledItems.length === 0 ? (
              <div className="p-8 text-center text-ink-400 flex flex-col items-center justify-center">
                <Icon name="calendar" size={28} className="mb-2 text-ink-300" />
                <p className="text-xs font-bold text-ink-500">No scheduled topics matching filter.</p>
              </div>
            ) : (
              <div className="w-full flex flex-col divide-y divide-hairline">
                {allScheduledItems.map((item) => {
                  const isExpanded    = expandedTopicId === item.id
                  const isHighlighted = hoveredDateKey === item.dateKey

                  return (
                    <div
                      key={`${item.id}-${item.dateKey}`}
                      /* R1: DOM Ref assignment for smooth auto-scroll */
                      ref={(el) => {
                        const refKey = item.id ? `${item.dateKey}_${item.id}` : item.dateKey
                        if (el) {
                          sidebarItemRefs.current[refKey] = el
                        } else {
                          delete sidebarItemRefs.current[refKey]
                        }
                      }}
                      className={`px-4 py-3.5 transition-all cursor-pointer group ${
                        isHighlighted
                          ? 'bg-mint-50 shadow-[inset_4px_0_0_0_#0f766e]'
                          : 'bg-white hover:bg-ink-50/50'
                      }`}
                      onClick={() => setExpandedTopicId(isExpanded ? null : item.id)}
                    >
                      {/* Topic Grid Summary Row */}
                      <div className="w-full grid grid-cols-[70px_1fr_auto_20px] items-center gap-3">
                        {/* 1. Date Column */}
                        <div className="text-[10px] font-bold text-ink-500 tabular-nums uppercase tracking-wide">
                          {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>

                        {/* 2. Title Column */}
                        <div className={`text-xs font-bold truncate transition-colors ${isHighlighted ? 'text-mint-900' : 'text-ink-950 group-hover:text-ink-900'}`}>
                          {item.title}
                        </div>

                        {/* 3. Format Badge */}
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
                            item.format === 'reel'
                              ? 'bg-pink-500 text-white'
                              : item.format === 'carousel'
                              ? 'bg-blue-500 text-white'
                              : 'bg-mint-600 text-white'
                          }`}
                        >
                          {item.format}
                        </span>

                        {/* 4. Chevron Icon */}
                        <div className="text-ink-400 flex items-center justify-end">
                          <Icon
                            name="chevronDown"
                            size={14}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-ink-800' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Accordion Expanded Details View */}
                      {isExpanded && (
                        <div
                          className="mt-3 pt-3 border-t border-hairline text-left space-y-2 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-xs text-ink-700 leading-relaxed font-normal">
                            {item.raw?.caption || item.raw?.description || item.title}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              {(item.raw?.platforms || ['instagram']).map(p => (
                                <PlatformDot key={p} platform={p} size={12} />
                              ))}
                            </div>
                            <span className="text-[10px] font-semibold text-ink-500">
                              {item.raw?.publish_at ? fmt12(item.raw.publish_at) : 'Scheduled'}
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => openSwapModal(item.dateKey, item.date)}
                              className="px-2.5 py-1 rounded-lg bg-paper-tint border border-hairline text-[11px] font-semibold text-ink-700 hover:bg-paper hover:text-ink-950 flex items-center gap-1 transition-colors"
                            >
                              <Icon name="refresh" size={12} className="text-blue-500" />
                              Swap Topic
                            </button>
                            {item.type === 'post' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item.raw)}
                                  className="px-2.5 py-1 rounded-lg bg-paper-tint border border-hairline text-[11px] font-semibold text-ink-700 hover:bg-paper hover:text-ink-950 flex items-center gap-1 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.raw)}
                                  className="px-2.5 py-1 rounded-lg border border-red-200 text-[11px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      {/* R4 LEGACY: Legacy Boxed Shell & Grid Commented Out
      <div className={`cal-shell${panelOpen && activeCell ? ' panel-open' : ''}`}>
        <div className="cal-grid-wrap">
          <div className="cal-weekdays">
            {WEEKDAYS.map(d => <div key={d} className="cal-weekday-label">{d}</div>)}
          </div>

          {isLoading ? (
            <div className="cal-month-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="cal-skeleton-cell" style={{ animationDelay: `${i * 18}ms` }} />
              ))}
            </div>
          ) : (
            <div className="cal-month-grid">
              {baseGridCells.map(cell => {
                const isToday  = !cell.blank && sameDay(cell.date, new Date())
                const isActive = !cell.blank && cell.dateKey === activeCell?.dateKey
                const isPast   = !cell.blank && isPastDay(cell.date)
                const cellPosts = (postsByDateKey[cell.dateKey] || []).filter(p => matchesFormatFilter(p, formatFilter))
                const cellEvents = eventsByDateKey[cell.dateKey] || []
                const hasPosts = !cell.blank && cellPosts.length > 0

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
                        <div className="cal-day-header">
                          <span className={`cal-day-num${isToday ? ' today' : ''}`}>
                            {cell.date.getDate()}
                          </span>
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

                        {cellEvents && cellEvents.length > 0 && (
                          <div className="stack" style={{ gap: 4, marginTop: 4, marginBottom: 4 }}>
                            {cellEvents.map(event => {
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

                        {hasPosts && <PlatformBar posts={cellPosts} />}

                        {hasPosts && (
                          <div className="cal-event-stack">
                            {cellPosts.slice(0, 3).map(post => (
                              <PostChip
                                key={post.id}
                                post={post}
                                onClick={e => { e.stopPropagation(); openCell(cell) }}
                              />
                            ))}
                            {cellPosts.length > 3 && (
                              <span className="cal-overflow-badge">+{cellPosts.length - 3} more</span>
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
      </div>
      */}

      {/* R4 LEGACY: Legacy DayPanel Invocation Commented Out
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
      */}

      {/* Selection Summary Strip Removed */}

      {/* ── R2 Swap Topic Modal Component ────────────────────────────────── */}
      {swapModalState.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
          onClick={closeSwapModal}
        >
          <div
            className="bg-white rounded-2xl border border-hairline shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-ink-950"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-hairline flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-ink-950 flex items-center gap-2">
                  <Icon name="refresh" size={16} className="text-orange-500" />
                  Swap Scheduled Topic
                </h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  Target date: <strong className="text-ink-950">{swapModalState.targetDateKey}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeSwapModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-paper-tint text-ink-400 hover:text-ink-800 transition-colors"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-hairline px-4 bg-paper-tint">
              {[
                { id: 'brand', label: 'Brand Topics' },
                { id: 'festivals', label: 'Festivals' },
                { id: 'custom', label: 'Custom Request' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSwapTab(tab.id)}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                    activeSwapTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-ink-500 hover:text-ink-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
              {activeSwapTab === 'brand' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">Select an alternative brand topic from your generated content to swap into this slot.</p>
                  {unusedBrandTopics.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-hairline rounded-xl bg-paper-tint text-xs text-ink-500">
                      No unused brand topics available. Switch to Custom Request to specify a new prompt.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unusedBrandTopics.map(event => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedSwapTopicId(event.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedSwapTopicId === event.id
                              ? 'bg-orange-50 border-orange-500 text-orange-950'
                              : 'bg-white border-hairline hover:border-ink-200 text-ink-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs text-ink-950">{event.title || event.caption || 'Untitled Topic'}</div>
                            <div className="text-[10px] text-ink-500 capitalize mt-0.5">{event.asset_type?.replace(/_/g, ' ') || 'Brand topic'}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedSwapTopicId === event.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline'
                          }`}>
                            {selectedSwapTopicId === event.id && <Icon name="check" size={10} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSwapTab === 'festivals' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">Choose an admin-curated festival to schedule.</p>
                  <div className="space-y-2">
                    {creativeEvents.map(fest => (
                      <div
                        key={fest.id}
                        onClick={() => setSelectedSwapFestival(fest.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          selectedSwapFestival === fest.id
                            ? 'bg-orange-50 border-orange-500 text-orange-950'
                            : 'bg-white border-hairline hover:border-ink-200 text-ink-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-ink-950">{fest.title}</div>
                          <div className="text-[10px] text-orange-500 font-semibold mt-0.5">{fest.tag || 'Admin Festival'}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedSwapFestival === fest.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline'
                        }`}>
                          {selectedSwapFestival === fest.id && <Icon name="check" size={10} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSwapTab === 'custom' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-ink-950 block">
                    What topic or prompt do you want to schedule instead?
                  </label>
                  <textarea
                    value={customSwapText}
                    onChange={e => setCustomSwapText(e.target.value)}
                    placeholder="E.g., Special promo for weekend event..."
                    className="w-full p-3 rounded-xl min-h-[110px] text-xs border border-hairline bg-white focus:border-orange-500 outline-none text-ink-950 placeholder:text-ink-400 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-hairline flex items-center justify-end gap-3 bg-paper-tint">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold text-ink-500 hover:text-ink-950 hover:bg-paper-tint transition-colors"
                onClick={closeSwapModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                onClick={handleConfirmSwap}
              >
                Confirm & Swap Topic
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
