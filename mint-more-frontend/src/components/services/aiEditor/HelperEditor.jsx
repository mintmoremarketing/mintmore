import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../ui/Icon'
import { aiEditsApi } from '../../../api/aiEdits'
import { helperApi, listenToHelper } from '../../../api/helper'
import VideoEditor from './VideoEditor'

// The one-click Windows installer, served with the site from public/downloads. It is built by
// scripts/build-helper.mjs in editing-os-saas. VITE_AI_HELPER_URL can point somewhere else.
const HELPER_DOWNLOAD_URL = import.meta.env.VITE_AI_HELPER_URL || '/downloads/CreatyvHelperSetup.exe'

const press = 'transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]'
const primary = `ai-make-btn inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-ink-950 disabled:opacity-50 ${press}`

/** Finds the helper on this computer, and keeps looking while it isn't there. */
function useHelper() {
	const [hello, setHello] = useState(undefined) // undefined: looking, null: not found
	const look = useCallback(() => helperApi.hello().then(setHello), [])
	const found = Boolean(hello)
	useEffect(() => {
		look()
		if (found) return undefined
		const timer = setInterval(look, 4000)
		return () => clearInterval(timer)
	}, [found, look])
	return { hello, look }
}

function InstallHelper({ looking }) {
	return (
		<section className="rounded-2xl bg-white p-5 md:p-7">
			<h2 className="text-xl font-medium text-ink-900">Install the Creatyv helper, once</h2>
			<p className="mt-1.5 max-w-[60ch] text-[15px] text-ink-600">
				It edits and renders on your computer, so your footage is never uploaded. You use it from this page. There's no separate app to open.
			</p>
			<ol className="mt-5 grid gap-4 text-[15px] md:grid-cols-3 md:gap-6">
				<li><span className="font-medium text-ink-900">1. Download it.</span> <span className="text-ink-600">Windows only for now.</span></li>
				<li><span className="font-medium text-ink-900">2. Open CreatyvHelperSetup.exe.</span> <span className="text-ink-600">If Windows says it protected your PC, choose More info, then Run anyway. It installs itself and starts with Windows.</span></li>
				<li><span className="font-medium text-ink-900">3. Come back here.</span> <span className="text-ink-600">This page finds it by itself. If the browser asks to reach apps on your device, allow it.</span></li>
			</ol>
			<div className="mt-6 flex flex-wrap items-center gap-4">
				{HELPER_DOWNLOAD_URL ? (
					<a href={HELPER_DOWNLOAD_URL} download className={primary}><Icon name="download" size={16} /> Download the helper</a>
				) : (
					<p className="text-[15px] text-ink-900">The helper is in private testing and not available to download yet.</p>
				)}
				<span className="flex items-center gap-2 text-sm text-ink-600" aria-live="polite">
					<span className={`h-2 w-2 rounded-full ${looking ? 'animate-pulse bg-amber-400' : 'bg-ink-300'}`} />
					{looking ? 'Looking for the helper…' : 'Not found on this computer yet'}
				</span>
			</div>
		</section>
	)
}

/** First run on a computer: the studio and the AI editor go in (about 1 GB, 10–15 minutes). */
function SetUpHelper({ check, onReady }) {
	const [running, setRunning] = useState(false)
	const [last, setLast] = useState('')
	const [failed, setFailed] = useState('')

	useEffect(() => listenToHelper('system', (event) => {
		if (event.type === 'log') setLast(event.line)
		if (event.type === 'setup') {
			setRunning(event.state === 'running')
			if (event.state === 'failed') setFailed(event.error || 'Setup stopped.')
			if (event.state === 'done') onReady()
		}
	}), [onReady])

	const blocking = check.items.filter(item => item.state === 'bad')
	const needsStudio = blocking.some(item => item.action === 'setup-studio')
	const start = async () => {
		setFailed('')
		setRunning(true)
		try { await helperApi.setupStudio() } catch (error) { setFailed(error.message); setRunning(false) }
	}

	return (
		<section className="rounded-2xl bg-white p-5 md:p-7">
			<h2 className="text-xl font-medium text-ink-900">{running ? 'Setting up the editor…' : 'One more step on this computer'}</h2>
			<p className="mt-1.5 max-w-[60ch] text-[15px] text-ink-600">
				{running
					? 'Downloading the video engine. This takes 10 to 15 minutes. You can leave this page open or come back later.'
					: 'The helper needs its video engine and AI editor, about 1 GB. This happens once.'}
			</p>
			<ul className="mt-5 divide-y divide-ink-100 rounded-xl bg-ink-50">
				{blocking.map(item => (
					<li key={item.id} className="px-4 py-3 text-[15px]">
						<span className="font-medium text-ink-900">{item.label}</span>
						<span className="text-ink-600"> · {item.fix || item.detail}</span>
					</li>
				))}
			</ul>
			{running && last && <p className="mt-4 truncate font-mono text-[13px] text-ink-600" aria-live="polite">{last}</p>}
			{failed && <p className="mt-4 text-[15px] text-red-700" role="alert">{failed}</p>}
			{needsStudio && !running && <button onClick={start} className={`${primary} mt-6`}>Set up the editor</button>}
		</section>
	)
}

