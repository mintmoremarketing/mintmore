import { useCallback, useEffect, useRef, useState } from 'react'
import { helperApi, helperFileUrl, listenToHelper } from '../../../api/helper'
import { APP_STATE } from '../aiEditStatus'
import FileGroup from './FileGroup'
import PlainMarkdown from './PlainMarkdown'

const press = 'transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]'
const primary = `ai-make-btn inline-flex h-12 items-center justify-center rounded-full px-7 text-base font-semibold text-ink-950 disabled:opacity-50 ${press}`
const secondary = `inline-flex h-12 items-center justify-center rounded-full border border-ink-200 bg-white px-6 text-base font-medium text-ink-900 hover:border-ink-400 disabled:opacity-50 ${press}`
const RUNNING = ['queued', 'planning', 'building']

function BriefFields({ job, fields, locked }) {
	const [brief, setBrief] = useState(job.brief || {})
	const [saved, setSaved] = useState(true)
	const timer = useRef(null)

	useEffect(() => () => clearTimeout(timer.current), [])

	const set = (id, value) => {
		const next = { ...brief, [id]: value }
		setBrief(next)
		setSaved(false)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => helperApi.patchJob(job.id, { brief: next }).then(() => setSaved(true)).catch(() => {}), 600)
	}

	const input = 'w-full rounded-lg border border-ink-200 bg-white px-3 text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none disabled:bg-ink-50'
	return (
		<>
			<p className="mt-1 text-sm text-ink-600" aria-live="polite">{locked ? 'Locked while the editor works' : saved ? 'Saved on your computer' : 'Saving…'}</p>
			<div className="mt-4 grid gap-4 md:grid-cols-2">
				{fields.map(field => (
					<label key={field.id} className={field.type === 'long' ? 'md:col-span-2' : ''}>
						<span className="text-sm font-medium text-ink-900">{field.label}{field.required && <span className="text-ink-500"> (needed)</span>}</span>
						{field.type === 'select' ? (
							<select value={brief[field.id] || field.default || ''} disabled={locked} onChange={(event) => set(field.id, event.target.value)} className={`${input} mt-1.5 h-11`}>
								{field.options.map(option => <option key={option}>{option}</option>)}
							</select>
						) : field.type === 'long' ? (
							<textarea rows={3} placeholder={field.placeholder} value={brief[field.id] || ''} disabled={locked} onChange={(event) => set(field.id, event.target.value)} className={`${input} mt-1.5 py-2.5`} />
						) : (
							<input placeholder={field.placeholder} value={brief[field.id] || ''} disabled={locked} onChange={(event) => set(field.id, event.target.value)} className={`${input} mt-1.5 h-11`} />
						)}
					</label>
				))}
			</div>
		</>
	)
}

/** What the editor is doing, newest line last. Collapsed to the last few lines. */
function LiveLog({ lines }) {
	const [open, setOpen] = useState(false)
	if (!lines.length) return null
	const shown = open ? lines : lines.slice(-4)
	return (
		<div className="mt-4 rounded-xl bg-ink-50 p-4">
			<ul className="space-y-1 break-words font-mono text-[13px] leading-relaxed text-ink-700">
				{shown.map((line, index) => <li key={`${line.t}-${index}`} className={line.level === 'error' ? 'text-red-700' : ''}>{line.line}</li>)}
			</ul>
			{lines.length > 4 && (
				<button type="button" onClick={() => setOpen(value => !value)} className="mt-2 text-sm font-medium text-ink-900 underline-offset-4 hover:underline">
					{open ? 'Show less' : `Show all ${lines.length} lines`}
				</button>
			)}
		</div>
	)
}

/**
 * What the outline leaves to the client. Answered before the render, so a wrong word or a guessed
 * detail never costs a whole render. Questions without a safe default must be answered.
 */
