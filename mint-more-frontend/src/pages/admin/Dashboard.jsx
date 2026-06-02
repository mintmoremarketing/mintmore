import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { negotiationsApi } from '../../api/negotiations'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

function StatCard({ icon, label, value, sub, tone, onClick }) {
  const displayValue = (value && typeof value === 'object') ? '—' : value
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-lg)',
        padding: 20, textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.12s', width: '100%',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = 'var(--ink-300)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = 'var(--hairline)')}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: tone === 'mint' ? 'var(--mint-100)' : tone === 'amber' ? 'rgba(217,119,6,0.1)' : 'var(--paper-tint)',
        color: tone === 'mint' ? 'var(--mint-700)' : tone === 'amber' ? 'var(--amber)' : 'var(--ink-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink-950)', lineHeight: 1 }}>
        {displayValue ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>{sub}</div>}
    </button>
  )
}

export default function AdminDashboard() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  // Fetch dashboard stats — handle both { data: stats } and { data: { stats } }
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard')
      const d   = res.data
      // Backend returns: { success, data: { stats: {...}, recent_jobs: [], ... } }
      // or flat: { success, data: { total_users, ... } }
      return d?.data?.stats || d?.data || {}
    },
  })

  const { data: dealsData } = useQuery({
    queryKey: ['pending-deals'],
    queryFn:  () => negotiationsApi.pendingApprovals().then(r => r.data.data),
  })

  const { data: kycData } = useQuery({
    queryKey: ['kyc-pending'],
    queryFn:  () => api.get('/kyc/admin/pending').then(r => r.data.data),
  })

  const { data: wdData } = useQuery({
    queryKey: ['admin-withdrawals', 'pending'],
    queryFn:  () => api.get('/wallet/admin/withdrawals?status=pending').then(r => r.data.data),
  })

  const approveDeal = useMutation({
    mutationFn: ({ jobId, note }) => negotiationsApi.approveDeal(jobId, note),
    onSuccess: () => {
      pushToast({ title: 'Deal approved — escrow held', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['pending-deals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const rejectDeal = useMutation({
    mutationFn: ({ jobId, note }) => negotiationsApi.rejectDeal(jobId, note),
    onSuccess: () => {
      pushToast({ title: 'Deal rejected', icon: 'x' })
      queryClient.invalidateQueries({ queryKey: ['pending-deals'] })
    },
  })

  const stats = dashData || {}
  const deals = dealsData?.negotiations || []
  const kycs  = kycData?.submissions    || kycData?.kyc_submissions || []
  const wds   = wdData?.withdrawals     || []

  const usersObj = stats.total_users && typeof stats.total_users === 'object' ? stats.total_users : null
  const totalUsers = usersObj
    ? (usersObj.total_clients || 0) + (usersObj.total_freelancers || 0)
    : (stats.total_users ?? stats.users ?? 0)
  const totalFreelancers = usersObj?.total_freelancers ?? stats.freelancers ?? stats.total_freelancers ?? 0
  const totalClients = usersObj?.total_clients ?? stats.clients ?? stats.total_clients ?? 0

  // Pending count
  const pendingCount = deals.length + kycs.length + wds.length

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Platform overview</h1>
      </div>

      {/* KPI grid — safe fallbacks for every field */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="reveal">
        <StatCard
          icon="user" label="Total users"
          value={totalUsers}
          sub={`${totalFreelancers} freelancers · ${totalClients} clients`}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          icon="briefcase" label="Active jobs"
          value={stats.active_jobs ?? stats.jobs_active ?? 0}
          sub="matching / in progress"
        />
        <StatCard
          icon="zap" label="Pending actions"
          value={isLoading ? '…' : pendingCount}
          tone="amber"
          sub="deals + KYC + withdrawals"
          onClick={() => navigate('/admin/approvals')}
        />
        <StatCard
          icon="wallet" label="Platform escrow"
          value={stats.total_escrow != null ? rupee(stats.total_escrow) : stats.escrow != null ? rupee(stats.escrow) : '—'}
          tone="mint"
          sub="funds securely held"
          onClick={() => navigate('/admin/wallet')}
        />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* Pending deals */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="row between">
            <h2 className="h-display h-3" style={{ margin: 0 }}>Deals pending approval</h2>
            {deals.length > 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 500 }}>
                {deals.length} waiting
              </span>
            )}
          </div>

          {isLoading ? <SkeletonCard /> : deals.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>No deals pending approval ✓</div>
            </div>
          ) : (
            deals.map(deal => (
              <div key={deal.id} style={{
                background: 'var(--paper)', border: '1.5px solid rgba(217,119,6,0.3)',
                borderRadius: 'var(--radius-lg)', padding: 20,
              }}>
                <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{deal.job?.title || 'Job'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>
                      {deal.client?.full_name} → {deal.freelancer?.full_name}
                    </div>
                  </div>
                  <span className="badge amber"><span className="bdot" /> Pending</span>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                  padding: '12px 14px', background: 'var(--paper-tint)',
                  borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13,
                }}>
                  <div>
                    <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Agreed price</div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{rupee(deal.agreed_price || 0)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Delivery</div>
                    <div style={{ fontWeight: 500 }}>{deal.agreed_days} days</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Rounds</div>
                    <div style={{ fontWeight: 500 }}>{deal.current_round} of {deal.max_rounds}</div>
                  </div>
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <button className="btn primary"
                    onClick={() => approveDeal.mutate({ jobId: deal.job_id, note: 'Approved' })}
                    disabled={approveDeal.isPending}>
                    <Icon name="check" size={13} />
                    {approveDeal.isPending ? 'Approving…' : 'Approve deal'}
                  </button>
                  <button className="btn ghost" style={{ color: 'var(--rose)' }}
                    onClick={() => rejectDeal.mutate({ jobId: deal.job_id, note: 'Rejected by admin' })}
                    disabled={rejectDeal.isPending}>
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right sidebar */}
        <div className="stack" style={{ gap: 14 }}>
          {/* KYC queue */}
          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div className="h-eyebrow">KYC queue</div>
              {kycs.length > 0 && <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>{kycs.length} pending</span>}
            </div>
            {kycs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>All caught up ✓</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {kycs.slice(0, 4).map(k => (
                  <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={k.user?.full_name || 'U'} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{k.user?.full_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>Level {k.kyc_level} · {timeAgo(k.created_at)}</div>
                    </div>
                    <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => navigate('/admin/users')}>Review</button>
                  </div>
                ))}
                {kycs.length > 4 && (
                  <button className="btn link sm" onClick={() => navigate('/admin/users')} style={{ fontSize: 12 }}>
                    +{kycs.length - 4} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Withdrawals queue */}
          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div className="h-eyebrow">Withdrawals</div>
              {wds.length > 0 && <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>{wds.length} pending</span>}
            </div>
            {wds.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>None pending ✓</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {wds.slice(0, 4).map(w => (
                  <div key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={w.user?.full_name || 'F'} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{w.user?.full_name}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-600)' }}>{rupee(w.amount)}</div>
                    </div>
                    <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => navigate('/admin/wallet')}>Process</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick nav */}
          <div className="card" style={{ padding: 18 }}>
            <div className="h-eyebrow" style={{ marginBottom: 12 }}>Admin tools</div>
            <div className="stack" style={{ gap: 6 }}>
              {[
                { icon: 'user',     label: 'Manage users',     route: '/admin/users' },
                { icon: 'zap',      label: 'Approve deals',    route: '/admin/approvals' },
                { icon: 'wallet',   label: 'Platform wallet',  route: '/admin/wallet' },
                { icon: 'sparkles', label: 'Mint AI panel',    route: '/admin/ai' },
              ].map(item => (
                <button key={item.route} className="nav-item" onClick={() => navigate(item.route)}>
                  <Icon name={item.icon} size={14} />
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <Icon name="arrowRight" size={12} style={{ marginLeft: 'auto', color: 'var(--ink-400)' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
