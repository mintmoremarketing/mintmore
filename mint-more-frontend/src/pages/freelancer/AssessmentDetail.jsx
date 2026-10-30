import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { assessmentsApi } from '../../api/assessments'
import { useUIStore } from '../../store/ui'
import { Block, Checklist, Chip, ProfileNotice, SpecRow } from '../../components/assessments/AssessmentBits'
import { BTN_DARK, BTN_LINE, BTN_OFF, dateOnly, durationLabel, sizeLabel } from '../../utils/assessments'

function Section({ title, children }) {
	return (
		<section className="border-t border-ink-100 pt-8 first:border-0 first:pt-0">
			<h2 className="mb-3 text-xl font-medium text-ink-900 md:text-2xl">{title}</h2>
			{children}
		</section>
	)
}

/** Primary action for the level, plus Share. Mirrors the list's states. */
function ActionCard({ a, onStart, starting }) {
	const attempt = a.latest_attempt ? `/assessments/attempts/${a.latest_attempt.id}` : null
	const pushToast = useUIStore(s => s.pushToast)
	const full = 'md:!w-full'
	let primary
	switch (a.state) {
		case 'held': primary = <Link to={attempt} className={`${BTN_DARK} ${full}`}>View result</Link>; break
		case 'in_progress': primary = <Link to={attempt} className={`${BTN_DARK} ${full}`}>Continue assessment</Link>; break
		case 'submitted': primary = <Link to={attempt} className={`${BTN_LINE} ${full}`}>View submission</Link>; break
		case 'busy': primary = <span className={`${BTN_LINE} ${BTN_OFF} ${full}`}>Finish your current assessment first</span>; break
		case 'no_attempts_left': primary = <span className={`${BTN_LINE} ${BTN_OFF} ${full}`}>No attempts left</span>; break
		case 'cooldown': primary = <span className={`${BTN_LINE} ${BTN_OFF} ${full}`}>Retake from {dateOnly(a.cooldown_until)}</span>; break
		case 'profile_required': primary = <span aria-disabled="true" className={`${BTN_DARK} ${BTN_OFF} ${full}`}>Start assessment</span>; break
		default: primary = <button type="button" onClick={onStart} disabled={starting} className={`${BTN_DARK} ${full}`}>{starting ? 'Starting…' : 'Start assessment'}</button>
	}
	const share = async () => {
		const url = window.location.href
		try {
			if (navigator.share) await navigator.share({ title: `Level ${a.level} – ${a.level_name}`, url })
			else { await navigator.clipboard.writeText(url); pushToast({ title: 'Link copied', icon: 'check' }) }
		} catch { /* share sheet dismissed */ }
	}
	return (
		<Block className="space-y-3">
			{primary}
			<button type="button" onClick={share} className={`${BTN_LINE} ${full}`}><Icon name="arrowUpRight" size={16} /> Share assessment</button>
			{a.state === 'cooldown' && attempt && (
				<p className="text-sm text-ink-600">Your last attempt was not approved. <Link to={attempt} className="font-medium text-ink-900 underline underline-offset-2">See the feedback</Link></p>
			)}
		</Block>
	)
}

function DetailSkeleton() {
	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 pt-10 md:px-8">
			<div className="h-5 w-16 animate-pulse rounded bg-ink-100" />
			<div className="mt-5 h-10 w-2/3 animate-pulse rounded bg-ink-100" />
			<div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_400px]">
				<div className="h-80 animate-pulse rounded-2xl bg-ink-50" />
				<div className="h-80 animate-pulse rounded-2xl bg-ink-50" />
			</div>
		</div>
	)
}