function OutlineQuestions({ questions, answers, onChange }) {
	if (!questions?.length) return null
	return (
		<div className="mt-6 rounded-xl bg-amber-50 p-4 md:p-5">
			<h4 className="text-lg font-medium text-ink-900">{questions.length === 1 ? 'One question before the render' : `${questions.length} questions before the render`}</h4>
			<p className="mt-1 text-sm text-ink-700">Rendering costs most of the video's budget, so the editor asks instead of guessing.</p>
			<ol className="mt-4 space-y-5">
				{questions.map(question => {
					const value = answers[question.id] || ''
					const custom = value && !question.options?.includes(value)
					return (
						<li key={question.id}>
							<p className="text-[15px] font-medium text-ink-900">
								{question.question}
								{question.default === null && <span className="font-normal text-ink-600"> (needed)</span>}
							</p>
							{question.why && <p className="mt-0.5 text-sm text-ink-600">{question.why}</p>}
							{question.options?.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{question.options.map(option => (
										<button
											key={option}
											type="button"
											aria-pressed={value === option}
											onClick={() => onChange(question.id, value === option ? '' : option)}
											className={`min-h-10 rounded-full border px-4 py-2 text-left text-sm ${press} ${value === option ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-400'}`}
										>
											{option}{question.default === option && value !== option ? ' (default)' : ''}
										</button>
									))}
								</div>
							)}
							<input
								value={custom || !question.options?.length ? value : ''}
								onChange={(event) => onChange(question.id, event.target.value)}
								placeholder={question.options?.length ? 'Or write your own answer' : question.default ? `Leave empty for: ${question.default}` : 'Your answer'}
								className="mt-2 h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none"
								aria-label={question.question}
							/>
						</li>
					)
				})}
			</ol>
		</div>
	)
}

