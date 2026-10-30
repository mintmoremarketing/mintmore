import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { assessmentsApi } from '../../api/assessments'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { useUIStore } from '../../store/ui'
import { Block, Checklist, SpecRow } from '../../components/assessments/AssessmentBits'
import { BTN_DARK, BTN_LINE, bytesLabel, clock, dateOnly, dateTime, fileExt, roughGap, sizeLabel } from '../../utils/assessments'

const STATUS = {
	in_progress: { label: 'In progress', tone: 'bg-sky-50 text-sky-800' },
	submitted: { label: 'Under review', tone: 'bg-ink-100 text-ink-800' },
	passed: { label: 'Passed', tone: 'bg-emerald-50 text-emerald-800' },
	failed: { label: 'Not approved', tone: 'bg-mint-50 text-mint-800' },
	closed: { label: 'Closed', tone: 'bg-ink-100 text-ink-600' },
}

function useNow(active) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!active) return undefined
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [active])
	return now
}

function ItemRow({ item, onRemove, removing }) {
	const isLink = item.kind === 'link'
	return (
		<li className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
			<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-[11px] font-semibold text-ink-600">
				{isLink ? <Icon name="globe" size={17} /> : fileExt(item.name)}
			</span>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium text-ink-900">{item.name}</div>
				<div className="truncate text-xs text-ink-500">{isLink ? item.url : bytesLabel(item.size_bytes)}</div>
			</div>
			{item.url && (
				<a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-ink-700 hover:bg-ink-50">{isLink ? 'Open' : 'Download'}</a>
			)}
			{onRemove && (
				<button type="button" onClick={onRemove} disabled={removing} aria-label={`Remove ${item.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-800 disabled:opacity-40">
					<Icon name="trash" size={15} />
				</button>
			)}
		</li>
	)
}

/** Files and links for an open attempt: upload, add a link, remove. */
function SubmissionEditor({ attempt, refresh }) {
	const pushToast = useUIStore(s => s.pushToast)
	const inputRef = useRef(null)
	const [uploads, setUploads] = useState([])
	const [link, setLink] = useState({ url: '', name: '' })
	const a = attempt.assessment
	const used = attempt.items.length + uploads.length
	const full = used >= a.max_files

	const uploadFiles = async (fileList) => {
		const files = [...fileList].slice(0, Math.max(0, a.max_files - used))
		for (const file of files) {
			const key = `${file.name}-${file.size}-${Date.now()}`
			setUploads(list => [...list, { key, name: file.name, progress: 0 }])
			let prepared
			try {
				prepared = (await assessmentsApi.prepareFile(attempt.id, { name: file.name, size: file.size, type: file.type })).data.data
				await uploadMintboxFile({
					file,
					config: prepared.upload,
					fileType: prepared.upload.content_type,
					onProgress: (done, total) => setUploads(list => list.map(u => (u.key === key ? { ...u, progress: Math.round((done / total) * 100) } : u))),
				})
				await assessmentsApi.completeFile(attempt.id, prepared.item_id)
				await refresh()
			} catch (err) {
				// Free the reserved slot so a retry isn't blocked by the failed upload.
				if (prepared?.item_id) assessmentsApi.removeItem(attempt.id, prepared.item_id).catch(() => {})
				pushToast({ title: `Could not upload ${file.name}`, body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' })
			} finally {
				setUploads(list => list.filter(u => u.key !== key))
			}
		}
	}

	const addLink = useMutation({
		mutationFn: () => assessmentsApi.addLink(attempt.id, link),
		onSuccess: async () => { setLink({ url: '', name: '' }); await refresh() },
		onError: err => pushToast({ title: 'Could not add link', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})
	const remove = useMutation({
		mutationFn: (itemId) => assessmentsApi.removeItem(attempt.id, itemId),
		onSuccess: refresh,
		onError: err => pushToast({ title: 'Could not remove', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	return (
		<div className="space-y-4">
			<button
				type="button"
				disabled={full}
				onClick={() => inputRef.current?.click()}
				onDragOver={e => e.preventDefault()}
				onDrop={e => { e.preventDefault(); if (!full) uploadFiles(e.dataTransfer.files) }}
				className="flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed border-ink-300 bg-white px-4 py-8 text-center transition-colors hover:border-mint-400 hover:bg-mint-50/40 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Icon name="upload" size={22} className="text-ink-500" />
				<span className="mt-1 text-[15px] font-medium text-ink-900">{full ? 'File limit reached' : 'Drop files here or browse'}</span>
				<span className="text-xs text-ink-500">{a.allowed_formats?.join(', ')} · up to {sizeLabel(a.max_file_size_mb)} each · {a.max_files} items max</span>
			</button>
			<input ref={inputRef} type="file" multiple hidden accept={a.allowed_formats?.map(f => `.${f.toLowerCase()}`).join(',')} onChange={e => { uploadFiles(e.target.files); e.target.value = '' }} />

			<form
				onSubmit={e => { e.preventDefault(); if (link.url.trim()) addLink.mutate() }}
				className="flex flex-col gap-2 sm:flex-row"
			>
				<label className="sr-only" htmlFor="link-url">Link to your work</label>
				<input id="link-url" value={link.url} onChange={e => setLink(l => ({ ...l, url: e.target.value }))} disabled={full} placeholder="Or paste a link (Drive, Figma, Frame.io)" className="h-10 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-400 focus:border-mint-400 focus:outline-none disabled:opacity-50" />
				<input value={link.name} onChange={e => setLink(l => ({ ...l, name: e.target.value }))} disabled={full} placeholder="Label (optional)" aria-label="Link label" className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-400 focus:border-mint-400 focus:outline-none disabled:opacity-50 sm:w-44" />
				<button type="submit" disabled={full || !link.url.trim() || addLink.isPending} className="h-10 shrink-0 rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 hover:border-ink-300 disabled:opacity-50">Add link</button>
			</form>

			{(attempt.items.length > 0 || uploads.length > 0) && (
				<ul className="space-y-2">
					{attempt.items.map(item => <ItemRow key={item.id} item={item} onRemove={() => remove.mutate(item.id)} removing={remove.isPending} />)}
					{uploads.map(u => (
						<li key={u.key} className="rounded-xl border border-ink-100 bg-white p-3">
							<div className="flex items-center justify-between text-sm"><span className="truncate font-medium text-ink-900">{u.name}</span><span className="tabular-nums text-ink-500">{u.progress}%</span></div>
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-mint-500 transition-[width] duration-300" style={{ width: `${u.progress}%` }} /></div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function Assets({ assets, locked }) {
	if (locked) return <p className="text-sm text-ink-500">Available once started.</p>
	if (!assets?.length) return <p className="text-sm text-ink-500">This task has no starter files. Work from the brief.</p>
	return (
		<ul className="space-y-2">
			{assets.map(asset => (
				<li key={asset.url} className="flex items-center gap-3 rounded-xl bg-white p-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-[11px] font-semibold text-ink-600">{fileExt(asset.label || asset.url)}</span>
					<span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{asset.label || 'Task file'}</span>
					<a href={asset.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-ink-700 hover:bg-ink-50">Download</a>
				</li>
			))}
		</ul>
	)
}

function ScoreCard({ attempt }) {
	const scores = attempt.criteria_scores || []
	return (
		<Block>
			<div className="flex items-end justify-between gap-4">
				<div>
					<div className="text-sm text-ink-500">Overall score</div>
					<div className="mt-1 text-4xl font-semibold tabular-nums text-ink-900">{attempt.score ?? '—'}<span className="text-lg text-ink-400">/100</span></div>
				</div>
				<span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS[attempt.status].tone}`}>{STATUS[attempt.status].label}</span>
			</div>
			{scores.length > 0 && (
				<div className="mt-6">
					<h3 className="text-[15px] font-semibold text-ink-900">Score by criterion</h3>
					<ul className="mt-3 space-y-3">
						{scores.map(s => (
							<li key={s.name}>
								<div className="flex justify-between text-sm"><span className="text-ink-700">{s.name}</span><span className="font-medium tabular-nums text-ink-900">{s.score}</span></div>
								<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-ink-900" style={{ width: `${s.score}%` }} /></div>
							</li>
						))}
					</ul>
				</div>
			)}
		</Block>
	)
}

/** One attempt: the live task while open, then its review status and result. */
export default function AssessmentAttempt() {
	const { attemptId } = useParams()
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [confirmSubmit, setConfirmSubmit] = useState(false)
	const [notes, setNotes] = useState('')
	const key = ['assessment-attempt', attemptId]
	const { data: attempt, isLoading, isError } = useQuery({
		queryKey: key,
		queryFn: () => assessmentsApi.attempt(attemptId).then(res => res.data.data),
		refetchInterval: q => (q.state.data?.status === 'submitted' ? 60_000 : false),
	})
	const open = attempt?.status === 'in_progress'
	const now = useNow(open)
	const refresh = () => queryClient.invalidateQueries({ queryKey: key })

	const submit = useMutation({
		mutationFn: () => assessmentsApi.submit(attemptId, { notes }),
		onSuccess: () => {
			setConfirmSubmit(false)
			queryClient.invalidateQueries({ queryKey: ['assessments'] })
			refresh()
		},
		onError: err => { setConfirmSubmit(false); pushToast({ title: 'Could not submit', body: err.response?.data?.message, tone: 'amber', icon: 'x' }) },
	})

	if (isLoading) {
		return <div className="mx-auto w-full max-w-[1240px] px-4 pt-10 md:px-10"><div className="h-10 w-1/2 animate-pulse rounded bg-ink-100" /><div className="mt-8 h-72 animate-pulse rounded-2xl bg-ink-50" /></div>
	}
	if (isError || !attempt) {
		return (
			<div className="mx-auto max-w-[640px] px-4 py-16 text-center font-store">
				<h1 className="text-xl font-medium text-ink-900">We couldn't find this attempt</h1>
				<Link to="/assessments" className={`${BTN_DARK} mt-6`}>Back to assessments</Link>
			</div>
		)
	}

	const a = attempt.assessment
	const remaining = new Date(attempt.deadline_at).getTime() - now
	const overdue = open && remaining < 0
	// Only shown once submitted, so submitted_at is always set where it is read.
	const usedMs = new Date(attempt.submitted_at || attempt.started_at).getTime() - new Date(attempt.started_at).getTime()
	const status = STATUS[attempt.status] || STATUS.closed

	return (
		<div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 font-store md:px-10 md:pt-10">
			<Link to={`/assessments/${a.slug}`} className="inline-flex items-center gap-1 text-sm text-ink-600 transition-colors hover:text-ink-900">
				<Icon name="chevronLeft" size={15} /> Back to assessment
			</Link>
			<div className="mt-4 flex flex-wrap items-center gap-3">
				<h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink-900 md:text-[34px]">Level {a.level} – {a.level_name}</h1>
				<span className={`rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}>{status.label}</span>
			</div>

			<div className="mt-6 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_400px] md:gap-12">
				<div className="flex min-w-0 flex-col gap-6">
					{open && (
						<>
							<Block title="Task brief">
								<p className="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{a.task_brief || a.summary}</p>
								{a.deliverables?.length > 0 && (
									<div className="mt-5">
										<div className="mb-2 text-[15px] font-medium text-ink-900">Deliverables</div>
										<Checklist items={a.deliverables} />
									</div>
								)}
								{a.task_guide?.length > 0 && (
									<div className="mt-5">
										<div className="mb-2 text-[15px] font-medium text-ink-900">How to approach it</div>
										<ol className="space-y-2.5">
											{a.task_guide.map((step, i) => (
												<li key={step} className="flex gap-3 text-[15px] text-ink-700">
													<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[13px] font-semibold tabular-nums text-ink-900">{i + 1}</span>
													<span>{step}</span>
												</li>
											))}
										</ol>
									</div>
								)}
							</Block>
							<Block title="Task files">
								<p className="-mt-2 mb-4 text-sm text-ink-500">Everything you need for the task. Downloads stay available until review is done.</p>
								<Assets assets={a.assets} />
							</Block>
							<Block title="Your submission">
								<SubmissionEditor attempt={attempt} refresh={refresh} />
								<label htmlFor="notes" className="mt-5 block text-[15px] font-medium text-ink-900">Note for the reviewer <span className="font-normal text-ink-400">(optional)</span></label>
								<textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Anything the reviewer should know about your choices" className="mt-2 w-full rounded-lg border border-ink-200 bg-white p-3 text-sm placeholder:text-ink-400 focus:border-mint-400 focus:outline-none" />
							</Block>
						</>
					)}

					{attempt.status === 'submitted' && (
						<Block>
							<div className="flex items-start gap-3">
								<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink-900"><Icon name="clock" size={18} /></span>
								<div>
									<h2 className="text-lg font-semibold text-ink-900">Assessment submitted</h2>
									<p className="mt-1 text-sm text-ink-600">Your work is with a reviewer. You can't change it while the review is in progress. You'll get a notification with the result.</p>
									<p className="mt-2 text-sm text-ink-500">Submitted {dateTime(attempt.submitted_at)}{attempt.is_late ? ' · after the deadline' : ''}</p>
								</div>
							</div>
						</Block>
					)}

					{['passed', 'failed'].includes(attempt.status) && <ScoreCard attempt={attempt} />}

					{attempt.status === 'failed' && attempt.review_note && (
						<Block title="Reviewer feedback">
							<p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{attempt.review_note}</p>
						</Block>
					)}

					{attempt.status === 'passed' && (
						<Block title="Services unlocked">
							<p className="-mt-2 mb-4 text-sm text-ink-600">Level {a.level} is now on your profile. Opt in to these on My Services to start getting orders.</p>
							<div className="flex flex-wrap gap-2">{attempt.unlocks.map(s => <span key={s.slug} className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-800">{s.title}</span>)}</div>
							<div className="mt-5 flex flex-wrap gap-2">
								<Link to="/my-services" className={BTN_DARK}>Go to My Services</Link>
								{attempt.next_level && <Link to={`/assessments/${attempt.next_level.slug}`} className={BTN_LINE}>Try Level {attempt.next_level.level}</Link>}
							</div>
						</Block>
					)}

					{attempt.status === 'closed' && (
						<Block><p className="text-sm text-ink-600">This attempt was closed before anything was submitted.</p></Block>
					)}

					{!open && attempt.items.length > 0 && (
						<Block title="What you submitted">
							<ul className="space-y-2">{attempt.items.map(item => <ItemRow key={item.id} item={item} />)}</ul>
							{attempt.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-white p-3 text-sm text-ink-600">{attempt.notes}</p>}
						</Block>
					)}
				</div>

				<aside className="flex flex-col gap-4 md:sticky md:top-24">
					{open && (
						<Block>
							<div className="text-sm text-ink-500">{overdue ? 'Overdue by' : 'Time left'}</div>
							<div className={`mt-1 text-[34px] font-semibold leading-none tabular-nums ${overdue ? 'text-mint-600' : 'text-ink-900'}`}>{overdue ? roughGap(remaining) : clock(remaining)}</div>
							<p className="mt-2 text-sm text-ink-500">Deadline {dateTime(attempt.deadline_at)}{overdue ? '. You can still submit; the reviewer will see it was late.' : ''}</p>
							<button type="button" onClick={() => setConfirmSubmit(true)} disabled={!attempt.items.length} className={`${BTN_DARK} mt-5 md:!w-full disabled:cursor-not-allowed disabled:opacity-50`}>Submit assessment</button>
							{!attempt.items.length && <p className="mt-2 text-xs text-ink-500">Add at least one file or link to submit.</p>}
						</Block>
					)}

					{!open && (
						<Block title="Summary">
							<SpecRow label="Submitted">{attempt.submitted_at ? dateTime(attempt.submitted_at) : '—'}</SpecRow>
							<SpecRow label="Time used">{attempt.submitted_at ? roughGap(usedMs) : '—'}</SpecRow>
							<SpecRow label="Items">{attempt.items.length}</SpecRow>
							{attempt.reviewed_at && <SpecRow label="Reviewed">{dateOnly(attempt.reviewed_at)}</SpecRow>}
						</Block>
					)}

					{attempt.status === 'submitted' && (
						<Block title="What happens next">
							<Checklist items={['A reviewer scores your work against the criteria.', 'You get a notification with the result.', 'If it passes, the services it covers open up on My Services.']} />
						</Block>
					)}

					{attempt.status === 'failed' && (
						<Block title="Before you retake">
							<p className="text-sm text-ink-600">Read the feedback and practise the weak criteria first.</p>
							<SpecRow label="Attempts left">{attempt.attempts_left}</SpecRow>
							<SpecRow label="Next attempt">{attempt.attempts_left === 0 ? 'None left' : new Date(attempt.retry_at) > new Date() ? dateOnly(attempt.retry_at) : 'Available now'}</SpecRow>
							{attempt.attempts_left > 0 && new Date(attempt.retry_at) <= new Date() && <Link to={`/assessments/${a.slug}`} className={`${BTN_DARK} mt-4 md:!w-full`}>Retake assessment</Link>}
						</Block>
					)}

					{(a.required_items?.length > 0 || a.expected_outcome) && (
						<Block title="Requirements">
							{a.required_items?.length > 0 && <Checklist items={a.required_items} />}
							{a.expected_outcome && <p className="mt-4 text-sm leading-relaxed text-ink-600">{a.expected_outcome}</p>}
						</Block>
					)}
				</aside>
			</div>

			{confirmSubmit && (
				<Modal
					title="Submit for review?"
					subtitle={`${attempt.items.length} item${attempt.items.length === 1 ? '' : 's'} attached`}
					onClose={() => !submit.isPending && setConfirmSubmit(false)}
					maxWidth={440}
					footer={<>
						<button type="button" className="btn ghost" onClick={() => setConfirmSubmit(false)} disabled={submit.isPending}>Keep editing</button>
						<button type="button" className="btn primary" onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit'}</button>
					</>}
				>
					<p className="text-sm text-ink-600">You can't change files or links after submitting.{overdue ? ' The deadline has passed, so this will be marked late.' : ''}</p>
				</Modal>
			)}
		</div>
	)
}
