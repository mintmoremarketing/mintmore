import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creativeApi } from '../../api/creative'
import { jobsApi } from '../../api/jobs'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import { SkeletonCard } from '../../components/ui/Skeleton'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusAccent, statusLabel } from '../../components/ui/statusMeta'
import { useUIStore } from '../../store/ui'

const badgeTone = (status = '') => {
  if (status === 'delivered') return 'mint'
  if (status === 'completed') return 'sky'
  if (['pending_review', 'pending_ops_review', 'approved'].includes(status)) return 'amber'
  return 'neutral'
}

const CLIENT_CANCELLABLE_STATUSES = ['draft', 'pending', 'assigned', 'blocked', 'approved', 'pending_review', 'pending_ops_review']

export default function Jobs() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [tab, setTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['creative-work'],
    queryFn: () => creativeApi.work().then((r) => r.data.data),
  })
  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'drafts-for-requests'],
    queryFn: () => jobsApi.list().then((r) => r.data.data.jobs || []),
  })
  const deleteDraft = useMutation({
    mutationFn: (id) => jobsApi.deleteDraft(id),
    onSuccess: () => {
      pushToast({ title: 'Draft deleted', icon: 'trash' })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (error) => {
      pushToast({
        title: 'Could not delete draft',
        body: error?.response?.data?.message || 'Please try again.',
        tone: 'danger',
      })
    },
  })
  const cancelCreative = useMutation({
    mutationFn: (item) => {
      if (item.type === 'custom') return creativeApi.cancelRequest(item.id)
      if (item.type === 'calendar') return creativeApi.cancelSelection(item.id)
      if (item.source_type === 'custom_request') return creativeApi.cancelRequest(item.source_id)
      if (item.source_type === 'calendar_event') return creativeApi.cancelSelection(item.source_id)
      throw new Error('This creative cannot be cancelled from here.')
    },
    onSuccess: () => {
      pushToast({ title: 'Creative cancelled', body: 'Any reserved MintCoins were returned when applicable.', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['creative-work'] })
      queryClient.invalidateQueries({ queryKey: ['creative-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['mintbox'] })
    },
    onError: (error) => {
      pushToast({
        title: 'Could not cancel creative',
        body: error?.response?.data?.message || error?.message || 'Please contact support if production has already started.',
        tone: 'danger',
      })
    },
  })

  const items = useMemo(() => {
    const rawTasks = data?.tasks || []
    const taskSourceIds = new Set(rawTasks.map(task => `${task.source_type}-${task.source_id}`))
    const drafts = (jobsData || [])
      .filter(job => job.status === 'draft')
      .map(job => ({
        id: job.id,
        type: 'draft',
        title: job.title || 'Untitled request',
        description: job.description === 'Brief in progress'
          ? 'Continue answering a few quick questions to finish this request.'
          : job.description || 'Draft request in progress.',
        status: 'draft',
        date: job.updated_at || job.created_at,
        coin_cost: null,
        job_id: job.id,
      }))
    const tasks = rawTasks.map(task => ({
      id: task.id,
      type: 'task',
      source_type: task.source_type,
      source_id: task.source_id,
      job_id: task.job_id,
      title: task.title,
      description: task.client_status || task.description || 'CREATYV production task.',
      status: task.status,
      date: task.due_date || task.created_at,
      coin_cost: task.coin_cost,
    }))
    const requests = (data?.requests || [])
      .filter(request => !taskSourceIds.has(`custom_request-${request.id}`))
      .map(request => ({
        id: request.id,
        type: 'custom',
        title: request.title,
        description: request.description || 'Custom request sent to CREATYV.',
        status: request.status,
        date: request.created_at,
        coin_cost: request.coin_cost,
        job_id: request.job_id,
      }))
    const selections = (data?.selections || [])
      .filter(selection => !selection.task_id && !taskSourceIds.has(`calendar_event-${selection.id}`))
      .map(selection => ({
        id: selection.id,
        type: 'calendar',
        title: selection.title,
        description: selection.client_status || 'Calendar creative selected.',
        status: selection.task_status || selection.status,
        date: selection.event_date || selection.created_at,
        coin_cost: selection.coin_cost,
        job_id: selection.job_id,
      }))
    const seen = new Set()
    return [...drafts, ...tasks, ...requests, ...selections]
      .filter(item => {
        const key = `${item.type}-${item.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [data, jobsData])

  const filtered = items.filter(item => {
    if (tab === 'all') return true
    if (tab === 'draft') return item.status === 'draft'
    if (tab === 'active') return ['pending', 'assigned', 'in_progress', 'revision', 'approved', 'pending_ops_review', 'pending_review'].includes(item.status)
    return item.status === tab
  })

  const counts = {
    all: items.length,
    draft: items.filter(item => item.status === 'draft').length,
    active: items.filter(item => ['pending', 'assigned', 'in_progress', 'revision', 'approved', 'pending_ops_review', 'pending_review'].includes(item.status)).length,
    delivered: items.filter(item => item.status === 'delivered').length,
    completed: items.filter(item => item.status === 'completed').length,
  }

  return (
    <div className="stack-6">
      <div className="row between reveal">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Requests</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>My creatives</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Calendar picks and custom design requests handled by CREATYV.
          </p>
        </div>
        <button className="btn primary" onClick={() => navigate('/jobs/new')}>
          <Icon name="plus" /> New custom request
        </button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'draft', label: 'Drafts', count: counts.draft },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'delivered', label: 'Delivered', count: counts.delivered },
          { value: 'completed', label: 'Completed', count: counts.completed },
        ]}
      />

      <div className="stack" style={{ gap: 10 }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph"><Icon name="briefcase" size={22} /></div>
            <h3>No requests yet</h3>
            <p>Choose from the calendar or send a custom design request to CREATYV.</p>
            <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
              <button className="btn primary" onClick={() => navigate('/calendar')}>
                <Icon name="calendar" /> Open calendar
              </button>
              <button className="btn ghost" onClick={() => navigate('/jobs/new')}>
                <Icon name="plus" /> Custom request
              </button>
            </div>
          </div>
        ) : (
          filtered.map((item) => (
            (() => {
              const canCancel = item.type !== 'draft' && CLIENT_CANCELLABLE_STATUSES.includes(item.status) && (
                item.type === 'custom' ||
                item.type === 'calendar' ||
                ['custom_request', 'calendar_event'].includes(item.source_type)
              )
              const targetPath = item.type === 'draft'
                ? `/jobs/${item.id}/edit`
                : item.job_id ? `/mintbox/jobs/${item.job_id}` : '/mintbox'
              return (
            <div
              key={`${item.type}-${item.id}`}
              className="job-card task-card-shell"
              style={{ padding: 16, '--task-status-color': statusAccent(item.status) }}
              role="button"
              tabIndex={0}
              onClick={() => navigate(targetPath)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(targetPath)
                }
              }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 10 }}>
                  <span className="badge neutral">{item.type === 'calendar' ? 'Calendar' : item.type === 'task' ? 'Production' : item.type === 'draft' ? 'Draft' : 'Custom'}</span>
                  {['assigned', 'in_progress', 'delivered', 'revision', 'blocked'].includes(item.status)
                    ? <StatusBadge status={item.status} />
                    : <span className={`badge ${badgeTone(item.status)}`}>{statusLabel(item.status)}</span>}
                </div>
                {item.type !== 'draft' && item.job_id && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="btn ghost sm"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(`/messages?job=${item.job_id}`)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        navigate(`/messages?job=${item.job_id}`)
                      }
                    }}
                  >
                    <Icon name="chat" size={12} /> Messages
                  </span>
                )}
                {item.type === 'draft' ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="btn ghost sm"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (window.confirm('Delete this draft request?')) deleteDraft.mutate(item.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        if (window.confirm('Delete this draft request?')) deleteDraft.mutate(item.id)
                      }
                    }}
                  >
                    <Icon name="trash" size={12} /> Delete
                  </span>
                ) : canCancel ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="btn ghost sm"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (window.confirm('Cancel this creative? This removes it from your active work and returns reserved MintCoins when applicable.')) cancelCreative.mutate(item)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        if (window.confirm('Cancel this creative?')) cancelCreative.mutate(item)
                      }
                    }}
                  >
                    <Icon name="trash" size={12} /> Cancel
                  </span>
                ) : (
                  <Icon name="chevronRight" size={14} className="muted" />
                )}
              </div>
              <div className="title" style={{ marginTop: 8 }}>{item.title}</div>
              <div className="description">{item.description}</div>
              <div className="row" style={{ marginTop: 12, gap: 18, fontSize: 11.5, color: 'var(--ink-500)' }}>
                <DateBadge value={item.date} />
                <span className="mono" style={{ color: 'var(--ink-900)', fontWeight: 500 }}>
                  {item.type === 'draft' ? 'Resume request' : `${Number(item.coin_cost || 0)} MintCoin${Number(item.coin_cost || 0) === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>
              )
            })()
          ))
        )}
      </div>
    </div>
  )
}