function Section({ step, title, current, children }) {
	return (
		<section className="rounded-2xl bg-white p-5 md:p-7">
			<div className="flex items-baseline gap-3">
				<span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${current ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'}`}>{step}</span>
				<h3 className="text-xl font-medium text-ink-900">{title}</h3>
			</div>
			<div className="mt-3 md:pl-10">{children}</div>
		</section>
	)
}

/** One paid video, edited by the helper on this computer and controlled from here. */
export default function VideoEditor({ jobId, meta, onLocked }) {
	const [job, setJob] = useState(null)
	const [lines, setLines] = useState([])
	const [notes, setNotes] = useState('')
	const [answers, setAnswers] = useState({})
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const load = useCallback(() => helperApi.job(jobId).then(setJob).catch(err => setError(err.message)), [jobId])

	useEffect(() => {
		load()
		return listenToHelper(jobId, (event) => {
			if (event.type === 'log') setLines(list => [...list.slice(-299), event])
			if (event.type === 'job') {
				setJob(prev => ({ ...prev, ...event.job }))
				// The outline and delivery notes change when a pass ends.
				if (!RUNNING.includes(event.job.status)) load()
			}
		})
	}, [jobId, load])

	if (!job) return <div className="h-64 animate-pulse rounded-2xl bg-ink-100" />

	const running = RUNNING.includes(job.status)
	const hasFootage = job.items.some(item => item.status === 'done')
	const hasPlan = job.outputs?.plan
	const hasFinal = job.outputs?.final
	const canApprove = hasPlan && !running && (job.status === 'plan_ready' || (['failed', 'stopped'].includes(job.status) && !hasFinal))
	const bust = job.updated_at
	const state = APP_STATE[job.status] || APP_STATE.draft
	const step = hasFinal ? 4 : hasPlan ? 3 : hasFootage ? 2 : 1
	const unanswered = (job.questions || []).filter(q => q.default === null && !String(answers[q.id] || '').trim()).length

	const act = async (fn) => {
		setBusy(true)
		setError('')
		try {
			await fn()
			setNotes('')
		} catch (err) {
			// The token ran out or was replaced: reconnect from Creatyv and let them try again.
			if (err.code === 'PAYMENT_REQUIRED') onLocked?.()
			setError(err.message)
		}
		setBusy(false)
	}

	return (
		<div className="space-y-4">
			<p className="text-[15px] text-ink-900" aria-live="polite">
				<span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${state.dot}`} />
				{state.text}
				{running && <span className="text-ink-600"> · keep this computer on; you can close this tab</span>}
			</p>
			{error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800" role="alert">{error}</p>}
			{job.status === 'failed' && job.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800">{job.error}</p>}
			{job.status === 'interrupted' && (
				<div className="flex flex-col gap-3 rounded-2xl bg-white p-5 md:flex-row md:items-center md:justify-between">
					<p className="text-[15px] text-ink-700">The helper was closed while it was {job.interrupted_pass === 'plan' ? 'making the outline' : 'making the reel'}. It remembers what it already did.</p>
					<button disabled={busy} onClick={() => act(() => helperApi.continue(jobId))} className={primary}>Continue</button>
				</div>
			)}

			<Section step={1} title="Footage and files" current={step === 1}>
				<p className="text-[15px] text-ink-600">Drop files or folders onto a group. They're copied to a folder on this computer, not uploaded.</p>
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					{meta.groups.map(group => <FileGroup key={group.id} jobId={jobId} group={group} items={job.items} locked={running} />)}
				</div>
			</Section>

			<Section step={2} title="The brief" current={step === 2}>
				<p className="text-[15px] text-ink-600">The editor reads this first and can't ask questions, so be specific.</p>
				<BriefFields job={job} fields={meta.briefFields} locked={running} />
			</Section>

			<Section step={3} title="The outline" current={step === 2 || step === 3}>
				{!hasPlan && !running && (
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<p className="max-w-[56ch] text-[15px] text-ink-600">The editor studies your footage and references, then shows a shot-by-shot outline with stills. Nothing renders until you approve it.</p>
						<button disabled={busy || !hasFootage} onClick={() => act(() => helperApi.plan(jobId))} className={`${primary} shrink-0`}>Make the outline</button>
					</div>
				)}
				{!hasPlan && !running && !hasFootage && <p className="mt-2 text-sm text-ink-600">Add some footage first.</p>}
				{running && (
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<p className="text-[15px] text-ink-700">{state.text}. This takes a while.</p>
						<button disabled={busy} onClick={() => act(() => helperApi.stop(jobId))} className={`${secondary} !h-10 shrink-0`}>Stop</button>
					</div>
				)}
				{(running || job.status === 'failed') && <LiveLog lines={lines} />}
				{hasPlan && (
					<div className="mt-2">
						{job.outputs.planStills && <img src={helperFileUrl(jobId, 'output/plan-stills.jpg', bust)} alt="Stills from the outline" className="mb-5 w-full rounded-xl bg-ink-100" />}
						<PlainMarkdown source={job.planMd} />
						{canApprove && <OutlineQuestions questions={job.questions} answers={answers} onChange={(id, value) => setAnswers(prev => ({ ...prev, [id]: value }))} />}
						{canApprove && (
							<div className="mt-6 border-t border-ink-100 pt-5">
								<label htmlFor={`notes-${jobId}`} className="text-sm font-medium text-ink-900">Notes for the editor (optional)</label>
								<textarea id={`notes-${jobId}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Open on the night sign, shorter end card" className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-[15px] focus:border-ink-900 focus:outline-none" />
								<div className="mt-3 flex flex-wrap gap-3">
									<button disabled={busy || unanswered > 0} onClick={() => act(() => helperApi.approve(jobId, notes, answers))} className={primary}>Approve and make the reel</button>
									<button disabled={busy || !notes.trim()} onClick={() => act(() => helperApi.plan(jobId, notes))} className={secondary}>Redo the outline</button>
								</div>
								{unanswered > 0 && <p className="mt-2 text-sm text-ink-700">Answer {unanswered === 1 ? 'the question' : `the ${unanswered} questions`} marked needed first.</p>}
							</div>
						)}
					</div>
				)}
			</Section>

			{(hasFinal || job.status === 'building') && (
				<Section step={4} title="Your reel" current={step === 4}>
					{hasFinal ? (
						<div className="grid gap-6 md:grid-cols-[minmax(0,300px)_1fr]">
							<video src={helperFileUrl(jobId, 'output/final.mp4', bust)} controls playsInline className="w-full rounded-xl bg-ink-950" />
							<div className="min-w-0">
								{job.deliveryMd && <PlainMarkdown source={job.deliveryMd} />}
								<div className="mt-5 flex flex-wrap gap-3">
									<button onClick={() => act(() => helperApi.openFolder(jobId))} className={primary}>Open the folder</button>
									<a href={helperFileUrl(jobId, 'output/final.mp4')} target="_blank" rel="noreferrer" className={secondary}>Open the video</a>
								</div>
								{!running && (
									<div className="mt-6 border-t border-ink-100 pt-5">
										<label htmlFor={`changes-${jobId}`} className="text-sm font-medium text-ink-900">Want changes?</label>
										<textarea id={`changes-${jobId}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. The 0:04 cut is too early, music quieter under the end card" className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-[15px] focus:border-ink-900 focus:outline-none" />
										<button disabled={busy || !notes.trim()} onClick={() => act(() => helperApi.revise(jobId, notes))} className={`${secondary} mt-3`}>Ask for changes</button>
									</div>
								)}
							</div>
						</div>
					) : (
						<p className="text-[15px] text-ink-600">Rendering on this computer…</p>
					)}
				</Section>
			)}
		</div>
	)
}
