import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import { inr } from '../../components/services/serviceUtils'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts a money figure up from zero once, the first time it shows. */
function useCountUp(value, duration = 900) {
	const [shown, setShown] = useState(reducedMotion() ? value : 0)
	const started = useRef(false)
	useEffect(() => {
		if (value == null) return undefined
		if (started.current || reducedMotion()) { setShown(value); return undefined }
		started.current = true
		let frame
		const start = performance.now()
		const tick = (now) => {
			const t = Math.min(1, (now - start) / duration)
			setShown(value * (1 - Math.pow(1 - t, 3)))
			if (t < 1) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [value, duration])
	return shown
}

const ago = (at) => {
	const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000))
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}m ago`
	if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
	return new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Due time in words, coloured only when it needs attention. */
function dueOf(row) {
	if (!row.due_at) return { text: 'No due date', tone: 'text-ink-500' }
	const hours = (new Date(row.due_at).getTime() - Date.now()) / 3_600_000
	const span = (h) => (Math.abs(h) < 24 ? `${Math.max(1, Math.round(Math.abs(h)))}h` : `${Math.round(Math.abs(h) / 24)}d`)
	if (hours < 0) return { text: `${span(hours)} overdue`, tone: 'text-rose-600 font-medium' }
	if (hours < 24) return { text: `Due in ${span(hours)}`, tone: 'text-amber-700 font-medium' }
	return { text: `Due in ${span(hours)}`, tone: 'text-ink-600' }
}

const payoutWhen = (next) => {
	if (!next) return ''
	if (next.days_away === 0) return 'Today'
	if (next.days_away === 1) return 'Tomorrow'
	return new Date(`${next.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
}

const UPDATE_WORDS = {
	revision: { label: 'Revision requested', tone: 'text-violet-700' },
	approved: { label: 'Approved', tone: 'text-emerald-700' },
	completed: { label: 'Completed · paid', tone: 'text-emerald-700' },
	viewed: { label: 'Viewed your delivery', tone: 'text-ink-600' },
	message: { label: 'Message', tone: 'text-ink-900' },
}

function Panel({ title, action, children, index, className = '' }) {
	return (
		<section className={`dash-rise flex min-w-0 flex-col rounded-2xl border border-ink-200 bg-white ${className}`} style={{ '--i': index }}>
			<header className="flex items-baseline justify-between gap-3 px-5 pt-4">
				<h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
				{action}
			</header>
			{children}
		</section>
	)
}

