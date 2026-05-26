import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import Icon from '../../components/ui/Icon'
import StatusChip from '../../components/ui/StatusChip'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

export default function JobDetail() {
	const { id } = useParams()
	const navigate = useNavigate()

	const { data, isLoading } = useQuery({
		queryKey: ['job', id],
		queryFn: () => jobsApi.get(id).then((r) => r.data.data.job),
	})

	if (isLoading) {
		return (
			<div className="stack-6">
				<SkeletonCard /><SkeletonCard />
			</div>
		)
	}

	if (!data) {
		return (
			<div className="empty">
				<h3>Job not found</h3>
				<button className="btn ghost" onClick={() => navigate('/jobs')}>Back to jobs</button>
			</div>
		)
	}

	const j = data

	return (
		<div className="stack-6">
			<div>
				<button className="btn link sm" onClick={() => navigate('/jobs')} style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12 }}>
					<Icon name="arrowLeft" size={12} /> All jobs
				</button>
				<div className="row between" style={{ marginTop: 8, flexWrap: 'wrap', gap: 10 }}>
					<div>
						<div className="row" style={{ gap: 8, marginBottom: 6 }}>
							<span className="badge neutral">{j.category?.name}</span>
							<StatusChip status={j.status} />
						</div>
						<h1 className="h-display h-1" style={{ margin: 0 }}>{j.title}</h1>
					</div>
				</div>
			</div>

			<div className="grid-2" style={{ gridTemplateColumns: '1fr 320px', gap: 18 }}>
				<div className="stack" style={{ gap: 18 }}>
					<div className="card" style={{ padding: 22 }}>
						<div className="h-eyebrow" style={{ marginBottom: 10 }}>Brief</div>
						<p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-700)', margin: 0 }}>{j.description}</p>
					</div>

					{['locked', 'negotiating', 'pending_admin_approval'].includes(j.status) && (
						<NegotiationPanel job={j} />
					)}

					{j.status === 'in_progress' && (
						<div className="card" style={{ padding: 22 }}>
							<div className="h-eyebrow" style={{ marginBottom: 10 }}>Messages</div>
							<button className="btn ghost" onClick={() => navigate('/chat')}>
								<Icon name="chat" /> Open full chat
							</button>
						</div>
					)}
				</div>

				<div className="stack" style={{ gap: 14 }}>
					<div className="card" style={{ padding: 18 }}>
						<div className="h-eyebrow" style={{ marginBottom: 10 }}>Details</div>
						<div className="stack" style={{ gap: 10, fontSize: 13 }}>
							<div className="row between">
								<span className="muted">Budget</span>
								<span className="mono">{rupee(j.budget_amount || 0)}</span>
							</div>
							<div className="row between">
								<span className="muted">Pricing</span>
								<span style={{ textTransform: 'capitalize' }}>{j.pricing_mode}</span>
							</div>
							<div className="row between">
								<span className="muted">Level</span>
								<span style={{ textTransform: 'capitalize' }}>{j.required_level}</span>
							</div>
							{j.deadline && (
								<div className="row between">
									<span className="muted">Deadline</span>
									<span>{new Date(j.deadline).toLocaleDateString('en-IN')}</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function NegotiationPanel({ job }) {
	return (
		<div className="card" style={{ padding: 22 }}>
			<div className="h-eyebrow" style={{ marginBottom: 10 }}>Negotiation</div>
			<div style={{ padding: 14, background: 'var(--amber-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(217,119,6,0.2)' }}>
				<div style={{ fontSize: 13, fontWeight: 500, color: 'var(--amber)' }}>
					Status: {job.status.replace(/_/g, ' ')}
				</div>
				<div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 4 }}>
					Full negotiation UI comes in Phase 2
				</div>
			</div>
		</div>
	)
}