/** One assessment level: the brief and rules, with Start on the right. */
export default function AssessmentDetail() {
	const { slug } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [confirming, setConfirming] = useState(false)
	const { data: a, isLoading, isError } = useQuery({
		queryKey: ['assessment', slug],
		queryFn: () => assessmentsApi.get(slug).then(res => res.data.data),
	})
	const start = useMutation({
		mutationFn: () => assessmentsApi.start(slug).then(res => res.data.data),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ['assessments'] })
			queryClient.invalidateQueries({ queryKey: ['assessment', slug] })
			navigate(`/assessments/attempts/${result.attempt_id}`)
		},
		onError: err => {
			setConfirming(false)
			pushToast({ title: 'Could not start', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
		},
	})

	if (isLoading) return <DetailSkeleton />
	if (isError || !a) {
		return (
			<div className="mx-auto max-w-[640px] px-4 py-16 text-center font-store">
				<h1 className="text-xl font-medium text-ink-900">This assessment is not available</h1>
				<p className="mt-2 text-sm text-ink-500">It may have been closed. Pick another level from the list.</p>
				<Link to="/assessments" className={`${BTN_DARK} mt-6`}>Back to assessments</Link>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-8 font-store md:px-8 md:pt-10">
			<Link to={`/assessments?category=${a.category_slug}`} className="inline-flex items-center gap-1 text-sm text-ink-600 transition-colors hover:text-ink-900">
				<Icon name="chevronLeft" size={15} /> Back
			</Link>

			<div className="mt-4 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_400px] md:gap-12">
				<div className="min-w-0">
					<h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink-900 md:text-[34px]">Level {a.level} – {a.level_name}</h1>
					<div className="mt-4 flex flex-wrap gap-2">
						<Chip tone="sky"><Icon name="clock" size={14} /> {durationLabel(a.duration_minutes)}</Chip>
						<Chip tone="mint">{a.attempts_left} of {a.max_attempts} attempts left</Chip>
						<Chip>{a.category_name}</Chip>
					</div>
					{!a.profile?.ready && <ProfileNotice className="mt-5" />}

					<div className="mt-8 space-y-8 border-t border-ink-100 pt-8">
						<Section title="Task brief">
							{a.task_locked ? (
								<>
									{a.summary && <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-600 md:text-base">{a.summary}</p>}
									<p className="mt-3 flex max-w-[70ch] gap-2.5 rounded-xl bg-ink-50 p-4 text-[15px] leading-relaxed text-ink-700">
										<Icon name="lock" size={16} className="mt-1 shrink-0 text-ink-500" />
										<span>The full brief, files and guide open when you start, and the timer starts at the same moment, so everyone gets the same {durationLabel(a.duration_minutes).toLowerCase()} with the task.</span>
									</p>
								</>
							) : (
								<p className="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-600 md:text-base">{a.task_brief || a.summary}</p>
							)}
						</Section>
						{a.deliverables?.length > 0 && (
							<Section title="Deliverables">
								<Checklist items={a.deliverables} />
							</Section>
						)}
						{a.expected_outcome && (
							<Section title="Expected outcome">
								<p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-600 md:text-base">{a.expected_outcome}</p>
							</Section>
						)}
						{a.unlocks?.length > 0 && (
							<Section title="Services you can unlock">
								<div className="flex flex-wrap gap-2">
									{a.unlocks.map(s => <Chip key={s.slug}>{s.title}</Chip>)}
								</div>
							</Section>
						)}
						{a.task_guide?.length > 0 && (
							<Section title="How to approach it">
								<ol className="space-y-3">
									{a.task_guide.map((step, i) => (
										<li key={step} className="flex gap-3 text-[15px] text-ink-700">
											<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-50 text-sm font-semibold tabular-nums text-ink-900">{i + 1}</span>
											<span className="pt-0.5">{step}</span>
										</li>
									))}
								</ol>
							</Section>
						)}
					</div>
				</div>

				<aside className="flex flex-col gap-4 md:sticky md:top-24">
					<ActionCard a={a} onStart={() => setConfirming(true)} starting={start.isPending} />
					<Block title="Submission requirements">
						<SpecRow label="File format">{a.allowed_formats?.join(' / ') || 'Any'}</SpecRow>
						<SpecRow label="Maximum files">{a.max_files}</SpecRow>
						<SpecRow label="Maximum size">{sizeLabel(a.max_file_size_mb)} each</SpecRow>
						{a.required_items?.length > 0 && (
							<div className="pt-3">
								<div className="mb-2 text-[15px] font-medium text-ink-900">Required</div>
								<Checklist items={a.required_items} />
							</div>
						)}
					</Block>
					{a.required_tools?.length > 0 && (
						<Block title="Tools">
							<div className="flex flex-wrap gap-2">{a.required_tools.map(t => <Chip key={t.name}>{t.name}</Chip>)}</div>
						</Block>
					)}
					{a.languages?.length > 0 && (
						<Block title="Language">
							<div className="flex flex-wrap gap-2">{a.languages.map(l => <Chip key={l}>{l}</Chip>)}</div>
						</Block>
					)}
					{a.evaluation_criteria?.length > 0 && (
						<Block title="How it is scored">
							{a.evaluation_criteria.map(c => <SpecRow key={c.name} label={c.name}>{c.weight_pct}%</SpecRow>)}
						</Block>
					)}
				</aside>
			</div>

			{confirming && (
				<Modal
					title="Ready to start?"
					subtitle={`Level ${a.level} – ${a.level_name}`}
					onClose={() => !start.isPending && setConfirming(false)}
					maxWidth={440}
					footer={<>
						<button type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={start.isPending}>Not yet</button>
						<button type="button" className="btn primary" onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? 'Starting…' : 'Start now'}</button>
					</>}
				>
					<p className="text-sm text-ink-600">The brief and files open now, and the timer starts at the same moment. It keeps running if you leave the page.</p>
					<div className="mt-4 rounded-xl bg-ink-50 p-4 text-center">
						<div className="text-xs text-ink-500">Time to submit</div>
						<div className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{durationLabel(a.duration_minutes)}</div>
					</div>
					<p className="mt-3 text-xs text-ink-500">This uses 1 of your {a.attempts_left} remaining attempts.</p>
				</Modal>
			)}
		</div>
	)
}
