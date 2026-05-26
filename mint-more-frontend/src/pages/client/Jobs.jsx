import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import StatusChip from '../../components/ui/StatusChip'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { rupee } from '../../utils/format'

export default function Jobs() {
	const navigate = useNavigate()
	const [tab, setTab] = useState('all')

	const { data, isLoading } = useQuery({
		queryKey: ['jobs'],
		queryFn: () => jobsApi.list().then((r) => r.data.data.jobs || []),
	})

	const jobs = data || []

	const filtered = jobs.filter((j) => {
		if (tab === 'all') return true
		if (tab === 'active') return ['matching', 'locked', 'negotiating', 'assigned', 'in_progress'].includes(j.status)
		return j.status === tab
	})

	const counts = {
		all: jobs.length,
		active: jobs.filter((j) => ['matching', 'locked', 'negotiating', 'assigned', 'in_progress'].includes(j.status)).length,
		draft: jobs.filter((j) => j.status === 'draft').length,
		completed: jobs.filter((j) => j.status === 'completed').length,
	}

	return (
		<div className="stack-6">
			<div className="row between reveal">
				<div>
					<div className="h-eyebrow" style={{ marginBottom: 4 }}>Jobs</div>
					<h1 className="h-display h-1" style={{ margin: 0 }}>Briefs &amp; campaigns</h1>
				</div>
				<button className="btn primary" onClick={() => navigate('/jobs/new')}>
					<Icon name="plus" /> Post a new brief
				</button>
			</div>

			<Tabs
				value={tab}
				onChange={setTab}
				items={[
					{ value: 'all', label: 'All', count: counts.all },
					{ value: 'active', label: 'Active', count: counts.active },
					{ value: 'draft', label: 'Drafts', count: counts.draft },
					{ value: 'completed', label: 'Completed', count: counts.completed },
				]}
			/>

			<div className="stack" style={{ gap: 10 }}>
				{isLoading ? (
					[1, 2, 3].map((i) => <SkeletonCard key={i} />)
				) : filtered.length === 0 ? (
					<div className="empty">
						<div className="empty-glyph"><Icon name="briefcase" size={22} /></div>
						<h3>Nothing here yet</h3>
						<p>Post your first brief and we'll start matching creatives.</p>
						<button className="btn primary" onClick={() => navigate('/jobs/new')}>
							<Icon name="plus" /> Post a brief
						</button>
					</div>
				) : (
					filtered.map((j) => (
						<button
							key={j.id}
							className="job-card"
							style={{ padding: 16 }}
							onClick={() => navigate(`/jobs/${j.id}`)}
						>
							<div className="row between">
								<div className="row" style={{ gap: 10 }}>
									<span className="badge neutral">{j.category?.name || 'General'}</span>
									<StatusChip status={j.status} />
								</div>
								<Icon name="chevronRight" size={14} className="muted" />
							</div>
							<div style={{ marginTop: 8, fontWeight: 600, fontSize: 15.5, color: 'var(--ink-950)', letterSpacing: '-0.005em' }}>
								{j.title}
							</div>
							<div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 4 }}>
								{j.description?.slice(0, 120)}...
							</div>
							<div className="row" style={{ marginTop: 12, gap: 18, fontSize: 11.5, color: 'var(--ink-500)' }}>
								<span><Icon name="calendar" size={11} /> &nbsp;Deadline {j.deadline ? new Date(j.deadline).toLocaleDateString('en-IN') : 'TBD'}</span>
								<span className="mono" style={{ color: 'var(--ink-900)', fontWeight: 500 }}>
									{j.budget_amount ? rupee(j.budget_amount) : 'Open'}
								</span>
							</div>
						</button>
					))
				)}
			</div>
		</div>
	)
}
