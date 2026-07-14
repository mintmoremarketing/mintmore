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
		<div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
			<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
				<div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide">
					{new Date().toLocaleDateString('en-IN', {
						weekday: 'long',
						day: 'numeric',
						month: 'long',
					})}
				</div>
				<h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">
					{greeting}, {user?.full_name?.split(' ')[0] || 'Freelancer'}.
				</h1>
			</div>

			{newMatches.length > 0 && (
				<div className="bg-ink-950 rounded-2xl p-6 md:p-8 shadow-lg relative overflow-hidden text-white animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_50%,_rgba(247,127,0,0.22),_transparent_60%)]" />
					<div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
						<div className="flex gap-4 items-center">
							<div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
								<Icon name="zap" size={24} />
							</div>
							<div>
								<div className="text-lg md:text-xl font-semibold text-white">
									{newMatches.length} new brief{newMatches.length > 1 ? 's' : ''} matched to you
								</div>
								<div className="text-sm text-white/70 mt-1">
									Review and initiate negotiation before another creative does.
								</div>
							</div>
						</div>
						<button className="whitespace-nowrap px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-full transition-all flex items-center gap-2 group shrink-0 shadow-lg shadow-orange-500/20" onClick={() => navigate('/jobs')}>
							View briefs <Icon name="arrowRight" className="group-hover:translate-x-1 transition-transform" />
						</button>
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
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
							? `★ ${Number(user.average_rating).toFixed(1)} avg`
							: 'No ratings yet',
						icon: 'star',
						onClick: null,
					},
				].map((stat) => (
					<button
						key={stat.label}
						onClick={stat.onClick}
						className={`bg-white border border-ink-200 rounded-2xl p-6 text-left transition-all ${stat.onClick ? 'hover:border-ink-300 hover:shadow-md group cursor-pointer' : 'cursor-default'}`}
					>
						<div className="w-12 h-12 rounded-xl bg-ink-50 text-ink-700 flex items-center justify-center mb-4 group-hover:bg-ink-100 transition-colors">
							<Icon name={stat.icon} size={20} />
						</div>
						<div className="text-[11px] font-bold tracking-wider uppercase text-ink-500 mb-1">
							{stat.label}
						</div>
						<div className="text-3xl font-display font-bold text-ink-950 mb-1">
							{stat.value}
						</div>
						<div className="text-sm text-ink-500">
							{stat.sub}
						</div>
					</button>
				))}
			</div>

			<div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
				<div className="flex items-end justify-between">
					<h2 className="text-xl md:text-2xl font-display font-bold text-ink-950 m-0">
						Active work
					</h2>
					<button className="text-sm font-medium text-ink-600 hover:text-ink-900 flex items-center gap-1 group transition-colors" onClick={() => navigate('/jobs')}>
						All briefs <Icon name="arrowRight" size={12} className="group-hover:translate-x-0.5 transition-transform" />
					</button>
				</div>

				{isLoading ? (
					<div className="flex flex-col gap-3">
						<SkeletonCard />
						<SkeletonCard />
					</div>
				) : activeJobs.length === 0 ? (
					<div className="border border-ink-200 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-center bg-ink-50/50">
						<div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-400 mb-3">
							<Icon name="briefcase" size={24} />
						</div>
						<h3 className="text-lg font-semibold text-ink-950 mb-1">No active work</h3>
						<p className="text-sm text-ink-500 max-w-sm">When a client's brief is matched to you, it appears here.</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{activeJobs.slice(0, 4).map((j) => (
							<button
								key={j.id}
								className="bg-white border border-ink-200 hover:border-ink-300 hover:shadow-md rounded-xl p-5 text-left transition-all group flex flex-col cursor-pointer"
								onClick={() => navigate(`/jobs/${j.id}`)}
							>
								<div className="flex justify-between items-center w-full mb-3">
									<div className="flex items-center gap-2">
										<span className="px-2.5 py-1 bg-ink-100 text-ink-700 text-xs font-medium rounded-md">{j.category?.name || 'General'}</span>
										<StatusChip status={j.status} />
									</div>
									<Icon name="chevronRight" size={16} className="text-ink-300 group-hover:text-ink-600 transition-colors group-hover:translate-x-0.5" />
								</div>
								<div className="font-semibold text-base text-ink-950">
									{j.title}
								</div>
								<div className="text-sm text-ink-500 mt-1">
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

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
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
						className="bg-white border border-ink-200 hover:border-ink-300 hover:shadow-md rounded-xl p-4 flex items-center gap-4 text-left cursor-pointer transition-all group"
					>
						<div className="w-10 h-10 rounded-lg bg-ink-50 text-ink-600 flex items-center justify-center shrink-0 group-hover:bg-ink-100 group-hover:text-ink-900 transition-colors">
							<Icon name={a.icon} size={20} />
						</div>
						<div>
							<div className="text-[14px] font-semibold text-ink-950 group-hover:text-orange-500 transition-colors">{a.label}</div>
							<div className="text-xs text-ink-500 mt-0.5">{a.sub}</div>
						</div>
					</button>
				))}
			</div>
		</div>
	)
}
