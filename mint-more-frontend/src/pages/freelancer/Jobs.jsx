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
		<div className="stack-6">
			<div className="reveal">
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>
					My briefs
				</div>
				<h1 className="h-display h-1" style={{ margin: 0 }}>
					Matched work
				</h1>
				<p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
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

			<div className="stack" style={{ gap: 10 }}>
				{isLoading ? (
					[1, 2, 3].map((i) => <SkeletonCard key={i} />)
				) : filtered.length === 0 ? (
					<div className="empty">
						<div className="empty-glyph">
							<Icon name="briefcase" size={22} />
						</div>
						<h3>Nothing here yet</h3>
						<p>When our engine matches a brief to your profile, it appears here.</p>
					</div>
				) : (
					filtered.map((j) => (
						<button
							key={j.id}
							className="job-card task-card-shell"
							style={{ padding: 16, '--task-status-color': statusAccent(j.status) }}
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

							<div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 4, lineHeight: 1.5 }}>
								{j.description?.slice(0, 140)}{j.description?.length > 140 ? '...' : ''}
							</div>

							<div
								className="row"
								style={{ marginTop: 12, gap: 20, fontSize: 12, color: 'var(--ink-500)', flexWrap: 'wrap' }}
							>
								<span>
									<Icon name="rupee" size={11} />{' '}
									<span className="mono" style={{ fontWeight: 500, color: 'var(--ink-900)' }}>
										{j.budget_amount ? rupee(j.budget_amount) : 'Open pricing'}
									</span>
								</span>
								{j.deadline && <DateBadge value={j.deadline} />}
								<span style={{ textTransform: 'capitalize' }}>{j.required_level || 'Any level'}</span>
							</div>

							{(j.status === 'open' || j.status === 'matching') && (
								<div
									style={{
										marginTop: 12,
										padding: '8px 12px',
										background: 'rgba(247,127,0,0.08)',
										borderRadius: 'var(--radius-md)',
										border: '1px solid rgba(247,127,0,0.2)',
										fontSize: 12.5,
										color: 'var(--mint-700)',
										fontWeight: 500,
									}}
								>
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
