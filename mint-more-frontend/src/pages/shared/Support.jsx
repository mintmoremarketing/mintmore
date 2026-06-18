import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supportApi } from '../../api/support'
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

function NewTicketModal({ onClose }) {
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
      subtitle="Mint More support will reply in this thread."
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
          <label className="field"><span className="field-label">Category</span><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option value="general">General</option><option value="calendar">Creative calendar</option><option value="mintbox">Mintbox</option><option value="social">Social accounts</option><option value="billing">Billing</option><option value="technical">Technical issue</option></select></label>
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
    <div className="stack-6">
      <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div>
          <div className="h-eyebrow">Support</div>
          <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Tickets</h1>
          <p className="muted">Ask Mint More support for help without opening a payment dispute.</p>
        </div>
        {role !== 'admin' && <button className="btn primary" onClick={() => setShowNew(true)}><Icon name="plus" /> Raise ticket</button>}
      </div>

      <div className="dispute-layout">
        <div className="card" style={{ overflow: 'hidden' }}>
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
        </div>

        {ticket ? (
          <div className="stack" style={{ gap: 14 }}>
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
          <div className="empty"><div className="empty-glyph"><Icon name="chat" size={20} /></div><h3>Select a ticket</h3><p>The support conversation will appear here.</p></div>
        )}
      </div>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
