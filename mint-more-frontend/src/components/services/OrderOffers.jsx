import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { inr, variantLabel } from './serviceUtils'
import { useOrderOffers } from './useOrderOffers'
import { linkify } from '../ui/linkify'

const clock = (ms) => {
	const total = Math.max(0, Math.floor(ms / 1000))
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Calm for the first half, orange under 15 minutes, red under 10.
const timerTone = (ms) => (ms < 10 * 60_000 ? 'bg-rose-100 text-rose-700' : ms < 15 * 60_000 ? 'bg-orange-100 text-orange-700' : 'bg-white text-emerald-800 ring-1 ring-emerald-200')

// One line of the brief is enough to judge the job from the list. The sheet shows the rest.
const briefLine = (brief = []) => brief.find(item => item.type !== 'files' && item.type !== 'link' && item.value)?.value || ''

const metaLine = (offer) => [
	offer.booking_number,
	`${variantLabel(offer.snapshot || {}, offer.snapshot?.option_group_label)}${Number(offer.quantity) > 1 ? ` × ${offer.quantity}` : ''}`,
	offer.client_name,
].filter(Boolean).join(' · ')

function Timer({ left, className = '' }) {
	return (
		<span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium tabular-nums transition-colors duration-300 ${timerTone(left)} ${className}`} aria-label={`${clock(left)} left to accept`}>
			<Icon name="clock" size={13} /> {clock(left)}
		</span>
	)
}

function useOfferActions(offer, onDone) {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const pushToast = useUIStore(s => s.pushToast)
	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ['service-offers'] })
		queryClient.invalidateQueries({ queryKey: ['service-bookings', 'freelancer'] })
	}
	const accept = useMutation({
		mutationFn: () => servicesApi.acceptOffer(offer.id),
		onSuccess: () => {
			refresh()
			onDone?.()
			pushToast({ title: 'Order accepted', body: 'The brief is waiting in the order chat.', icon: 'check' })
			navigate(`/work/${offer.id}`)
		},
		onError: err => { refresh(); pushToast({ title: 'Could not accept', body: err.response?.data?.message, tone: 'amber', icon: 'x' }) },
	})
	const decline = useMutation({
		mutationFn: () => servicesApi.declineOffer(offer.id),
		onSuccess: () => { refresh(); onDone?.(); pushToast({ title: 'Order passed on' }) },
		onError: err => { refresh(); pushToast({ title: 'Could not decline', body: err.response?.data?.message, tone: 'amber', icon: 'x' }) },
	})
	return { accept, decline, busy: accept.isPending || decline.isPending }
}

const press = 'transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-60'

function Actions({ actions, wide = false }) {
	const { accept, decline, busy } = actions
	const stop = fn => e => { e.stopPropagation(); fn() }
	return (
		<>
			<button type="button" disabled={busy} onClick={stop(() => decline.mutate())} className={`h-11 rounded-xl px-3 text-[15px] font-medium text-ink-600 hover:bg-white hover:text-ink-900 ${press} ${wide ? 'flex-1 border border-ink-200 hover:bg-ink-50' : ''}`}>
				{decline.isPending ? 'Passing…' : 'Decline'}
			</button>
			<button
				type="button"
				disabled={busy}
				onClick={stop(() => accept.mutate())}
				className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(6,78,59,0.25)] hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${press} ${wide ? 'flex-[2]' : ''}`}
			>
				{accept.isPending ? 'Accepting…' : <><Icon name="check" size={16} /> Accept order</>}
			</button>
		</>
	)
}

function BriefValue({ item }) {
	if (item.type === 'link') {
		return <a href={item.value} target="_blank" rel="noreferrer" className="break-all text-[15px] text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900">{item.value}</a>
	}
	if (item.type === 'files') {
		const count = Array.isArray(item.value) ? item.value.length : 0
		return <p className="text-[15px] text-ink-600">{count ? `${count} file${count === 1 ? '' : 's'}, shared in the chat once you accept` : 'Shared in the chat once you accept'}</p>
	}
	return <p className="whitespace-pre-line text-[15px] text-ink-900 [overflow-wrap:anywhere]">{linkify(item.value)}</p>
}

