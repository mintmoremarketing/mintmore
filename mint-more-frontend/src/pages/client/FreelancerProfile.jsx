import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { freelancersApi } from '../../api/freelancers'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

function Stars({ rating, max = 5, size = 13 }) {
	return (
		<div style={{ display: 'flex', gap: 2 }}>
			{Array.from({ length: max }).map((_, i) => (
				<svg key={i} width={size} height={size} viewBox="0 0 16 16" fill="none">
					<path
						d="M8 1.5l2 4.5 5 .5-3.5 3 1 5L8 12l-4.5 2.5 1-5L1 6.5l5-.5z"
						fill={i < Math.round(rating) ? '#F59E0B' : 'var(--hairline-strong)'}
						stroke="none"
					/>
				</svg>
			))}
		</div>
	)
}

function RatingBar({ label, value }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
			<span style={{ color: 'var(--ink-600)', width: 110, flexShrink: 0 }}>{label}</span>
			<div style={{ flex: 1, height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
				<div
					style={{
						height: '100%',
						borderRadius: 3,
						width: `${(Number(value) / 5) * 100}%`,
						background: '#F59E0B',
						transition: 'width 0.4s ease',
					}}
				/>
			</div>
			<span className="mono" style={{ fontWeight: 500, width: 30, textAlign: 'right' }}>
				{Number(value).toFixed(1)}
			</span>
		</div>
	)
}

function PackageTab({ pkg, onInquire }) {
	const inclusions = pkg.inclusions || {}

	return (
		<div className="stack" style={{ gap: 14, padding: 4 }}>
			<div>
				<div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em' }}>
					{rupee(pkg.price)}
				</div>
				<div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 4 }}>{pkg.name}</div>
			</div>

			<p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.6, margin: 0 }}>
				{pkg.description}
			</p>

			<div className="stack" style={{ gap: 8 }}>
				<div className="row between" style={{ fontSize: 13 }}>
					<span style={{ color: 'var(--ink-600)', display: 'flex', gap: 6 }}>
						<Icon name="clock" size={13} /> Delivery
					</span>
					<span style={{ fontWeight: 500 }}>{pkg.delivery_days} days</span>
				</div>
				<div className="row between" style={{ fontSize: 13 }}>
					<span style={{ color: 'var(--ink-600)', display: 'flex', gap: 6 }}>
						<Icon name="refresh" size={13} /> Revisions
					</span>
					<span style={{ fontWeight: 500 }}>{pkg.revisions}</span>
				</div>

				{Object.entries(inclusions).map(([key, val]) => (
					<div key={key} className="row between" style={{ fontSize: 13 }}>
						<span style={{ color: 'var(--ink-600)', textTransform: 'capitalize' }}>
							{key.replace(/_/g, ' ')}
						</span>
						<span style={{ fontWeight: 500 }}>
							{typeof val === 'boolean' ? (
								val ? (
									<Icon name="check" size={13} style={{ color: 'var(--mint-600)' }} />
								) : (
									'-'
								)
							) : (
								String(val)
							)}
						</span>
					</div>
				))}
			</div>

			<button className="btn primary block" onClick={() => onInquire(pkg)} style={{ marginTop: 4 }}>
				Contact freelancer <Icon name="arrowRight" />
			</button>
		</div>
	)
}

