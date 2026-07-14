import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import StatusChip from '../../components/ui/StatusChip'
import DateBadge from '../../components/ui/DateBadge'
import { statusAccent } from '../../components/ui/statusMeta'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function FreelancerJobs() {
	const navigate = useNavigate()
	const [tab, setTab] = useState('active')

	const { data, isLoading } = useQuery({
		queryKey: ['jobs'],
		queryFn: async () => {
			const res = await api.get('/jobs')
			const d = res.data
			return d?.data?.jobs ?? d?.data ?? []
		},
	})

	const jobs = Array.isArray(data) ? data : data?.jobs || []

	const tabs = {
		active: jobs.filter((j) =>
			['matching', 'open', 'locked', 'negotiating', 'assigned', 'in_progress'].includes(j.status)
		),
		pending: jobs.filter((j) => j.status === 'pending_admin_approval'),
		completed: jobs.filter((j) => j.status === 'completed'),
		all: jobs,
	}

	const filtered = tabs[tab] || jobs

	return (
		<div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
			<div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
				<div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide uppercase">
					My briefs
				</div>
				<h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">
					Matched work
				</h1>
				<p className="text-ink-600 mt-2 text-sm md:text-base">
					Only briefs matched to you by our engine appear here.
				</p>
			</div>

			<Tabs
				value={tab}
				onChange={setTab}
				items={[
					{ value: 'active', label: 'Active', count: tabs.active.length },
					{ value: 'pending', label: 'Pending', count: tabs.pending.length },
					{ value: 'completed', label: 'Completed', count: tabs.completed.length },
					{ value: 'all', label: 'All', count: jobs.length },
				]}
			/>

			<div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
				{isLoading ? (
					[1, 2, 3].map((i) => <SkeletonCard key={i} />)
				) : filtered.length === 0 ? (
					<div className="border border-ink-200 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-center bg-ink-50/50">
						<div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-400 mb-3">
							<Icon name="briefcase" size={24} />
						</div>
						<h3 className="text-lg font-semibold text-ink-950 mb-1">Nothing here yet</h3>
						<p className="text-sm text-ink-500 max-w-sm">When our engine matches a brief to your profile, it appears here.</p>
					</div>
				) : (
					filtered.map((j) => (
						<button
							key={j.id}
							className="bg-white/80 backdrop-blur-sm border border-ink-200/60 hover:border-mint-500/30 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 rounded-2xl p-6 text-left transition-all duration-300 group flex flex-col cursor-pointer"
							onClick={() => navigate(`/jobs/${j.id}`)}
						>
							<div className="flex justify-between items-start w-full mb-4">
								<div className="flex flex-col gap-3">
									<div className="flex items-center gap-2">
										<span className="px-3 py-1.5 bg-ink-50 text-ink-600 text-[11px] uppercase tracking-wider font-bold rounded-lg">{j.category?.name || 'General'}</span>
										<StatusChip status={j.status} />
									</div>
									<div className="font-display font-bold text-xl md:text-2xl text-ink-950 group-hover:text-mint-700 transition-colors">
										{j.title}
									</div>
								</div>
								<div className="w-10 h-10 rounded-full bg-ink-50 group-hover:bg-mint-50 flex items-center justify-center transition-colors shrink-0">
									<Icon name="arrowRight" size={18} className="text-ink-400 group-hover:text-mint-600 transition-colors group-hover:translate-x-0.5" />
								</div>
							</div>

							<div className="text-sm text-ink-600 mt-1 line-clamp-2 leading-relaxed max-w-3xl">
								{j.description}
							</div>

							<div className="flex flex-wrap items-center mt-6 pt-5 border-t border-ink-100/50 gap-6 text-sm">
								<div className="flex items-center gap-2">
									<div className="w-8 h-8 rounded-lg bg-mint-50 flex items-center justify-center text-mint-600">
										<Icon name="rupee" size={16} />
									</div>
									<span className="font-mono text-base font-medium text-ink-900">
										{j.budget_amount ? rupee(j.budget_amount) : 'Open pricing'}
									</span>
								</div>
								<div className="hidden md:block w-px h-6 bg-ink-200" />
								{j.deadline && (
									<>
										<DateBadge value={j.deadline} />
										<div className="hidden md:block w-px h-6 bg-ink-200" />
									</>
								)}
								<span className="capitalize text-ink-600 flex items-center gap-2">
									<Icon name="user" size={15} className="text-ink-400" />
									{j.required_level || 'Any level'}
								</span>
							</div>

							{(j.status === 'open' || j.status === 'matching') && (
								<div className="mt-5 px-4 py-3 bg-gradient-to-r from-orange-500/10 to-transparent border-l-2 border-orange-500 rounded-r-xl text-sm font-medium text-orange-700 flex items-center gap-3">
									<Icon name="sparkles" size={16} className="text-orange-500" />
									You can initiate negotiation on this brief
								</div>
							)}
						</button>
					))
				)}
			</div>
		</div>
	)
}
