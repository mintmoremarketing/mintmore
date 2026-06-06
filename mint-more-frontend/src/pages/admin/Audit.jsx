import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { api } from '../../api/client'
import { timeAgo } from '../../utils/format'
import Icon from '../../components/ui/Icon'
import { useUIStore } from '../../store/ui'
import { useEntitlements } from '../../hooks/useEntitlements'

export default function AdminAudit() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(state => state.pushToast)
  const { data: access } = useEntitlements()
  const canRetry = access?.is_super_admin ||
    access?.admin_permissions?.includes('*') ||
    access?.admin_permissions?.includes('operations.manage')
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => commerceApi.audit({ limit: 100 }).then(res => res.data.data),
    refetchInterval: 30_000,
  })
  const logs = data?.logs || []
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
              padding: '14px 18px',
              borderTop: index ? '1px solid var(--hairline)' : 'none',
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1fr) minmax(150px, .8fr) minmax(160px, .9fr) 100px',
              gap: 14,
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{log.action}</div>
                <div className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>{log.entity_type}: {log.entity_id || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5 }}>{log.actor_name || 'System'}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{log.actor_email || log.actor_role || ''}</div>
              </div>
              <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {Object.keys(log.metadata || {}).length ? JSON.stringify(log.metadata) : 'No additional metadata'}
              </div>
              <div className="muted" style={{ fontSize: 11.5, textAlign: 'right' }}>{timeAgo(log.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
