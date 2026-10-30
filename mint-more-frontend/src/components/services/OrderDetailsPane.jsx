import { useState } from 'react'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import StageBadge from './StageBadge'
import { deliveryText, formatDate, inr, variantLabel } from './serviceUtils'

const timeOf = (value) => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Remaining time until the due date, with a tone that warns as it gets close. */
function dueState(dueAt) {
	if (!dueAt) return null
	const hours = (new Date(dueAt).getTime() - Date.now()) / 3_600_000
	if (hours < 0) {
		const late = Math.abs(hours)
		return { text: `Overdue by ${late < 24 ? `${Math.ceil(late)}h` : `${Math.round(late / 24)}d`}`, tone: 'text-rose-700 bg-rose-50' }
	}
	if (hours < 24) return { text: `${Math.max(1, Math.floor(hours))}h left`, tone: 'text-amber-800 bg-amber-50' }
	return { text: `${Math.round(hours / 24)}d left`, tone: 'text-ink-700 bg-ink-100' }
}

/** Order milestones from the booking's own timestamps; the first unreached step is "current". */
function milestones(booking, isClient) {
	const revising = booking.stage === 'revision_requested'
	const deliveries = Number(booking.delivery_count || 0)
	const steps = [
		{ key: 'paid', label: 'Order placed', at: booking.paid_at, note: isClient ? 'Payment held safely by Creatyv' : null },
		{ key: 'assigned', label: isClient ? 'Freelancer assigned' : 'Assigned to you', at: booking.assigned_at, note: isClient ? booking.freelancer_name : null },
		{
			key: 'delivered',
			label: deliveries > 1 ? `Delivered · v${deliveries}` : 'Delivered',
			at: deliveries > 0 ? booking.latest_delivery_at : null,
			note: revising ? `Changes requested on v${deliveries} · ${booking.revisions_used} of ${booking.revisions_included} used` : booking.stage === 'approved' ? 'Approved by client' : booking.stage === 'delivered' ? 'Waiting for client review' : null,
		},
		{
			key: 'completed',
			label: 'Completed',
			at: booking.completed_at,
			note: booking.completed_at
				? (isClient ? null : 'Payout released to your wallet')
				: booking.stage === 'approved' ? (isClient ? 'Complete & rate in the conversation to release the freelancer’s payment' : 'Your payout releases as soon as the client completes the order') : null,
		},
	]
	// Until a freelancer accepts, the client's order is only placed: the rest appears once it's assigned.
	const shown = isClient && !booking.assigned_at ? steps.slice(0, 1) : steps
	const firstOpen = shown.findIndex(step => !step.at)
	return shown.map((step, index) => ({
		...step,
		done: Boolean(step.at) && !(step.key === 'delivered' && revising),
		current: revising ? step.key === 'delivered' : index === firstOpen,
	}))
}

