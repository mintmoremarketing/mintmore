import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { negotiationsApi } from '../../api/negotiations'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const normalizeDeal = (deal) => ({
  key: deal.negotiation_id || deal.id || deal.job_id,
  title: deal.job?.title || deal.title || 'Job',
  category: deal.job?.category?.name || deal.category_name || 'Category',
  updatedAt: deal.updated_at || deal.negotiation_started || deal.created_at,
  clientName: deal.client?.full_name || deal.client_name || 'Client',
  clientEmail: deal.client?.email || deal.client_email || '',
  freelancerName: deal.freelancer?.full_name || deal.freelancer_name || 'Freelancer',
  freelancerLevel: deal.freelancer?.freelancer_level || deal.freelancer_level || 'freelancer',
  budget: deal.job?.budget_amount ?? deal.budget_amount,
})

export default function AdminNegotiations() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [notes, setNotes] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['pending-deals'],
    queryFn: () => negotiationsApi.pendingApprovals().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ jobId, note }) => negotiationsApi.approveDeal(jobId, note),
    onSuccess: () => {
      pushToast({ title: 'Deal approved - escrow held!', body: 'Freelancer will be notified', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['pending-deals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: err => pushToast({ title: 'Approval failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ jobId, note }) => negotiationsApi.rejectDeal(jobId, note || 'Rejected by admin'),
    onSuccess: () => {
      pushToast({ title: 'Deal rejected', body: 'Job will be re-matched', icon: 'refresh' })
      queryClient.invalidateQueries({ queryKey: ['pending-deals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })

  const deals = data?.negotiations || data?.pending || []

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <div className="row between">
          <h1 className="h-display h-1" style={{ margin: 0 }}>Deal approvals</h1>
          {deals.length > 0 && (
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--amber)', padding: '5px 12px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 20 }}>
              {deals.length} waiting
            </span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
          Review agreed deals. Approving holds escrow and assigns the freelancer.
        </p>
      </div>

      {isLoading ? (
        <div className="stack" style={{ gap: 14 }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : deals.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="check" size={22} /></div>
          <h3>All clear</h3>
          <p>No deals pending approval right now.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          {deals.map(deal => {
            const row = normalizeDeal(deal)

            return (
              <div key={row.key} style={{
                background: 'var(--paper)',
                border: '1.5px solid rgba(217,119,6,0.3)',
                borderRadius: 'var(--radius-lg)', padding: 24,
              }}>
                <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink-950)', letterSpacing: '-0.01em' }}>
                      {row.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 3 }}>
                      {row.category} - {timeAgo(row.updatedAt)}
                    </div>
                  </div>
                  <span className="badge amber"><span className="bdot" /> Pending approval</span>
                </div>

                <div className="grid-2" style={{ gap: 14, marginBottom: 18 }}>
                  <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 6 }}>Client</div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{row.clientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{row.clientEmail}</div>
                  </div>
                  <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 6 }}>Freelancer</div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{row.freelancerName}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                      {row.freelancerLevel}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
                  padding: '14px 16px', background: 'rgba(16,185,129,0.05)',
                  borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)',
                  marginBottom: 18,
                }}>
                  {[
                    { label: 'Agreed price', value: rupee(deal.agreed_price || 0), mono: true },
                    { label: 'Delivery', value: `${deal.agreed_days || 0} days` },
                    { label: 'Rounds used', value: `${deal.current_round || 0} of ${deal.max_rounds || 6}` },
                    { label: 'Client total', value: rupee(deal.economics?.client_total || deal.agreed_price || 0), mono: true },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div className={item.mono ? 'mono' : ''} style={{ fontWeight: 600, fontSize: 16 }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label className="field-label">Admin note (optional)</label>
                  <input
                    className="input"
                    placeholder="Internal note for this decision..."
                    value={notes[row.key] || ''}
                    onChange={e => setNotes(n => ({ ...n, [row.key]: e.target.value }))}
                  />
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <button
                    className="btn primary"
                    onClick={() => approveMutation.mutate({ jobId: deal.job_id, note: notes[row.key] })}
                    disabled={approveMutation.isPending}
                  >
                    <Icon name="check" size={13} />
                    {approveMutation.isPending ? 'Approving...' : 'Approve deal'}
                  </button>
                  <button
                    className="btn ghost"
                    style={{ color: 'var(--rose)' }}
                    onClick={() => rejectMutation.mutate({ jobId: deal.job_id, note: notes[row.key] })}
                    disabled={rejectMutation.isPending}
                  >
                    Reject deal
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
