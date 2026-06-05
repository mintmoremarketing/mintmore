import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { api } from '../../api/client'
import { mintboxApi } from '../../api/mintbox'
import Icon from '../../components/ui/Icon'
import StatusChip from '../../components/ui/StatusChip'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const GB = 1024 * 1024 * 1024

const formatBytes = (bytes = 0) => {
	if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${bytes} B`
}

export default function ClientDashboard() {
	const navigate = useNavigate()
	const { user } = useAuthStore()
	const setShowTopUp = useUIStore((s) => s.setShowTopUp)

	const now = new Date()
	const hour = now.getHours()
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

	const { data: walletData } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => api.get('/wallet').then((r) => r.data.data),
	})

	const { data: jobsData, isLoading } = useQuery({
		queryKey: ['jobs', 'active'],
		queryFn: () => api.get('/jobs').then((r) => r.data.data),
	})

	const { data: mintboxData } = useQuery({
		queryKey: ['mintbox'],
		queryFn: () => mintboxApi.getFolders().then((r) => r.data.data),
	})

	const { data: profileData } = useQuery({
		queryKey: ['my-profile'],
		queryFn: () => api.get('/profile/me').then((r) => r.data.data),
	})
	const profile = profileData?.profile || profileData || {}
	const onboarding = profile.onboarding_checklist || {}
	const onboardingItems = [
		Boolean(onboarding.profile),
		Boolean(onboarding.language),
		Boolean(onboarding.social),
		profile.kyc_status === 'verified',
	]
	const onboardingDone = onboardingItems.filter(Boolean).length

	const activeJobs = jobsData?.jobs?.filter((j) =>
		['matching', 'locked', 'negotiating', 'in_progress', 'assigned'].includes(j.status)
	) || []

	const wallet = walletData?.wallet
	const quota = mintboxData?.quota
	const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0

	return (
		<div className="stack-6">
			<div className="reveal" data-d="0">
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>
					{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
				</div>
				<h1 className="h-display" style={{ fontSize: 30, margin: 0, lineHeight: 1.15 }}>
					{greeting}, {user?.full_name?.split(' ')[0]}.
				</h1>
			</div>

			<div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
				<div className="card-ink reveal" data-d="1" style={{ position: 'relative', overflow: 'hidden' }}>
					<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.18), transparent 50%)' }} />
					<div style={{ position: 'relative' }}>
						<div className="row between" style={{ marginBottom: 18 }}>
							<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Wallet balance</span>
							<span className="badge mint" style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--mint-200)' }}>
								<span className="bdot" style={{ background: 'var(--mint-300)' }} /> Escrow-protected
							</span>
						</div>
						<div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
							<span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em' }}>
								{wallet ? rupee(wallet.balance) : '-'}
							</span>
						</div>
						<div className="row" style={{ gap: 20, marginTop: 14, fontSize: 12 }}>
							<div>
								<div style={{ color: 'rgba(255,255,255,0.5)' }}>Available</div>
								<div className="mono" style={{ color: 'white', marginTop: 2 }}>{wallet ? rupee(wallet.balance) : '-'}</div>
							</div>
							<div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.1)' }} />
							<div>
								<div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
									<Icon name="lock" size={11} /> In escrow
								</div>
								<div className="mono" style={{ color: 'white', marginTop: 2 }}>{wallet ? rupee(wallet.escrow_balance) : '-'}</div>
							</div>
						</div>
						<div className="row" style={{ marginTop: 22, gap: 8 }}>
							<button className="btn mint" onClick={() => setShowTopUp(true)}>
								<Icon name="plus" /> Top up wallet
							</button>
							<button className="btn link" style={{ color: 'rgba(255,255,255,0.85)' }} onClick={() => navigate('/wallet')}>
								View transactions <Icon name="arrowRight" />
							</button>
						</div>
					</div>
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
					{[
						{ icon: 'plus', label: 'Post a new brief', sub: 'Get matched in ~6 min', onClick: () => navigate('/jobs/new'), primary: true },
						{ icon: 'user', label: 'Browse freelancers', sub: 'Marketplace access', onClick: () => navigate('/freelancers') },
						{ icon: 'sparkles', label: 'Mint AI', sub: 'Captions, scripts', onClick: () => navigate('/ai') },
						{ icon: 'layers', label: 'Schedule a post', sub: '2 platforms', onClick: () => navigate('/social') },
					].map((a) => (
						<button
							key={a.label}
							onClick={a.onClick}
							style={{
								background: 'var(--paper)',
								border: '1px solid var(--hairline)',
								borderRadius: 'var(--radius-md)',
								padding: 12,
								textAlign: 'left',
								cursor: 'pointer',
								transition: 'all 0.12s ease',
								display: 'flex',
								flexDirection: 'column',
								gap: 8,
								minHeight: 88,
							}}
							onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-300)' }}
							onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)' }}
						>
							<div style={{ width: 28, height: 28, borderRadius: 8, background: a.primary ? 'var(--ink-950)' : 'var(--paper-tint)', color: a.primary ? 'white' : 'var(--ink-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								<Icon name={a.icon} size={14} />
							</div>
							<div>
								<div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-950)' }}>{a.label}</div>
								<div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>{a.sub}</div>
							</div>
						</button>
					))}
				</div>
			</div>

			{onboardingDone < onboardingItems.length && (
				<div className="card reveal" style={{ padding: 18 }}>
					<div className="row between" style={{ gap: 16 }}>
						<div style={{ flex: 1 }}>
							<div className="h-eyebrow" style={{ marginBottom: 5 }}>Account setup</div>
							<div style={{ fontSize: 16, fontWeight: 600 }}>Make Mint More work around your business</div>
							<div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{onboardingDone} of {onboardingItems.length} setup steps complete</div>
							<div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
								<div style={{ width: `${(onboardingDone / onboardingItems.length) * 100}%`, height: '100%', background: 'var(--mint-500)' }} />
							</div>
						</div>
						<button className="btn primary" onClick={() => navigate('/onboarding')}>
							Continue setup <Icon name="arrowRight" size={12} />
						</button>
					</div>
				</div>
			)}

			<div className="card reveal" data-d="2" style={{ padding: 18 }}>
				<div className="row between" style={{ gap: 14, marginBottom: 14 }}>
					<div>
						<div className="h-eyebrow" style={{ marginBottom: 5 }}>Mintbox storage</div>
						<div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-950)' }}>
							{formatBytes(quota?.used || 0)} used
						</div>
					</div>
					<button className="btn ghost sm" onClick={() => navigate('/mintbox')}>
						Open Mintbox <Icon name="arrowRight" size={12} />
					</button>
				</div>
				<div className="row between" style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8 }}>
					<span>Total space</span>
					<span className="mono">{formatBytes(quota?.limit || 10 * GB)}</span>
				</div>
				<div style={{ height: 7, background: 'var(--hairline)', borderRadius: 4, overflow: 'hidden' }}>
					<div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 90 ? 'var(--rose)' : 'var(--mint-500)' }} />
				</div>
			</div>

			<div className="stack reveal" data-d="3">
				<div className="row between" style={{ alignItems: 'flex-end' }}>
					<h2 className="h-display h-3" style={{ margin: 0 }}>Active jobs</h2>
					<button className="btn link sm" onClick={() => navigate('/jobs')}>
						See all <Icon name="arrowRight" size={12} />
					</button>
				</div>
				{isLoading ? (
					<div className="grid-3" style={{ gap: 10 }}>
						<SkeletonCard /><SkeletonCard /><SkeletonCard />
					</div>
				) : activeJobs.length === 0 ? (
					<div className="empty">
						<div className="empty-glyph"><Icon name="briefcase" size={22} /></div>
						<h3>No active jobs yet</h3>
						<p>Post your first brief and we'll match you with the right creative.</p>
						<button className="btn primary" onClick={() => navigate('/jobs/new')}>
							<Icon name="plus" /> Post a brief
						</button>
					</div>
				) : (
					<div className="grid-3" style={{ gap: 10 }}>
						{activeJobs.slice(0, 3).map((j) => (
							<button key={j.id} className="job-card" onClick={() => navigate(`/jobs/${j.id}`)}>
								<div className="row between">
									<span className="h-eyebrow" style={{ color: 'var(--ink-500)' }}>{j.category?.name || 'General'}</span>
									<StatusChip status={j.status} />
								</div>
								<div className="title">{j.title}</div>
								<div className="description">{j.description}</div>
								<div className="divider" style={{ margin: '12px 0 8px' }} />
								<div className="row between" style={{ fontSize: 11.5 }}>
									<span className="muted">Budget</span>
									<span className="mono" style={{ color: 'var(--ink-900)', fontWeight: 500 }}>
										{rupee(j.budget_amount || 0)}
									</span>
								</div>
							</button>
						))}
					</div>
				)}
			</div>

			<div className="card-mint reveal" data-d="6" style={{ position: 'relative', overflow: 'hidden' }}>
				<div className="row between" style={{ marginBottom: 6 }}>
					<span className="h-eyebrow" style={{ color: 'var(--mint-800)' }}>Tip · Marketplace</span>
					<Icon name="sparkles" style={{ color: 'var(--mint-700)' }} size={14} />
				</div>
				<h3 className="h-display" style={{ fontSize: 17, margin: '4px 0 8px', color: 'var(--ink-950)' }}>
					Unlock browse access for ₹599
				</h3>
				<p style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.55, margin: '0 0 14px' }}>
					Skip matching and reach out directly to top creatives across India. 30 days of unlimited browse.
				</p>
				<div className="row">
					<button className="btn mint sm" onClick={() => navigate('/addons')}>
						Unlock for ₹599 <Icon name="arrowRight" size={12} />
					</button>
				</div>
			</div>
		</div>
	)
}