function InquiryModal({ freelancer, selectedPackage, onClose, onSent }) {
	const pushToast = useUIStore((s) => s.pushToast)
	const [message, setMessage] = useState('')
	const [budget, setBudget] = useState(selectedPackage?.price || '')
	const [deadline, setDeadline] = useState('')

	const { mutate, isPending } = useMutation({
		mutationFn: () =>
			freelancersApi.sendInquiry({
				freelancer_id: freelancer.id,
				package_id: selectedPackage?.id || undefined,
				message,
				budget: budget ? parseFloat(budget) : undefined,
				deadline_days: deadline ? parseInt(deadline, 10) : undefined,
			}),
		onSuccess: () => {
			pushToast({
				title: 'Inquiry sent!',
				body: `${freelancer.full_name} will respond within ${
					freelancer.response_time_hours || 24
				}h`,
				icon: 'check',
			})
			onSent()
			onClose()
		},
		onError: (err) => {
			pushToast({
				title: 'Failed to send',
				body: err.response?.data?.message || 'Try again',
				tone: 'amber',
				icon: 'x',
			})
		},
	})

	return (
		<Modal
			title={`Contact ${freelancer.full_name}`}
			subtitle={
				selectedPackage
					? `Inquiring about: ${selectedPackage.name} - ${rupee(selectedPackage.price)}`
					: 'Direct inquiry'
			}
			onClose={onClose}
			maxWidth={460}
			footer={
				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
					<button className="btn ghost" onClick={onClose} disabled={isPending}>
						Cancel
					</button>
					<button
						className="btn primary"
						onClick={() => mutate()}
						disabled={isPending || message.trim().length < 10}
					>
						{isPending ? (
							'Sending...'
						) : (
							<>
								<Icon name="send" size={13} /> Send inquiry
							</>
						)}
					</button>
				</div>
			}
		>
			<div className="stack" style={{ gap: 14 }}>
				<div className="field">
					<label className="field-label">Your message</label>
					<textarea
						className="textarea"
						rows={5}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Describe your project, timeline, and any specific requirements..."
					/>
					<div
						style={{
							fontSize: 11.5,
							color: message.length < 10 ? 'var(--rose)' : 'var(--ink-400)',
							marginTop: 4,
						}}
					>
						{message.length < 10
							? `${10 - message.length} more characters needed`
							: `${message.length} characters`}
					</div>
				</div>

				<div className="grid-2" style={{ gap: 10 }}>
					<div className="field">
						<label className="field-label">Your budget (Rs)</label>
						<input
							className="input"
							type="number"
							value={budget}
							onChange={(e) => setBudget(e.target.value)}
							placeholder="Optional"
						/>
					</div>
					<div className="field">
						<label className="field-label">Deadline (days)</label>
						<input
							className="input"
							type="number"
							value={deadline}
							onChange={(e) => setDeadline(e.target.value)}
							placeholder="Optional"
						/>
					</div>
				</div>

				<div style={{ fontSize: 12, color: 'var(--ink-500)', display: 'flex', gap: 5, alignItems: 'center' }}>
					<Icon name="clock" size={11} />
					Avg. response time: {freelancer.response_time_hours || 24}h
				</div>
			</div>
		</Modal>
	)
}

