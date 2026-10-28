import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disputesApi } from '../../api/disputes'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import RaiseIssueSheet from '../../components/support/RaiseIssueSheet'
import { rupee, timeAgo } from '../../utils/format'

const statusLabels = {
  open: 'Open',
  under_review: 'Under review',
  resolved_release: 'Resolved: payment released',
  resolved_refund: 'Resolved: client refunded',
}
const statusTone = (status) => (status?.startsWith('resolved') ? 'bg-emerald-50 text-emerald-800' : status === 'under_review' ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800')

const STEPS = [
  ['Raise it from the order', 'Use Raise an issue in the order chat, or the button above. Pick a reason and say what happened.'],
  ['Payment is held', 'The order’s payment stays on hold, so nobody loses money while it is looked at.'],
  ['Support reviews everything', 'They read the order, the brief and the full chat, and can ask either of you for more.'],
  ['A fair decision', 'Support releases the payment or refunds the client, and explains why in the case.'],
]

const FAQS = [
  ['When should I raise an issue?', 'When you and the other person can’t sort something out in the chat: work that is very late, a delivery that doesn’t match the brief, someone who stopped replying, or scope that changed after booking.'],
  ['Does the other person find out?', 'Yes. They are notified straight away and can add their side to the same case.'],
  ['What happens to the money?', 'It stays on hold from the moment the issue is raised until support decides. Then it goes to the freelancer or back to the client.'],
  ['Can I raise an issue on a finished order?', 'Not as a dispute, because the payment is already settled. Ask support a question instead and they will help.'],
]

const btnDark = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-700 active:scale-[0.97]'
const btnLine = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-ink-200 px-5 text-[15px] font-medium text-ink-900 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-50 active:scale-[0.97]'

/** First visit, or no cases yet: what support is for and the two ways in. */
function SupportHome() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 md:px-8">
      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">How it works</h2>
        <ol className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-semibold tabular-nums text-white">{index + 1}</span>
              <div>
                <h3 className="text-[16px] font-medium text-ink-900">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-600">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">Common questions</h2>
          <p className="mt-2 max-w-sm text-[15px] text-ink-600">Something not about an order, like your account or payouts? <Link to="/support" className="font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900">Ask support a question</Link>.</p>
        </div>
        <div className="divide-y divide-ink-100 border-y border-ink-100">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                {q}
                <Icon name="chevronDown" size={18} className="shrink-0 text-ink-500 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-ink-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

/** The order and chat that came with the case, collapsed until someone needs them. */
function Evidence({ evidence, role }) {
  const order = evidence?.order
  const chat = evidence?.chat || []
  if (!order && !chat.length) return null
  const snap = order?.snapshot || {}
  const brief = (order?.brief || []).filter(item => item.value && (!Array.isArray(item.value) || item.value.length))
  return (
    <section className="rounded-2xl border border-ink-200">
      <h3 className="border-b border-ink-100 px-5 py-4 text-[16px] font-medium text-ink-900">Attached to this case</h3>
      {order && (
        <details className="group border-b border-ink-100 px-5 py-4" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="text-[15px] font-medium text-ink-900">Order {order.booking_number} · {snap.title}</span>
            <Icon name="chevronDown" size={16} className="text-ink-500 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-500">Option</dt><dd className="mt-0.5 text-ink-900">{snap.option_label || '—'}{Number(order.quantity) > 1 ? ` × ${order.quantity}` : ''}</dd></div>
            <div><dt className="text-ink-500">{role === 'freelancer' ? 'Your payout' : 'Order value'}</dt><dd className="mt-0.5 tabular-nums text-ink-900">{rupee(role === 'freelancer' ? order.freelancer_payout : order.subtotal ?? order.freelancer_payout)}</dd></div>
            <div><dt className="text-ink-500">Due</dt><dd className="mt-0.5 text-ink-900">{order.due_at ? new Date(order.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</dd></div>
            <div><dt className="text-ink-500">Deliveries</dt><dd className="mt-0.5 tabular-nums text-ink-900">{order.delivery_count} · {order.revisions_used} revision{order.revisions_used === 1 ? '' : 's'}</dd></div>
          </dl>
          {brief.length > 0 && (
            <dl className="mt-4 space-y-2.5">
              {brief.map(item => (
                <div key={item.key}>
                  <dt className="text-sm text-ink-500">{item.label}</dt>
                  <dd className="text-[15px] text-ink-900 [overflow-wrap:anywhere]">{Array.isArray(item.value) ? `${item.value.length} file${item.value.length === 1 ? '' : 's'}` : item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {order.instructions && <p className="mt-3 text-[15px] text-ink-700"><span className="text-ink-500">Notes: </span>{order.instructions}</p>}
        </details>
      )}
      <details className="group px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="text-[15px] font-medium text-ink-900">Order chat <span className="font-normal text-ink-500">· {chat.length} message{chat.length === 1 ? '' : 's'}</span></span>
          <Icon name="chevronDown" size={16} className="text-ink-500 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ol className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {chat.map(item => (
            <li key={item.id} className={item.sender_role === 'system' ? 'text-center text-[13px] text-ink-500' : ''}>
              {item.sender_role === 'system' ? (
                <span className="whitespace-pre-wrap">{item.content}</span>
              ) : (
                <div className="text-[15px]">
                  <span className="font-medium text-ink-900">{item.sender_name}</span>
                  <span className="ml-2 text-xs text-ink-400">{new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{item.edited_at ? ' · edited' : ''}</span>
                  {item.content && <p className="mt-0.5 whitespace-pre-wrap text-ink-700 [overflow-wrap:anywhere]">{item.content}</p>}
                  {(item.file_name || item.attachment_url) && <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-ink-600"><Icon name="paperclip" size={12} /> {item.file_name || 'Attachment'}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

export default function Disputes() {
  const [params, setParams] = useSearchParams()
  const role = useAuthStore(s => s.user?.role)
  const pushToast = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const isAdmin = role === 'admin'
  const [message, setMessage] = useState('')
  const [resolution, setResolution] = useState('')
  const [raising, setRaising] = useState(() => Boolean(params.get('jobId')) && role !== 'admin')

  const { data: listData, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => disputesApi.list().then(res => res.data.data),
    refetchInterval: 20_000,
  })
  const disputes = listData?.disputes || []
  const activeId = params.get('id') || disputes[0]?.id || ''

  const { data: detailData } = useQuery({
    queryKey: ['dispute', activeId],
    queryFn: () => disputesApi.get(activeId).then(res => res.data.data),
    enabled: Boolean(activeId),
    refetchInterval: 15_000,
  })
  const selected = detailData?.dispute
  const messages = detailData?.messages || []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['disputes'] })
    if (activeId) queryClient.invalidateQueries({ queryKey: ['dispute', activeId] })
    queryClient.invalidateQueries({ queryKey: ['wallet'] })
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }
  const messageMutation = useMutation({
    mutationFn: () => disputesApi.message(activeId, message),
    onSuccess: () => { setMessage(''); refresh() },
    onError: err => pushToast({ title: 'Message failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })
  const resolveMutation = useMutation({
    mutationFn: action => disputesApi.resolve(activeId, { action, resolution_note: resolution }),
    onSuccess: () => {
      setResolution('')
      pushToast({ title: 'Dispute resolved', icon: 'check' })
      refresh()
    },
    onError: err => pushToast({ title: 'Resolution failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })
  const active = selected && ['open', 'under_review'].includes(selected.status)
  const showHome = !isAdmin && !isLoading && disputes.length === 0

  return (
    <div className="w-full bg-white font-store">
      <header className="border-b border-ink-100">
        <div className={`mx-auto flex w-full flex-col gap-5 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8 md:py-10 ${showHome ? 'max-w-[1400px]' : ''}`}>
          <div className="min-w-0">
            <h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">{isAdmin ? 'Disputes' : 'Support'}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-600 md:text-[17px]">
              {isAdmin
                ? 'Review each case with its order and chat, then release the payment or refund the client.'
                : 'Stuck on an order? Raise an issue and support steps in. They see the order and its chat, and the payment stays on hold until it’s sorted.'}
            </p>
          </div>
          {!isAdmin && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setRaising(true)} className={btnDark}><Icon name="shield" size={16} /> Raise an issue</button>
              <Link to="/support" className={btnLine}>Ask a question</Link>
            </div>
          )}
        </div>
      </header>

      {!isAdmin && isLoading ? <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8"><div className="h-40 animate-pulse rounded-2xl bg-ink-50" /></div> : showHome ? <SupportHome /> : (
        <div className="grid min-h-[calc(100dvh-220px)] grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside className={`${params.get('id') ? 'hidden md:block' : ''} border-r border-ink-100`}>
            <h2 className="px-4 pb-2 pt-5 text-sm font-medium text-ink-500 md:px-5">{isAdmin ? 'All cases' : 'Your cases'}</h2>
            {isLoading ? (
              <div className="space-y-2 px-4">{[0, 1].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-100" />)}</div>
            ) : disputes.length === 0 ? (
              <p className="px-5 py-6 text-[15px] text-ink-500">No cases right now.</p>
            ) : (
              <ul className="px-2 pb-4">
                {disputes.map(dispute => (
                  <li key={dispute.id}>
                    <button type="button" onClick={() => setParams({ id: dispute.id })} aria-current={activeId === dispute.id ? 'true' : undefined}
                      className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${activeId === dispute.id ? 'bg-ink-100' : 'hover:bg-ink-50'}`}>
                      <span className="block truncate text-[15px] font-medium text-ink-900">{dispute.job_title}</span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(dispute.status)}`}>{statusLabels[dispute.status]}</span>
                        <span className="text-xs text-ink-400">{timeAgo(dispute.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {selected ? (
            <div className="min-w-0 space-y-5 p-4 md:p-8">
              <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 md:hidden"><Icon name="chevronLeft" size={16} /> All cases</button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-medium tracking-tight text-ink-900">{selected.job_title}</h2>
                  <p className="mt-1 text-[15px] text-ink-500">{selected.reason} · raised by {selected.opened_by_name} {timeAgo(selected.created_at)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${statusTone(selected.status)}`}>{statusLabels[selected.status]}</span>
              </div>
              <dl className="flex flex-wrap gap-x-10 gap-y-3 border-y border-ink-100 py-4">
                <div><dt className="text-sm text-ink-500">Payment on hold</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">{rupee(selected.escrow_amount)}</dd></div>
                {role !== 'client' && <div><dt className="text-sm text-ink-500">Freelancer payout</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">{rupee(selected.freelancer_payout)}</dd></div>}
              </dl>
              {selected.resolution_note && (
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <h3 className="text-[15px] font-medium text-emerald-900">Support’s decision</h3>
                  <p className="mt-1 text-[15px] text-emerald-900/80">{selected.resolution_note}</p>
                </div>
              )}

              <section className="rounded-2xl border border-ink-200">
                <h3 className="border-b border-ink-100 px-5 py-4 text-[16px] font-medium text-ink-900">Case conversation</h3>
                <ol className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
                  {messages.map(item => {
                    const mine = item.sender_role === role
                    return (
                      <li key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-ink-900 text-white' : 'rounded-bl-md bg-ink-50 text-ink-900'}`}>
                          <div className={`text-[13px] font-medium ${mine ? 'text-white/70' : 'text-ink-500'}`}>{mine ? 'You' : item.sender_role === 'admin' ? 'CREATYV support' : item.sender_name}</div>
                          <p className="mt-0.5 whitespace-pre-wrap text-[15px] [overflow-wrap:anywhere]">{item.body}</p>
                          <div className={`mt-1 text-xs ${mine ? 'text-white/60' : 'text-ink-400'}`}>{timeAgo(item.created_at)}</div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {active && (
                  <form onSubmit={e => { e.preventDefault(); if (message.trim()) messageMutation.mutate() }} className="flex gap-2 border-t border-ink-100 p-3">
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder={isAdmin ? 'Ask a question or share what you found…' : 'Add details or evidence for support…'} aria-label="Message"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-ink-200 px-3.5 text-[15px] placeholder:text-ink-400 focus:border-ink-500 focus:outline-none" />
                    <button type="submit" aria-label="Send" disabled={!message.trim() || messageMutation.isPending} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white transition-[opacity,transform] active:scale-95 disabled:opacity-30">
                      <Icon name="send" size={16} />
                    </button>
                  </form>
                )}
              </section>

              <Evidence evidence={detailData?.evidence} role={role} />

              {isAdmin && active && (
                <section className="rounded-2xl border border-ink-200 p-5">
                  <h3 className="text-[16px] font-medium text-ink-900">Record the decision</h3>
                  <textarea rows={4} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Explain the evidence reviewed and why this outcome is fair."
                    className="mt-3 w-full rounded-xl border border-ink-200 px-3.5 py-3 text-[15px] placeholder:text-ink-400 focus:border-ink-500 focus:outline-none" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnDark} onClick={() => resolveMutation.mutate('release')} disabled={resolution.trim().length < 10 || resolveMutation.isPending}><Icon name="check" size={15} /> Release to freelancer</button>
                    <button type="button" className={btnLine} onClick={() => resolveMutation.mutate('refund')} disabled={resolution.trim().length < 10 || resolveMutation.isPending}>Refund client</button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="hidden items-center justify-center p-8 text-center md:flex">
              <p className="text-[15px] text-ink-500">Pick a case to see its conversation and the order it’s about.</p>
            </div>
          )}
        </div>
      )}

      {raising && <RaiseIssueSheet role={role} jobId={params.get('jobId')} onClose={() => setRaising(false)} />}
    </div>
  )
}
