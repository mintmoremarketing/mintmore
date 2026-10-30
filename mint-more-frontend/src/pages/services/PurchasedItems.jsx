import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { mintboxApi } from '../../api/mintbox'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { briefFiles } from '../../store/briefFiles'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import BriefSheet from '../../components/services/BriefSheet'
import { formatDate, itemChatLink, itemStageText, perItemDeliveryText, variantLabel } from '../../components/services/serviceUtils'

const filesKey = (itemId) => `item:${itemId}`

/**
 * One multi-item purchase: every item with where it stands, and the brief for the
 * selected one. Drafts save as the client types; submitting an item starts finding
 * its freelancer and moves on to the next item that still needs a brief.
 */
export default function PurchasedItems() {
	const { id } = useParams()
	const [params, setParams] = useSearchParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [submitting, setSubmitting] = useState(false)
	const [uploading, setUploading] = useState(null)
	const [error, setError] = useState('')
	const draftTimer = useRef(null)
	const latestDraft = useRef(null)
	const draftRequest = useRef(Promise.resolve())

	const { data: purchase, isLoading, isError, refetch } = useQuery({
		queryKey: ['service-purchase', id],
		queryFn: () => servicesApi.purchase(id).then(res => res.data.data),
	})
	const items = purchase?.items || []
	const firstOpen = items.find(item => item.stage === 'needs_brief')
	const selected = items.find(item => item.id === params.get('item')) || firstOpen || items[0]
	const open = items.filter(item => item.stage === 'needs_brief').length

	const flushDraft = useCallback(() => {
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = null
		const pending = latestDraft.current
		latestDraft.current = null
		if (pending) {
			draftRequest.current = draftRequest.current.catch(() => {}).then(() => servicesApi.saveItemDraft(pending.itemId, pending.payload))
		}
		return draftRequest.current
	}, [])
	const queueDraft = useCallback((payload) => {
		if (!selected || selected.stage !== 'needs_brief') return
		latestDraft.current = { itemId: selected.id, payload }
		if (draftTimer.current) clearTimeout(draftTimer.current)
		draftTimer.current = setTimeout(() => { flushDraft().catch(() => {}) }, 650)
	}, [selected, flushDraft])
	useEffect(() => () => { flushDraft().catch(() => {}) }, [selected?.id, flushDraft])

	const select = (itemId) => {
		setError('')
		setParams({ item: itemId }, { replace: true })
		if (window.matchMedia('(max-width: 1023px)').matches) document.getElementById('item-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	const uploadFiles = async (item, jobId) => {
		const queued = Object.values(briefFiles.get(filesKey(item.id))).flat()
		let failed = 0
		if (queued.length) setUploading({ done: 0, total: queued.length })
		for (const [i, file] of queued.entries()) {
			try {
				const type = file.type || 'application/octet-stream'
				const prepared = await mintboxApi.prepareUpload(jobId, { name: file.name, size: file.size, type })
				const config = prepared.data?.data?.upload
				await uploadMintboxFile({ file, config, fileType: type })
				await mintboxApi.completeUpload(config.upload_id)
			} catch {
				failed += 1
			}
			setUploading({ done: i + 1, total: queued.length })
		}
		briefFiles.remove(filesKey(item.id))
		return { queued: queued.length, failed }
	}

	// The brief already saves as it's typed; this only makes sure the last change is in, then moves on.
	const later = async () => {
		if (!selected) return
		const item = selected
		await flushDraft().catch(() => {})
		pushToast({ title: `Order ${item.item_index} saved for later`, body: 'Its brief stays here until you send it.', icon: 'check' })
		const next = items.find(entry => entry.stage === 'needs_brief' && entry.id !== item.id)
		if (next) select(next.id)
		else navigate('/orders?tab=items')
	}

	const submit = async ({ brief, instructions }) => {
		if (!selected || submitting) return
		const item = selected
		setSubmitting(true)
		setError('')
		try {
			await flushDraft().catch(() => {})
			const hasFiles = Object.values(briefFiles.get(filesKey(item.id))).flat().length > 0
			const res = await servicesApi.submitItemBrief(item.id, { brief, instructions, files_pending: hasFiles })
			const { job_id: jobId, matching_held: held } = res.data.data
			// Matching waits for the files, so the freelancer gets them with the brief.
			const { failed } = hasFiles ? await uploadFiles(item, jobId) : { failed: 0 }
			if (held) await servicesApi.startItemMatching(item.id)
			if (failed) pushToast({ title: `${failed} file${failed === 1 ? '' : 's'} didn't upload`, body: 'Send them in the order chat once it opens.', tone: 'amber', icon: 'paperclip' })
			pushToast({ title: `Order ${item.item_index} sent`, body: 'We are finding a freelancer for it.', icon: 'check' })
			const fresh = await refetch()
			const next = (fresh.data?.items || []).find(entry => entry.stage === 'needs_brief' && entry.item_index > item.item_index)
				|| (fresh.data?.items || []).find(entry => entry.stage === 'needs_brief')
			setParams(next ? { item: next.id } : { item: item.id }, { replace: true })
			queryClient.invalidateQueries({ queryKey: ['service-purchases'] })
			queryClient.invalidateQueries({ queryKey: ['service-bookings', 'client'] })
			window.scrollTo({ top: 0, behavior: 'smooth' })
		} catch (err) {
			setError(err.response?.data?.errors?.join(' ') || err.response?.data?.message || 'Could not send this brief. Please try again.')
		} finally {
			setSubmitting(false)
			setUploading(null)
		}
	}

	if (isLoading) return <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8"><div className="h-80 animate-pulse rounded-2xl bg-ink-100" /></div>
	if (isError || !purchase) {
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-16 text-center font-store md:px-8">
				<h1 className="text-2xl font-medium tracking-tight text-ink-900">Couldn't load this purchase</h1>
				<p className="mt-2 text-ink-600">Your payment and orders are safe. Try again from My orders.</p>
				<Link to="/orders?tab=items" className="mt-5 inline-flex h-11 items-center rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white">Purchased orders</Link>
			</main>
		)
	}

	const snapshot = purchase.snapshot || {}
	const savedAnswers = Object.fromEntries((selected?.brief || []).filter(answer => answer.type !== 'files').map(answer => [answer.key, answer.value]))

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			{/* The orders get their own column from the top of the page. It sticks at the height it
			    starts at (top bar + page padding), so it never moves while the brief scrolls. */}
			<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
				<aside className="lg:sticky lg:top-[104px] lg:max-h-[calc(100dvh-128px)] lg:self-start lg:overflow-y-auto" aria-label="Orders in this purchase">
					<Link to="/orders?tab=items" className="inline-flex items-center gap-2 text-[15px] text-ink-600 hover:text-ink-900">
						<Icon name="arrowLeft" size={16} /> Purchased orders
					</Link>
					<p className="mb-3 mt-6 text-[15px] text-ink-700">
						{open ? <><span className="font-medium text-ink-900">{open} of {purchase.item_count}</span> still need a brief</> : 'Every order has its brief'}
					</p>
					<ol className="overflow-hidden rounded-2xl bg-ink-50">
						{items.map(item => {
							const active = item.id === selected?.id
							return (
								<li key={item.id}>
									<button
										type="button"
										onClick={() => select(item.id)}
										aria-current={active ? 'true' : undefined}
										className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-900 ${active ? 'bg-ink-900 text-white' : 'text-ink-900 hover:bg-ink-100'}`}
									>
										<span className="text-[15px] font-medium">Order {item.item_index}</span>
										<span className={`text-sm ${active ? 'text-white/80' : item.stage === 'needs_brief' && !item.has_draft ? 'text-ink-500' : 'text-ink-700'}`}>{itemStageText(item)}</span>
									</button>
								</li>
							)
						})}
					</ol>
					{purchase.shared_instructions && (
						<div className="mt-4 px-1 xl:hidden">
							<p className="text-sm font-medium text-ink-900">Note for every order</p>
							<p className="mt-1 whitespace-pre-line text-sm text-ink-600">{purchase.shared_instructions}</p>
						</div>
					)}
				</aside>

				<div className="min-w-0">
					<h1 className="text-3xl font-medium leading-tight tracking-tight text-ink-900 [text-wrap:balance] md:text-[40px]">{snapshot.title || purchase.template_title}</h1>
					<p className="mt-2 text-[15px] text-ink-600 xl:hidden">
						{purchase.item_count} orders · {variantLabel(snapshot, snapshot.option_group_label)}{Number(snapshot.pack_size) > 1 && purchase.item_count > Number(snapshot.pack_size) ? ` × ${purchase.item_count / Number(snapshot.pack_size)}` : ''} · paid {formatDate(purchase.paid_at)}
					</p>
					<p className="mt-1 max-w-[70ch] text-[15px] text-ink-600 xl:hidden">{perItemDeliveryText(snapshot.delivery_days)}</p>

				<section id="item-panel" className="mt-8 min-w-0 scroll-mt-6" aria-live="polite">
					{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
					{selected?.stage === 'needs_brief' ? (
						<BriefSheet
							key={selected.id}
							presentation="inline"
							heading={`Order ${selected.item_index} brief`}
							title={snapshot.title}
							description={`Order ${selected.item_index} of ${purchase.item_count} · its freelancer sees this when they accept`}
							fields={purchase.brief_fields || []}
							variantId={filesKey(selected.id)}
							filesAttached={false}
							initial={savedAnswers}
							initialNotes={selected.instructions || ''}
							submitting={submitting}
							onDraftChange={queueDraft}
							onLater={later}
							submitLabel={uploading ? `Uploading files ${uploading.done} of ${uploading.total}…` : submitting ? 'Sending…' : open > 1 ? 'Send brief & next order' : 'Send brief'}
							onSubmit={submit}
						/>
					) : selected && (
						<div className="rounded-2xl border border-ink-200 bg-white p-6 md:p-8">
							<h2 className="text-xl font-medium tracking-tight text-ink-900">Order {selected.item_index}: {itemStageText(selected).toLowerCase()}</h2>
							<p className="mt-2 max-w-[60ch] text-[15px] text-ink-600">
								{selected.stage === 'matching' && 'Its brief is in and we are offering it to freelancers. The delivery time starts when one accepts.'}
								{selected.stage === 'active' && 'A freelancer accepted it. Share files and follow progress in its chat.'}
								{selected.stage === 'completed' && 'This order is done. Its files stay in its chat.'}
								{selected.stage === 'cancelled' && 'This order was cancelled.'}
								{selected.stage === 'refunded' && `Refunded ${formatDate(selected.refunded_at)}.`}
							</p>
							{selected.booking_number && <p className="mt-1 text-sm tabular-nums text-ink-500">Order {selected.booking_number}</p>}
							<div className="mt-5 flex flex-wrap gap-3">
								{selected.job_id && selected.stage !== 'matching' && (
									<Link to={itemChatLink(selected)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white transition-transform active:scale-[0.97]">
										<Icon name="chat" size={16} /> Open chat
									</Link>
								)}
								{firstOpen && (
									<button type="button" onClick={() => select(firstOpen.id)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 px-5 text-[15px] font-medium text-ink-900 transition-colors hover:bg-ink-50 active:scale-[0.97]">
										Order {firstOpen.item_index} brief <Icon name="arrowRight" size={16} />
									</button>
								)}
							</div>
						</div>
					)}
				</section>
				</div>

				{/* Wide screens: what was bought sits beside the brief instead of above it. */}
				<aside className="hidden xl:sticky xl:top-[104px] xl:block xl:self-start" aria-label="About this purchase">
					<h2 className="text-[15px] font-semibold text-ink-900">About this purchase</h2>
					<dl className="mt-3 divide-y divide-ink-100 rounded-2xl bg-ink-50 px-4 text-[14px]">
						<div className="flex justify-between gap-3 py-3"><dt className="text-ink-600">Orders</dt><dd className="font-medium tabular-nums text-ink-900">{purchase.item_count}</dd></div>
						<div className="flex justify-between gap-3 py-3"><dt className="text-ink-600">Option</dt><dd className="text-right font-medium text-ink-900">{variantLabel(snapshot, snapshot.option_group_label)}</dd></div>
						<div className="flex justify-between gap-3 py-3"><dt className="text-ink-600">Paid</dt><dd className="font-medium text-ink-900">{formatDate(purchase.paid_at)}</dd></div>
						<div className="py-3"><dt className="text-ink-600">Delivery</dt><dd className="mt-1 text-ink-900">{perItemDeliveryText(snapshot.delivery_days)}</dd></div>
					</dl>
					{purchase.shared_instructions && (
						<div className="mt-5">
							<p className="text-[15px] font-semibold text-ink-900">Note for every order</p>
							<p className="mt-1 whitespace-pre-line text-[14px] text-ink-600">{purchase.shared_instructions}</p>
						</div>
					)}
				</aside>
			</div>
		</div>
	)
}