function Timeline({ steps }) {
	return (
		<ol className="relative">
			{steps.map((step, index) => {
				const last = index === steps.length - 1
				return (
					<li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
						{!last && <span aria-hidden="true" className={`absolute left-[9px] top-5 h-[calc(100%-12px)] w-px ${step.done ? 'bg-ink-900' : 'bg-ink-200'}`} />}
						<span aria-hidden="true" className={`relative z-[1] mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full ${
							step.done ? 'bg-ink-900 text-white' : step.current ? 'border-2 border-mint-500 bg-white' : 'border border-ink-300 bg-white'
						}`}>
							{step.done ? <Icon name="check" size={11} /> : step.current && <span className="h-[7px] w-[7px] rounded-full bg-mint-500" />}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline justify-between gap-3">
								<span className={`text-[14px] ${step.done || step.current ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>{step.label}</span>
								{step.at && <time className="shrink-0 text-xs tabular-nums text-ink-500" dateTime={step.at}>{timeOf(step.at)}</time>}
							</div>
							{step.note && <p className={`mt-0.5 text-[13px] ${step.current ? 'text-ink-700' : 'text-ink-500'}`}>{step.note}</p>}
						</div>
					</li>
				)
			})}
		</ol>
	)
}

function Section({ title, children, action }) {
	return (
		<section className="border-t-8 border-ink-50 px-4 py-5 md:border-t md:border-ink-100 md:px-5">
			{title && (
				<div className="mb-3 flex items-center justify-between gap-3">
					<h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
					{action}
				</div>
			)}
			{children}
		</section>
	)
}

function Row({ label, value, strong }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-1.5">
			<dt className={strong ? 'font-semibold text-ink-900' : 'text-ink-600'}>{label}</dt>
			<dd className={`tabular-nums ${strong ? 'text-[15px] font-semibold text-ink-900' : 'text-ink-900'}`}>{value}</dd>
		</div>
	)
}

/**
 * The "Order details" side of an order: what was bought, where it stands, the
 * brief, scope and money. Full-bleed bands on phones, one panel beside the chat on desktop.
 */
export default function OrderDetailsPane({ booking, snapshot, isClient, counterpart, onMessage, embedded = false }) {
	const [copied, setCopied] = useState(false)
	const [showExcluded, setShowExcluded] = useState(false)
	const completed = booking.stage === 'completed'
	const due = completed ? null : dueState(booking.due_at)
	const total = Number(booking.subtotal) + Number(booking.gst_amount)
	const revisionsLeft = Number(booking.revisions_left ?? 0)
	const revisionsIncluded = Number(booking.revisions_included ?? 0)
	const includes = snapshot.includes || []
	const excludes = snapshot.excludes || []
	const rating = Number(booking.freelancer_rating || 0)

	const copyNumber = async () => {
		try {
			await navigator.clipboard.writeText(booking.booking_number)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch { /* clipboard blocked; the number stays visible */ }
	}

	return (
		<div className={`bg-white font-store ${embedded ? '' : 'md:max-h-[calc(100dvh-112px)] md:overflow-y-auto md:rounded-2xl md:border md:border-ink-200'}`}>
			{/* What was bought */}
			<div className="flex gap-3.5 px-4 pb-5 pt-5 md:px-5">
				<div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-900 text-lg font-semibold text-white">
					{booking.cover_url ? <img src={booking.cover_url} alt="" className="h-full w-full object-cover" /> : (snapshot.title || 'C').slice(0, 1)}
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink-900 [text-wrap:balance]">{snapshot.title || booking.template_title}</h1>
					<p className="mt-0.5 text-[13px] text-ink-500">
						{variantLabel(snapshot, snapshot.option_group_label)}{Number(booking.quantity) > 1 ? ` × ${booking.quantity}` : ''}
						{snapshot.purchase_item ? ` · Order ${snapshot.purchase_item.index} of ${snapshot.purchase_item.count}` : ''}
						{booking.category_name ? ` · ${booking.category_name}` : ''}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<StageBadge stage={booking.stage} />
						<button type="button" onClick={copyNumber} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums text-ink-600 transition-colors hover:bg-ink-100 active:scale-[0.97]" aria-label={`Copy order number ${booking.booking_number}`}>
							{booking.booking_number}
							<Icon name={copied ? 'check' : 'copy'} size={12} />
						</button>
					</div>
				</div>
			</div>

			{/* Deadline, delivery time and revisions at a glance */}
			<dl className="mx-4 mb-5 grid grid-cols-3 divide-x divide-ink-100 rounded-xl bg-ink-50 py-3 md:mx-5">
				<div className="px-3">
					<dt className="text-xs text-ink-500">{completed ? 'Completed' : 'Due'}</dt>
					<dd className="mt-0.5 text-[14px] font-semibold text-ink-900">{completed ? formatDate(booking.completed_at) : booking.due_at ? new Date(booking.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</dd>
					{due && <dd className={`mt-1 inline-flex rounded-full px-1.5 py-px text-[11px] font-semibold ${due.tone}`}>{due.text}</dd>}
				</div>
				<div className="px-3">
					<dt className="text-xs text-ink-500">Turnaround</dt>
					<dd className="mt-0.5 text-[14px] font-semibold text-ink-900">{deliveryText(snapshot.delivery_days)}</dd>
					{snapshot.purchase_item && <dd className="mt-0.5 text-xs text-ink-500">From acceptance</dd>}
				</div>
				<div className="px-3">
					<dt className="text-xs text-ink-500">Revisions</dt>
					<dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink-900">{revisionsLeft} left</dd>
					{revisionsIncluded > 0 && (
						<dd className="mt-1.5 flex gap-1" aria-label={`${revisionsLeft} of ${revisionsIncluded} revisions left`}>
							{Array.from({ length: revisionsIncluded }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < revisionsIncluded - revisionsLeft ? 'bg-ink-300' : 'bg-mint-500'}`} />)}
						</dd>
					)}
				</div>
			</dl>

			<Section title="Order status">
				<Timeline steps={milestones(booking, isClient)} />
			</Section>

			<Section>
				<div className="flex items-center gap-3">
					{counterpart.name ? <Avatar name={counterpart.name} src={counterpart.avatar} size="md" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="clock" size={16} /></span>}
					<div className="min-w-0 flex-1">
						<div className="truncate text-[15px] font-semibold text-ink-900">{counterpart.name || 'Finding your freelancer'}</div>
						<div className="flex items-center gap-1.5 text-[13px] text-ink-500">
							{counterpart.label}
							{isClient && rating > 0 && <><span aria-hidden="true">·</span><Icon name="star" size={12} className="text-amber-500" />{rating.toFixed(1)}</>}
						</div>
					</div>
					{counterpart.name && (
						<button type="button" onClick={onMessage} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink-200 px-3.5 text-sm font-medium text-ink-900 transition-[background-color,transform] hover:bg-ink-50 active:scale-[0.97] md:hidden">
							<Icon name="chat" size={15} /> Message
						</button>
					)}
				</div>
			</Section>

			<Section title="Brief">
				{Array.isArray(booking.brief) && booking.brief.some(answer => String(answer.value || '').trim()) && <dl className="space-y-3">{booking.brief.filter(answer => String(answer.value || '').trim()).map(answer => <div key={answer.key}><dt className="text-[13px] font-medium text-ink-500">{answer.label || answer.key}</dt><dd className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-800 [overflow-wrap:anywhere]">{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value)}</dd></div>)}</dl>}
				{booking.instructions ? <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-700">{booking.instructions}</p> : !booking.brief?.length && <p className="text-[14px] leading-relaxed text-ink-700">No written brief. Files and notes shared in the conversation count as the brief.</p>}
				{snapshot.requirements_hint && (
					<p className="mt-3 flex gap-2 text-[13px] text-ink-500"><Icon name="file" size={14} className="mt-0.5 shrink-0" />{snapshot.requirements_hint}</p>
				)}
			</Section>

			{(includes.length > 0 || excludes.length > 0) && (
				<Section
					title="What's included"
					action={excludes.length > 0 && (
						<button type="button" onClick={() => setShowExcluded(v => !v)} aria-expanded={showExcluded} className="text-[13px] font-medium text-ink-600 underline-offset-2 hover:underline">
							{showExcluded ? 'Hide exclusions' : `Not included (${excludes.length})`}
						</button>
					)}
				>
					<ul className="space-y-2 text-[14px] text-ink-800">
						{includes.map(item => <li key={item} className="flex gap-2.5"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />{item}</li>)}
					</ul>
					{showExcluded && (
						<ul className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-[14px] text-ink-500">
							{excludes.map(item => <li key={item} className="flex gap-2.5"><Icon name="x" size={15} className="mt-0.5 shrink-0 text-ink-400" />{item}</li>)}
						</ul>
					)}
				</Section>
			)}

			<Section title={isClient ? 'Payment' : 'Earnings'}>
				<dl className="text-[14px]">
					{isClient ? (
						<>
							<Row label="Service price" value={inr(booking.subtotal)} />
							<Row label="GST (18%)" value={inr(booking.gst_amount)} />
							<div className="my-1.5 border-t border-dashed border-ink-200" />
							<Row label="Total paid" value={inr(total)} strong />
						</>
					) : (
						<Row label="Your payout" value={inr(booking.freelancer_payout)} strong />
					)}
				</dl>
				<p className="mt-3 flex gap-2 rounded-xl bg-ink-50 p-3 text-[13px] leading-snug text-ink-600">
					<Icon name="shield" size={15} className="mt-px shrink-0 text-ink-700" />
					{isClient
						? `Paid on ${formatDate(booking.paid_at)}. Creatyv holds it and releases it to the freelancer only when you complete the order.`
						: completed ? 'Released to your wallet.' : 'Held by Creatyv and released to your wallet when the client completes the order.'}
				</p>
			</Section>
		</div>
	)
}
