import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supportApi } from '../../api/support'
import RaiseIssueSheet from '../../components/support/RaiseIssueSheet'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { timeAgo } from '../../utils/format'

const statusLabel = {
  open: 'Open',
  under_review: 'Under review',
  waiting_on_user: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
}

const CLIENT_STEPS = [
  ['Raise it from the order', 'Choose an order that is still in progress, then tell support what went wrong.'],
  ['Payment stays on hold', 'The order payment is held while support reviews the issue.'],
  ['Support reviews the details', 'They look at the order, your brief and the full chat, and can ask either of you for more.'],
  ['Get a clear decision', 'Support explains the outcome and releases the payment or refunds you.'],
]

const CLIENT_FAQS = [
  ['When should I raise an issue?', 'Raise one when you and your freelancer cannot resolve an order problem in chat, such as a very late delivery, work that does not match the brief, or a freelancer who has stopped responding.'],
  ['What happens to my payment?', 'For an eligible order that is still in progress, its payment stays on hold while support reviews the case. Support will explain the decision in the case conversation.'],
  ['Can I raise an issue on a finished order?', 'A finished order has already been settled, so it cannot be reopened as a payment dispute. Ask support a question and include the order number.'],
  ['Will the freelancer see my support ticket?', 'A general support ticket is a private conversation with CREATYV support. If you raise an order issue, the freelancer is notified and can add their side to that case.'],
]

