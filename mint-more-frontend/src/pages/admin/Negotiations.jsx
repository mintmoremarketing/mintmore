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
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Deal approvals</h1>
            {deals.length > 0 && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {deals.length} waiting
              </span>
            )}
          </div>
          <p className="text-ink-600 font-medium">Review agreed deals. Approving holds escrow and assigns the freelancer.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-ink-50/50 border border-ink-200/50 rounded-[2rem] p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-6 text-mint-500">
            <Icon name="checkCircle" size={32} />
          </div>
          <div className="text-ink-600 font-bold text-lg">All clear</div>
          <p className="text-ink-500 mt-2">No deals pending approval right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {deals.map(deal => {
            const row = normalizeDeal(deal)

            return (
              <div key={row.key} className="bg-white border border-ink-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm transition-all hover:shadow-xl hover:border-ink-300 relative overflow-hidden flex flex-col md:flex-row gap-8 items-start md:items-center">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-amber-500" />
                
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Pending approval
                    </div>
                  </div>
                  
                  <div className="font-display font-bold text-3xl text-ink-950 mb-2">{row.title}</div>
                  <div className="text-sm text-ink-500 font-medium mb-8">
                    {row.category} — {timeAgo(row.updatedAt)}
                  </div>

                  <div className="flex items-center gap-6 bg-ink-50 rounded-[1.5rem] p-5 w-fit border border-ink-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ink-200/50 flex items-center justify-center text-ink-400">
                        <Icon name="user" size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Client</div>
                        <div className="text-sm font-bold text-ink-900">{row.clientName}</div>
                        <div className="text-xs text-ink-500">{row.clientEmail}</div>
                      </div>
                    </div>
                    <Icon name="arrowRight" size={16} className="text-ink-300" />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ink-200/50 flex items-center justify-center text-ink-400">
                        <Icon name="user" size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Freelancer</div>
                        <div className="text-sm font-bold text-ink-900">{row.freelancerName}</div>
                        <div className="text-xs text-ink-500 capitalize">{row.freelancerLevel}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-[400px] shrink-0 flex flex-col gap-6 bg-ink-50/50 rounded-[2rem] p-8 border border-ink-100">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-400 mb-1">Agreed price</div>
                      <div className="font-mono font-bold text-xl text-ink-950">{rupee(deal.agreed_price || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-400 mb-1">Client total</div>
                      <div className="font-mono font-bold text-xl text-ink-950">{rupee(deal.economics?.client_total || deal.agreed_price || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-400 mb-1">Delivery</div>
                      <div className="text-sm font-bold text-ink-900">{deal.agreed_days || 0} days</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-400 mb-1">Rounds used</div>
                      <div className="text-sm font-bold text-ink-900">{deal.current_round || 0} of {deal.max_rounds || 4}</div>
                    </div>
                  </div>

                  <div className="h-px w-full bg-ink-200/60 my-2" />

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Admin note (optional)</label>
                    <input
                      className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all text-sm"
                      placeholder="Internal note for this decision..."
                      value={notes[row.key] || ''}
                      onChange={e => setNotes(n => ({ ...n, [row.key]: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      className="w-full py-3.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                      onClick={() => approveMutation.mutate({ jobId: deal.job_id, note: notes[row.key] })}
                      disabled={approveMutation.isPending}
                    >
                      <Icon name="check" size={16} />
                      {approveMutation.isPending ? 'Approving...' : 'Approve & Escrow'}
                    </button>
                    <button
                      className="w-full py-3.5 bg-transparent hover:bg-rose-50 text-rose-600 font-bold rounded-full transition-all disabled:opacity-50"
                      onClick={() => rejectMutation.mutate({ jobId: deal.job_id, note: notes[row.key] })}
                      disabled={rejectMutation.isPending}
                    >
                      Reject deal
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
