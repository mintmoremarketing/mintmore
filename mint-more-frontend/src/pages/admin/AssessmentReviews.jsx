import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { assessmentsApi } from '../../api/assessments'
import { useUIStore } from '../../store/ui'
import Modal from '../../components/ui/Modal'
import Tabs from '../../components/ui/Tabs'
import Avatar from '../../components/ui/Avatar'
import { AdminPage, EmptyState, PageHeader, Panel, SkeletonRows } from '../../components/admin/AdminUI'
import { bytesLabel, dateTime, fileExt } from '../../utils/assessments'

const VIEWS = [
	{ value: 'submitted', label: 'To review' },
	{ value: 'passed', label: 'Passed' },
	{ value: 'failed', label: 'Not approved' },
	{ value: 'in_progress', label: 'In progress' },
	{ value: 'all', label: 'All' },
]
const STATUS_TONE = {
	submitted: 'bg-ink-100 text-ink-800',
	passed: 'bg-emerald-50 text-emerald-800',
	failed: 'bg-mint-50 text-mint-800',
	in_progress: 'bg-sky-50 text-sky-800',
	closed: 'bg-ink-100 text-ink-600',
}
const STATUS_LABEL = { submitted: 'To review', passed: 'Passed', failed: 'Not approved', in_progress: 'In progress', closed: 'Closed' }

