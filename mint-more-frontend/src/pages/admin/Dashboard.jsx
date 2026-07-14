import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { negotiationsApi } from '../../api/negotiations'
import { disputesApi } from '../../api/disputes'
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
      className={`group w-full relative overflow-hidden bg-ink-950 border border-ink-800 rounded-[2rem] p-6 md:p-8 text-left transition-all duration-500 hover:border-ink-700 hover:shadow-2xl hover:shadow-ink-900/20 ${onClick ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'}`}
    >
      <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[64px] opacity-30 transition-opacity duration-700 group-hover:opacity-60 ${
        tone === 'mint' ? 'bg-mint-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-ink-400'
      }`} />
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-8">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-ink-400">
            {label}
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner border ${
            tone === 'mint' ? 'bg-mint-950 border-mint-800 text-mint-400' : 
            tone === 'amber' ? 'bg-amber-950 border-amber-800 text-amber-400' : 
            'bg-ink-900 border-ink-800 text-ink-400'
          }`}>
            <Icon name={icon} size={18} />
          </div>
        </div>
        
        <div>
          <div className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-none mb-3">
            {displayValue ?? '—'}
          </div>
          {sub && (
            <div className={`text-sm font-medium ${tone === 'amber' ? 'text-amber-400' : tone === 'mint' ? 'text-mint-400' : 'text-ink-500'}`}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

export default function AdminDashboard() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  // Fetch dashboard stats
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard')
      const d   = res.data
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

  const { data: disputesData } = useQuery({
    queryKey: ['disputes', 'open'],
    queryFn: () => disputesApi.list({ status: 'open' }).then(r => r.data.data),
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
  const totalUsers = Number(stats.users?.total_clients || 0) + Number(stats.users?.total_freelancers || 0)
  const newUsers = Number(stats.users?.new_this_week || 0)
  const activeJobs = Number(stats.jobs?.active_jobs || 0)
  const pendingDeals = Number(stats.operations?.pending_deals || 0)

  const deals = Array.isArray(dealsData?.negotiations) ? dealsData.negotiations : (Array.isArray(dealsData) ? dealsData : [])
  const kycs  = Array.isArray(kycData?.submissions) ? kycData.submissions : (Array.isArray(kycData?.kycs) ? kycData.kycs : (Array.isArray(kycData) ? kycData : []))
  const wds   = Array.isArray(wdData?.withdrawals) ? wdData.withdrawals : (Array.isArray(wdData) ? wdData : [])
  const disputes = Array.isArray(disputesData?.disputes) ? disputesData.disputes : (Array.isArray(disputesData) ? disputesData : [])

  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin Overview</div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Command Center</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon="user" label="Total users"
          value={totalUsers}
          sub={newUsers ? `+${newUsers} this week` : 'All time'}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          icon="briefcase" label="Active deals"
          value={activeJobs}
          sub={pendingDeals ? `${pendingDeals} pending approval` : 'In progress'}
          tone={pendingDeals > 0 ? 'amber' : null}
          onClick={() => navigate('/admin/approvals')}
        />
        <StatCard
          icon="shield" label="Open disputes"
          value={disputes.length}
          tone={disputes.length > 0 ? 'amber' : null}
          sub="Requires admin review"
          onClick={() => navigate(disputes.length ? '/disputes' : '/admin/approvals')}
        />
        <StatCard
          icon="wallet" label="Platform escrow"
          value={stats.total_escrow != null ? rupee(stats.total_escrow) : stats.escrow != null ? rupee(stats.escrow) : '—'}
          tone="mint"
          sub="Funds securely held"
          onClick={() => navigate('/admin/wallet')}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Pending deals */}
        <div className="flex-1 w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold text-ink-950 m-0">Deals pending approval</h2>
            {deals.length > 0 && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {deals.length} waiting
              </span>
            )}
          </div>

          {isLoading ? <SkeletonCard /> : deals.length === 0 ? (
            <div className="bg-ink-50/50 border border-ink-200/50 rounded-[2rem] p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-6 text-mint-500">
                <Icon name="checkCircle" size={32} />
              </div>
              <div className="text-ink-600 font-bold text-lg">No deals pending approval</div>
              <p className="text-ink-500 mt-2">All deals have been reviewed and escrowed.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {deals.map(deal => (
                <div key={deal.negotiation_id || deal.id || deal.job_id} className="bg-white border border-ink-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm transition-all hover:shadow-xl hover:border-ink-300 relative overflow-hidden group flex flex-col md:flex-row gap-8 items-center">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-amber-500" />
                  
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-full">Requires Approval</div>
                    </div>
                    <div className="font-display font-bold text-2xl text-ink-950 mb-4">{deal.job?.title || deal.title || 'Job'}</div>
                    
                    <div className="flex items-center gap-4 bg-ink-50 rounded-2xl p-4 w-fit">
                      <div className="flex items-center gap-3">
                        <Avatar name={deal.client?.full_name || deal.client_name || 'C'} size="sm" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Client</div>
                          <div className="text-sm font-bold text-ink-900">{deal.client?.full_name || deal.client_name || 'Client'}</div>
                        </div>
                      </div>
                      <Icon name="arrowRight" size={16} className="text-ink-300" />
                      <div className="flex items-center gap-3">
                        <Avatar name={deal.freelancer?.full_name || deal.freelancer_name || 'F'} size="sm" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Freelancer</div>
                          <div className="text-sm font-bold text-ink-900">{deal.freelancer?.full_name || deal.freelancer_name || 'Freelancer'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-6 bg-ink-50/50 rounded-3xl p-6 border border-ink-100">
                    <div className="flex justify-between items-end border-b border-ink-200/50 pb-4">
                      <div className="text-xs font-bold tracking-widest uppercase text-ink-500">Agreed Price</div>
                      <div className="font-mono font-bold text-3xl text-ink-950">{rupee(deal.agreed_price || 0)}</div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="text-ink-500 font-medium">Delivery timeline</div>
                      <div className="font-bold text-ink-900">{deal.agreed_days} days</div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="text-ink-500 font-medium">Revision rounds</div>
                      <div className="font-bold text-ink-900">{deal.current_round || 0} of {deal.max_rounds || 4}</div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-2">
                      <button className="w-full py-3.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
                        onClick={() => approveDeal.mutate({ jobId: deal.job_id, note: 'Approved' })}
                        disabled={approveDeal.isPending}>
                        <Icon name="check" size={18} />
                        {approveDeal.isPending ? 'Approving…' : 'Approve & Escrow'}
                      </button>
                      <button className="w-full py-3.5 bg-transparent hover:bg-rose-50 text-rose-600 font-bold rounded-full transition-all disabled:opacity-50"
                        onClick={() => rejectDeal.mutate({ jobId: deal.job_id, note: 'Rejected by admin' })}
                        disabled={rejectDeal.isPending}>
                        Reject terms
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-[420px] flex flex-col gap-8">
          {/* Quick nav */}
          <div className="bg-white border border-ink-200/60 rounded-[2rem] p-6 shadow-sm">
            <div className="text-xs font-bold tracking-widest uppercase text-ink-400 mb-6 px-2">Admin Modules</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: 'calendar', label: 'Operations',       route: '/admin/operations' },
                { icon: 'user',     label: 'Manage users',     route: '/admin/users' },
                { icon: 'zap',      label: 'Approve deals',    route: '/admin/approvals' },
                { icon: 'wallet',   label: 'Platform wallet',  route: '/admin/wallet' },
                { icon: 'shield',   label: 'Disputes',         route: '/admin/disputes' },
                { icon: 'sparkles', label: 'Mint AI',          route: '/admin/ai' },
              ].map(item => (
                <button key={item.route} className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-ink-50 hover:bg-ink-950 hover:text-white transition-all group border border-transparent hover:border-ink-800 hover:shadow-xl" onClick={() => navigate(item.route)}>
                  <Icon name={item.icon} size={24} className="text-ink-500 group-hover:text-mint-400 transition-colors" />
                  <span className="font-bold text-sm text-ink-900 group-hover:text-white transition-colors text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* KYC queue */}
          <div className="bg-white border border-ink-200/60 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-600 flex items-center justify-center">
                  <Icon name="checkCircle" size={18} />
                </div>
                <div className="text-sm font-bold tracking-widest uppercase text-ink-950">KYC Queue</div>
              </div>
              {kycs.length > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">{kycs.length} pending</span>}
            </div>
            {kycs.length === 0 ? (
              <div className="text-sm font-medium text-ink-500 bg-ink-50 rounded-2xl p-4 text-center">
                All accounts verified.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {kycs.slice(0, 4).map(k => (
                  <div key={k.id} className="flex items-center gap-4 bg-ink-50/50 p-3 pr-4 rounded-2xl border border-ink-100 hover:border-ink-200 transition-colors">
                    <Avatar name={k.full_name || 'U'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink-950 truncate">{k.full_name}</div>
                      <div className="text-xs text-ink-500 capitalize truncate">{k.level} · {timeAgo(k.created_at)}</div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-ink-200 hover:border-ink-300 hover:bg-ink-50 text-ink-900 font-bold text-xs rounded-xl transition-all shadow-sm" onClick={() => navigate('/admin/users')}>
                      Review
                    </button>
                  </div>
                ))}
                {kycs.length > 4 && (
                  <button className="text-xs font-bold text-mint-600 hover:text-mint-700 mt-2 text-center w-full py-2" onClick={() => navigate('/admin/users')}>
                    View {kycs.length - 4} more requests
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Withdrawals queue */}
          <div className="bg-white border border-ink-200/60 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-600 flex items-center justify-center">
                  <Icon name="rupee" size={18} />
                </div>
                <div className="text-sm font-bold tracking-widest uppercase text-ink-950">Withdrawals</div>
              </div>
              {wds.length > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">{wds.length} pending</span>}
            </div>
            {wds.length === 0 ? (
              <div className="text-sm font-medium text-ink-500 bg-ink-50 rounded-2xl p-4 text-center">
                No pending withdrawals.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {wds.slice(0, 4).map(w => (
                  <div key={w.id} className="flex items-center gap-4 bg-ink-50/50 p-3 pr-4 rounded-2xl border border-ink-100 hover:border-ink-200 transition-colors">
                    <Avatar name={w.user?.full_name || 'F'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink-950 truncate">{w.user?.full_name}</div>
                      <div className="font-mono text-xs text-ink-600 font-medium">{rupee(w.amount)}</div>
                    </div>
                    <button className="px-4 py-2 bg-ink-950 text-white hover:bg-ink-900 font-bold text-xs rounded-xl transition-all shadow-sm" onClick={() => navigate('/admin/wallet')}>
                      Pay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
