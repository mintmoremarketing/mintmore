import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { api } from '../../api/client'
import { walletApi } from '../../api/wallet'
import Icon from '../../components/ui/Icon'
import StatusChip from '../../components/ui/StatusChip'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function FreelancerDashboard() {
	const navigate = useNavigate()
	const { user } = useAuthStore()
	const hour = new Date().getHours()
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

	const { data: walletData } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then((r) => r.data.data),
	})

	const { data: jobsData, isLoading } = useQuery({
		queryKey: ['jobs'],
		queryFn: async () => {
			const res = await api.get('/jobs')
			const d = res.data
			return d?.data?.jobs ?? d?.data ?? []
		},
	})

	const jobs = Array.isArray(jobsData) ? jobsData : jobsData?.jobs || []
	const activeJobs = jobs.filter((j) =>
		['matching', 'locked', 'negotiating', 'assigned', 'in_progress'].includes(j.status)
	)
	const newMatches = jobs.filter(
		(j) => j.status === 'matching' || j.status === 'open'
	)
	const wallet = walletData?.wallet

	return (
		<div className="stack-6">
			<div className="reveal">
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>
					{new Date().toLocaleDateString('en-IN', {
						weekday: 'long',
						day: 'numeric',
						month: 'long',
					})}
				</div>
				<h1 className="h-display" style={{ fontSize: 30, margin: 0, lineHeight: 1.15 }}>
					{greeting}, {user?.full_name?.split(' ')[0]}.
				</h1>
			</div>

			{newMatches.length > 0 && (
				<div className="card-ink reveal" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
					<div
						style={{
							position: 'absolute',
							inset: 0,
							background:
								'radial-gradient(circle at 90% 50%, rgba(247,127,0,0.2), transparent 60%)',
						}}
					/>
					<div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
						<div
							style={{
								width: 44,
								height: 44,
								borderRadius: '50%',
								background: 'rgba(247,127,0,0.2)',
								color: 'var(--mint-300)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								flexShrink: 0,
							}}
						>
							<Icon name="zap" size={20} />
						</div>
						<div style={{ flex: 1 }}>
							<div style={{ fontWeight: 600, fontSize: 15, color: 'white' }}>
								{newMatches.length} new brief{newMatches.length > 1 ? 's' : ''} matched to you
							</div>
							<div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
								Review and initiate negotiation before another creative does.
							</div>
						</div>
						<button className="btn mint" onClick={() => navigate('/jobs')}>
							View briefs <Icon name="arrowRight" />
						</button>
					</div>
				</div>
			)}

			<div
				style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
				className="reveal"
			>
				{[
					{
						label: 'Available balance',
						value: wallet ? rupee(wallet.balance) : '-',
						sub: wallet ? `${rupee(wallet.escrow_balance)} escrowed` : 'Loading...',
						icon: 'wallet',
						onClick: () => navigate('/wallet'),
					},
					{
						label: 'Active jobs',
						value: activeJobs.length,
						sub: 'of 5 slots used',
						icon: 'briefcase',
						onClick: () => navigate('/jobs'),
					},
					{
						label: 'Completed jobs',
						value: user?.jobs_completed_count || 0,
						sub: user?.average_rating
							? `* ${Number(user.average_rating).toFixed(1)} avg`
							: 'No ratings yet',
						icon: 'star',
						onClick: null,
					},
				].map((stat) => (
					<button
						key={stat.label}
						onClick={stat.onClick}
						style={{
							background: 'var(--paper)',
							border: '1px solid var(--hairline)',
							borderRadius: 'var(--radius-lg)',
							padding: 18,
							textAlign: 'left',
							cursor: stat.onClick ? 'pointer' : 'default',
							transition: 'all 0.12s ease',
						}}
						onMouseEnter={(e) =>
							stat.onClick && (e.currentTarget.style.borderColor = 'var(--ink-300)')
						}
						onMouseLeave={(e) =>
							stat.onClick && (e.currentTarget.style.borderColor = 'var(--hairline)')
						}
					>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 10,
								background: 'var(--paper-tint)',
								color: 'var(--ink-600)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								marginBottom: 12,
							}}
						>
							<Icon name={stat.icon} size={15} />
						</div>
						<div
							style={{
								fontSize: 11.5,
								color: 'var(--ink-500)',
								marginBottom: 4,
								textTransform: 'uppercase',
								letterSpacing: 0.04,
							}}
						>
							{stat.label}
						</div>
						<div
							style={{
								fontFamily: 'var(--font-display)',
								fontSize: 24,
								fontWeight: 500,
								letterSpacing: '-0.02em',
								color: 'var(--ink-950)',
							}}
						>
							{stat.value}
						</div>
						<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
							{stat.sub}
						</div>
					</button>
				))}
			</div>

			<div className="stack reveal">
				<div className="row between" style={{ alignItems: 'flex-end' }}>
					<h2 className="h-display h-3" style={{ margin: 0 }}>
						Active work
					</h2>
					<button className="btn link sm" onClick={() => navigate('/jobs')}>
						All briefs <Icon name="arrowRight" size={12} />
					</button>
				</div>

				{isLoading ? (
					<div className="stack" style={{ gap: 10 }}>
						<SkeletonCard />
						<SkeletonCard />
					</div>
				) : activeJobs.length === 0 ? (
					<div className="empty">
						<div className="empty-glyph">
							<Icon name="briefcase" size={22} />
						</div>
						<h3>No active work</h3>
						<p>When a client's brief is matched to you, it appears here.</p>
					</div>
				) : (
					<div className="stack" style={{ gap: 10 }}>
						{activeJobs.slice(0, 4).map((j) => (
							<button
								key={j.id}
								className="job-card"
								style={{ padding: 16 }}
								onClick={() => navigate(`/jobs/${j.id}`)}
							>
								<div className="row between">
									<div className="row" style={{ gap: 8 }}>
										<span className="badge neutral">{j.category?.name || 'General'}</span>
										<StatusChip status={j.status} />
									</div>
									<Icon name="chevronRight" size={13} style={{ color: 'var(--ink-400)' }} />
								</div>
								<div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-950)', marginTop: 8 }}>
									{j.title}
								</div>
								<div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 4 }}>
									{j.status === 'matching'
										? 'Awaiting your negotiation'
										: j.status === 'negotiating'
											? 'Negotiation in progress'
											: j.status === 'in_progress'
												? 'Work in progress'
												: j.status}
								</div>
							</button>
						))}
					</div>
				)}
			</div>

			<div
				style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}
				className="reveal"
			>
				{[
					{
						icon: 'user',
						label: 'Edit marketplace profile',
						sub: 'Tagline, bio, visibility',
						route: '/profile-edit',
					},
					{
						icon: 'layers',
						label: 'Manage packages',
						sub: 'Basic, Standard, Premium',
						route: '/packages',
					},
					{
						icon: 'image',
						label: 'Update portfolio',
						sub: 'Add recent work',
						route: '/portfolio',
					},
					{
						icon: 'chat',
						label: 'View inquiries',
						sub: 'Direct client messages',
						route: '/inquiries',
					},
				].map((a) => (
					<button
						key={a.route}
						onClick={() => navigate(a.route)}
						style={{
							background: 'var(--paper)',
							border: '1px solid var(--hairline)',
							borderRadius: 'var(--radius-md)',
							padding: '14px 16px',
							textAlign: 'left',
							cursor: 'pointer',
							display: 'flex',
							gap: 12,
							alignItems: 'center',
							transition: 'all 0.12s',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.borderColor = 'var(--ink-300)'
							e.currentTarget.style.transform = 'translateY(-1px)'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.borderColor = 'var(--hairline)'
							e.currentTarget.style.transform = 'none'
						}}
					>
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
							<Icon name={a.icon} size={16} />
						</div>
						<div>
							<div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-950)' }}>{a.label}</div>
							<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{a.sub}</div>
						</div>
					</button>
				))}
			</div>
		</div>
	)
}