/** The whole offer: brief, scope and payout, with the same two choices. */
function OfferSheet({ offer, left, onClose }) {
	const actions = useOfferActions(offer, onClose)
	const snap = offer.snapshot || {}
	const brief = (offer.brief || []).filter(item => item.value && (!Array.isArray(item.value) || item.value.length))

	useEffect(() => {
		const onKey = (e) => { if (e.key === 'Escape') onClose() }
		document.addEventListener('keydown', onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
	}, [onClose])

	return (
		<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 font-store md:items-stretch md:justify-end" onClick={onClose}>
			<div role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={e => e.stopPropagation()} className="brief-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-none md:max-w-[520px] md:rounded-none">
				<div className="flex items-start gap-3 border-b border-ink-100 px-5 pb-4 pt-5">
					<div className="min-w-0 flex-1">
						<h2 id="offer-title" className="text-xl font-medium tracking-tight text-ink-900">{snap.title || offer.template_title}</h2>
						<p className="mt-0.5 text-sm text-ink-500">{metaLine(offer)}</p>
					</div>
					<Timer left={left} className="mt-1" />
					<button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900">
						<Icon name="x" size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-5">
					<dl className="grid grid-cols-3 gap-3 rounded-2xl bg-ink-50 p-4">
						<div><dt className="text-[13px] text-ink-500">You earn</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{inr(offer.freelancer_payout)}</dd></div>
						<div><dt className="text-[13px] text-ink-500">Deliver in</dt><dd className="mt-0.5 text-lg font-medium text-ink-900">{snap.delivery_days ? `${snap.delivery_days} day${snap.delivery_days === 1 ? '' : 's'}` : '—'}</dd></div>
						<div><dt className="text-[13px] text-ink-500">Revisions</dt><dd className="mt-0.5 text-lg font-medium tabular-nums text-ink-900">{offer.revisions_included ?? snap.revisions ?? 0}</dd></div>
					</dl>

					<h3 className="mt-7 text-[17px] font-medium text-ink-900">Client brief</h3>
					{brief.length ? (
						<dl className="mt-3 space-y-4">
							{brief.map(item => (
								<div key={item.key}>
									<dt className="text-sm text-ink-500">{item.label}</dt>
									<dd className="mt-1"><BriefValue item={item} /></dd>
								</div>
							))}
						</dl>
					) : <p className="mt-2 text-[15px] text-ink-600">No brief yet. The client can add details in the chat.</p>}

					{offer.instructions && (
						<div className="mt-4">
							<p className="text-sm text-ink-500">Anything else</p>
							<p className="mt-1 whitespace-pre-line text-[15px] text-ink-900">{offer.instructions}</p>
						</div>
					)}

					{(snap.includes?.length > 0 || snap.excludes?.length > 0) && (
						<>
							<h3 className="mt-7 text-[17px] font-medium text-ink-900">Scope</h3>
							<ul className="mt-3 space-y-2 text-[15px]">
								{(snap.includes || []).map(text => <li key={`in-${text}`} className="flex gap-2 text-ink-900"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />{text}</li>)}
								{(snap.excludes || []).map(text => <li key={`ex-${text}`} className="flex gap-2 text-ink-500"><Icon name="x" size={16} className="mt-0.5 shrink-0 text-ink-400" />{text}</li>)}
							</ul>
						</>
					)}
				</div>

				<div className="flex gap-2 border-t border-ink-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<Actions actions={actions} wide />
				</div>
			</div>
		</div>
	)
}

function Offer({ offer, now, onOpen }) {
	const actions = useOfferActions(offer)
	const left = new Date(offer.offer_expires_at).getTime() - now
	const line = briefLine(offer.brief)

	return (
		<li>
			<div
				role="button"
				tabIndex={0}
				onClick={onOpen}
				onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
				aria-label={`View offer ${offer.booking_number}`}
				className="group flex cursor-pointer flex-col gap-4 p-4 transition-colors duration-150 hover:bg-emerald-100/50 focus-visible:bg-emerald-100/50 focus-visible:outline-none md:flex-row md:items-center md:gap-6 md:p-5"
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-3">
						<h3 className="min-w-0 truncate text-lg font-medium text-ink-900">{offer.snapshot?.title || offer.template_title}</h3>
						<Timer left={left} />
					</div>
					<div className="mt-0.5 truncate text-sm text-ink-600">{metaLine(offer)}</div>
					{line && <p className="mt-2 line-clamp-1 text-[15px] text-ink-800">“{line}”</p>}
					<span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-emerald-800 underline-offset-4 group-hover:underline">
						See full brief <Icon name="arrowRight" size={13} />
					</span>
				</div>
				<div className="flex items-center gap-3 md:gap-5">
					<div className="mr-auto md:mr-0 md:text-right">
						<div className="text-xl font-semibold tabular-nums text-ink-900">{inr(offer.freelancer_payout)}</div>
						<div className="text-[13px] text-ink-600">you earn</div>
					</div>
					<Actions actions={actions} />
				</div>
			</div>
		</li>
	)
}

/** New orders offered to this freelancer. Each one waits 30 minutes, then goes to the next freelancer. */
export default function OrderOffers({ className = 'mt-6' }) {
	const [now, setNow] = useState(() => Date.now())
	const [openId, setOpenId] = useState(null)
	const { data: offers = [] } = useOrderOffers()
	const live = offers.filter(offer => new Date(offer.offer_expires_at).getTime() > now)
	const open = live.find(offer => offer.id === openId)

	useEffect(() => {
		if (!offers.length) return undefined
		const timer = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(timer)
	}, [offers.length])

	if (!live.length) return null
	return (
		<section className={className} aria-label="New order offers">
			<div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 className="text-xl font-medium tracking-tight text-ink-900 md:text-2xl">
					{live.length === 1 ? 'A new order is waiting' : `${live.length} new orders are waiting`}
				</h2>
				<p className="text-sm text-ink-500">Accept within 30 minutes or it goes to the next freelancer.</p>
			</div>
			<ul className="divide-y divide-emerald-200/70 overflow-hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
				{live.map(offer => <Offer key={offer.id} offer={offer} now={now} onOpen={() => setOpenId(offer.id)} />)}
			</ul>
			{open && <OfferSheet offer={open} left={new Date(open.offer_expires_at).getTime() - now} onClose={() => setOpenId(null)} />}
		</section>
	)
}
