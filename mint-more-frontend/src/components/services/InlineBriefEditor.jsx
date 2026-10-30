import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { mintboxApi } from '../../api/mintbox'
import { briefFiles } from '../../store/briefFiles'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import BriefSheet from './BriefSheet'

/** The full service brief, shown in the conversation column while keeping order details in view. */
export default function InlineBriefEditor({ booking, onBack, onSaved }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const timer = useRef(null)
	const latestDraft = useRef(null)
	const draftRequest = useRef(Promise.resolve())

	const { data: service, isLoading, isError } = useQuery({
		queryKey: ['post-payment-brief-service', booking.template_slug],
		queryFn: () => servicesApi.catalogItem(booking.template_slug).then(res => res.data.data),
		enabled: Boolean(booking.template_slug),
	})
	const flushDraft = useCallback(() => {
		if (timer.current) clearTimeout(timer.current)
		timer.current = null
		const pending = latestDraft.current
		latestDraft.current = null
		if (pending) {
			draftRequest.current = draftRequest.current.catch(() => {}).then(() => servicesApi.updateBookingBrief(booking.id, { ...pending, draft: true })).then(result => {
				queryClient.invalidateQueries({ queryKey: ['service-booking', 'client', booking.id] })
				return result
			})
		}
		return draftRequest.current
	}, [booking.id, queryClient])
	useEffect(() => () => { flushDraft().catch(() => {}) }, [flushDraft])

	const queueDraft = (payload) => {
		latestDraft.current = payload
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => { flushDraft().catch(() => {}) }, 650)
	}

	const save = async ({ brief, instructions }) => {
		if (saving) return
		setSaving(true)
		setError('')
		try {
			await flushDraft().catch(() => {})
			await servicesApi.updateBookingBrief(booking.id, { brief, instructions })
			const queuedFiles = Object.values(briefFiles.get(booking.variant_id)).flat()
			let failedUploads = 0
			for (const file of queuedFiles) {
				try {
					const type = file.type || 'application/octet-stream'
					const prepared = await mintboxApi.prepareUpload(booking.job_id, { name: file.name, size: file.size, type })
					const config = prepared.data?.data?.upload
					await uploadMintboxFile({ file, config, fileType: type })
					await mintboxApi.completeUpload(config.upload_id)
				} catch {
					failedUploads += 1
				}
			}
			briefFiles.remove(booking.variant_id)
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['pending-order-chat', booking.job_id] }),
				queryClient.invalidateQueries({ queryKey: ['service-booking', 'client', booking.id] }),
				queryClient.invalidateQueries({ queryKey: ['service-bookings', 'client'] }),
			])
			if (failedUploads) pushToast({ title: `${failedUploads} file${failedUploads === 1 ? '' : 's'} didn't upload`, body: 'You can attach them in the order chat.', tone: 'amber', icon: 'paperclip' })
			onSaved()
		} catch (saveError) {
			setError(saveError.response?.data?.errors?.join(' ') || saveError.response?.data?.message || 'Could not save your brief. Please try again.')
		} finally {
			setSaving(false)
		}
	}

	const initial = Object.fromEntries((booking.brief || []).map(answer => [answer.key, answer.value]))
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white">
			<header className="sticky top-0 z-[1] flex items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 md:px-6">
				<button type="button" onClick={onBack} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 active:scale-[0.97]" aria-label="Back to order chat">
					<Icon name="arrowLeft" size={17} /> Back to order
				</button>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-[17px] font-medium text-ink-900">Complete your full brief</h2>
					<p className="truncate text-sm text-ink-500">{booking.booking_number} · Progress saves as you go</p>
				</div>
			</header>
			{error && <p role="alert" className="mx-auto mt-4 w-full max-w-3xl px-4 text-sm text-rose-700 md:px-8">{error}</p>}
			{isLoading ? <div className="m-5 h-64 animate-pulse rounded-2xl bg-ink-100" /> : isError || !service ? (
				<p className="m-auto px-6 py-10 text-center text-sm text-ink-600">Couldn't load the brief questions. Go back to the order and try again.</p>
			) : (
				<BriefSheet
					title={service.title}
					description="Your freelancer will see this in the order chat."
					fields={service.brief_fields || []}
					variantId={booking.variant_id}
					initial={initial}
					initialNotes={booking.instructions || ''}
					presentation="page"
					submitting={saving}
					submitLabel={saving ? 'Saving brief…' : 'Save brief'}
					onDraftChange={queueDraft}
					onSubmit={save}
				/>
			)}
		</div>
	)
}
