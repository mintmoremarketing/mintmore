// LAUNCH-HIDDEN: replaced by OrderConversation (deliveries now live in the order conversation). Kept for reference.
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mintboxApi } from '../../api/mintbox'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { useUIStore } from '../../store/ui'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { timeAgo } from '../../utils/format'

const RATING_FIELDS = [
	['rating_quality', 'Quality of work'],
	['rating_communication', 'Communication'],
	['timeliness_rating', 'Timeliness'],
	['brief_adherence_rating', 'Followed the brief'],
]

const fileKind = (file) => String(file.mime_type || file.content_type || '').split('/')[0]
	|| (/\.(png|jpe?g|webp|gif|avif)$/i.test(file.original_name || '') ? 'image' : /\.(mp4|mov|webm)$/i.test(file.original_name || '') ? 'video' : '')
const isImageFile = (file) => fileKind(file) === 'image'
const isVideoFile = (file) => fileKind(file) === 'video'

/** Image deliveries get a real preview; anything else, or an image that fails to load, gets the file icon. */
function FileThumb({ file }) {
	const [broken, setBroken] = useState(false)
	if (isImageFile(file) && file.public_url && !broken) {
		return (
			<a href={file.public_url} target="_blank" rel="noreferrer" className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-50 ring-1 ring-ink-200 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95" aria-label={`Preview ${file.original_name}`}>
				<img src={file.public_url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
			</a>
		)
	}
	return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600"><Icon name={isVideoFile(file) ? 'video' : 'file'} size={18} /></span>
}

const formatSize = (bytes) => {
	const value = Number(bytes || 0)
	if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
	if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
	return `${Math.max(1, Math.round(value / 1024))} KB`
}

function Uploader({ jobId, label, hint, notePlaceholder, onUploaded }) {
	const pushToast = useUIStore(s => s.pushToast)
	const inputRef = useRef(null)
	const [note, setNote] = useState('')
	const [state, setState] = useState({ status: 'idle', progress: 0, name: '' })

	const upload = async (file) => {
		if (!file) return
		const type = file.type || 'application/octet-stream'
		setState({ status: 'preparing', progress: 0, name: file.name })
		try {
			const prepared = await mintboxApi.prepareUpload(jobId, { name: file.name, size: file.size, type, note: note.trim() || undefined })
			const config = prepared.data?.data?.upload
			await uploadMintboxFile({
				file,
				config,
				fileType: type,
				onProgress: (done, total) => setState({ status: 'uploading', progress: Math.round((done / total) * 100), name: file.name }),
			})
			await mintboxApi.completeUpload(config.upload_id)
			setState({ status: 'idle', progress: 0, name: '' })
			setNote('')
			pushToast({ title: 'File uploaded', body: file.name, icon: 'check' })
			onUploaded?.()
		} catch (error) {
			setState({ status: 'failed', progress: 0, name: file.name })
			pushToast({ title: 'Upload failed', body: error.response?.data?.message || error.message || 'Try again', tone: 'amber', icon: 'x' })
		} finally {
			if (inputRef.current) inputRef.current.value = ''
		}
	}

	const busy = state.status === 'preparing' || state.status === 'uploading'
	return (
		<div className="rounded-2xl border border-dashed border-mint-300 bg-mint-50/40 p-4">
			<div className="flex flex-col sm:flex-row sm:items-center gap-3">
				<div className="flex-1 min-w-0">
					<div className="text-sm font-bold text-ink-900">{label}</div>
					<div className="text-xs text-ink-500 mt-0.5">{hint}</div>
				</div>
				<button type="button" className="btn primary" disabled={busy} onClick={() => inputRef.current?.click()}>
					<Icon name="upload" size={14} /> {busy ? `${state.status === 'preparing' ? 'Preparing' : `${state.progress}%`}` : 'Choose file'}
				</button>
				<input ref={inputRef} type="file" className="hidden" onChange={e => upload(e.target.files?.[0])} />
			</div>
			{notePlaceholder && (
				<input
					value={note}
					onChange={e => setNote(e.target.value)}
					placeholder={notePlaceholder}
					className="mt-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-mint-400"
				/>
			)}
			{busy && (
				<div className="mt-3">
					<div className="text-xs text-ink-600 truncate mb-1">{state.name}</div>
					<div className="h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className="h-full bg-mint-500 transition-all" style={{ width: `${state.progress}%` }} /></div>
				</div>
			)}
		</div>
	)
}

/**
 * Deliveries + review for a service order. role is 'client' or 'freelancer'.
 */
export default function DeliveriesPanel({ booking, role, onChanged }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const jobId = booking.job_id
	const [revisionFor, setRevisionFor] = useState(null)
	const [revisionNote, setRevisionNote] = useState('')
	const [showRating, setShowRating] = useState(false)
	const [ratings, setRatings] = useState({ rating_quality: 5, rating_communication: 5, timeliness_rating: 5, brief_adherence_rating: 5 })
	const [reviewText, setReviewText] = useState('')

	const queryKey = ['mintbox-job', jobId]
	const { data, isLoading } = useQuery({
		queryKey,
		queryFn: () => mintboxApi.getJobFolder(jobId).then(res => res.data.data),
		enabled: Boolean(jobId) && booking.assignment_status === 'assigned',
		refetchInterval: 30_000,
	})

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey })
		onChanged?.()
	}

	const review = useMutation({
		mutationFn: ({ fileId, action, note }) => mintboxApi.reviewFile(fileId, { action, note }),
		onSuccess: (_res, vars) => {
			pushToast({ title: vars.action === 'approve' ? 'Delivery approved' : 'Revision requested', icon: 'check' })
			setRevisionFor(null)
			setRevisionNote('')
			refresh()
		},
		onError: err => pushToast({ title: 'Could not update delivery', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const complete = useMutation({
		mutationFn: () => mintboxApi.completeProject(jobId, { ...ratings, review_text: reviewText.trim() || undefined }),
		onSuccess: () => {
			pushToast({ title: 'Order completed', body: 'Thanks! Payment has been released to the freelancer.', icon: 'check' })
			setShowRating(false)
			refresh()
		},
		onError: err => pushToast({ title: 'Could not complete order', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	if (booking.assignment_status !== 'assigned') {
		return <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">Deliveries appear here once a freelancer is assigned.</div>
	}
	if (isLoading) return <div className="text-sm text-ink-500">Loading files…</div>

	const files = data?.files || []
	const deliveries = files.filter(file => file.purpose === 'delivery')
	const references = files.filter(file => file.purpose === 'brief')
	const latest = deliveries[0]
	const revisions = data?.revisions || {}
	const included = Number(revisions.free_rounds ?? booking.revisions_included ?? 0)
	const used = Number(revisions.rounds_used ?? booking.revisions_used ?? 0)
	const left = Math.max(0, included - used)
	const activeRound = revisions.active_round
	const completed = booking.stage === 'completed'
	const canReviewLatest = role === 'client' && latest?.status === 'submitted' && !completed
	const canComplete = role === 'client' && latest?.status === 'approved' && !activeRound && !completed

	return (
		<div className="space-y-5">
			<p className="text-sm text-ink-600">
				{deliveries.length} deliver{deliveries.length === 1 ? 'y' : 'ies'}
				<span className="mx-1.5 text-ink-300">·</span>
				<span className={left > 0 ? 'text-ink-900 font-semibold' : 'text-rose-700 font-semibold'}>{left} of {included} revision{included === 1 ? '' : 's'} left</span>
				{activeRound && <><span className="mx-1.5 text-ink-300">·</span><span className="font-semibold text-violet-700">Revision {activeRound.round_number} in progress</span></>}
			</p>

			{canComplete && (
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
					<div className="flex-1">
						<div className="text-sm font-bold text-emerald-800">You approved the latest delivery</div>
						<div className="text-xs text-emerald-700 mt-0.5">Complete the order and rate the freelancer to release their payment.</div>
					</div>
					<button className="btn primary" onClick={() => setShowRating(true)}><Icon name="checkCircle" size={14} /> Complete &amp; rate</button>
				</div>
			)}

			{role === 'freelancer' && !completed && (
				<Uploader
					jobId={jobId}
					label={activeRound ? `Deliver revision ${activeRound.round_number}` : latest ? 'Upload a new version' : 'Upload your delivery'}
					hint="Each upload is a new version the client can review."
					notePlaceholder="Add a short note for the client (optional)"
					onUploaded={refresh}
				/>
			)}

			{activeRound?.feedback?.length > 0 && role === 'freelancer' && (
				<div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
					<div className="text-sm font-bold text-violet-800 mb-2">Client feedback · revision {activeRound.round_number}</div>
					<ul className="space-y-1.5 text-sm text-violet-900">
						{activeRound.feedback.map(item => <li key={item.id} className="whitespace-pre-wrap">• {item.note}</li>)}
					</ul>
				</div>
			)}

			<div className="space-y-3">
				{deliveries.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
						{role === 'client' ? 'No delivery yet. Your freelancer will upload work here.' : 'Nothing delivered yet.'}
					</div>
				) : deliveries.map((file, index) => (
					<div key={file.id} className={`rounded-2xl border bg-white p-4 ${index === 0 ? 'border-mint-200 shadow-sm' : 'border-ink-200 opacity-80'}`}>
						<div className="flex items-start gap-3">
							<FileThumb file={file} />
							<div className="flex-1 min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-bold text-sm text-ink-900 truncate">{file.original_name}</span>
									<span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">v{deliveries.length - index}</span>
									{file.status === 'approved' && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Approved</span>}
									{file.status === 'revision_requested' && <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">Revision requested</span>}
									{file.status === 'submitted' && <span className="rounded-md bg-mint-50 px-2 py-0.5 text-xs font-semibold text-mint-700">Awaiting review</span>}
								</div>
								<div className="text-xs text-ink-500 mt-0.5">{formatSize(file.size_bytes)} · {timeAgo(file.created_at)}</div>
								{file.freelancer_note && <div className="mt-2 text-sm text-ink-700 whitespace-pre-wrap">“{file.freelancer_note}”</div>}
								{file.client_note && file.status === 'revision_requested' && <div className="mt-2 text-sm text-violet-800 whitespace-pre-wrap">Feedback: {file.client_note}</div>}
							</div>
							{file.public_url && (
								<a href={file.public_url} target="_blank" rel="noreferrer" className="btn ghost sm"><Icon name="download" size={13} /> Open</a>
							)}
						</div>
						{index === 0 && canReviewLatest && (
							<div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
								<button className="btn primary" disabled={review.isPending} onClick={() => review.mutate({ fileId: file.id, action: 'approve' })}>
									<Icon name="check" size={14} /> Approve
								</button>
								<button
									className="btn ghost"
									disabled={review.isPending || left === 0}
									title={left === 0 ? 'No revisions left for this service' : undefined}
									onClick={() => setRevisionFor(file)}
								>
									<Icon name="refresh" size={14} /> Request revision {left === 0 ? '(none left)' : ''}
								</button>
							</div>
						)}
					</div>
				))}
			</div>

			{role === 'client' && !completed && (
				<Uploader jobId={jobId} label="Share files with your freelancer" hint="Raw footage, logos, references: anything they need." onUploaded={refresh} />
			)}
			{references.length > 0 && (
				<div>
					<div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">Files shared by the client</div>
					<div className="space-y-2">
						{references.map(file => (
							<a key={file.id} href={file.public_url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm hover:border-mint-300">
								<Icon name="paperclip" size={14} className="text-ink-400" />
								<span className="flex-1 truncate">{file.original_name}</span>
								<span className="text-xs text-ink-400">{formatSize(file.size_bytes)}</span>
							</a>
						))}
					</div>
				</div>
			)}

			{revisionFor && (
				<Modal
					title="Request a revision"
					subtitle={`${left} of ${included} revision${included === 1 ? '' : 's'} left. Put all your feedback in one go.`}
					onClose={() => setRevisionFor(null)}
					footer={(
						<>
							<button className="btn ghost" onClick={() => setRevisionFor(null)}>Cancel</button>
							<button className="btn primary" disabled={!revisionNote.trim() || review.isPending} onClick={() => review.mutate({ fileId: revisionFor.id, action: 'revision', note: revisionNote })}>
								Send feedback
							</button>
						</>
					)}
				>
					<textarea
						rows={5}
						autoFocus
						value={revisionNote}
						onChange={e => setRevisionNote(e.target.value)}
						placeholder="What should change? Mention timestamps, colours or text."
						className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:border-mint-400"
					/>
				</Modal>
			)}

			{showRating && (
				<Modal
					title="Complete order & rate"
					subtitle="Completing releases payment to the freelancer. This can't be undone."
					onClose={() => setShowRating(false)}
					footer={(
						<>
							<button className="btn ghost" onClick={() => setShowRating(false)}>Cancel</button>
							<button className="btn primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
								{complete.isPending ? 'Completing…' : 'Complete order'}
							</button>
						</>
					)}
				>
					<div className="space-y-3">
						{RATING_FIELDS.map(([key, label]) => (
							<div key={key} className="flex items-center justify-between gap-3">
								<span className="text-sm text-ink-700">{label}</span>
								<div className="flex gap-1">
									{[1, 2, 3, 4, 5].map(star => (
										<button
											key={star}
											type="button"
											aria-label={`${star} star${star === 1 ? '' : 's'}`}
											onClick={() => setRatings(prev => ({ ...prev, [key]: star }))}
											className={star <= ratings[key] ? 'text-amber-400' : 'text-ink-200'}
										>
											<Icon name="star" size={20} />
										</button>
									))}
								</div>
							</div>
						))}
						<textarea
							rows={3}
							value={reviewText}
							onChange={e => setReviewText(e.target.value)}
							placeholder="Anything you'd like to say about the work? (optional)"
							className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:border-mint-400"
						/>
					</div>
				</Modal>
			)}
		</div>
	)
}
