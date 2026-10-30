import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { mintboxApi } from '../../api/mintbox'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { briefFiles } from '../../store/briefFiles'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import BriefSheet from '../../components/services/BriefSheet'

export default function PostPaymentBrief() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const pushToast = useUIStore(s => s.pushToast)
	const bookingIds = params.getAll('booking').filter(Boolean)
	// Set when the same checkout also bought multi-item lines: their items come next.
	const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : null
	const [index, setIndex] = useState(0)
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState('')
	const draftTimer = useRef(null)
	const latestDraft = useRef(null)
	const draftRequest = useRef(Promise.resolve())
	const activeBookingId = useRef(null)

	const { data: orders = [], isLoading, isError } = useQuery({
		queryKey: ['post-payment-brief', bookingIds],
		queryFn: async () => Promise.all(bookingIds.map(async id => {
			const booking = (await servicesApi.booking(id)).data.data
			const service = (await servicesApi.catalogItem(booking.template_slug)).data.data
			return { booking, service }
		})),
		enabled: bookingIds.length > 0,
	})
	const current = orders[index]
	const flushDraft = useCallback(() => {
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = null
		const pending = latestDraft.current
		latestDraft.current = null
		if (pending) {
			draftRequest.current = draftRequest.current.catch(() => {}).then(() => servicesApi.updateBookingBrief(pending.bookingId, { ...pending.payload, draft: true }))
		}
		return draftRequest.current
	}, [])
	const queueDraft = useCallback((payload) => {
		if (!activeBookingId.current) return
		latestDraft.current = { bookingId: activeBookingId.current, payload }
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = setTimeout(() => { flushDraft().catch(() => {}) }, 650)
	}, [flushDraft])
	useEffect(() => {
		activeBookingId.current = current?.booking?.id || null
		return () => { flushDraft().catch(() => {}) }
	}, [current?.booking?.id, flushDraft])

	const saveBrief = async ({ brief, instructions }) => {
		if (!current || saving) return
		const { booking } = current
		setSaving(true)
		setSaveError('')
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
			queryClient.invalidateQueries({ queryKey: ['service-booking', 'client', booking.id] })
			queryClient.invalidateQueries({ queryKey: ['service-bookings', 'client'] })
			if (failedUploads) {
				pushToast({ title: `${failedUploads} file${failedUploads === 1 ? '' : 's'} didn't upload`, body: 'You can attach them in the order chat.', tone: 'amber', icon: 'paperclip' })
			}
			if (index < orders.length - 1) setIndex(value => value + 1)
			else navigate(next || `/chat?job=${encodeURIComponent(orders[0].booking.job_id)}`, { replace: true })
		} catch (error) {
			setSaveError(error.response?.data?.errors?.join(' ') || error.response?.data?.message || 'Could not save your brief. Please try again.')
		} finally {
			setSaving(false)
		}
	}

	if (!bookingIds.length) {
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-16 text-center font-store md:px-8">
				<h1 className="text-2xl font-medium tracking-tight text-ink-900">No order brief to complete</h1>
				<p className="mt-2 text-ink-600">Open an order chat to continue.</p>
				<Link to="/chat" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white"><Icon name="chat" size={16} /> Open chats</Link>
			</main>
		)
	}

	if (isLoading) return <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8"><div className="h-72 animate-pulse rounded-2xl bg-ink-100" /></main>
	if (isError || !current) {
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-16 text-center font-store md:px-8">
				<h1 className="text-2xl font-medium tracking-tight text-ink-900">Couldn't load your order brief</h1>
				<p className="mt-2 text-ink-600">Your payment is safe. Open chats or try the order again from your order list.</p>
				<Link to="/chat" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white"><Icon name="chat" size={16} /> Open chats</Link>
			</main>
		)
	}

	const { booking, service } = current
	const initial = Object.fromEntries((booking.brief || []).map(answer => [answer.key, answer.value]))
	const isLast = index === orders.length - 1

	return (
		<div>
			<div className="mx-auto w-full max-w-3xl px-4 pt-8 font-store md:px-8 md:pt-12">
				<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">Your payment is complete</h1>
				<p className="mt-2 text-[15px] leading-relaxed text-ink-600">Your progress saves as you go. Complete the required details now, or return to this brief from the order chat later.</p>
				{orders.length > 1 && <p className="mt-3 text-sm font-medium text-ink-700">Service {index + 1} of {orders.length}</p>}
				{saveError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>}
			</div>
			<BriefSheet
				key={booking.id}
				title={service.title}
				description={`Order ${booking.booking_number} · Your freelancer will see this brief in the order chat.`}
				fields={service.brief_fields || []}
				variantId={booking.variant_id}
				initial={initial}
				initialNotes={booking.instructions || ''}
				presentation="page"
				submitting={saving}
				onDraftChange={queueDraft}
				submitLabel={saving ? 'Saving brief…' : isLast && !next ? 'Save brief & open chat' : 'Save brief & continue'}
				onSubmit={saveBrief}
			/>
		</div>
	)
}