/** Finds or makes this video's job in the helper, and hands it the paid token from Creatyv. */
function VideoSlot({ edit, videoNumber, hello, meta }) {
	const [jobId, setJobId] = useState(null)
	const [error, setError] = useState('')
	const started = useRef(false)

	const connect = useCallback(async (id) => {
		const { data } = await aiEditsApi.connect(edit.id, { video_number: videoNumber, device: hello.device })
		await helperApi.connect(id, data.data)
	}, [edit.id, videoNumber, hello.device])

	useEffect(() => {
		if (started.current) return
		started.current = true
		;(async () => {
			try {
				const jobs = await helperApi.jobsFor(edit.id)
				let job = jobs.find(j => j.creatyv?.video_number === videoNumber)
				if (!job) job = await helperApi.createJob(edit.videos > 1 ? `${edit.title} ${videoNumber}` : edit.title, { ai_edit_id: edit.id, video_number: videoNumber })
				if (!job.access?.unlocked) await connect(job.id)
				setJobId(job.id)
			} catch (err) {
				setError(err.response?.data?.message || err.message)
			}
		})()
	}, [edit, videoNumber, connect])

	const relock = useCallback(() => {
		if (jobId) connect(jobId).catch(err => setError(err.response?.data?.message || err.message))
	}, [jobId, connect])

	if (error) return <p className="rounded-2xl bg-red-50 px-5 py-4 text-[15px] text-red-800" role="alert">{error}</p>
	if (!jobId) return <div className="h-64 animate-pulse rounded-2xl bg-ink-100" />
	return <VideoEditor jobId={jobId} meta={meta} onLocked={relock} />
}

/** A paid AI edit: the helper on this computer does the work, this page drives it. */
export default function HelperEditor({ edit }) {
	const { hello, look } = useHelper()
	const [check, setCheck] = useState(null)
	const [meta, setMeta] = useState(null)
	const [video, setVideo] = useState(1)

	const refresh = useCallback(() => {
		helperApi.check().then(setCheck).catch(() => look())
		helperApi.meta().then(setMeta).catch(() => {})
	}, [look])

	useEffect(() => { if (hello) refresh() }, [hello, refresh])

	if (hello === undefined) return <div className="h-48 animate-pulse rounded-2xl bg-ink-100" />
	if (!hello) return <InstallHelper looking />
	if (!check || !meta) return <div className="h-48 animate-pulse rounded-2xl bg-ink-100" />
	if (!check.canEdit) return <SetUpHelper check={check} onReady={refresh} />

	return (
		<div>
			{edit.videos > 1 && (
				<div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Videos">
					{Array.from({ length: edit.videos }, (_, index) => index + 1).map(number => (
						<button
							key={number}
							role="tab"
							aria-selected={video === number}
							onClick={() => setVideo(number)}
							className={`h-10 rounded-full px-5 text-[15px] font-medium ${press} ${video === number ? 'bg-ink-900 text-white' : 'bg-white text-ink-900 hover:bg-ink-100'}`}
						>
							Video {number}
						</button>
					))}
				</div>
			)}
			<VideoSlot key={video} edit={edit} videoNumber={video} hello={hello} meta={meta} />
		</div>
	)
}
