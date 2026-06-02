import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { addonsApi } from '../../api/addons'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'

const FEATURE_LABELS = {
	browse_freelancers: { icon: 'user', label: 'Browse freelancer profiles' },
	direct_inquiry: { icon: 'chat', label: 'Send direct inquiries' },
	priority_matching: { icon: 'radar', label: 'Priority matching queue' },
	advanced_analytics: { icon: 'trending', label: 'Advanced analytics' },
}

function PlanCard({ plan, isActive, activeAddon, onBuy, isPurchasing }) {
	const rawFeatures = plan.features
	let features = []
	if (Array.isArray(rawFeatures)) {
		features = rawFeatures
	} else if (rawFeatures && typeof rawFeatures === 'object') {
		const values = Object.values(rawFeatures)
		const allStrings = values.length > 0 && values.every((v) => typeof v === 'string')
		features = allStrings
			? values
			: Object.entries(rawFeatures)
					.filter(([, v]) => Boolean(v))
					.map(([k]) => k)
	}
	const daysLeft = activeAddon
		? Math.max(
				0,
				Math.ceil((new Date(activeAddon.expires_at) - new Date()) / 86400000)
			)
		: 0

	return (
		<div
			style={{
				position: 'relative',
				background: 'var(--paper)',
				border: `1.5px solid ${
					plan.is_featured ? 'var(--ink-950)' : 'var(--hairline)'
				}`,
				borderRadius: 'var(--radius-lg)',
				padding: 24,
				display: 'flex',
				flexDirection: 'column',
				gap: 16,
				transition: 'box-shadow 0.15s ease',
			}}
		>
			{plan.is_featured && (
				<div
					style={{
						position: 'absolute',
						top: -12,
						left: '50%',
						transform: 'translateX(-50%)',
						background: 'var(--ink-950)',
						color: 'white',
						fontSize: 11,
						fontWeight: 600,
						letterSpacing: 0.04,
						padding: '4px 12px',
						borderRadius: 20,
						whiteSpace: 'nowrap',
					}}
				>
					Most popular
				</div>
			)}

			<div>
				<div
					style={{
						fontSize: 13,
						fontWeight: 500,
						color: 'var(--ink-600)',
						marginBottom: 4,
					}}
				>
					{plan.name}
				</div>
				<div
					style={{
						fontFamily: 'var(--font-display)',
						fontSize: 36,
						fontWeight: 500,
						letterSpacing: '-0.02em',
						lineHeight: 1,
						color: 'var(--ink-950)',
					}}
				>
					{rupee(plan.price)}
				</div>
				<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>
					{plan.duration_days} days access
				</div>
			</div>

			{plan.description && (
				<p
					style={{
						fontSize: 13,
						color: 'var(--ink-600)',
						lineHeight: 1.55,
						margin: 0,
					}}
				>
					{plan.description}
				</p>
			)}

			<div className="stack" style={{ gap: 8 }}>
				{features.map((f) => {
					const meta = FEATURE_LABELS[f] || { icon: 'check', label: f }
					return (
						<div
							key={f}
							style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
						>
							<div
								style={{
									width: 20,
									height: 20,
									borderRadius: '50%',
									background: 'var(--mint-100)',
									color: 'var(--mint-700)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0,
								}}
							>
								<Icon name={meta.icon} size={11} />
							</div>
							<span style={{ color: 'var(--ink-700)' }}>{meta.label}</span>
						</div>
					)
				})}
			</div>

			<div style={{ flex: 1 }} />

			{isActive ? (
				<div>
					<div
						style={{
							padding: '10px 14px',
							background: 'rgba(16,185,129,0.08)',
							borderRadius: 'var(--radius-md)',
							border: '1px solid rgba(16,185,129,0.25)',
							marginBottom: 10,
						}}
					>
						<div
							style={{
								fontSize: 12.5,
								fontWeight: 500,
								color: 'var(--mint-700)',
								marginBottom: 2,
							}}
						>
							Active - {daysLeft} days remaining
						</div>
						<div
							style={{
								height: 4,
								background: 'var(--paper-tint)',
								borderRadius: 2,
								overflow: 'hidden',
								marginTop: 6,
							}}
						>
							<div
								style={{
									height: '100%',
									width: `${Math.min(
										100,
										(daysLeft / plan.duration_days) * 100
									)}%`,
									background: 'var(--mint-500)',
									borderRadius: 2,
									transition: 'width 0.3s ease',
								}}
							/>
						</div>
					</div>
					<button
						className="btn ghost block"
						onClick={() => onBuy(plan)}
						disabled={isPurchasing}
					>
						Extend by {plan.duration_days} days
					</button>
				</div>
			) : (
				<button
					className={`btn block ${plan.is_featured ? 'primary' : 'ghost'}`}
					onClick={() => onBuy(plan)}
					disabled={isPurchasing}
				>
					{isPurchasing ? (
						'Processing...'
					) : (
						<>
							Unlock for {rupee(plan.price)} <Icon name="arrowRight" />
						</>
					)}
				</button>
			)}
		</div>
	)
}