function ReviewModal({ attemptId, onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const { data: attempt, isLoading } = useQuery({
		queryKey: ['assessment-attempt', attemptId],
		queryFn: () => assessmentsApi.attempt(attemptId).then(res => res.data.data),
	})
	const [scores, setScores] = useState({})
	const [note, setNote] = useState('')
	const criteria = attempt?.assessment?.evaluation_criteria || []
	const filled = criteria.filter(c => scores[c.name] !== undefined && scores[c.name] !== '')
	// Weighted by each criterion's share, so the overall matches what the freelancer was told.
	const weight = criteria.reduce((sum, c) => sum + Number(c.weight_pct || 0), 0) || 1
	const overall = filled.length === criteria.length && criteria.length
		? Math.round(criteria.reduce((sum, c) => sum + Number(scores[c.name]) * Number(c.weight_pct || 0), 0) / weight)
		: null

	const review = useMutation({
		mutationFn: (decision) => assessmentsApi.adminReview(attemptId, {
			decision,
			score: overall,
			criteria_scores: criteria.map(c => ({ name: c.name, score: Number(scores[c.name] || 0) })),
			note,
		}),
		onSuccess: (_res, decision) => {
			queryClient.invalidateQueries({ queryKey: ['admin-assessment-attempts'] })
			pushToast({ title: decision === 'passed' ? 'Marked as passed' : 'Marked as not approved', icon: 'check' })
			onClose()
		},
		onError: err => pushToast({ title: 'Could not save review', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})
	const reviewable = attempt?.status === 'submitted'

	return (
		<Modal
			title={attempt ? `Level ${attempt.assessment.level} – ${attempt.assessment.level_name}` : 'Assessment'}
			subtitle={attempt ? `${attempt.freelancer_name} · ${attempt.assessment.category_name}` : undefined}
			onClose={onClose}
			maxWidth={640}
			footer={reviewable ? <>
				<button type="button" className="btn ghost text-rose-600" disabled={review.isPending} onClick={() => review.mutate('failed')}>Not approved</button>
				<button type="button" className="btn primary" disabled={review.isPending || overall === null} onClick={() => review.mutate('passed')}>Pass{overall !== null ? ` · ${overall}/100` : ''}</button>
			</> : <button type="button" className="btn ghost" onClick={onClose}>Close</button>}
		>
			{isLoading || !attempt ? <div className="h-40 animate-pulse rounded-xl bg-ink-50" /> : (
				<div className="space-y-5">
					<div className="text-sm text-ink-500">
						Submitted {dateTime(attempt.submitted_at)}
						{attempt.is_late && <span className="ml-2 rounded-md bg-mint-50 px-1.5 py-0.5 text-xs font-medium text-mint-700">Late</span>}
					</div>
					<div>
						<h3 className="mb-2 text-sm font-semibold text-ink-900">Submitted work</h3>
						{attempt.items.length === 0 ? <p className="text-sm text-ink-500">Nothing attached.</p> : (
							<ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
								{attempt.items.map(item => (
									<li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
										<span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-50 text-[10px] font-semibold text-ink-600">{item.kind === 'link' ? 'URL' : fileExt(item.name)}</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium text-ink-900">{item.name}</span>
											<span className="block truncate text-xs text-ink-500">{item.kind === 'link' ? item.url : bytesLabel(item.size_bytes)}</span>
										</span>
										{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-mint-600 hover:text-mint-700">{item.kind === 'link' ? 'Open' : 'Download'}</a>}
									</li>
								))}
							</ul>
						)}
						{attempt.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{attempt.notes}</p>}
					</div>

					{reviewable ? (
						<>
							<div>
								<h3 className="mb-2 text-sm font-semibold text-ink-900">Score each criterion (0–100)</h3>
								<div className="grid gap-2 sm:grid-cols-2">
									{criteria.map(c => (
										<label key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
											<span className="text-sm text-ink-700">{c.name} <span className="text-xs text-ink-400">{c.weight_pct}%</span></span>
											<input type="number" min={0} max={100} inputMode="numeric" value={scores[c.name] ?? ''} onChange={e => setScores(s => ({ ...s, [c.name]: e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))) }))} className="h-8 w-16 rounded-md border border-ink-200 px-2 text-right text-sm tabular-nums focus:border-mint-400 focus:outline-none" />
										</label>
									))}
								</div>
							</div>
							<label className="block">
								<span className="mb-1 block text-sm font-semibold text-ink-900">Feedback for the freelancer</span>
								<textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Required if not approved. Say what to improve before a retake." className="w-full rounded-lg border border-ink-200 p-3 text-sm focus:border-mint-400 focus:outline-none" />
							</label>
						</>
					) : (
						<div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
							{STATUS_LABEL[attempt.status]}{attempt.score != null ? ` · ${attempt.score}/100` : ''}
							{attempt.review_note && <p className="mt-1 whitespace-pre-line text-ink-600">{attempt.review_note}</p>}
						</div>
					)}
				</div>
			)}
		</Modal>
	)
}

export default function AdminAssessmentReviews() {
	const [params, setParams] = useSearchParams()
	const view = VIEWS.some(v => v.value === params.get('view')) ? params.get('view') : 'submitted'
	const [open, setOpen] = useState(null)
	const { data: rows = [], isLoading } = useQuery({
		queryKey: ['admin-assessment-attempts', view],
		queryFn: () => assessmentsApi.adminAttempts({ status: view }).then(res => res.data.data || []),
		refetchInterval: 60_000,
	})

	return (
		<AdminPage>
			<PageHeader title="Assessments" description="Freelancers qualify for a category by passing its levels. Score each submission against the criteria, then pass it or send feedback." />
			<div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
				<Tabs items={VIEWS} value={view} onChange={next => setParams({ view: next }, { replace: true })} />
			</div>
			<Panel>
				{isLoading ? <SkeletonRows rows={4} /> : rows.length === 0 ? (
					<EmptyState
						title={view === 'submitted' ? 'Nothing waiting for review' : 'No attempts here yet'}
						body={view === 'submitted' ? 'When a freelancer submits an assessment it shows up here, oldest first.' : 'Attempts move here as freelancers take assessments.'}
					/>
				) : (
					<ul className="divide-y divide-ink-100">
						{rows.map(row => (
							<li key={row.id}>
								<button type="button" onClick={() => setOpen(row.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 md:px-5">
									<Avatar name={row.freelancer_name} src={row.freelancer_avatar} size="sm" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-ink-900">{row.freelancer_name}</span>
										<span className="block truncate text-xs text-ink-500">{row.category_name} · Level {row.level} · {row.item_count} item{row.item_count === 1 ? '' : 's'}</span>
									</span>
									<span className="hidden text-right text-xs text-ink-500 sm:block">
										{row.submitted_at ? dateTime(row.submitted_at) : `Started ${dateTime(row.started_at)}`}
										{row.is_late && <span className="ml-1.5 font-medium text-mint-600">Late</span>}
									</span>
									<span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}{row.score != null ? ` · ${row.score}` : ''}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Panel>
			{open && <ReviewModal attemptId={open} onClose={() => setOpen(null)} />}
		</AdminPage>
	)
}
