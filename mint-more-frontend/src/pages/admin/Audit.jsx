import { useQuery } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { timeAgo } from '../../utils/format'
import Icon from '../../components/ui/Icon'

export default function AdminAudit() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => commerceApi.audit({ limit: 100 }).then(res => res.data.data),
    refetchInterval: 30_000,
  })
  const logs = data?.logs || []

  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">Admin</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Audit records</h1>
        <p className="muted">Immutable records of sensitive platform actions.</p>
      </div>

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
