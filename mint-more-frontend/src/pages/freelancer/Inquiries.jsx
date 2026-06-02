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
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Direct inquiries</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
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

      <div className="stack" style={{ gap: 14 }}>
        {isLoading ? (
          [1,2].map(i => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph"><Icon name="chat" size={22} /></div>
            <h3>No {tab} inquiries</h3>
            <p>
              {tab === 'pending'
                ? 'When clients contact you directly, their messages appear here.'
                : `No ${tab} inquiries yet.`}
            </p>
          </div>
        ) : (
          filtered.map(inq => (
            <div
              key={inq.id}
              style={{
                background: 'var(--paper)',
                border: `1px solid ${inq.status === 'pending' ? 'var(--mint-200)' : 'var(--hairline)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 20,
              }}
            >
              {/* Header */}
              <div className="row between" style={{ marginBottom: 14 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={inq.client_name || 'Client'} size="sm" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-950)' }}>
                      {inq.client_name || 'Client'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1 }}>
                      {timeAgo(inq.created_at)}
                    </div>
                  </div>
                </div>
                <span className={`badge ${
                  inq.status === 'pending'   ? 'amber' :
                  inq.status === 'responded' ? 'mint'  :
                  inq.status === 'accepted'  ? 'mint'  : 'neutral'
                }`}>
                  <span className="bdot" />
                  {inq.status}
                </span>
              </div>

              {/* Package interested in */}
              {inq.package_name && (
                <div style={{
                  display: 'inline-flex', gap: 6, alignItems: 'center',
                  padding: '5px 10px', marginBottom: 12,
                  background: 'var(--paper-tint)', border: '1px solid var(--hairline)',
                  borderRadius: 20, fontSize: 12.5,
                }}>
                  <Icon name="layers" size={11} />
                  {inq.package_name}
                  {inq.package_price && (
                    <span className="mono" style={{ fontWeight: 500 }}>
                      · {rupee(inq.package_price)}
                    </span>
                  )}
                </div>
              )}

              {/* Message */}
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-700)', margin: '0 0 12px' }}>
                {inq.message}
              </p>

              {/* Budget + deadline */}
              {(inq.budget || inq.deadline_days) && (
                <div className="row" style={{ gap: 18, fontSize: 12.5, color: 'var(--ink-600)', marginBottom: 14 }}>
                  {inq.budget && (
                    <span>
                      <Icon name="rupee" size={11} /> Budget: <span className="mono">{rupee(inq.budget)}</span>
                    </span>
                  )}
                  {inq.deadline_days && (
                    <span>
                      <Icon name="calendar" size={11} /> Timeline: {inq.deadline_days} days
                    </span>
                  )}
                </div>
              )}

              {/* Freelancer's response (if any) */}
              {inq.freelancer_response && (
                <div style={{
                  padding: 12, background: 'var(--paper-tint)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 4 }}>Your response</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-800)' }}>{inq.freelancer_response}</div>
                </div>
              )}

              {/* Response form */}
              {inq.status === 'pending' && (
                <>
                  {responding === inq.id ? (
                    <div style={{
                      padding: 16, background: 'var(--paper-tint)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
                    }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 12 }}>
                        Your response
                      </div>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={response}
                        onChange={e => setResponse(e.target.value)}
                        placeholder="Tell the client about your availability, approach, or any questions…"
                      />
                      <div className="row" style={{ gap: 8, marginTop: 12 }}>
                        <button
                          className="btn primary"
                          onClick={() => respondMutation.mutate({ id: inq.id, action: 'accept' })}
                          disabled={respondMutation.isPending}
                        >
                          <Icon name="check" size={13} />
                          {respondMutation.isPending ? 'Sending…' : 'Accept & respond'}
                        </button>
                        <button
                          className="btn ghost"
                          style={{ color: 'var(--rose)' }}
                          onClick={() => respondMutation.mutate({ id: inq.id, action: 'decline' })}
                          disabled={respondMutation.isPending}
                        >
                          Decline
                        </button>
                        <button className="btn ghost" onClick={() => { setResponding(null); setResponse('') }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn primary" onClick={() => setResponding(inq.id)}>
                        <Icon name="chat" size={13} /> Respond
                      </button>
                      <button
                        className="btn ghost"
                        style={{ color: 'var(--rose)' }}
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
          ))
        )}
      </div>
    </div>
  )
}