/** Money on its way, ready, and being paid out, as one lane. Only Creatyv has this flow. */
function PayoutLane({ earnings }) {
	const parts = [
		{ key: 'on_the_way', label: 'On its way', value: earnings.on_the_way, fill: 'bg-ink-200' },
		{ key: 'available', label: 'Ready', value: earnings.available, fill: 'bg-mint-500' },
		{ key: 'in_withdrawal', label: 'Paying out', value: earnings.in_withdrawal, fill: 'bg-ink-900' },
	]
	const total = parts.reduce((sum, part) => sum + part.value, 0)
	return (
		<div className="mt-5">
			<div className="dash-fill flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={parts.map(p => `${p.label} ${inr(p.value)}`).join(', ')}>
				{total > 0 && parts.filter(p => p.value > 0).map(part => (
					<span key={part.key} className={`h-full ${part.fill}`} style={{ width: `${(part.value / total) * 100}%` }} />
				))}
			</div>
			<dl className="mt-3 grid grid-cols-3 gap-3">
				{parts.map(part => (
					<div key={part.key} className="min-w-0">
						<dt className="flex items-center gap-1.5 text-[12px] text-ink-500">
							<span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${part.fill}`} />
							<span className="truncate">{part.label}</span>
						</dt>
						<dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{inr(part.value)}</dd>
					</div>
				))}
			</dl>
		</div>
	)
}

function Skeleton() {
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
			{[0, 1, 2, 3].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-ink-100" />)}
		</div>
	)
}

/**
 * The freelancer's home: what they've earned and when it pays out, what needs them next, and
 * what their clients just did. It answers "how's my money, and what do I do now?" first.
 */
export default function FreelancerHome() {
	const firstName = (useAuthStore(s => s.user?.full_name) || '').split(/[\s(]/)[0]
	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ['freelancer-dashboard'],
		queryFn: () => servicesApi.dashboard().then(res => res.data.data),
		refetchInterval: 30_000,
	})
	const available = useCountUp(data?.earnings.available)

	if (isLoading) return <div className="mx-auto w-full max-w-[1280px] px-4 py-8 font-store md:px-8"><Skeleton /></div>
	if (isError || !data) {
		return (
			<div className="mx-auto w-full max-w-xl px-4 py-16 text-center font-store">
				<h1 className="text-2xl font-medium text-ink-900">Couldn't load your dashboard</h1>
				<button type="button" onClick={() => refetch()} className="mt-4 rounded-xl bg-ink-900 px-5 py-2.5 text-[15px] font-medium text-white active:scale-[0.97]">Try again</button>
			</div>
		)
	}

	const { earnings, next_payout: next, orders, updates } = data
	const unread = updates.filter(u => u.unread).length
	const summary = [
		orders.overdue ? `${orders.overdue} overdue` : null,
		orders.due_today ? `${orders.due_today} due today` : null,
		orders.revisions ? `${orders.revisions} revision${orders.revisions === 1 ? '' : 's'} to do` : null,
	].filter(Boolean)

	return (
		<div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-7 font-store md:px-8 md:pt-9">
			<div className="dash-rise" style={{ '--i': 0 }}>
				<h1 className="text-[26px] font-medium tracking-[-0.02em] text-ink-900 md:text-[30px]">{firstName ? `Hi ${firstName}` : 'Dashboard'}</h1>
				<p className="mt-1 max-w-[70ch] text-[15px] text-ink-600">
					{summary.length
						? <><span className="font-medium text-ink-900">{summary.join(', ')}</span>. {orders.active} order{orders.active === 1 ? '' : 's'} in progress.</>
						: orders.active ? `${orders.active} order${orders.active === 1 ? '' : 's'} in progress, nothing late.` : 'No orders in progress right now.'}
					{unread > 0 && <> {unread} new from your clients.</>}
				</p>
			</div>

			<div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
				{/* Money first: the screen's question */}
				<Panel title="Earnings" index={1} action={<Link to="/settings/freelancer?tab=earnings" className="text-[13px] font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline">History</Link>}>
					<div className="px-5 pb-5 pt-3">
						<p className="text-[13px] text-ink-500">Ready to withdraw</p>
						<p className="mt-0.5 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink-900 md:text-[48px]">{inr(available === earnings.available ? available : Math.round(available))}</p>
						<PayoutLane earnings={earnings} />
						<dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-ink-50 px-4 py-3">
							<div><dt className="text-[12px] text-ink-500">This month</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{inr(earnings.this_month)}</dd></div>
							<div><dt className="text-[12px] text-ink-500">All time</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{inr(earnings.total_earned)}</dd></div>
							<div><dt className="text-[12px] text-ink-500">Orders completed</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{orders.completed}</dd></div>
						</dl>
					</div>
				</Panel>

				<Panel title="Next payout" index={2}>
					<div className="flex flex-1 flex-col px-5 pb-5 pt-3">
						<p className="text-[13px] text-ink-500">{next.label}</p>
						<p className="mt-0.5 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">{payoutWhen(next)}</p>
						<p className="mt-1 text-[14px] text-ink-600">
							{next.days_away === 0 ? `Today's ${next.weekday} run` : `Every ${next.weekday}${next.days_away > 1 ? `, in ${next.days_away} days` : ''}`}
						</p>
						<p className="mt-4 text-[14px] text-ink-700">
							{earnings.available > 0
								? <>Request a withdrawal before then and <span className="font-semibold tabular-nums text-ink-900">{inr(earnings.available)}</span> goes out in it.</>
								: earnings.on_the_way > 0
									? <><span className="font-semibold tabular-nums text-ink-900">{inr(earnings.on_the_way)}</span> is released to you as clients complete their orders.</>
									: 'Complete orders to have money in the next run.'}
						</p>
						<div className="mt-auto pt-5" />
						<Link
							to="/settings/freelancer?tab=earnings"
							className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] ease-[cubic-bezier(0.23,1,0.32,1)] ${earnings.available > 0 ? 'bg-ink-900 text-white hover:bg-ink-800' : 'pointer-events-none bg-ink-100 text-ink-400'}`}
							aria-disabled={earnings.available <= 0}
						>
							<Icon name="arrowUpRight" size={16} /> Withdraw
						</Link>
					</div>
				</Panel>

				{/* What needs them next */}
				<Panel
					title="Next up"
					index={3}
					action={<Link to="/work" className="text-[13px] font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline">All work</Link>}
				>
					<p className="px-5 pt-1 text-[13px] text-ink-500">
						{orders.active} in progress · {orders.awaiting_client} with the client · {orders.revisions} revision{orders.revisions === 1 ? '' : 's'}
					</p>
					{orders.next_up.length === 0 ? (
						<p className="px-5 pb-6 pt-6 text-[15px] text-ink-600">Nothing to work on right now. New orders show up in My Work as they're offered to you.</p>
					) : (
						<ul className="mt-2 pb-2">
							{orders.next_up.map(row => {
								const due = dueOf(row)
								return (
									<li key={row.id}>
										<Link to={row.room_id ? `/chat?room=${row.room_id}` : `/work/${row.id}`} className={`group mx-2 flex items-center gap-4 rounded-xl px-3 py-3 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.99] ease-[cubic-bezier(0.23,1,0.32,1)]`}>
											<div className="min-w-0 flex-1">
												<p className="truncate text-[15px] font-medium text-ink-900">{row.title}</p>
												<p className="truncate text-[13px] text-ink-500">
													{row.stage === 'revision_requested' && <span className="font-medium text-violet-700">Revision · </span>}
													{row.service !== row.title ? `${row.service} · ` : ''}{row.booking_number}
												</p>
												<p className={`text-[13px] tabular-nums sm:hidden ${due.tone}`}>{due.text}</p>
											</div>
											<span className={`hidden w-28 shrink-0 text-right text-[13px] tabular-nums sm:block ${due.tone}`}>{due.text}</span>
											<span className="w-20 shrink-0 text-right text-[15px] font-medium tabular-nums text-ink-900">{inr(row.payout)}</span>
											<Icon name="chevronRight" size={16} className="shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-600" />
										</Link>
									</li>
								)
							})}
						</ul>
					)}
				</Panel>

				{/* What clients just did */}
				<Panel title="From your clients" index={4}>
					{updates.length === 0 ? (
						<p className="px-5 pb-6 pt-4 text-[15px] text-ink-600">Revisions, approvals and messages from your clients show up here.</p>
					) : (
						<ul className="mt-2 pb-2">
							{updates.map(update => {
								const word = UPDATE_WORDS[update.kind] || UPDATE_WORDS.message
								return (
									<li key={update.id}>
										<Link to={update.room_id ? `/chat?room=${update.room_id}` : '/notifications'} className={`mx-2 block rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-ink-50 ease-[cubic-bezier(0.23,1,0.32,1)]`}>
											<p className="flex items-baseline justify-between gap-3 text-[13px]">
												<span className={`truncate ${word.tone} ${update.unread ? 'font-semibold' : 'font-medium'}`}>{word.label}{update.order_title ? <span className="font-normal text-ink-500"> · {update.order_title}</span> : null}</span>
												<time className="shrink-0 tabular-nums text-ink-500" dateTime={update.at}>{ago(update.at)}</time>
											</p>
											{update.body && <p className={`mt-0.5 line-clamp-1 text-[14px] ${update.unread ? 'text-ink-900' : 'text-ink-600'}`}>{update.body.replace(/\s+/g, ' ')}</p>}
										</Link>
									</li>
								)
							})}
						</ul>
					)}
				</Panel>
			</div>
		</div>
	)
}
