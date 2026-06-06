import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disputesApi } from '../../api/disputes'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee, timeAgo } from '../../utils/format'

const statusLabels = {
  open: 'Open',
  under_review: 'Under review',
  resolved_release: 'Resolved: payment released',
  resolved_refund: 'Resolved: client refunded',
}

export default function Disputes() {
  const [params, setParams] = useSearchParams()
  const role = useAuthStore(s => s.user?.role)
  const pushToast = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(params.get('id') || '')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [resolution, setResolution] = useState('')
  const jobId = params.get('jobId')

  const { data: listData, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => disputesApi.list().then(res => res.data.data),
    refetchInterval: 20_000,
  })
  const disputes = listData?.disputes || []
  const activeId = params.get('id') || selectedId || disputes[0]?.id || ''

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
  const openMutation = useMutation({
    mutationFn: () => disputesApi.open(jobId, { reason, description }),
    onSuccess: res => {
      const dispute = res.data.data.dispute
      setSelectedId(dispute.id)
      setParams({ id: dispute.id })
      setReason('')
      setDescription('')
      pushToast({ title: 'Dispute opened', body: 'Escrow remains safely locked.', icon: 'shield' })
      refresh()
    },
    onError: err => pushToast({ title: 'Could not open dispute', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })
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

  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">{role === 'admin' ? 'Support' : 'Project support'}</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Disputes</h1>
        <p className="muted">Escrow stays locked while support reviews the project history and messages.</p>
      </div>

      {jobId && role !== 'admin' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Open a dispute</div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label">Reason</label>
              <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Delivery, scope, communication, or payment issue" />
            </div>
            <div className="field">
              <label className="field-label">What happened?</label>
              <textarea className="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue and the outcome you believe is fair." />
            </div>
          </div>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => openMutation.mutate()} disabled={openMutation.isPending || reason.trim().length < 3 || description.trim().length < 10}>
            <Icon name="shield" size={13} /> {openMutation.isPending ? 'Opening...' : 'Open dispute'}
          </button>
        </div>
      )}

      <div className="dispute-layout">
        <div className="card" style={{ overflow: 'hidden' }}>
          {isLoading ? <div className="muted" style={{ padding: 18 }}>Loading disputes...</div> : disputes.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}><div className="empty-glyph"><Icon name="shield" size={20} /></div><h3>No disputes</h3><p>Active support cases will appear here.</p></div>
          ) : disputes.map(dispute => (
            <button key={dispute.id} type="button" onClick={() => { setSelectedId(dispute.id); setParams({ id: dispute.id }) }} style={{ width: '100%', padding: 16, border: 0, borderTop: '1px solid var(--hairline)', background: activeId === dispute.id ? 'var(--paper-tint)' : 'var(--paper)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{dispute.job_title}</div>
              <div className="row between" style={{ marginTop: 7, gap: 8 }}>
                <span className={`badge ${dispute.status.startsWith('resolved') ? 'neutral' : 'amber'}`}>{statusLabels[dispute.status]}</span>
                <span className="muted" style={{ fontSize: 11 }}>{timeAgo(dispute.created_at)}</span>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div><div style={{ fontWeight: 700, fontSize: 18 }}>{selected.job_title}</div><div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Opened by {selected.opened_by_name} · {selected.reason}</div></div>
                <span className={`badge ${active ? 'amber' : 'mint'}`}>{statusLabels[selected.status]}</span>
              </div>
              <div className="row" style={{ gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
                <div><div className="h-eyebrow">Escrow locked</div><strong className="mono">{rupee(selected.escrow_amount)}</strong></div>
                <div><div className="h-eyebrow">Creative payout</div><strong className="mono">{rupee(selected.freelancer_payout)}</strong></div>
              </div>
              {selected.resolution_note && <div style={{ marginTop: 16, padding: 13, background: 'var(--paper-tint)', border: '1px solid var(--hairline)', borderRadius: 6 }}><strong>Support resolution</strong><div className="muted" style={{ marginTop: 5 }}>{selected.resolution_note}</div></div>}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div className="h-eyebrow" style={{ marginBottom: 12 }}>Case conversation</div>
              <div className="stack" style={{ gap: 9, maxHeight: 420, overflowY: 'auto' }}>
                {messages.map(item => (
                  <div key={item.id} style={{ alignSelf: item.sender_role === role ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '11px 13px', border: '1px solid var(--hairline)', borderRadius: 7, background: item.sender_role === role ? 'var(--mint-50)' : 'var(--paper-tint)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{item.sender_name} · {item.sender_role}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>{item.body}</div>
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 5 }}>{timeAgo(item.created_at)}</div>
                  </div>
                ))}
              </div>
              {active && <div className="row" style={{ gap: 8, marginTop: 14 }}><input className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Add evidence or context..." onKeyDown={e => { if (e.key === 'Enter' && message.trim()) messageMutation.mutate() }} /><button className="icon-btn" title="Send" onClick={() => messageMutation.mutate()} disabled={!message.trim() || messageMutation.isPending}><Icon name="send" size={15} /></button></div>}
            </div>

            {role === 'admin' && active && (
              <div className="card" style={{ padding: 18 }}>
                <div className="h-eyebrow" style={{ marginBottom: 10 }}>Record final resolution</div>
                <textarea className="textarea" rows={4} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Explain the evidence reviewed and why this outcome is fair." />
                <div className="row" style={{ gap: 9, marginTop: 12 }}>
                  <button className="btn primary" onClick={() => resolveMutation.mutate('release')} disabled={resolution.trim().length < 10 || resolveMutation.isPending}><Icon name="check" size={13} /> Release to creative</button>
                  <button className="btn ghost" onClick={() => resolveMutation.mutate('refund')} disabled={resolution.trim().length < 10 || resolveMutation.isPending}>Refund client</button>
                </div>
              </div>
            )}
          </div>
        ) : <div className="empty"><div className="empty-glyph"><Icon name="shield" size={20} /></div><h3>Select a dispute</h3><p>The case conversation and escrow decision will appear here.</p></div>}
      </div>
    </div>
  )
}
