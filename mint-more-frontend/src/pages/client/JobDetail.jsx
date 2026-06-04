import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import { negotiationsApi } from '../../api/negotiations'
import { walletApi } from '../../api/wallet'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import StatusChip from '../../components/ui/StatusChip'
import Avatar from '../../components/ui/Avatar'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

// ── Progress timeline ─────────────────────────────────────────────────────────

const STAGES = [
  { key: 'draft',      label: 'Drafted' },
  { key: 'matching',   label: 'Matching' },
  { key: 'negotiating',label: 'Negotiating' },
  { key: 'in_progress',label: 'In progress' },
  { key: 'completed',  label: 'Completed' },
]

const STAGE_ORDER = {
  draft: 0, open: 1, matching: 1,
  locked: 2, negotiating: 2, pending_admin_approval: 2,
  assigned: 3, in_progress: 3,
  completed: 4, cancelled: -1,
}

const NEGOTIATION_MAX_ROUNDS = 6

const talentPoolLabel = (mode) => mode === 'expert' ? 'Pro creatives' : 'Budget creatives'

function Timeline({ status }) {
  const current = STAGE_ORDER[status] ?? 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '18px 22px',
      background: 'var(--paper)',
      border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'auto',
    }}>
      {STAGES.map((stage, i) => {
        const done    = current > i
        const active  = current === i
        const pending = current < i
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 'none', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--ink-950)' : active ? 'var(--mint-500)' : 'var(--paper-tint)',
                border: `2px solid ${done ? 'var(--ink-950)' : active ? 'var(--mint-500)' : 'var(--hairline-strong)'}`,
                color: done || active ? 'white' : 'var(--ink-400)',
                transition: 'all 0.2s ease',
              }}>
                {done
                  ? <Icon name="check" size={12} strokeWidth={2.5} />
                  : active
                  ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                  : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-300)' }} />
                }
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: active ? 600 : 400,
                color: active ? 'var(--ink-950)' : done ? 'var(--ink-700)' : 'var(--ink-400)',
                whiteSpace: 'nowrap',
              }}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 6px',
                marginBottom: 20,
                background: done ? 'var(--ink-950)' : 'var(--hairline)',
                transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Matching animation panel ──────────────────────────────────────────────────