function PurchaseConfirmModal({ plan, walletBalance, onConfirm, onClose, isPending }) {
	const canAfford = walletBalance !== null && walletBalance >= plan.price

	return (
		<Modal
			title="Confirm purchase"
			subtitle={plan.name}
			onClose={onClose}
			maxWidth={400}
			footer={
				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
					<button className="btn ghost" onClick={onClose} disabled={isPending}>
						Cancel
					</button>
					<button
						className="btn primary"
						onClick={onConfirm}
						disabled={!canAfford || isPending}
					>
						{isPending ? 'Processing...' : `Pay ${rupee(plan.price)}`}
					</button>
				</div>
			}
		>
			<div className="stack" style={{ gap: 16 }}>
				<div
					style={{
						padding: 16,
						background: 'var(--paper-tint)',
						borderRadius: 'var(--radius-md)',
						border: '1px solid var(--hairline)',
					}}
				>
					<div className="row between" style={{ fontSize: 13, marginBottom: 8 }}>
						<span style={{ color: 'var(--ink-600)' }}>Plan</span>
						<span style={{ fontWeight: 500 }}>{plan.name}</span>
					</div>
					<div className="row between" style={{ fontSize: 13, marginBottom: 8 }}>
						<span style={{ color: 'var(--ink-600)' }}>Duration</span>
						<span>{plan.duration_days} days</span>
					</div>
					<div style={{ height: 1, background: 'var(--hairline)', margin: '8px 0' }} />
					<div className="row between" style={{ fontSize: 15, fontWeight: 600 }}>
						<span>Total</span>
						<span className="mono">{rupee(plan.price)}</span>
					</div>
				</div>

				<div style={{ fontSize: 13 }}>
					{canAfford ? (
						<div
							style={{
								display: 'flex',
								gap: 6,
								alignItems: 'center',
								color: 'var(--ink-600)',
							}}
						>
							<Icon name="wallet" size={13} />
							<span>
								{rupee(walletBalance)} in wallet →{' '}
								<strong style={{ color: 'var(--ink-950)' }}>
									{rupee(walletBalance - plan.price)}
								</strong>{' '}
								after purchase
							</span>
						</div>
					) : (
						<div
							style={{
								padding: 12,
								background: 'rgba(217,119,6,0.08)',
								borderRadius: 'var(--radius-md)',
								border: '1px solid rgba(217,119,6,0.25)',
								color: 'var(--amber)',
								display: 'flex',
								gap: 8,
								alignItems: 'flex-start',
							}}
						>
							<Icon name="zap" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
							<div>
								<div style={{ fontWeight: 500, marginBottom: 2 }}>
									Insufficient balance
								</div>
								<div style={{ fontSize: 12, opacity: 0.8 }}>
									You need {rupee(plan.price - walletBalance)} more. Top up
									your wallet first.
								</div>
							</div>
						</div>
					)}
				</div>

				<div
					style={{
						fontSize: 11.5,
						color: 'var(--ink-400)',
						display: 'flex',
						gap: 5,
						alignItems: 'center',
					}}
				>
					<Icon name="shield" size={11} />
					Deducted instantly from your Mint More wallet. No refunds on add-on plans.
				</div>
			</div>
		</Modal>
	)
}

