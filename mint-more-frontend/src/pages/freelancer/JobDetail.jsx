import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import { negotiationsApi } from '../../api/negotiations'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import StatusChip from '../../components/ui/StatusChip'
import Avatar from '../../components/ui/Avatar'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const normalizeLevel = (level) => {
	if (level === 'basic') return 'beginner'
	if (level === 'expert') return 'experienced'
	return level || 'beginner'
}

const levelLabel = (level) => {
	const normalized = normalizeLevel(level)
	if (normalized === 'experienced') return 'Expert'
	return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const getMarketRangeFromResponse = (res) =>
	res.data?.data?.range ?? res.data?.data?.data?.range ?? res.data?.range ?? null

const NEGOTIATION_MAX_ROUNDS = 6

const talentPoolLabel = (mode) => mode === 'expert' ? 'Pro creatives' : 'Budget creatives'

export default function FreelancerJobDetail() {
	const { id } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const user = useAuthStore((s) => s.user)
	const userId = user?.id

	const { data: job, isLoading } = useQuery({
		queryKey: ['job', id],
		queryFn: async () => {
			const res = await jobsApi.get(id)
			const d = res.data
			return d?.data?.job ?? d?.data ?? null
		},
	})

	if (isLoading)
		return (
			<div className="stack-6">
				<SkeletonCard />
				<SkeletonCard />
			</div>
		)

	if (!job)
		return (
			<div className="empty">
				<h3>Brief not found</h3>
				<button className="btn ghost" onClick={() => navigate('/jobs')}>
					Back
				</button>
			</div>
		)

	const primaryId =
		job.primary_candidate_id ||
		job.primary_freelancer_id ||
		job.primary_freelancer?.id ||
		job.primary_candidate?.id ||
		null
	const isPrimaryCandidate = primaryId ? primaryId === userId : true
	const canInitiate = ['open', 'matching'].includes(job.status) && isPrimaryCandidate
	const isNegotiating = ['locked', 'negotiating'].includes(job.status)
	const isAssigned = job.status === 'assigned'
	const isInProgress = job.status === 'in_progress'
	const activeCountRaw = Number(job.active_jobs_count)
	const activeCount = Number.isFinite(activeCountRaw) ? activeCountRaw : 0
	const availableSlots = Math.max(0, 5 - activeCount)
	const capacityPct = Math.min(100, (activeCount / 5) * 100)

	return (
		<div className="stack-6">
			<div className="reveal">
				<button
					className="btn link sm"
					onClick={() => navigate('/jobs')}
					style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12, marginBottom: 10 }}
				>
					<Icon name="arrowLeft" size={12} /> All briefs
				</button>
				<div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
					{job.category?.name && <span className="badge neutral">{job.category.name}</span>}
					<StatusChip status={job.status} />
				</div>
				<h1 className="h-display" style={{ fontSize: 28, margin: 0, letterSpacing: '-0.02em' }}>
					{job.title}
				</h1>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'minmax(0,1fr) 280px',
					gap: 18,
					alignItems: 'start',
				}}
			>
				<div className="stack" style={{ gap: 14 }}>
					{canInitiate && (
						<InitiatePanel job={job} user={user} queryClient={queryClient} pushToast={pushToast} />
					)}

					{!canInitiate && ['open', 'matching'].includes(job.status) && !isPrimaryCandidate && (
						<div className="card" style={{ padding: 22 }}>
							<div className="h-eyebrow" style={{ marginBottom: 10 }}>
								Negotiation locked
							</div>
							<div style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.55 }}>
								You are not the primary candidate for this brief. If the primary candidate does not respond, you may be notified.
							</div>
						</div>
					)}

					{isNegotiating && (
						<FreelancerNegotiatePanel job={job} queryClient={queryClient} pushToast={pushToast} />
					)}

					{isAssigned && (
						<AssignmentPanel
							job={job}
							queryClient={queryClient}
							pushToast={pushToast}
							navigate={navigate}
						/>
					)}

					{isInProgress && (
						<div className="card" style={{ padding: 22 }}>
							<div className="h-eyebrow" style={{ marginBottom: 10 }}>Active project</div>
							<p style={{ fontSize: 13.5, color: 'var(--ink-700)', marginBottom: 14 }}>
								Work is in progress. Chat with the client and deliver your work.
							</p>
							<button className="btn primary" onClick={() => navigate('/chat')}>
								<Icon name="chat" /> Open messages
							</button>
							<button className="btn ghost" style={{ marginLeft: 10 }} onClick={() => navigate(`/mintbox/jobs/${job.id}`)}>
								<Icon name="upload" /> Submit work
							</button>
						</div>
					)}

					<div className="card reveal" style={{ padding: 22 }}>
						<h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 12px' }}>
							The brief
						</h3>
						<p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-700)', margin: 0 }}>
							{job.description}
						</p>
						{job.required_skills?.length > 0 && (
							<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
								{job.required_skills.map((s) => (
									<span key={s} className="badge neutral" style={{ padding: '5px 10px', fontSize: 12 }}>
										{s}
									</span>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="stack" style={{ gap: 14 }}>
					<div className="card reveal" style={{ padding: 18 }}>
						<div className="h-eyebrow" style={{ marginBottom: 12 }}>Brief details</div>
						<div className="stack" style={{ gap: 10, fontSize: 13 }}>
							<div className="row between">
								<span style={{ color: 'var(--ink-500)' }}>Creative pool</span>
								<span>{talentPoolLabel(job.pricing_mode)}</span>
							</div>
							<div style={{ height: 1, background: 'var(--hairline)' }} />
							{job.deadline && (
								<div className="row between">
									<span style={{ color: 'var(--ink-500)' }}>Deadline</span>
									<span>
										{new Date(job.deadline).toLocaleDateString('en-IN', {
											day: 'numeric',
											month: 'short',
											year: 'numeric',
										})}
									</span>
								</div>
							)}
							<div className="row between">
								<span style={{ color: 'var(--ink-500)' }}>Pricing mode</span>
								<span>Quote first</span>
							</div>
						</div>
					</div>

					<div className="card reveal" style={{ padding: 18 }}>
						<div className="row between" style={{ marginBottom: 10 }}>
							<div className="h-eyebrow">Capacity</div>
							<span style={{ fontSize: 12, fontWeight: 500 }}>
								{activeCount} / 5
							</span>
						</div>
						<div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
							<div
								style={{
									height: '100%',
									borderRadius: 3,
									width: `${capacityPct}%`,
									background:
										activeCount >= 4 ? 'var(--rose)' : 'var(--mint-500)',
									transition: 'width 0.3s ease',
								}}
							/>
						</div>
						<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>
							{availableSlots} slot{availableSlots !== 1 ? 's' : ''} available
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function InitiatePanel({ job, user, queryClient, pushToast }) {
	const [price, setPrice] = useState('')
	const [days, setDays] = useState('')
	const [message, setMessage] = useState('')
	const [confirm, setConfirm] = useState(false)
	const freelancerLevel = normalizeLevel(user?.freelancer_level)
	const marketPricingMode = freelancerLevel === 'experienced' ? 'expert' : 'budget'
	const priceValue = Number(price)
	const hasPrice = Number.isFinite(priceValue) && priceValue > 0

	const { data: marketRange } = useQuery({
		queryKey: ['market-range', job.category_id, marketPricingMode],
		queryFn: async () => getMarketRangeFromResponse(await jobsApi.marketRange(job.category_id, marketPricingMode)),
		enabled: Boolean(job.category_id),
	})

	const levelRange = marketRange?.breakdown?.[freelancerLevel] || null
	const marketMin = Number(levelRange?.min)
	const marketMax = Number(levelRange?.max)
	const hasMarketRange = Number.isFinite(marketMin) && Number.isFinite(marketMax)
	const outsideMarketRange = hasPrice && hasMarketRange && (priceValue < marketMin || priceValue > marketMax)
	const isExpert = freelancerLevel === 'experienced'
	const isPriceBlocked = outsideMarketRange && !isExpert

	const { mutate, isPending } = useMutation({
		mutationFn: () =>
			negotiationsApi.initiate(job.id, {
				proposed_price: parseFloat(price),
				proposed_days: parseInt(days, 10),
				message: message || undefined,
			}),
		onSuccess: () => {
			pushToast({ title: 'Negotiation initiated!', body: 'Job is now locked to you', icon: 'lock' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
			queryClient.invalidateQueries({ queryKey: ['jobs'] })
		},
		onError: (err) => {
			pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' })
		},
	})

	if (!confirm)
		return (
			<div className="card" style={{ padding: 22 }}>
				<div className="h-eyebrow" style={{ marginBottom: 10 }}>Start negotiation</div>
				<div
					style={{
						padding: 14,
						background: 'rgba(16,185,129,0.06)',
						borderRadius: 'var(--radius-md)',
						border: '1px solid rgba(16,185,129,0.2)',
						marginBottom: 16,
					}}
				>
					<div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--mint-800)', marginBottom: 4 }}>
						This brief is open to you
					</div>
					<div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.55 }}>
						Initiating locks this job to you for 2 rounds of negotiation. If no deal is reached, the job is re-matched.
					</div>
				</div>
				<button className="btn primary block" onClick={() => setConfirm(true)}>
					Initiate negotiation <Icon name="arrowRight" />
				</button>
			</div>
		)

	return (
		<div className="card" style={{ padding: 22 }}>
			<div className="row between" style={{ marginBottom: 16 }}>
				<div className="h-eyebrow">Your opening offer</div>
				<button className="btn link sm" style={{ padding: 0, fontSize: 12 }} onClick={() => setConfirm(false)}>
					Cancel
				</button>
			</div>

				<div className="stack" style={{ gap: 14 }}>
				<div className="grid-2" style={{ gap: 10 }}>
					<div className="field">
						<label className="field-label">Your price (Rs)</label>
						<input
							className="input"
							type="number"
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							placeholder={job.budget_amount ? String(job.budget_amount) : 'e.g. 15000'}
						/>
						{hasMarketRange && (
							<div
								style={{
									marginTop: 8,
									padding: '9px 11px',
									borderRadius: 'var(--radius-md)',
									border: outsideMarketRange
										? '1px solid rgba(245,158,11,0.35)'
										: '1px solid var(--hairline)',
									background: outsideMarketRange
										? 'rgba(245,158,11,0.08)'
										: 'var(--paper-tint)',
									color: outsideMarketRange ? 'var(--ink-800)' : 'var(--ink-600)',
									fontSize: 12,
									lineHeight: 1.45,
								}}
							>
								<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
									{outsideMarketRange && (
										<span
											aria-hidden="true"
											style={{
												width: 18,
												height: 18,
												borderRadius: '50%',
												background: 'var(--amber)',
												color: 'white',
												display: 'inline-flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontWeight: 700,
												flexShrink: 0,
											}}
										>
											!
										</span>
									)}
									<span>
										Market range for {levelLabel(freelancerLevel)}: {rupee(marketMin)} - {rupee(marketMax)}
										{isPriceBlocked && (
											<>
												<br />
												Your offer must stay within this range.
											</>
										)}
										{outsideMarketRange && isExpert && (
											<>
												<br />
												You can still quote this, but it may reduce your chances with the client.
											</>
										)}
									</span>
								</div>
							</div>
						)}
					</div>
					<div className="field">
						<label className="field-label">Delivery (days)</label>
						<input
							className="input"
							type="number"
							value={days}
							onChange={(e) => setDays(e.target.value)}
							placeholder="e.g. 7"
						/>
					</div>
				</div>

				<div className="field">
					<label className="field-label">Message to client (optional)</label>
					<textarea
						className="textarea"
						rows={3}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Introduce yourself and explain why you're the right fit..."
					/>
				</div>

				<button className="btn primary block" onClick={() => mutate()} disabled={isPending || !price || !days || isPriceBlocked}>
					{isPending ? 'Submitting...' : <>Submit offer - {price ? rupee(parseFloat(price)) : 'Rs -'} in {days || '-'} days</>}
				</button>
			</div>
		</div>
	)
}

function FreelancerNegotiatePanel({ job, queryClient, pushToast }) {
	const [showCounter, setShowCounter] = useState(false)
	const [price, setPrice] = useState('')
	const [days, setDays] = useState('')
	const [message, setMessage] = useState('')

	const { data: negotiationData } = useQuery({
		queryKey: ['negotiation-status', job.id],
		queryFn: async () => {
			const res = await negotiationsApi.getStatus(job.id)
			return res.data?.data || null
		},
		enabled: Boolean(job.id) && ['locked', 'negotiating', 'pending_admin_approval'].includes(job.status),
	})

	const neg = job.negotiation || negotiationData?.negotiation
	const getSender = (round) => round?.sender_role || round?.sender
	const rounds = neg?.rounds || []
	const lastRound = rounds[rounds.length - 1]
	const isMyTurn = neg?.status === 'active' && getSender(lastRound) === 'client'
	const maxRounds = Math.max(Number(neg?.max_rounds) || 0, NEGOTIATION_MAX_ROUNDS)
	const currentRound = neg?.current_round || Math.max(1, rounds.length)

	const acceptMutation = useMutation({
		mutationFn: () => negotiationsApi.freelancerRespond(job.id, { action: 'accept' }),
		onSuccess: () => {
			pushToast({ title: 'Offer accepted!', body: 'Waiting for admin approval', icon: 'check' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	const counterMutation = useMutation({
		mutationFn: () =>
			negotiationsApi.freelancerRespond(job.id, {
				action: 'counter',
				proposed_price: parseFloat(price),
				proposed_days: parseInt(days, 10),
				message: message || undefined,
			}),
		onSuccess: () => {
			pushToast({ title: 'Counter sent', body: 'Waiting for client response', icon: 'refresh' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
			setShowCounter(false)
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	const rejectMutation = useMutation({
		mutationFn: () => negotiationsApi.freelancerRespond(job.id, { action: 'reject' }),
		onSuccess: () => {
			pushToast({ title: 'Offer declined', icon: 'x' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	if (!neg) {
		return (
			<div className="card reveal" style={{ padding: 22 }}>
				<div className="h-eyebrow" style={{ marginBottom: 10 }}>Negotiation</div>
				<div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', fontSize: 13, color: 'var(--ink-600)' }}>
					Negotiation starting soon...
				</div>
			</div>
		)
	}

	return (
		<div className="card reveal" style={{ padding: 20 }}>
			<div className="row between" style={{ marginBottom: 16, gap: 12, alignItems: 'flex-start' }}>
				<div>
					<span className="h-eyebrow">Negotiation</span>
					<h3 className="h-display h-3" style={{ margin: '2px 0 0' }}>
						{isMyTurn ? 'Client countered your offer' : 'Waiting for client response'}
					</h3>
				</div>
				<div className="row" style={{ gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
					{Array.from({ length: maxRounds }).map((_, i) => {
						const roundNumber = i + 1
						const done = roundNumber < currentRound || rounds.length >= roundNumber
						const active = roundNumber === currentRound
						return (
							<div key={roundNumber} className={`nego-round ${done ? 'done' : active ? 'current' : ''}`}>
								{roundNumber}
							</div>
						)
					})}
				</div>
			</div>

			{rounds.length > 0 && (
				<div className="nego-board">
					{rounds.map((r, i) => {
						const isMe = getSender(r) === 'freelancer'
						return (
							<div key={r.id || i} className={`offer-card ${isMe ? 'me' : 'them'}`}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11.5, color: 'var(--ink-500)' }}>
									<Avatar name={isMe ? 'You' : 'Client'} size="sm" />
									<span style={{ fontWeight: 500, color: 'var(--ink-700)' }}>
										{isMe ? 'You' : 'Client'}
									</span>
									<span>{isMe ? 'proposed' : 'countered'}</span>
									<span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-500)' }}>
										Round {r.round_number || i + 1}
									</span>
								</div>
								<div className="offer-row">
									<span className="big">{rupee(r.proposed_price || 0)}</span>
									<span className="small">delivered in {r.proposed_days || '-'} days</span>
								</div>
								{r.message && <div className="msg">{r.message}</div>}
							</div>
						)
					})}
				</div>
			)}

			{isMyTurn && !showCounter && (
				<div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
					<div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 12 }}>
						Client countered: {rupee(lastRound.proposed_price)} - {lastRound.proposed_days} days
					</div>
					<div className="row" style={{ gap: 8 }}>
						<button className="btn primary" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
							<Icon name="check" size={13} />
							{acceptMutation.isPending ? 'Accepting...' : 'Accept'}
						</button>
						{currentRound < maxRounds && (
							<button className="btn ghost" onClick={() => setShowCounter(true)}>Counter</button>
						)}
						<button className="btn ghost" style={{ color: 'var(--rose)' }} onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
							{rejectMutation.isPending ? '...' : 'Decline'}
						</button>
					</div>
				</div>
			)}

			{showCounter && (
				<div style={{ padding: 16, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
					<div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>Your counter</div>
					<div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
						<div className="field">
							<label className="field-label">Price (Rs)</label>
							<input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
						</div>
						<div className="field">
							<label className="field-label">Days</label>
							<input className="input" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
						</div>
					</div>
					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label">Message (optional)</label>
						<textarea className="textarea" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
					</div>
					<div className="row" style={{ gap: 8 }}>
						<button className="btn primary" onClick={() => counterMutation.mutate()} disabled={counterMutation.isPending || !price || !days}>
							{counterMutation.isPending ? 'Sending...' : 'Send counter'}
						</button>
						<button className="btn ghost" onClick={() => setShowCounter(false)}>Cancel</button>
					</div>
				</div>
			)}

			{neg.status === 'active' && getSender(lastRound) === 'freelancer' && (
				<div
					style={{
						padding: 12,
						background: 'var(--paper-tint)',
						borderRadius: 'var(--radius-md)',
						border: '1px solid var(--hairline)',
						display: 'flex',
						gap: 10,
						alignItems: 'center',
					}}
				>
					<span className="typing-dots">
						<span />
						<span />
						<span />
					</span>
					<span style={{ fontSize: 13, color: 'var(--ink-600)' }}>
						Waiting for client response...
					</span>
				</div>
			)}

			{neg.status === 'agreed' && (
				<div style={{ padding: 14, background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.25)' }}>
					<div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--mint-700)' }}>
						Deal agreed - waiting for admin approval
					</div>
				</div>
			)}
		</div>
	)
}

function AssignmentPanel({ job, queryClient, pushToast, navigate }) {
	const neg = job.negotiation

	const acceptMutation = useMutation({
		mutationFn: () => negotiationsApi.assignmentRespond(job.id, 'accept'),
		onSuccess: () => {
			pushToast({ title: 'Assignment accepted!', body: 'Project is now in progress', icon: 'check' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	const declineMutation = useMutation({
		mutationFn: () => negotiationsApi.assignmentRespond(job.id, 'decline'),
		onSuccess: () => {
			pushToast({ title: 'Assignment declined', body: 'Job will be re-matched', icon: 'refresh' })
			queryClient.invalidateQueries({ queryKey: ['job', job.id] })
			navigate('/jobs')
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	return (
		<div className="card" style={{ padding: 22 }}>
			<div className="h-eyebrow" style={{ marginBottom: 14 }}>Assignment ready</div>
			<div
				style={{
					padding: 16,
					background: 'rgba(16,185,129,0.08)',
					borderRadius: 'var(--radius-md)',
					border: '1px solid rgba(16,185,129,0.25)',
					marginBottom: 18,
				}}
			>
				<div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mint-800)', marginBottom: 6 }}>
					Admin approved this deal
				</div>
				{neg?.agreed_price && (
					<div style={{ fontSize: 13, color: 'var(--ink-700)' }}>
						<span className="mono" style={{ fontWeight: 600 }}>{rupee(neg.agreed_price)}</span>
						<span style={{ color: 'var(--ink-500)' }}> - {neg.agreed_days} days delivery</span>
					</div>
				)}
				<div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 8 }}>
					Escrow is held. On job completion, funds are released to your wallet.
				</div>
			</div>
			<div className="row" style={{ gap: 10 }}>
				<button className="btn primary" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
					<Icon name="check" size={13} />
					{acceptMutation.isPending ? 'Accepting...' : 'Accept assignment'}
				</button>
				<button className="btn ghost" style={{ color: 'var(--rose)' }} onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending}>
					{declineMutation.isPending ? '...' : 'Decline'}
				</button>
			</div>
		</div>
	)
}