function ClientSupportGuide({ onAskQuestion }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-8 md:px-8">
      <section>
        <h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">How order support works</h2>
        <ol className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {CLIENT_STEPS.map(([title, body], index) => (
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

      <section className="mt-12 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">Common questions</h2>
          <p className="mt-2 max-w-sm text-[15px] text-ink-600">Need help with your account, payment or something else? <button type="button" onClick={onAskQuestion} className="font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900">Ask support a question</button>.</p>
        </div>
        <div className="divide-y divide-ink-100 border-y border-ink-100">
          {CLIENT_FAQS.map(([question, answer]) => (
            <details key={question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                {question}
                <Icon name="chevronDown" size={18} className="shrink-0 text-ink-500 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-ink-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

function NewTicketModal({ onClose, role }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [form, setForm] = useState({ subject: '', category: 'general', priority: 'normal', body: '' })
  const create = useMutation({
    mutationFn: () => supportApi.create(form),
    onSuccess: () => {
      pushToast({ title: 'Support ticket created' })
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
      onClose()
    },
    onError: err => pushToast({ title: 'Could not create ticket', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })
  return (
    <Modal
      title="Raise a support ticket"
      subtitle="CREATYV support will reply in this thread."
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => create.mutate()} disabled={create.isPending || form.subject.trim().length < 3 || form.body.trim().length < 10}>
          <Icon name="send" /> Submit ticket
        </button>
      </>}
    >
      <div className="stack" style={{ gap: 12 }}>
        <label className="field"><span className="field-label">Subject</span><input className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="What do you need help with?" /></label>
        <div className="grid-2" style={{ gap: 10 }}>
          <label className="field"><span className="field-label">Category</span><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{role === 'client' ? <><option value="general">General</option><option value="orders">Orders</option><option value="billing">Payments</option><option value="account">Account</option><option value="technical">Technical issue</option></> : <><option value="general">General</option><option value="calendar">Creative calendar</option><option value="mintbox">Mintbox</option><option value="social">Social accounts</option><option value="billing">Billing</option><option value="technical">Technical issue</option></>}</select></label>
          <label className="field"><span className="field-label">Priority</span><select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        </div>
        <label className="field"><span className="field-label">Details</span><textarea className="textarea" rows={5} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Tell us what happened, what you expected, and any useful links or context." /></label>
      </div>
    </Modal>
  )
}

export default function Support() {
  const role = useAuthStore(s => s.user?.role)
  const pushToast = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [message, setMessage] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.list().then(res => res.data.data),
    refetchInterval: 20_000,
  })
  const tickets = data?.tickets || []
  const activeId = selectedId || tickets[0]?.id || ''
  const { data: detail } = useQuery({
    queryKey: ['support-ticket', activeId],
    queryFn: () => supportApi.get(activeId).then(res => res.data.data),
    enabled: Boolean(activeId),
    refetchInterval: 15_000,
  })
  const ticket = detail?.ticket
  const messages = detail?.messages || []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    if (activeId) queryClient.invalidateQueries({ queryKey: ['support-ticket', activeId] })
  }
  const send = useMutation({
    mutationFn: () => supportApi.message(activeId, message),
    onSuccess: () => { setMessage(''); refresh() },
    onError: err => pushToast({ title: 'Message failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })
  const update = useMutation({
    mutationFn: payload => supportApi.update(activeId, payload),
    onSuccess: () => { pushToast({ title: 'Ticket updated' }); refresh() },
    onError: err => pushToast({ title: 'Update failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  return (
    <div className={`flex flex-col w-full bg-white ${role === 'client' ? 'min-h-[calc(100vh-64px)] font-store' : 'h-[calc(100vh-64px)]'}`}>
      <div className={`flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 md:px-8 border-b border-ink-100 shrink-0 ${role === 'client' ? 'mx-auto w-full max-w-[1400px] border-0 py-8' : ''}`}>
        <div>
          <h1 className="text-3xl font-display font-bold text-ink-900 tracking-tight m-0">Support</h1>
          <p className="text-ink-500 text-sm md:text-base mt-2">{role === 'client' ? 'Get help with an order, payment or your Creatyv account.' : 'Ask CREATYV support for help without opening a payment dispute.'}</p>
        </div>
        {role !== 'admin' && (
          role === 'client' ? <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button type="button" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-700 active:scale-[0.97]" onClick={() => setShowIssue(true)}><Icon name="shield" size={16} /> Raise an issue</button>
            <button type="button" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-ink-200 px-5 text-[15px] font-medium text-ink-900 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-50 active:scale-[0.97]" onClick={() => setShowNew(true)}>Ask a question</button>
          </div> : <button className="self-start bg-ink-950 text-white shadow-md shadow-ink-900/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-ink-900 transition-[background-color,transform] duration-150 active:scale-[0.97]" onClick={() => setShowNew(true)}><Icon name="plus" size={16} /> Raise ticket</button>
        )}
      </div>

      {role === 'client' && <ClientSupportGuide onAskQuestion={() => setShowNew(true)} />}

      {role === 'client' && <div className="mx-auto w-full max-w-[1400px] px-4 pb-4 md:px-8"><h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">Your support tickets</h2><p className="mt-1 text-[15px] text-ink-600">Follow up with CREATYV support on account, payment or platform questions.</p></div>}

      <div className={`flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] min-h-[300px] bg-white ${role === 'client' ? 'mx-auto mb-12 w-full max-w-[1400px] border-y border-ink-100' : 'min-h-0'}`}>
        <aside className="border-r border-ink-100 flex flex-col min-w-0 bg-ink-50/30">
          {isLoading ? <div className="muted" style={{ padding: 18 }}>Loading tickets...</div> : tickets.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}><div className="empty-glyph"><Icon name="chat" size={20} /></div><h3>No tickets</h3><p>Support tickets will appear here.</p>{role !== 'admin' && <button className="btn primary" onClick={() => setShowNew(true)}>Raise ticket</button>}</div>
          ) : tickets.map(item => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} style={{ width: '100%', padding: 16, border: 0, borderTop: '1px solid var(--hairline)', background: activeId === item.id ? 'var(--paper-tint)' : 'var(--paper)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 650, fontSize: 13 }}>{item.subject}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{role === 'admin' ? item.opened_by_name : item.latest_message || item.category}</div>
              <div className="row between" style={{ marginTop: 8 }}>
                <span className={`badge ${['resolved', 'closed'].includes(item.status) ? 'neutral' : 'mint'}`}>{statusLabel[item.status] || item.status}</span>
                <span className="muted" style={{ fontSize: 11 }}>{timeAgo(item.updated_at)}</span>
              </div>
            </button>
          ))}
        </aside>

        {ticket ? (
          <div className="flex flex-col min-h-0 bg-white p-4 md:p-8">
            <div className="card" style={{ padding: 18 }}>
              <div className="row between" style={{ gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{ticket.subject}</h2>
                  <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{ticket.category} · {ticket.priority} priority · opened {timeAgo(ticket.created_at)}</div>
                </div>
                <span className="badge mint">{statusLabel[ticket.status] || ticket.status}</span>
              </div>
              {role === 'admin' && (
                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <select className="input" value={ticket.status} onChange={e => update.mutate({ status: e.target.value })} style={{ maxWidth: 220 }}>
                    {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select className="input" value={ticket.priority} onChange={e => update.mutate({ priority: e.target.value })} style={{ maxWidth: 170 }}>
                    {['low', 'normal', 'high', 'urgent'].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="h-eyebrow" style={{ marginBottom: 12 }}>Conversation</div>
              <div className="stack" style={{ gap: 9, maxHeight: 430, overflowY: 'auto' }}>
                {messages.map(item => (
                  <div key={item.id} style={{ alignSelf: item.sender_role === role ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '11px 13px', border: '1px solid var(--hairline)', borderRadius: 7, background: item.sender_role === role ? 'var(--mint-50)' : 'var(--paper-tint)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{item.sender_name} · {item.sender_role}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>{item.body}</div>
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 5 }}>{timeAgo(item.created_at)}</div>
                  </div>
                ))}
              </div>
              {!['resolved', 'closed'].includes(ticket.status) && <div className="row" style={{ gap: 8, marginTop: 14 }}><input className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Reply to support..." onKeyDown={e => { if (e.key === 'Enter' && message.trim()) send.mutate() }} /><button className="icon-btn" title="Send" onClick={() => send.mutate()} disabled={!message.trim() || send.isPending}><Icon name="send" size={15} /></button></div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-white p-8">
            <div className="empty" style={{ border: 0, padding: 28 }}><div className="empty-glyph"><Icon name="chat" size={20} /></div><h3>Select a ticket</h3><p>The support conversation will appear here.</p></div>
          </div>
        )}
      </div>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} role={role} />}
      {showIssue && <RaiseIssueSheet role={role} onClose={() => setShowIssue(false)} />}
    </div>
  )
}