export default function Addons() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const setShowTopUp = useUIStore((s) => s.setShowTopUp)

	const [confirmPlan, setConfirmPlan] = useState(null)

	const { data: plansData, isLoading: plansLoading } = useQuery({
		queryKey: ['addon-plans'],
		queryFn: () => addonsApi.plans().then((r) => r.data.data),
	})

	const { data: myAddonsData } = useQuery({
		queryKey: ['my-addons'],
		queryFn: () => addonsApi.myAddons().then((r) => r.data.data),
	})

	const { data: walletData } = useQuery({
		queryKey: ['wallet'],
		queryFn: () =>
			import('../../api/wallet')
				.then((m) => m.walletApi.get())
				.then((r) => r.data.data),
	})

	const plans = plansData?.plans || []
	const myAddons = myAddonsData?.addons || []
	const wallet = walletData?.wallet
	const walletBal = wallet?.balance ?? null

	const browseAddon = myAddons.find(
		(a) =>
			a.is_active &&
			new Date(a.expires_at) > new Date() &&
			a.features?.includes('browse_freelancers')
	)

	const { mutate: purchase, isPending: purchasing } = useMutation({
		mutationFn: (planId) => addonsApi.purchase(planId),
		onSuccess: (res) => {
			const result = res.data.data
			pushToast({
				title: `${result.plan.name} activated!`,
				body: `${result.days_added} days of access - enjoy the marketplace`,
				icon: 'check',
			})
			queryClient.invalidateQueries({ queryKey: ['my-addons'] })
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
			setConfirmPlan(null)
		},
		onError: (err) => {
			const msg = err.response?.data?.message || 'Purchase failed'
			if (msg.toLowerCase().includes('insufficient')) {
				pushToast({
					title: 'Insufficient balance',
					body: 'Top up your wallet first',
					tone: 'amber',
					icon: 'wallet',
				})
				setShowTopUp(true)
			} else {
				pushToast({ title: 'Purchase failed', body: msg, tone: 'amber', icon: 'x' })
			}
			setConfirmPlan(null)
		},
	})

	return (
		<div className="stack-6">
			<div className="reveal">
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>
					Add-ons
				</div>
				<h1 className="h-display h-1" style={{ margin: '0 0 8px' }}>
					Unlock the marketplace
				</h1>
				<p className="muted" style={{ maxWidth: 520, lineHeight: 1.6 }}>
					Browse, contact, and hire top Indian creatives directly - bypassing
					the matching queue. Purchase a plan and get instant access.
				</p>
			</div>

			{browseAddon && (
				<div className="card-mint reveal" style={{ padding: 18 }}>
					<div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
						<div className="row" style={{ gap: 12 }}>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: '50%',
									background: 'var(--mint-200)',
									color: 'var(--mint-800)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<Icon name="check" size={16} strokeWidth={2.5} />
							</div>
							<div>
								<div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-950)' }}>
									Marketplace access active
								</div>
								<div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>
									{Math.max(
										0,
										Math.ceil(
											(new Date(browseAddon.expires_at) - new Date()) / 86400000
										)
									)}{' '}
									days remaining - expires{' '}
									{new Date(browseAddon.expires_at).toLocaleDateString('en-IN', {
										day: 'numeric',
										month: 'short',
										year: 'numeric',
									})}
								</div>
							</div>
						</div>
						<button className="btn primary" onClick={() => navigate('/freelancers')}>
							Browse freelancers <Icon name="arrowRight" />
						</button>
					</div>
				</div>
			)}

			{plansLoading ? (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			) : (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
						gap: 16,
						alignItems: 'start',
					}}
					className="reveal"
				>
					{plans.map((plan) => {
						const activeForThisPlan = myAddons.find(
							(a) =>
								a.addon_plan_id === plan.id &&
								a.is_active &&
								new Date(a.expires_at) > new Date()
						)
						return (
							<PlanCard
								key={plan.id}
								plan={plan}
								isActive={!!activeForThisPlan}
								activeAddon={activeForThisPlan}
								onBuy={(p) => setConfirmPlan(p)}
								isPurchasing={purchasing}
							/>
						)
					})}
				</div>
			)}

			<div className="card reveal" style={{ padding: 28 }}>
				<div className="h-eyebrow" style={{ marginBottom: 16 }}>
					What you get
				</div>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
						gap: 20,
					}}
				>
					{[
						{
							icon: 'user',
							title: 'Full profiles',
							desc:
								'See portfolios, reviews, packages and response times for every creative.',
						},
						{
							icon: 'star',
							title: 'Verified ratings',
							desc:
								'Authentic reviews from real clients. Rating breakdown: quality, value, communication.',
						},
						{
							icon: 'chat',
							title: 'Direct contact',
							desc:
								'Send an inquiry directly to any freelancer with your brief and budget.',
						},
						{
							icon: 'shield',
							title: 'Escrow included',
							desc:
								'Every hire goes through our escrow system regardless of how you found them.',
						},
					].map((f) => (
						<div key={f.title} style={{ display: 'flex', gap: 12 }}>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: 10,
									background: 'var(--paper-tint)',
									color: 'var(--ink-700)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0,
								}}
							>
								<Icon name={f.icon} size={16} />
							</div>
							<div>
								<div
									style={{
										fontSize: 13.5,
										fontWeight: 500,
										color: 'var(--ink-950)',
										marginBottom: 4,
									}}
								>
									{f.title}
								</div>
								<div
									style={{
										fontSize: 12.5,
										color: 'var(--ink-600)',
										lineHeight: 1.55,
									}}
								>
									{f.desc}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{confirmPlan && (
				<PurchaseConfirmModal
					plan={confirmPlan}
					walletBalance={walletBal}
					onConfirm={() => purchase(confirmPlan.id)}
					onClose={() => setConfirmPlan(null)}
					isPending={purchasing}
				/>
			)}
		</div>
	)
}
