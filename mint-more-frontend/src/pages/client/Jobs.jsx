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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-mint-500 mb-2">Requests</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900 tracking-tight m-0 pb-1">My creatives</h1>
          <p className="text-ink-500 text-sm md:text-base mt-2">
            Calendar picks and custom design requests handled by CREATYV.
          </p>
        </div>
        <button className="bg-ink-950 text-white shadow-md shadow-ink-900/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-ink-900 transition-colors" onClick={() => navigate('/jobs/new')}>
          <Icon name="plus" size={16} /> New custom request
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

      <div className="flex flex-col border border-ink-200 rounded-xl overflow-hidden bg-white shadow-sm">
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
              className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-ink-100 last:border-b-0 hover:bg-ink-50 transition-colors cursor-pointer bg-white"
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
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium bg-ink-100 text-ink-600 px-2 py-0.5 rounded-md">
                    {item.type === 'calendar' ? 'Calendar' : item.type === 'task' ? 'Production' : item.type === 'draft' ? 'Draft' : 'Custom'}
                  </span>
                  {['assigned', 'in_progress', 'delivered', 'revision', 'blocked'].includes(item.status)
                    ? <StatusBadge status={item.status} />
                    : <span className={`text-xs font-medium px-2 py-0.5 rounded-md capitalize ${item.status === 'completed' ? 'bg-sky-50 text-sky-700' : 'bg-ink-100 text-ink-700'}`}>{statusLabel(item.status)}</span>}
                </div>
                
                <div className="flex flex-col min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate group-hover:text-orange-600 transition-colors">{item.title}</div>
                  <div className="text-xs text-ink-500 truncate">{item.description}</div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 flex-shrink-0">
                <div className="flex items-center gap-4 text-xs text-ink-500">
                  <DateBadge value={item.date} />
                  <span className="font-mono font-medium text-ink-700">
                    {item.type === 'draft' ? 'Resume request' : `${Number(item.coin_cost || 0)} MintCoin${Number(item.coin_cost || 0) === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {item.type !== 'draft' && item.job_id && (
                    <button
                      className="text-ink-500 hover:text-ink-900 hover:bg-ink-100 p-1.5 rounded-lg transition-colors"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        navigate(`/messages?job=${item.job_id}`)
                      }}
                      title="Messages"
                    >
                      <Icon name="chat" size={14} />
                    </button>
                  )}
                  {item.type === 'draft' ? (
                    <button
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (window.confirm('Delete this draft request?')) deleteDraft.mutate(item.id)
                      }}
                      title="Delete"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  ) : canCancel ? (
                    <button
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (window.confirm('Cancel this creative? This removes it from your active work and returns reserved MintCoins when applicable.')) cancelCreative.mutate(item)
                      }}
                      title="Cancel"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  ) : (
                    <Icon name="chevronRight" size={16} className="text-ink-400" />
                  )}
                </div>
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