export default function FreelancerProfile() {
	const { freelancerId } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const [activePackage, setActivePackage] = useState(0)
	const [inquirePackage, setInquirePackage] = useState(null)
	const [showInquiry, setShowInquiry] = useState(false)
	const [reviewSort, setReviewSort] = useState('recent')

	const { data: profileData, isLoading } = useQuery({
		queryKey: ['freelancer-profile', freelancerId],
		queryFn: async () => {
			const res = await freelancersApi.getProfile(freelancerId)
			const d = res.data
			return d?.data?.profile ?? d?.data ?? null
		},
	})

	const { data: reviewData } = useQuery({
		queryKey: ['freelancer-reviews', freelancerId, reviewSort],
		queryFn: () =>
			freelancersApi
				.getReviews(freelancerId, { sort: reviewSort, limit: 10 })
				.then((r) => r.data.data),
		enabled: !!profileData,
	})

	const preferredMutation = useMutation({
		mutationFn: (preferred) => freelancersApi.setPreferred(freelancerId, preferred),
		onSuccess: (_, preferred) => {
			queryClient.setQueryData(['freelancer-profile', freelancerId], (current) => (
				current ? { ...current, is_preferred_creator: preferred } : current
			))
			pushToast({
				title: preferred ? 'Creative saved' : 'Creative removed',
				body: preferred
					? 'This creative will receive priority when eligible for your managed briefs.'
					: 'This creative no longer has preference for your managed briefs.',
				icon: 'star',
			})
		},
		onError: (err) => pushToast({
			title: 'Could not update preference',
			body: err.response?.data?.message || 'Please try again.',
			tone: 'amber',
			icon: 'x',
		}),
	})

	if (isLoading) {
		return (
			<div className="stack-6">
				<div style={{ height: 40 }}>
					<div className="skeleton" style={{ width: 200, height: 16, borderRadius: 6 }} />
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
					<div className="stack" style={{ gap: 14 }}>
						<SkeletonCard />
						<SkeletonCard />
					</div>
					<SkeletonCard />
				</div>
			</div>
		)
	}

	if (!profileData) {
		return (
			<div className="empty">
				<h3>Freelancer not found</h3>
				<button className="btn ghost" onClick={() => navigate('/freelancers')}>
					Back to browse
				</button>
			</div>
		)
	}

	const f = profileData
	const packages = f.packages || []
	const portfolio = f.portfolio || []
	const reviews = reviewData?.reviews || []
	const summary = reviewData?.summary

	function openInquiry(pkg = null) {
		setInquirePackage(pkg)
		setShowInquiry(true)
	}

	return (
		<div className="stack-6">
			<button
				className="btn link sm reveal"
				onClick={() => navigate('/freelancers')}
				style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12, width: 'fit-content' }}
			>
				<Icon name="arrowLeft" size={12} /> Back to browse
			</button>

			<div
				className="freelancer-profile-grid"
				style={{
					display: 'grid',
					gridTemplateColumns: 'minmax(0, 1fr) 300px',
					gap: 20,
					alignItems: 'start',
				}}
			>
				<div className="stack" style={{ gap: 18 }}>
					<div className="card reveal" style={{ padding: 24 }}>
						<div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
							<div style={{ position: 'relative', flexShrink: 0 }}>
								<div
									style={{
										width: 64,
										height: 64,
										borderRadius: '50%',
										background: 'var(--ink-950)',
										color: 'white',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontFamily: 'var(--font-display)',
										fontSize: 22,
										fontWeight: 500,
									}}
								>
									{(f.full_name || 'F')
										.split(' ')
										.map((p) => p[0])
										.slice(0, 2)
										.join('')}
								</div>
								{f.is_online && (
									<div
										style={{
											position: 'absolute',
											bottom: 2,
											right: 2,
											width: 14,
											height: 14,
											borderRadius: '50%',
											background: 'var(--mint-500)',
											border: '2.5px solid var(--paper)',
										}}
									/>
								)}
							</div>

							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
									<h1
										style={{
											fontFamily: 'var(--font-display)',
											fontSize: 22,
											fontWeight: 600,
											margin: 0,
											letterSpacing: '-0.01em',
										}}
									>
										{f.full_name}
									</h1>
									{f.freelancer_level && (
										<span
											style={{
												fontSize: 11,
												fontWeight: 500,
												padding: '3px 9px',
												background: 'var(--paper-tint)',
												border: '1px solid var(--hairline)',
												borderRadius: 20,
												color: 'var(--ink-600)',
												textTransform: 'capitalize',
												marginTop: 3,
											}}
										>
											{f.freelancer_level}
										</span>
									)}
									<button
										className="btn ghost sm"
										onClick={() => preferredMutation.mutate(!f.is_preferred_creator)}
										disabled={preferredMutation.isPending}
										title={f.is_preferred_creator ? 'Remove preferred creative' : 'Save as preferred creative'}
										style={{ marginLeft: 'auto' }}
									>
										<Icon name="star" size={13} />
										{f.is_preferred_creator ? 'Preferred' : 'Prefer'}
									</button>
								</div>

								{f.tagline && (
									<div style={{ fontSize: 14, color: 'var(--ink-700)', marginTop: 4 }}>
										{f.tagline}
									</div>
								)}

								<div className="row" style={{ gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
									{f.review_count > 0 && (
										<div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13 }}>
											<Icon name="star" size={13} style={{ color: '#F59E0B' }} />
											<strong>{Number(f.review_avg_overall).toFixed(1)}</strong>
											<span style={{ color: 'var(--ink-500)' }}>
												({f.review_count} reviews)
											</span>
										</div>
									)}
									{f.response_time_hours && (
										<div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13, color: 'var(--ink-600)' }}>
											<Icon name="clock" size={13} />
											Avg. response:{' '}
											{f.response_time_hours < 24
												? `${f.response_time_hours}h`
												: `${Math.round(f.response_time_hours / 24)}d`}
										</div>
									)}
									{f.is_online && (
										<div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 13, color: 'var(--mint-700)' }}>
											<div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint-500)' }} />
											Online now
										</div>
									)}
								</div>
							</div>
						</div>

						{f.bio && (
							<>
								<div style={{ height: 1, background: 'var(--hairline)', margin: '18px 0' }} />
								<p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-700)', margin: 0 }}>
									{f.bio}
								</p>
							</>
						)}

						{f.skills?.length > 0 && (
							<div style={{ marginTop: 14 }}>
								<div className="h-eyebrow" style={{ marginBottom: 8 }}>
									Skills
								</div>
								<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
									{f.skills.map((s) => (
										<span
											key={s}
											style={{
												fontSize: 12.5,
												padding: '5px 10px',
												background: 'var(--paper-tint)',
												border: '1px solid var(--hairline)',
												borderRadius: 'var(--radius-md)',
												color: 'var(--ink-700)',
											}}
										>
											{s}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					{portfolio.length > 0 && (
						<div className="card reveal" style={{ padding: 22 }}>
							<div className="h-eyebrow" style={{ marginBottom: 14 }}>
								Portfolio
							</div>
							<div
								style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
									gap: 12,
								}}
							>
								{portfolio.map((item) => (
									<div
										key={item.id}
										style={{
											borderRadius: 'var(--radius-md)',
											overflow: 'hidden',
											border: '1px solid var(--hairline)',
										}}
									>
										<div style={{ aspectRatio: '4/3', overflow: 'hidden', background: 'var(--paper-tint)' }}>
											{item.cover_image_url ? (
												<img
													src={item.cover_image_url}
													alt={item.title}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
												/>
											) : (
												<div
													style={{
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														height: '100%',
														color: 'var(--ink-300)',
													}}
												>
													<Icon name="image" size={24} />
												</div>
											)}
										</div>
										<div style={{ padding: '10px 12px' }}>
											<div
												style={{
													fontSize: 13,
													fontWeight: 500,
													color: 'var(--ink-950)',
													marginBottom: 4,
												}}
											>
												{item.title}
											</div>
											{(item.project_cost_min || item.project_cost_max) && (
												<div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
													{item.project_cost_min && item.project_cost_max
														? `${rupee(item.project_cost_min)}-${rupee(item.project_cost_max)}`
														: rupee(item.project_cost_min || item.project_cost_max)}
													{item.project_duration && ` · ${item.project_duration}`}
												</div>
											)}
											{item.tags?.length > 0 && (
												<div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
													{item.tags.slice(0, 2).map((t) => (
														<span
															key={t}
															style={{
																fontSize: 10.5,
																padding: '2px 7px',
																background: 'var(--paper-tint)',
																border: '1px solid var(--hairline)',
																borderRadius: 20,
																color: 'var(--ink-600)',
															}}
														>
															{t}
														</span>
													))}
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="card reveal" style={{ padding: 22 }}>
						<div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
							<div>
								<div className="h-eyebrow" style={{ marginBottom: 4 }}>
									Reviews
								</div>
								{summary && (
									<div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
										<span
											style={{
												fontFamily: 'var(--font-display)',
												fontSize: 36,
												fontWeight: 500,
												letterSpacing: '-0.02em',
											}}
										>
											{Number(summary.avg_overall || 0).toFixed(1)}
										</span>
										<div>
											<Stars rating={Number(summary.avg_overall || 0)} />
											<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
												{summary.total} reviews
											</div>
										</div>
									</div>
								)}
							</div>

							<select
								className="select"
								style={{ width: 'auto' }}
								value={reviewSort}
								onChange={(e) => setReviewSort(e.target.value)}
							>
								<option value="recent">Most recent</option>
								<option value="highest">Highest rated</option>
								<option value="lowest">Lowest rated</option>
							</select>
						</div>

						{summary && (
							<div className="stack" style={{ gap: 8, marginBottom: 20 }}>
								<RatingBar label="Communication" value={summary.avg_communication || 0} />
								<RatingBar label="Quality" value={summary.avg_quality || 0} />
								<RatingBar label="Value for money" value={summary.avg_value || 0} />
							</div>
						)}

						{summary && (
							<div className="stack" style={{ gap: 5, marginBottom: 20 }}>
								{[5, 4, 3, 2, 1].map((star) => {
									const count = Number(
										summary[
											`${['one', 'two', 'three', 'four', 'five'][star - 1]}_star`
										] || 0
									)
									const total = Number(summary.total || 1)
									const pct = total > 0 ? (count / total) * 100 : 0
									return (
										<div key={star} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
											<span style={{ width: 14, textAlign: 'right', color: 'var(--ink-600)' }}>{star}</span>
											<Icon name="star" size={11} style={{ color: '#F59E0B', flexShrink: 0 }} />
											<div style={{ flex: 1, height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
												<div
													style={{
														height: '100%',
														background: '#F59E0B',
														borderRadius: 3,
														width: `${pct}%`,
														transition: 'width 0.4s ease',
													}}
												/>
											</div>
											<span style={{ width: 28, color: 'var(--ink-500)' }}>({count})</span>
										</div>
									)
								})}
							</div>
						)}

						<div className="stack" style={{ gap: 16 }}>
							{reviews.length === 0 ? (
								<div style={{ fontSize: 13, color: 'var(--ink-500)', textAlign: 'center', padding: '20px 0' }}>
									No reviews yet
								</div>
							) : (
								reviews.map((r) => (
									<div
										key={r.id}
										style={{ paddingBottom: 16, borderBottom: '1px solid var(--hairline)' }}
									>
										<div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
											<Avatar name={r.client_name || 'Client'} size="sm" />
											<div style={{ flex: 1 }}>
												<div style={{ fontSize: 13.5, fontWeight: 500 }}>
													{r.client_name || 'Client'}
												</div>
												<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
													<Stars rating={Number(r.rating_overall)} size={11} />
													{(r.price_range_min || r.price_range_max) && (
														<span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
															{r.price_range_min && r.price_range_max
																? `${rupee(r.price_range_min)}-${rupee(r.price_range_max)}`
																: rupee(r.price_range_min || r.price_range_max)}
															{r.job_duration && ` · ${r.job_duration}`}
														</span>
													)}
												</div>
											</div>
										</div>
										{r.review_text && (
											<p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-700)', margin: 0 }}>
												{r.review_text}
											</p>
										)}
									</div>
								))
							)}
						</div>
					</div>
				</div>

				<div style={{ position: 'sticky', top: 80 }}>
					{packages.length > 0 ? (
						<div className="card reveal" style={{ padding: 22 }}>
							{packages.length > 1 && (
								<div className="tabs" style={{ marginBottom: 18 }}>
									{packages.map((pkg, i) => (
										<button
											key={pkg.id}
											className={`tab ${activePackage === i ? 'active' : ''}`}
											onClick={() => setActivePackage(i)}
											style={{ textTransform: 'capitalize' }}
										>
											{pkg.package_type}
										</button>
									))}
								</div>
							)}
							<PackageTab pkg={packages[activePackage] || packages[0]} onInquire={(pkg) => openInquiry(pkg)} />
						</div>
					) : (
						<div className="card reveal" style={{ padding: 22 }}>
							<div className="h-eyebrow" style={{ marginBottom: 10 }}>
								Contact
							</div>
							<p style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 14 }}>
								This freelancer hasn't set up packages yet. Send a direct inquiry.
							</p>
							<button className="btn primary block" onClick={() => openInquiry(null)}>
								<Icon name="chat" /> Send inquiry
							</button>
						</div>
					)}

					<div className="card reveal" style={{ padding: 18, marginTop: 14 }}>
						<div className="stack" style={{ gap: 10, fontSize: 13 }}>
							{f.address_city && (
								<div className="row between">
									<span style={{ color: 'var(--ink-500)' }}>Location</span>
									<span>
										{f.address_city}
										{f.address_state ? `, ${f.address_state}` : ''}
									</span>
								</div>
							)}
							{f.languages?.length > 0 && (
								<div className="row between">
									<span style={{ color: 'var(--ink-500)' }}>Languages</span>
									<span>{f.languages.join(', ')}</span>
								</div>
							)}
							{f.hourly_rate && (
								<div className="row between">
									<span style={{ color: 'var(--ink-500)' }}>Hourly rate</span>
									<span className="mono" style={{ fontWeight: 500 }}>
										{rupee(f.hourly_rate)}/hr
									</span>
								</div>
							)}
							{f.jobs_completed_count > 0 && (
								<div className="row between">
									<span style={{ color: 'var(--ink-500)' }}>Jobs completed</span>
									<span style={{ fontWeight: 500 }}>{f.jobs_completed_count}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{showInquiry && (
				<InquiryModal
					freelancer={f}
					selectedPackage={inquirePackage}
					onClose={() => setShowInquiry(false)}
					onSent={() => {}}
				/>
			)}
		</div>
	)
}
