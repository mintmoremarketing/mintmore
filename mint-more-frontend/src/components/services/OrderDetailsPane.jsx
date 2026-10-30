import { useState } from 'react'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import { deliveryText, formatDate, inr, STAGE_META, variantLabel } from './serviceUtils'

const timeOf = (value) => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Remaining time until the due date, with a tone that warns as it gets close. */
function dueState(dueAt) {
	if (!dueAt) return null
	const hours = (new Date(dueAt).getTime() - Date.now()) / 3_600_000
	if (hours < 0) {
		const late = Math.abs(hours)
		return { text: `overdue by ${late < 24 ? `${Math.ceil(late)}h` : `${Math.round(late / 24)}d`}`, tone: 'text-rose-700' }
	}
	if (hours < 24) return { text: `${Math.max(1, Math.floor(hours))}h left`, tone: 'text-amber-700' }
	const days = Math.round(hours / 24)
	return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: 'text-ink-600' }
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
				: booking.stage === 'approved' ? (isClient ? 'Complete the order and rate your freelancer' : 'Your payout releases as soon as the client completes the order') : null,
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
		<ol>
			{steps.map((step, index) => {
				const last = index === steps.length - 1
				return (
					<li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
						{!last && <span aria-hidden="true" className={`absolute left-[7px] top-[18px] bottom-0 w-px ${step.done ? 'bg-ink-900' : 'bg-ink-200'}`} />}
						<span aria-hidden="true" className={`relative z-[1] mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full ${
							step.done ? 'bg-ink-900 text-white' : step.current ? 'bg-mint-500 ring-4 ring-mint-500/15' : 'border border-ink-300 bg-white'
						}`}>
							{step.done && <Icon name="check" size={9} />}
						</span>
						<div className="min-w-0 flex-1">
							<p className={`text-[14px] leading-5 ${step.done || step.current ? 'font-medium text-ink-900' : 'text-ink-500'}`}>
								{step.label}
								{step.at && <time className="ml-2 text-[12px] font-normal tabular-nums text-ink-500" dateTime={step.at}>{timeOf(step.at)}</time>}
							</p>
							{step.note && <p className={`mt-0.5 text-[13px] leading-5 ${step.current ? 'text-ink-700' : 'text-ink-500'}`}>{step.note}</p>}
						</div>
					</li>
				)
			})}
		</ol>
	)
}

// Sections are told apart by space and a heading, not by rules between them.
function Section({ title, children, action }) {
	return (
		<section className="px-5 pt-7 last:pb-7">
			{title && (
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
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
	const stageLabel = (STAGE_META[booking.stage] || { label: booking.stage }).label
	const stageTone = { revision_requested: 'text-violet-700', delivered: 'text-mint-600', cancelled: 'text-rose-700' }[booking.stage] || 'text-ink-900'
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
			{/* What was bought and where it stands, in one place */}
			<header className="px-5 pt-5">
				<div className="flex items-start gap-3">
					{booking.cover_url && <img src={booking.cover_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
					<div className="min-w-0 flex-1">
						<h1 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink-900 [text-wrap:balance]">{snapshot.title || booking.template_title}</h1>
						<p className="mt-0.5 text-[13px] text-ink-500">
							{variantLabel(snapshot, snapshot.option_group_label)}{Number(booking.quantity) > 1 ? ` × ${booking.quantity}` : ''}
							{snapshot.purchase_item ? ` · Order ${snapshot.purchase_item.index} of ${snapshot.purchase_item.count}` : ''}
							{booking.category_name ? ` · ${booking.category_name}` : ''}
						</p>
					</div>
					<button type="button" onClick={copyNumber} className="-mr-2 inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium tabular-nums text-ink-500 transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-100 hover:text-ink-900 active:scale-[0.96]" aria-label={`Copy order number ${booking.booking_number}`}>
						{booking.booking_number}
						<Icon name={copied ? 'check' : 'copy'} size={12} />
					</button>
				</div>
				<p className="mt-3 text-[14px] text-ink-900">
					<span className={`font-semibold ${stageTone}`}>{stageLabel}</span>
					{!completed && due && <span className={due.tone}> · {due.text}</span>}
				</p>
			</header>

			{/* Deadline, delivery time and revisions at a glance: one tone step, no dividers */}
			<dl className="mx-5 mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-ink-50 px-4 py-3.5">
				<div>
					<dt className="text-[12px] text-ink-500">{completed ? 'Completed' : 'Due'}</dt>
					<dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{completed ? formatDate(booking.completed_at) : booking.due_at ? new Date(booking.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'On acceptance'}</dd>
				</div>
				<div>
					<dt className="text-[12px] text-ink-500">Turnaround</dt>
					<dd className="mt-0.5 text-[15px] font-semibold text-ink-900">{deliveryText(snapshot.delivery_days)}</dd>
				</div>
				<div>
					<dt className="text-[12px] text-ink-500">Revisions</dt>
					<dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{revisionsIncluded > 0 ? `${revisionsLeft} of ${revisionsIncluded}` : 'None'}</dd>
				</div>
			</dl>

			{/* Who's on the other side */}
			<div className="mx-5 mt-4 flex items-center gap-3">
				{counterpart.name ? <Avatar name={counterpart.name} src={counterpart.avatar} size="sm" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="clock" size={14} /></span>}
				<p className="min-w-0 flex-1 truncate text-[14px] text-ink-600">
					{counterpart.name ? <><span className="font-medium text-ink-900">{counterpart.name}</span> · {counterpart.label.toLowerCase()}</> : 'Finding your freelancer'}
					{isClient && rating > 0 && <> · <Icon name="star" size={12} className="-mt-0.5 inline text-amber-500" /> {rating.toFixed(1)}</>}
				</p>
				{counterpart.name && onMessage && (
					<button type="button" onClick={onMessage} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink-100 px-3 text-[13px] font-medium text-ink-900 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-200 active:scale-[0.96] md:hidden">
						<Icon name="chat" size={14} /> Message
					</button>
				)}
			</div>

			<Section title="Order status">
				<Timeline steps={milestones(booking, isClient)} />
			</Section>

			<Section title="Brief">
				{Array.isArray(booking.brief) && booking.brief.some(answer => String(answer.value || '').trim()) && <dl className="space-y-3.5">{booking.brief.filter(answer => String(answer.value || '').trim()).map(answer => <div key={answer.key}><dt className="text-[13px] text-ink-500">{answer.label || answer.key}</dt><dd className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-900 [overflow-wrap:anywhere]">{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value)}</dd></div>)}</dl>}
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
						<ul className="mt-3 space-y-2 text-[14px] text-ink-500">
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
							<div className="mt-1.5 pt-1.5"><Row label="Total paid" value={inr(total)} strong /></div>
						</>
					) : (
						<Row label="Your payout" value={inr(booking.freelancer_payout)} strong />
					)}
				</dl>
				<p className="mt-3 flex gap-2 text-[13px] leading-snug text-ink-500">
					<Icon name="shield" size={14} className="mt-px shrink-0 text-ink-500" />
					{isClient
						? `Paid on ${formatDate(booking.paid_at)}.`
						: completed ? 'Released to your wallet.' : 'Held by Creatyv and released to your wallet when the client completes the order.'}
				</p>
			</Section>
		</div>
	)
}
