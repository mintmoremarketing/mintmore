import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { api } from '../../api/client'
import { timeAgo } from '../../utils/format'
import Icon from '../../components/ui/Icon'
import { useUIStore } from '../../store/ui'
import { useEntitlements } from '../../hooks/useEntitlements'

const formatAuditDate = (value) => new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
}).format(new Date(value))

const humanize = (value) => String(value || '')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase())

const summarizeLog = (log) => {
  const metadata = log.metadata || {}
  const after = log.after_state || {}
  const before = log.before_state || {}
  const parts = []
  const title = metadata.title || after.title || before.title || after.full_name || before.full_name
  if (title) parts.push(title)
  if (metadata.event_date || after.event_date || before.event_date) {
    parts.push(new Date(metadata.event_date || after.event_date || before.event_date).toLocaleDateString('en-IN'))
  }
  if (metadata.asset_type || after.asset_type) parts.push(metadata.asset_type || after.asset_type)
  if (metadata.coin_cost || after.coin_cost) parts.push(`${Number(metadata.coin_cost || after.coin_cost)} coin`)
  if (after.deleted) parts.push('Deleted')
  if (after.status && before.status && after.status !== before.status) parts.push(`${before.status} to ${after.status}`)
  return parts.length ? parts.join(' - ') : 'No extra details recorded'
}

