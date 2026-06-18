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
  })
  const { data: access } = useEntitlements()
  const canRetry = access?.is_super_admin ||
    access?.admin_permissions?.includes('*') ||
    access?.admin_permissions?.includes('operations.manage')
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => commerceApi.audit({
      limit: 100,
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
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">Admin</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Audit records</h1>
        <p className="muted">Immutable records of sensitive platform actions.</p>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) repeat(5, minmax(130px, 1fr)) auto', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Search</span>
            <input
              className="input"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Action, user, entity, metadata"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Entity</span>
            <select className="input" value={filters.entity_type} onChange={e => setFilters(prev => ({ ...prev, entity_type: e.target.value }))}>
              <option value="">All</option>
              <option value="user">User</option>
              <option value="creative_event">Creative event</option>
              <option value="platform_setting">Platform setting</option>
              <option value="wallet">Wallet</option>
              <option value="mint_credit">MintCoin</option>
              <option value="event_outbox">Outbox</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Action</span>
            <input
              className="input"
              value={filters.action}
              onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
              placeholder="creative_event.created"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>From</span>
            <input className="input" type="date" value={filters.date_from} onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>To</span>
            <input className="input" type="date" value={filters.date_to} onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Sort</span>
            <select className="input" value={filters.sort} onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value }))}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <button
            className="btn ghost"
            onClick={() => setFilters({ search: '', entity_type: '', action: '', date_from: '', date_to: '', sort: 'desc' })}
          >
            Clear
          </button>
        </div>
        {pagination && (
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Showing {logs.length} of {pagination.total} audit records
          </div>
        )}
      </div>

      {failedEvents.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline)' }}>
            <div className="h-eyebrow">Failed background events</div>
            <p className="muted" style={{ margin: '5px 0 0', fontSize: 12.5 }}>
              These events exhausted automatic retries and need operator review.
            </p>
          </div>
          {failedEvents.map((event, index) => (
            <div key={event.id} style={{
              padding: '14px 18px',
              borderTop: index ? '1px solid var(--hairline)' : 'none',
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1.4fr) 90px auto',
              gap: 14,
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{event.event_type}</div>
                <div className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>{event.dedupe_key || event.id}</div>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>{event.last_error || 'No error detail recorded'}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{event.attempts} attempts</div>
              {canRetry ? (
                <button
                  className="btn ghost sm"
                  onClick={() => retryMutation.mutate(event.id)}
                  disabled={retryMutation.isPending}
                >
                  <Icon name="refresh" size={12} /> Retry
                </button>
              ) : <span />}
            </div>
          ))}
        </div>
      )}

      {isLoading ? <div className="muted">Loading audit records...</div> : logs.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="shield" size={20} /></div>
          <h3>No audit records yet</h3>
          <p>Sensitive admin and financial actions will appear here.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {logs.map((log, index) => (
            <div key={log.id} style={{
              padding: '16px 18px',
              borderTop: index ? '1px solid var(--hairline)' : 'none',
              display: 'grid',
              gridTemplateColumns: 'minmax(190px, 1fr) minmax(160px, .8fr) minmax(260px, 1.1fr) minmax(190px, .9fr)',
              gap: 14,
              alignItems: 'start',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{humanize(log.action)}</div>
                <div className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>{log.action}</div>
                <div className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>{log.entity_type}: {log.entity_id || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5 }}>{log.actor_name || 'System'}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{log.actor_email || log.actor_role || ''}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5 }}>{summarizeLog(log)}</div>
                {(Object.keys(log.metadata || {}).length > 0) && (
                  <details style={{ marginTop: 5 }}>
                    <summary className="muted" style={{ fontSize: 11.5, cursor: 'pointer' }}>Metadata</summary>
                    <pre className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: 'var(--paper-soft)', border: '1px solid var(--hairline)', borderRadius: 8, padding: 10, margin: '8px 0 0' }}>
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12.5 }}>{formatAuditDate(log.created_at)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{timeAgo(log.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
