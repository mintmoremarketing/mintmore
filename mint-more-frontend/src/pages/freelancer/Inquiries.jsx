import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import Tabs from '../../components/ui/Tabs'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function Inquiries() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [tab, setTab] = useState('pending')
  const [responding, setResponding] = useState(null) // inquiry id being responded to
  const [response,   setResponse]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn: () => api.get('/inquiries').then(r => r.data.data.inquiries || []),
  })

  const inquiries = data || []

  const filtered = inquiries.filter(i => {
    if (tab === 'pending')   return i.status === 'pending'
    if (tab === 'responded') return ['responded','accepted'].includes(i.status)
    if (tab === 'declined')  return i.status === 'declined'
    return true
  })

  const counts = {
    pending:   inquiries.filter(i => i.status === 'pending').length,
    responded: inquiries.filter(i => ['responded','accepted'].includes(i.status)).length,
    declined:  inquiries.filter(i => i.status === 'declined').length,
    all:       inquiries.length,
  }

  const respondMutation = useMutation({
    mutationFn: ({ id, action }) =>
      api.patch(`/inquiries/${id}/respond`, {
        action,
        response: response.trim() || undefined,
      }),
    onSuccess: (_, vars) => {
      pushToast({
        title: vars.action === 'accept' ? 'Inquiry accepted!' : 'Inquiry declined',
        body:  vars.action === 'accept' ? 'Your response has been sent to the client' : '',
        icon:  vars.action === 'accept' ? 'check' : 'x',
      })
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      setResponding(null)
      setResponse('')
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1200px] mx-auto">
      <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide uppercase">Marketplace</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">Direct inquiries</h1>
        <p className="text-ink-600 mt-2 text-sm md:text-base">
          Clients with marketplace access can contact you directly here.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending',   label: 'Pending',    count: counts.pending },
          { value: 'responded', label: 'Responded',  count: counts.responded },
          { value: 'declined',  label: 'Declined',   count: counts.declined },
          { value: 'all',       label: 'All',        count: counts.all },
        ]}
      />

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1,2].map(i => <div key={i} className="animate-pulse bg-ink-100 h-48 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-ink-200 border-dashed rounded-3xl flex flex-col items-center justify-center p-16 text-center bg-ink-50/50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-ink-400 mb-6">
              <Icon name="chat" size={32} />
            </div>
            <h3 className="text-xl font-display font-bold text-ink-950 mb-2">No {tab} inquiries</h3>
            <p className="text-base text-ink-500 max-w-md">
              {tab === 'pending'
                ? 'When clients contact you directly, their messages appear here.'
                : `No ${tab} inquiries yet.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            {filtered.map(inq => (
              <div
                key={inq.id}
                className={`bg-white border rounded-2xl p-5 md:p-6 shadow-sm transition-all ${
                  inq.status === 'pending' ? 'border-mint-200 hover:border-mint-300 bg-mint-50/10' : 'border-ink-200/60 hover:border-ink-300'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-ink-100">
                  <div className="flex items-center gap-3">
                    <Avatar name={inq.client_name || 'Client'} size="md" />
                    <div>
                      <div className="text-base font-bold text-ink-950">
                        {inq.client_name || 'Client'}
                      </div>
                      <div className="text-sm font-medium text-ink-500 mt-0.5">
                        {timeAgo(inq.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    inq.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                    inq.status === 'responded' ? 'bg-mint-100 text-mint-700'  :
                    inq.status === 'accepted'  ? 'bg-mint-100 text-mint-700'  : 'bg-ink-100 text-ink-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      inq.status === 'pending'   ? 'bg-amber-500' :
                      inq.status === 'responded' ? 'bg-mint-500'  :
                      inq.status === 'accepted'  ? 'bg-mint-500'  : 'bg-ink-400'
                    }`} />
                    {inq.status}
                  </div>
                </div>

                {/* Package interested in */}
                {inq.package_name && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 bg-ink-50 border border-ink-200 rounded-lg text-sm font-medium text-ink-700">
                    <Icon name="layers" size={14} className="text-ink-400" />
                    {inq.package_name}
                    {inq.package_price && (
                      <span className="text-ink-500 ml-1">
                        · {rupee(inq.package_price)}
                      </span>
                    )}
                  </div>
                )}

                {/* Message */}
                <p className="text-base text-ink-800 leading-relaxed mb-4">
                  {inq.message}
                </p>

                {/* Budget + deadline */}
                {(inq.budget || inq.deadline_days) && (
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-ink-600 mb-5 p-3 bg-ink-50 rounded-xl">
                    {inq.budget && (
                      <span className="flex items-center gap-1.5">
                        <Icon name="rupee" size={14} className="text-ink-400" /> 
                        Budget: <span className="text-ink-950 font-bold">{rupee(inq.budget)}</span>
                      </span>
                    )}
                    {inq.deadline_days && (
                      <span className="flex items-center gap-1.5">
                        <Icon name="calendar" size={14} className="text-ink-400" /> 
                        Timeline: <span className="text-ink-950 font-bold">{inq.deadline_days} days</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Freelancer's response (if any) */}
                {inq.freelancer_response && (
                  <div className="p-4 bg-ink-50 border border-ink-200 rounded-xl mb-4">
                    <div className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2">Your response</div>
                    <div className="text-sm font-medium text-ink-800">{inq.freelancer_response}</div>
                  </div>
                )}

                {/* Response form */}
                {inq.status === 'pending' && (
                  <>
                    {responding === inq.id ? (
                      <div className="p-5 bg-ink-50 border border-ink-200 rounded-xl mt-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-sm font-bold text-ink-900 mb-3">
                          Your response
                        </div>
                        <textarea
                          className="w-full bg-white border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all resize-y mb-4"
                          rows={3}
                          value={response}
                          onChange={e => setResponse(e.target.value)}
                          placeholder="Tell the client about your availability, approach, or any questions…"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            className="px-5 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => respondMutation.mutate({ id: inq.id, action: 'accept' })}
                            disabled={respondMutation.isPending}
                          >
                            <Icon name="check" size={16} />
                            {respondMutation.isPending ? 'Sending…' : 'Accept & respond'}
                          </button>
                          <button
                            className="px-5 py-2.5 bg-white border border-rose-200 text-rose-600 font-semibold rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => respondMutation.mutate({ id: inq.id, action: 'decline' })}
                            disabled={respondMutation.isPending}
                          >
                            Decline
                          </button>
                          <button 
                            className="px-5 py-2.5 text-ink-600 font-semibold hover:bg-ink-200 rounded-xl transition-colors ml-auto" 
                            onClick={() => { setResponding(null); setResponse('') }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 pt-4 border-t border-ink-100">
                        <button 
                          className="px-5 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2" 
                          onClick={() => setResponding(inq.id)}
                        >
                          <Icon name="chat" size={16} /> Respond
                        </button>
                        <button
                          className="px-5 py-2.5 bg-white border border-rose-200 text-rose-600 font-semibold rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => respondMutation.mutate({ id: inq.id, action: 'decline' })}
                          disabled={respondMutation.isPending}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}