export default function AdminAudit() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(state => state.pushToast)
  const [filters, setFilters] = useState({
    search: '',
    entity_type: '',
    action: '',
    date_from: '',
    date_to: '',
    sort: 'desc',
    page: 1,
  })
  
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }
  const { data: access } = useEntitlements()
  const canRetry = access?.is_super_admin ||
    access?.admin_permissions?.includes('*') ||
    access?.admin_permissions?.includes('operations.manage')
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => commerceApi.audit({
      limit: 15,
      page: filters.page,
      sort: filters.sort,
      search: filters.search || undefined,
      entity_type: filters.entity_type || undefined,
      action: filters.action || undefined,
      date_from: filters.date_from ? `${filters.date_from}T00:00:00.000+05:30` : undefined,
      date_to: filters.date_to ? `${filters.date_to}T23:59:59.999+05:30` : undefined,
    }).then(res => res.data.data),
    refetchInterval: 30_000,
  })
  const logs = data?.logs || []
  const pagination = data?.pagination || null
  const { data: outboxData } = useQuery({
    queryKey: ['admin-outbox-failed'],
    queryFn: () => api.get('/admin/operations/outbox', { params: { status: 'failed', limit: 50 } })
      .then(response => response.data.data),
    refetchInterval: 30_000,
  })
  const failedEvents = outboxData?.events || []
  const retryMutation = useMutation({
    mutationFn: eventId => api.post(`/admin/operations/outbox/${eventId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-outbox-failed'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      pushToast({ title: 'Event queued', body: 'The background event will be retried shortly.', icon: 'refresh' })
    },
    onError: error => pushToast({
      title: 'Retry failed',
      body: error.response?.data?.message || 'Please try again.',
      tone: 'amber',
      icon: 'x',
    }),
  })

  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 pt-12 md:p-10 md:pt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Audit records</h1>
          <p className="text-ink-500 font-medium mt-1">Immutable records of sensitive platform actions.</p>
        </div>
        
        {/* Pagination UI */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-ink-500 font-medium">
              Page {filters.page} of {pagination.pages}
            </div>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={filters.page <= 1}
                onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={filters.page >= pagination.pages}
                onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      <div className="bg-white border border-ink-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">Search</span>
            <input
              className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium placeholder:text-ink-400"
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder="Action, user, metadata"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">Entity</span>
            <select 
              className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium appearance-none cursor-pointer" 
              value={filters.entity_type} 
              onChange={e => updateFilter('entity_type', e.target.value)}
            >
              <option value="">All Entities</option>
              <option value="user">User</option>
              <option value="creative_event">Creative event</option>
              <option value="platform_setting">Platform setting</option>
              <option value="wallet">Wallet</option>
              <option value="mint_credit">MintCoin</option>
              <option value="event_outbox">Outbox</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">Action</span>
            <input
              className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium placeholder:text-ink-400"
              value={filters.action}
              onChange={e => updateFilter('action', e.target.value)}
              placeholder="creative_event.created"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">From</span>
            <input 
              className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium" 
              type="date" 
              value={filters.date_from} 
              onChange={e => updateFilter('date_from', e.target.value)} 
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">To</span>
            <input 
              className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium" 
              type="date" 
              value={filters.date_to} 
              onChange={e => updateFilter('date_to', e.target.value)} 
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-col gap-2 flex-1">
              <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">Sort</span>
              <select 
                className="w-full px-4 py-2.5 bg-ink-50/50 border border-ink-200 rounded-xl text-ink-950 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm font-medium appearance-none cursor-pointer" 
                value={filters.sort} 
                onChange={e => updateFilter('sort', e.target.value)}
              >
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
            </label>
            <button
              className="px-4 py-2.5 h-[42px] bg-ink-100 hover:bg-ink-200 text-ink-600 hover:text-ink-900 font-bold rounded-xl transition-all flex items-center justify-center shrink-0"
              onClick={() => setFilters({ search: '', entity_type: '', action: '', date_from: '', date_to: '', sort: 'desc', page: 1 })}
              title="Clear filters"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        
        {pagination && (
          <div className="text-sm font-medium text-ink-500 bg-ink-50/50 px-4 py-2 rounded-lg border border-ink-100 inline-flex items-center self-start">
            Showing <strong className="text-ink-900 mx-1">{logs.length}</strong> of <strong className="text-ink-900 mx-1">{pagination.total}</strong> records
          </div>
        )}
      </div>

      {failedEvents.length > 0 && (
        <div className="bg-rose-50/50 border border-rose-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-6 md:px-8 border-b border-rose-100 flex flex-col gap-1">
            <h2 className="text-lg font-bold text-rose-900 m-0 flex items-center gap-2">
              <Icon name="alertCircle" size={18} className="text-rose-500" />
              Failed background events
            </h2>
            <p className="text-rose-600/80 font-medium text-sm">
              These events exhausted automatic retries and need operator review.
            </p>
          </div>
          <div className="flex flex-col">
            {failedEvents.map((event, index) => (
              <div key={event.id} className={`p-6 md:px-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${index !== 0 ? 'border-t border-rose-100' : ''} hover:bg-rose-50 transition-colors`}>
                <div className="flex flex-col gap-1 md:w-1/4">
                  <div className="text-sm font-bold text-rose-900">{event.event_type}</div>
                  <div className="font-mono text-xs text-rose-500 bg-rose-100/50 px-2 py-0.5 rounded w-fit">{event.dedupe_key || event.id}</div>
                </div>
                <div className="text-sm font-medium text-rose-700 md:w-2/4 break-words">
                  {event.last_error || 'No error detail recorded'}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-1/4">
                  <div className="text-xs font-bold uppercase tracking-widest text-rose-500">{event.attempts} attempts</div>
                  {canRetry ? (
                    <button
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                      onClick={() => retryMutation.mutate(event.id)}
                      disabled={retryMutation.isPending}
                    >
                      <Icon name="refresh" size={14} /> Retry
                    </button>
                  ) : <span />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
           <div className="h-24 bg-ink-50 rounded-2xl animate-pulse"></div>
           <div className="h-24 bg-ink-50 rounded-2xl animate-pulse"></div>
           <div className="h-24 bg-ink-50 rounded-2xl animate-pulse"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="border border-dashed border-ink-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] bg-white">
          <div className="w-16 h-16 bg-ink-50 text-ink-400 rounded-2xl flex items-center justify-center mb-6">
            <Icon name="shield" size={28} />
          </div>
          <h3 className="text-xl font-bold text-ink-950 mb-2">No audit records</h3>
          <p className="text-ink-500 font-medium">Sensitive admin and financial actions will appear here based on your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-ink-200/60 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
          {logs.map((log, index) => (
            <div key={log.id} className={`p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[2fr_1.5fr_2.5fr_1fr] gap-6 lg:gap-8 items-start ${index !== 0 ? 'border-t border-ink-100' : ''} hover:bg-ink-50/30 transition-colors`}>
              
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-bold text-ink-950">{humanize(log.action)}</div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="font-mono text-xs text-ink-500 bg-ink-100/50 px-2 py-0.5 rounded w-fit">{log.action}</div>
                  <div className="font-mono text-xs text-ink-500 flex items-center gap-1.5">
                    <span className="uppercase tracking-widest text-[9px] font-bold text-ink-400">{log.entity_type}</span>
                    <Icon name="arrowRight" size={10} className="text-ink-300" />
                    <span className="bg-ink-100/50 px-2 py-0.5 rounded">{log.entity_id || '-'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="text-xs font-bold uppercase tracking-widest text-ink-400 mb-1">Actor</div>
                <div className="text-sm font-bold text-ink-900">{log.actor_name || 'System'}</div>
                {log.actor_email || log.actor_role ? (
                  <div className="text-xs font-medium text-ink-500">{log.actor_email || log.actor_role}</div>
                ) : null}
              </div>
              
              <div className="flex flex-col gap-2 min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-ink-400 mb-1">Details</div>
                <div className="text-sm font-medium text-ink-800 bg-ink-50/80 p-3 rounded-xl border border-ink-100 leading-relaxed">
                  {summarizeLog(log)}
                </div>
                {(Object.keys(log.metadata || {}).length > 0) && (
                  <details className="mt-2 group">
                    <summary className="text-xs font-bold uppercase tracking-widest text-ink-500 cursor-pointer hover:text-ink-900 flex items-center gap-1.5 select-none transition-colors">
                      <Icon name="chevronDown" size={12} className="group-open:rotate-180 transition-transform" />
                      View Metadata
                    </summary>
                    <pre className="font-mono text-[10px] sm:text-xs text-ink-700 bg-ink-50 border border-ink-200/60 p-4 rounded-xl mt-3 overflow-x-auto shadow-sm leading-relaxed">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              
              <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-center lg:items-end gap-1 lg:text-right mt-2 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-ink-100">
                <div className="text-sm font-bold text-ink-900 whitespace-nowrap">{formatAuditDate(log.created_at)}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-ink-400 whitespace-nowrap">{timeAgo(log.created_at)}</div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