function MatchingPanel({ job }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)
  const candidates = job.matched_candidates || []

  const pauseMutation = useMutation({
    mutationFn: () => jobsApi.pauseMatching(job.id),
    onSuccess: () => {
      pushToast({
        title: 'Matching paused',
        body: 'You can edit the brief now.',
        icon: 'check',
      })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => {
      pushToast({
        title: 'Could not pause matching',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  const editMutation = useMutation({
    mutationFn: () => jobsApi.pauseMatching(job.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/jobs/${job.id}/edit`)
    },
    onError: (err) => {
      pushToast({
        title: 'Could not open editor',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  const isActionPending = pauseMutation.isPending || editMutation.isPending

  const actionButtons = (style = {}) => (
    <div className="row" style={{ gap: 10, justifyContent: 'center', ...style }}>
      <button
        className="btn ghost"
        onClick={() => pauseMutation.mutate()}
        disabled={isActionPending}
      >
        {pauseMutation.isPending ? 'Pausing...' : 'Pause matching'}
      </button>
      <button
        className="btn ghost"
        onClick={() => editMutation.mutate()}
        disabled={isActionPending}
      >
        <Icon name="edit" size={13} />
        {editMutation.isPending ? 'Opening...' : 'Edit brief'}
      </button>
    </div>
  )

  return (
    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
      {/* Radar animation */}
      <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 28px' }}>
        {[120, 90, 60].map((size, i) => (
          <div key={size} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size, height: size,
            borderRadius: '50%',
            border: `1.5px solid var(--mint-${i === 0 ? '200' : i === 1 ? '300' : '400'})`,
            animation: `pulse ${1.8 + i * 0.4}s ease-out infinite`,
            animationDelay: `${i * 0.3}s`,
            opacity: 0.7,
          }} />
        ))}
        {/* Orbiting dots */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 120, height: 120,
          transform: 'translate(-50%, -50%)', animation: 'spin 4s linear infinite' }}>
          <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%', background: 'var(--mint-500)' }} />
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 90, height: 90,
          transform: 'translate(-50%, -50%)', animation: 'spin 3s linear infinite reverse' }}>
          <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
            width: 6, height: 6, borderRadius: '50%', background: 'var(--mint-400)' }} />
        </div>
        {/* Core */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--mint-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 0 0 6px rgba(16,185,129,0.15)',
        }}>
          <Icon name="radar" size={18} />
        </div>
      </div>

      <div className="h-eyebrow" style={{ color: 'var(--mint-700)', marginBottom: 8 }}>MATCHING NOW</div>
      <h2 className="h-display h-2" style={{ margin: '0 0 8px' }}>Finding the right creative.</h2>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.6 }}>
        We're scanning 2,400+ verified {job.category?.name?.toLowerCase() || 'creative'}s across India.
        Average match time is ~6 minutes.
      </p>

      {candidates.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint-500)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              <strong>{candidates.length}</strong> of 4 creatives short-listed
            </span>
            <span className="muted" style={{ fontSize: 12 }}>~ 3 min remaining</span>
          </div>
          {actionButtons({ marginBottom: 24 })}
          <div style={{ textAlign: 'left', marginTop: 4 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>SHORT-LIST ({candidates.length})</div>
            <div className="stack" style={{ gap: 8 }}>
              {candidates.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: 'var(--paper-tint)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <Avatar name={c.freelancer?.full_name || 'F'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-950)' }}>
                      {c.freelancer?.full_name || 'Matched creative'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                      {c.freelancer?.tagline || c.freelancer?.bio?.slice(0, 60) || 'Creative professional'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mint-700)' }}>
                      {Math.round((c.score || 0.88) * 100)}% fit
                    </div>
                    {c.freelancer?.average_rating && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
                        {c.freelancer.average_rating} ★ ({c.freelancer.review_count || 0})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {candidates.length === 0 && (
        actionButtons({ marginTop: 4 })
      )}
    </div>
  )
}

// ── Negotiation panel ─────────────────────────────────────────────────────────

function ClientNegotiationPanel({ job }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)
  const [showCounter, setShowCounter] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterDays, setCounterDays] = useState('')
  const [counterMsg, setCounterMsg] = useState('')
  const [pendingCounter, setPendingCounter] = useState(null)

  const { data: negotiationData } = useQuery({
    queryKey: ['negotiation-status', job.id],
    queryFn: async () => {
      const res = await negotiationsApi.getStatus(job.id)
      return res.data?.data || null
    },
    enabled: Boolean(job.id) && ['locked', 'negotiating', 'pending_admin_approval'].includes(job.status),
    refetchInterval: 2500,
  })

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => walletApi.get().then(r => r.data?.data),
  })

  const neg = negotiationData?.negotiation || job.negotiation
  const freelancer =
    job.active_freelancer ||
    job.matched_freelancer ||
    job.primary_freelancer ||
    job.primary_candidate ||
    {}
  const freelancerName = freelancer.full_name || freelancer.name || 'Creative'

  const acceptMutation = useMutation({
    mutationFn: () => negotiationsApi.clientRespond(job.id, { action: 'accept' }),
    onSuccess: () => {
      pushToast({ title: 'Deal sent for admin approval', body: 'Escrow will be held after approval.', icon: 'shield' })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      queryClient.invalidateQueries({ queryKey: ['negotiation-status', job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })

  const counterMutation = useMutation({
    mutationFn: () =>
      negotiationsApi.clientRespond(job.id, {
        action: 'counter',
        proposed_price: parseFloat(counterPrice),
        proposed_days: parseInt(counterDays, 10),
        message: counterMsg || undefined,
      }),
    onSuccess: () => {
      pushToast({ title: 'Counter offer sent', body: `Waiting for ${freelancerName.split(' ')[0]} to respond.`, icon: 'refresh' })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      queryClient.invalidateQueries({ queryKey: ['negotiation-status', job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setShowCounter(false)
      setCounterPrice('')
      setCounterDays('')
      setCounterMsg('')
    },
    onError: (err) => pushToast({ title: 'Counter failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => negotiationsApi.clientRespond(job.id, { action: 'reject' }),
    onSuccess: () => {
      pushToast({ title: 'Offer declined', body: 'Job will be re-matched.', icon: 'refresh' })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      queryClient.invalidateQueries({ queryKey: ['negotiation-status', job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })

  const getSender = (round) => round?.sender_role || round?.sender
  const rounds = neg?.rounds || []
  const displayedRounds = pendingCounter ? [...rounds, pendingCounter] : rounds
  const lastRound = rounds[rounds.length - 1]
  const maxRounds = Math.max(Number(neg?.max_rounds) || 0, NEGOTIATION_MAX_ROUNDS)
  const currentRound = neg?.current_round || Math.max(1, rounds.length)
  const isMyTurn = !pendingCounter && neg?.status === 'active' && getSender(lastRound) === 'freelancer'
  const isWaitingOnFreelancer = neg?.status === 'active' && getSender(lastRound) === 'client'
  const isPendingAdmin = job.status === 'pending_admin_approval'
  const isAgreed = neg?.status === 'agreed'
  const isRejected = neg?.status === 'failed'
  const canCounter = currentRound < maxRounds
  const agreedPrice = neg?.agreed_price || lastRound?.proposed_price || 0
  const agreedDays = neg?.agreed_days || lastRound?.proposed_days || 0
  const walletBalance = Number(walletData?.wallet?.balance ?? 0)
  const lastOfferPrice = Number(lastRound?.proposed_price || 0)
  const counterOfferPrice = Number(counterPrice || 0)
  const canFundLastOffer = walletBalance >= lastOfferPrice
  const canFundCounter = counterOfferPrice > 0 && walletBalance >= counterOfferPrice

  useEffect(() => {
    if (!pendingCounter) return
    const saved = rounds.some((round) =>
      getSender(round) === 'client' &&
      Number(round.proposed_price) === Number(pendingCounter.proposed_price) &&
      Number(round.proposed_days) === Number(pendingCounter.proposed_days)
    )
    if (saved) setPendingCounter(null)
  }, [pendingCounter, rounds])

  if (!neg) {
    return (
      <div className="card reveal" style={{ padding: 22 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Negotiation</div>
        <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', fontSize: 13, color: 'var(--ink-600)' }}>
          {job.status === 'locked'
            ? 'A creative has been matched. Negotiation starting soon...'
            : 'Negotiation details will appear here.'}
        </div>
      </div>
    )
  }

  const sendCounter = () => {
    const proposedPrice = parseFloat(counterPrice)
    const proposedDays = parseInt(counterDays, 10)
    setPendingCounter({
      id: `pending-${Date.now()}`,
      sender: 'client',
      round_number: currentRound + 1,
      proposed_price: proposedPrice,
      proposed_days: proposedDays,
      message: counterMsg || undefined,
      pending: true,
    })
    counterMutation.mutate()
  }

  return (
    <div className="card reveal" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 16, gap: 12, alignItems: 'flex-start' }}>
        <div>
          <span className="h-eyebrow">Negotiation</span>
          <h3 className="h-display h-3" style={{ margin: '2px 0 0' }}>
            {isPendingAdmin || isAgreed
              ? 'Deal waiting for admin approval'
              : isMyTurn
                ? 'Counter offer is on the table'
                : 'Waiting for creative response'}
          </h3>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {Array.from({ length: maxRounds }).map((_, i) => {
            const roundNumber = i + 1
            const done = roundNumber < currentRound || displayedRounds.length >= roundNumber
            const active = roundNumber === currentRound
            return (
              <div key={roundNumber} className={`nego-round ${done ? 'done' : active ? 'current' : ''}`}>
                {roundNumber}
              </div>
            )
          })}
        </div>
      </div>

      {(isPendingAdmin || isAgreed) && (
        <div className="card-mint" style={{ marginBottom: 14, padding: 14, animation: 'slideIn 0.32s ease' }}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--mint-200)', color: 'var(--mint-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="shield" size={14} />
            </div>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--ink-950)' }}>Awaiting admin approval</div>
              <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 2 }}>
                Deal agreed at {rupee(agreedPrice)} in {agreedDays || '-'} days. Once approved, funds will be escrowed and {freelancerName.split(' ')[0]} can begin work.
              </div>
            </div>
          </div>
        </div>
      )}

      {displayedRounds.length > 0 ? (
        <div className="nego-board">
          {displayedRounds.map((round, i) => {
            const isClient = getSender(round) === 'client'
            return (
              <div key={round.id || i} className={`offer-card ${isClient ? 'me' : 'them'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11.5, color: 'var(--ink-500)' }}>
                  <Avatar name={isClient ? 'You' : freelancerName} size="sm" />
                  <span style={{ fontWeight: 500, color: 'var(--ink-700)' }}>
                    {isClient ? 'You' : freelancerName}
                  </span>
                  <span>{round.pending ? 'sending' : isClient ? 'countered' : 'proposed'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-500)' }}>
                    Round {round.round_number || i + 1}
                  </span>
                </div>
                <div className="offer-row">
                  <span className="big">{rupee(round.proposed_price || 0)}</span>
                  <span className="small">delivered in {round.proposed_days || '-'} days</span>
                </div>
                {round.message && <div className="msg">{round.message}</div>}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', fontSize: 13, color: 'var(--ink-600)' }}>
          A creative has been matched. Negotiation starting soon...
        </div>
      )}

      {isMyTurn && !showCounter && (
        <>
          <div className="row" style={{ marginTop: 16, gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canCounter && (
              <button className="btn ghost" onClick={() => {
                setCounterPrice(String(lastRound?.proposed_price || ''))
                setCounterDays(String(lastRound?.proposed_days || ''))
                setShowCounter(true)
              }}>
                <Icon name="refresh" size={13} /> Counter offer
              </button>
            )}
            <button className="btn mint" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || !canFundLastOffer}>
              <Icon name="check" size={13} />
              {acceptMutation.isPending ? 'Accepting...' : `Accept ${rupee(lastRound?.proposed_price || 0)}`}
            </button>
            <button className="btn ghost" style={{ color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Declining...' : 'Decline'}
            </button>
          </div>
          {!canFundLastOffer && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--amber)', textAlign: 'right' }}>
              Add {rupee(Math.max(0, lastOfferPrice - walletBalance))} to your wallet to accept this offer.
            </div>
          )}
        </>
      )}

      {showCounter && (
        <div style={{ marginTop: 16, padding: 14, background: 'white', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Your counter · Round {Math.min(maxRounds, currentRound + 1)}</div>
          <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field">
              <label className="field-label">Your price</label>
              <div className="input-with-prefix">
                <span className="prefix">₹</span>
                <input className="input input-mono" type="number" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} placeholder={String(lastRound?.proposed_price || '')} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Delivery (days)</label>
              <input className="input input-mono" type="number" value={counterDays} onChange={(e) => setCounterDays(e.target.value)} placeholder={String(lastRound?.proposed_days || '')} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Message (optional)</label>
            <textarea className="textarea" rows={2} value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} placeholder={`Add a note for ${freelancerName.split(' ')[0]}...`} />
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setShowCounter(false)}>Cancel</button>
            <button className="btn primary" onClick={sendCounter} disabled={counterMutation.isPending || !counterPrice || !counterDays || !canFundCounter}>
              <Icon name="send" size={13} />
              {counterMutation.isPending ? 'Sending...' : 'Send counter'}
            </button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'right' }}>
            <Icon name="shield" size={10} /> Client gets 3 proposal turns. Creative gets 2 re-proposals.
          </div>
          {counterPrice && !canFundCounter && (
            <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 8, textAlign: 'right' }}>
              Add {rupee(Math.max(0, counterOfferPrice - walletBalance))} to your wallet to send this counter.
            </div>
          )}
        </div>
      )}

      {isWaitingOnFreelancer && (
        <div style={{ marginTop: 14, padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="typing-dots"><span /><span /><span /></span>
            Waiting for creative's response...
          </div>
        </div>
      )}

      {isRejected && (
        <div style={{ marginTop: 14, padding: 14, background: 'rgba(225,29,72,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(225,29,72,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rose)' }}>
            Negotiation ended · Re-matching in progress
          </div>
        </div>
      )}
    </div>
  )
}

function NegotiationPanel({ job }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)
  const [showCounter, setShowCounter] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterDays, setCounterDays] = useState('')
  const [counterMsg, setCounterMsg] = useState('')

  const neg = job.negotiation

  const acceptMutation = useMutation({
    mutationFn: () =>
      negotiationsApi.clientRespond(job.id, { action: 'accept' }),
    onSuccess: () => {
      pushToast({
        title: 'Offer accepted!',
        body: 'Waiting for admin approval',
        icon: 'check',
      })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
    },
    onError: (err) => {
      pushToast({
        title: 'Failed',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  const counterMutation = useMutation({
    mutationFn: () =>
      negotiationsApi.clientRespond(job.id, {
        action: 'counter',
        proposed_price: parseFloat(counterPrice),
        proposed_days: parseInt(counterDays, 10),
        message: counterMsg || undefined,
      }),
    onSuccess: () => {
      pushToast({
        title: 'Counter sent',
        body: 'Waiting for freelancer response',
        icon: 'refresh',
      })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      setShowCounter(false)
      setCounterPrice('')
      setCounterDays('')
      setCounterMsg('')
    },
    onError: (err) => {
      pushToast({
        title: 'Counter failed',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      negotiationsApi.clientRespond(job.id, { action: 'reject' }),
    onSuccess: () => {
      pushToast({
        title: 'Offer declined',
        body: 'Job will be re-matched',
        icon: 'refresh',
      })
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
    },
    onError: (err) => {
      pushToast({
        title: 'Failed',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  if (!neg)
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>
          Negotiation
        </div>
        <div
          style={{
            padding: 14,
            background: 'var(--paper-tint)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--hairline)',
            fontSize: 13,
            color: 'var(--ink-600)',
          }}
        >
          {job.status === 'locked'
            ? 'A creative has been matched. Negotiation starting soon...'
            : 'Negotiation details will appear here.'}
        </div>
      </div>
    )

  const rounds = neg.rounds || []
  const lastRound = rounds[rounds.length - 1]
  const isMyTurn =
    neg.status === 'active' && lastRound?.sender_role === 'freelancer'
  const isAgreed = neg.status === 'agreed'
  const isRejected = neg.status === 'failed'
  const isPendingAdmin = job.status === 'pending_admin_approval'

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="h-eyebrow">Negotiation</div>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            Round {neg.current_round || 1} of {neg.max_rounds || 2}
          </span>
          {Array.from({ length: neg.max_rounds || 2 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 6,
                borderRadius: 3,
                background:
                  i < (neg.current_round || 1)
                    ? 'var(--ink-950)'
                    : 'var(--hairline)',
              }}
            />
          ))}
        </div>
      </div>

      {rounds.length > 0 && (
        <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
          {rounds.map((r, i) => {
            const isClient = r.sender_role === 'client'
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  flexDirection: isClient ? 'row-reverse' : 'row',
                }}
              >
                <div
                  className="avatar sm"
                  style={{
                    background: isClient ? 'var(--ink-950)' : 'var(--mint-100)',
                    color: isClient ? 'white' : 'var(--mint-800)',
                    flexShrink: 0,
                  }}
                >
                  {isClient ? 'You' : 'C'}
                </div>
                <div
                  style={{
                    maxWidth: '72%',
                    padding: '12px 14px',
                    background: isClient ? 'var(--ink-950)' : 'var(--paper-tint)',
                    color: isClient ? 'white' : 'var(--ink-900)',
                    borderRadius: isClient ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    border: isClient ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  <div
                    style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}
                  >
                    ₹{Number(r.proposed_price || 0).toLocaleString('en-IN')}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        opacity: 0.7,
                        marginLeft: 8,
                      }}
                    >
                      · {r.proposed_days} days
                    </span>
                  </div>
                  {r.message && (
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.55,
                        opacity: 0.9,
                        marginTop: 4,
                      }}
                    >
                      {r.message}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isMyTurn && !showCounter && (
        <div
          style={{
            padding: 16,
            background: 'var(--paper-tint)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--hairline)',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>
            Creative offered ₹
            {Number(lastRound?.proposed_price || 0).toLocaleString('en-IN')} ·{' '}
            {lastRound?.proposed_days} days
          </div>
          {lastRound?.message && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginBottom: 12 }}>
              "{lastRound.message}"
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn primary"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              <Icon name="check" size={13} />
              {acceptMutation.isPending ? 'Accepting...' : 'Accept offer'}
            </button>
            {neg.current_round < (neg.max_rounds || 2) && (
              <button className="btn ghost" onClick={() => setShowCounter(true)}>
                Counter offer
              </button>
            )}
            <button
              className="btn ghost"
              style={{ color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.2)' }}
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Declining...' : 'Decline'}
            </button>
          </div>
        </div>
      )}

      {showCounter && (
        <div
          style={{
            padding: 16,
            background: 'var(--paper-tint)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--hairline)',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>
            Your counter offer
          </div>
          <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field">
              <label className="field-label">Your price (₹)</label>
              <input
                className="input"
                type="number"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                placeholder={String(lastRound?.proposed_price || '')}
              />
            </div>
            <div className="field">
              <label className="field-label">Delivery (days)</label>
              <input
                className="input"
                type="number"
                value={counterDays}
                onChange={(e) => setCounterDays(e.target.value)}
                placeholder={String(lastRound?.proposed_days || '')}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Message (optional)</label>
            <textarea
              className="textarea"
              rows={2}
              value={counterMsg}
              onChange={(e) => setCounterMsg(e.target.value)}
              placeholder="Explain your counter offer..."
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn primary"
              onClick={() => counterMutation.mutate()}
              disabled={
                counterMutation.isPending || !counterPrice || !counterDays
              }
            >
              {counterMutation.isPending ? 'Sending...' : 'Send counter'}
            </button>
            <button className="btn ghost" onClick={() => setShowCounter(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(isAgreed || isPendingAdmin) && (
        <div
          style={{
            padding: 14,
            background: 'rgba(16,185,129,0.08)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--mint-700)',
              marginBottom: 4,
            }}
          >
            ✓ Deal agreed at ₹
            {Number(neg.agreed_price || 0).toLocaleString('en-IN')} ·{' '}
            {neg.agreed_days} days
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            Waiting for admin approval · Escrow will be held on approval
          </div>
        </div>
      )}

      {isRejected && (
        <div
          style={{
            padding: 14,
            background: 'rgba(225,29,72,0.06)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(225,29,72,0.2)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rose)' }}>
            Negotiation ended · Re-matching in progress
          </div>
        </div>
      )}

      {neg.status === 'active' && lastRound?.sender_role === 'client' && (
        <div
          style={{
            padding: 14,
            background: 'var(--paper-tint)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--hairline)',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-600)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="typing-dots">
              <span />
              <span />
              <span />
            </span>
            Waiting for creative's response...
          </div>
        </div>
      )}
    </div>
  )
}

// ── In-progress panel ─────────────────────────────────────────────────────────

function InProgressPanel({ job, navigate }) {
  const freelancer = job.active_freelancer

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="h-eyebrow">Active project</div>
        <StatusChip status="in_progress" />
      </div>

      {freelancer && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, padding: '12px 14px', background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
          <Avatar name={freelancer.full_name} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-950)' }}>{freelancer.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{freelancer.tagline || 'Your assigned creative'}</div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint-500)' }} />
        </div>
      )}

      <button className="btn primary block" onClick={() => navigate('/chat')}>
        <Icon name="chat" /> Open messages
      </button>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => navigate(`/mintbox/jobs/${job.id}`)}>
        <Icon name="layers" /> Open Mintbox
      </button>
    </div>
  )
}

// ── Completed panel ───────────────────────────────────────────────────────────

function CompletedPanel({ job }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mint-100)', color: 'var(--mint-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={16} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-950)', marginBottom: 4 }}>Project completed</div>
          <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.55 }}>
            Escrow has been released to the creative. Leave a review to help others find the right match.
          </div>
          <button className="btn primary" style={{ marginTop: 14 }}>
            <Icon name="star" /> Leave a review
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function JobDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await jobsApi.get(id)
      const d   = res.data
      const job = d?.data?.job ?? d?.data ?? null
      if (!job || !job.id) throw new Error('Job not found')
      return job
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => jobsApi.publish(id),
    onSuccess: () => {
      pushToast({
        title: 'Brief published',
        body: 'Matching creatives now - ~6 min',
        icon: 'radar',
      })
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err) => {
      pushToast({
        title: 'Could not publish',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  if (isLoading) return (
    <div className="stack-6">
      <div style={{ height: 40 }}><div className="skeleton" style={{ width: 120, height: 14, borderRadius: 6 }} /></div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )

  if (!job) return (
    <div className="empty">
      <h3>Job not found</h3>
      <button className="btn ghost" onClick={() => navigate('/jobs')}>Back to jobs</button>
    </div>
  )

  const isMatching    = ['open','matching'].includes(job.status)
  const isNegotiating = ['locked','negotiating','pending_admin_approval'].includes(job.status)
  const isInProgress  = ['assigned','in_progress'].includes(job.status)
  const isCompleted   = job.status === 'completed'

  return (
    <div className="stack-6">

      {/* Header */}
      <div className="reveal" data-d="0">
        <button
          className="btn link sm"
          onClick={() => navigate('/jobs')}
          style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12, marginBottom: 10 }}
        >
          <Icon name="arrowLeft" size={12} /> All jobs
        </button>
        <div className="row" style={{ gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {job.category?.name && <span className="badge neutral">{job.category.name}</span>}
          <StatusChip status={job.status} />
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            Posted {job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
          </span>
        </div>
        <h1 className="h-display" style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {job.title}
        </h1>
      </div>

      {/* Timeline */}
      <div className="reveal" data-d="1">
        <Timeline status={job.status} />
      </div>

      {/* Body: 2-col layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: 18,
        alignItems: 'start',
      }}>

        {/* Left column */}
        <div className="stack" style={{ gap: 14 }}>

          {/* Status-specific main panel */}
          {isMatching    && <MatchingPanel job={job} />}
          {isNegotiating && <ClientNegotiationPanel job={job} />}
          {isInProgress  && <InProgressPanel job={job} navigate={navigate} />}
          {isCompleted   && <CompletedPanel job={job} />}

          {/* The brief */}
          <div className="card reveal" data-d="2" style={{ padding: 22 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              The brief
            </h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-700)', margin: '0 0 16px' }}>
              {job.description}
            </p>

            {/* Skills tags */}
            {job.required_skills?.length > 0 && (
              <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
                {job.required_skills.map(s => (
                  <span key={s} className="badge neutral" style={{ padding: '5px 10px', fontSize: 12 }}>{s}</span>
                ))}
              </div>
            )}

            {/* Attachments */}
            {job.attachments?.length > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--hairline)', margin: '16px 0' }} />
                <div className="h-eyebrow" style={{ marginBottom: 8 }}>Attachments</div>
                <div className="row wrap" style={{ gap: 8 }}>
                  {job.attachments.map((a, i) => (
                    <a key={i} href={a.url || '#'} target="_blank" rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', fontSize: 12.5, fontWeight: 400,
                        background: 'var(--paper-tint)', border: '1px solid var(--hairline)',
                        borderRadius: 'var(--radius-md)', color: 'var(--ink-800)',
                        textDecoration: 'none', cursor: 'pointer',
                      }}>
                      <Icon name="paperclip" size={12} />
                      {typeof a === 'string' ? a : a.name || `File ${i + 1}`}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="stack" style={{ gap: 14 }}>

          {/* At a glance */}
          <div className="card reveal" data-d="3" style={{ padding: 18 }}>
            <div className="h-eyebrow" style={{ marginBottom: 12 }}>At a glance</div>
            <div className="stack" style={{ gap: 12 }}>

              <div className="row between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--ink-500)' }}>Status</span>
                <StatusChip status={job.status} />
              </div>

              <div style={{ height: 1, background: 'var(--hairline)' }} />

              <div className="row between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--ink-500)' }}>Creative pool</span>
                <span>{talentPoolLabel(job.pricing_mode)}</span>
              </div>

              {job.deadline && (
                <div className="row between" style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--ink-500)' }}>Deadline</span>
                  <span>{new Date(job.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              )}

              <div className="row between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--ink-500)' }}>Pricing</span>
                <span>Freelancers quote first</span>
              </div>

            </div>
          </div>

          {/* Assigned freelancer (if any) */}
          {job.active_freelancer && (
            <div className="card reveal" data-d="4" style={{ padding: 18 }}>
              <div className="h-eyebrow" style={{ marginBottom: 12 }}>Assigned creative</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar name={job.active_freelancer.full_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-950)' }}>
                    {job.active_freelancer.full_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                    {job.active_freelancer.tagline || 'Creative professional'}
                  </div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint-500)', flexShrink: 0 }} />
              </div>
              {job.active_freelancer.average_rating > 0 && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-600)' }}>
                  ★ {job.active_freelancer.average_rating} · {job.active_freelancer.review_count} reviews
                </div>
              )}
            </div>
          )}

          {/* Escrow info (if deal approved) */}
          {['assigned','in_progress','completed'].includes(job.status) && (
            <div className="card reveal" data-d="5" style={{ padding: 18 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div className="h-eyebrow">Escrow</div>
                <Icon name="shield" size={13} style={{ color: 'var(--mint-600)' }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.55 }}>
                {isCompleted
                  ? 'Funds have been released to the creative.'
                  : `${rupee(job.negotiation?.agreed_price || job.agreed_price || 0)} is securely held. Released only on your approval.`
                }
              </div>
            </div>
          )}

          {/* Actions */}
          {job.status === 'draft' && (
            <div className="card reveal" data-d="5" style={{ padding: 18 }}>
              <div className="h-eyebrow" style={{ marginBottom: 12 }}>Actions</div>
              <div className="stack" style={{ gap: 8 }}>
                <button
                  className="btn primary block"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                >
                  <Icon name="radar" /> {publishMutation.isPending ? 'Publishing...' : 'Publish brief'}
                </button>
                <button
                  className="btn ghost block"
                  onClick={() => navigate(`/jobs/${job.id}/edit`)}
                  disabled={publishMutation.isPending}
                >
                  <Icon name="edit" /> Edit brief
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
