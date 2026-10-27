import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import { dueText, formatDate, inr } from '../../components/services/serviceUtils'
import FreelancerWallet from './Wallet'

const SECTIONS = [
	{ key: 'bookings', label: 'Bookings', icon: 'calendar' },
	{ key: 'earnings', label: 'Earnings', icon: 'rupee' },
	{ key: 'billing', label: 'Billing & Invoices', icon: 'file' },
]

const ONGOING = ['in_progress', 'revision_requested', 'delivered', 'approved']

function useWork() {
	return useQuery({
		queryKey: ['service-bookings', 'freelancer'],
		queryFn: () => servicesApi.work().then(res => res.data.data),
	})
}

function Stat({ label, value, icon, tone }) {
	return (
		<div className="flex items-start justify-between rounded-2xl border border-ink-100 p-4">
			<div>
				<div className="text-sm text-ink-500">{label}</div>
				<div className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</div>
			</div>
			<span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon name={icon} size={17} /></span>
		</div>
	)
}

function Bookings() {
	const { data: rows = [], isLoading } = useWork()
	const ongoing = rows.filter(r => ONGOING.includes(r.stage)).length
	const revisions = rows.filter(r => r.stage === 'revision_requested').length
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight text-ink-900">Your Bookings</h1>
			<p className="mt-1 text-[15px] text-ink-500">Service bookings made on your offerings.</p>
			<div className="mt-6 grid gap-3 sm:grid-cols-3">
				<Stat label="Total Projects" value={rows.length} icon="calendar" tone="bg-sky-50 text-sky-600" />
				<Stat label="Ongoing Projects" value={ongoing} icon="clock" tone="bg-amber-50 text-amber-600" />
				<Stat label="Revisions Requested" value={revisions} icon="refresh" tone="bg-rose-50 text-rose-600" />
			</div>
			<h2 className="mt-8 text-lg font-semibold text-ink-900">Recent Bookings</h2>
			<div className="mt-3 overflow-hidden rounded-2xl border border-ink-100">
				{isLoading ? (
					<div className="h-32 animate-pulse bg-ink-50" />
				) : rows.length === 0 ? (
					<div className="flex flex-col items-center py-14 text-center">
						<Icon name="calendar" size={30} className="text-ink-300" />
						<p className="mt-3 text-[15px] text-ink-500">No bookings on your services yet.</p>
					</div>
				) : (
					<ul className="divide-y divide-ink-100">
						{rows.slice(0, 12).map(row => (
							<li key={row.id}>
								<Link to={`/work/${row.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-ink-50">
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium text-ink-900">{row.snapshot?.title}</div>
										<div className="text-sm text-ink-500">{row.booking_number} · {row.client_name || 'Client'}</div>
									</div>
									<div className="hidden text-right text-sm text-ink-500 sm:block">{row.stage === 'completed' ? `Completed ${formatDate(row.completed_at)}` : dueText(row.due_at)}</div>
									<StageBadge stage={row.stage} />
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</>
	)
}

function Billing() {
	const { data: rows = [], isLoading } = useWork()
	const paid = rows.filter(r => r.stage === 'completed')
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight text-ink-900">Billing & Invoices</h1>
			<p className="mt-1 text-[15px] text-ink-500">Payouts for completed orders. Money moves to Earnings once the client approves.</p>
			<div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100">
				{isLoading ? <div className="h-32 animate-pulse bg-ink-50" /> : paid.length === 0 ? (
					<div className="flex flex-col items-center py-14 text-center">
						<Icon name="file" size={30} className="text-ink-300" />
						<p className="mt-3 text-[15px] text-ink-500">No payouts yet. They appear here when an order is completed.</p>
					</div>
				) : (
					<table className="w-full min-w-[560px] text-left text-sm">
						<thead className="bg-ink-50 text-ink-500">
							<tr><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Service</th><th className="px-4 py-3 font-medium">Completed</th><th className="px-4 py-3 text-right font-medium">Payout</th></tr>
						</thead>
						<tbody className="divide-y divide-ink-100">
							{paid.map(row => (
								<tr key={row.id}>
									<td className="px-4 py-3 tabular-nums text-ink-700"><Link to={`/work/${row.id}`} className="hover:underline">{row.booking_number}</Link></td>
									<td className="px-4 py-3 text-ink-900">{row.snapshot?.title}</td>
									<td className="px-4 py-3 text-ink-600">{formatDate(row.completed_at)}</td>
									<td className="px-4 py-3 text-right font-medium tabular-nums text-ink-900">{inr(row.freelancer_payout)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</>
	)
}

/** Freelancer settings hub: Bookings, Earnings and Billing in one place with a left menu. */
export default function FreelancerSettings() {
	const [params, setParams] = useSearchParams()
	const section = SECTIONS.some(s => s.key === params.get('tab')) ? params.get('tab') : 'bookings'

	return (
		<div className="flex w-full flex-1 flex-col font-store md:flex-row">
			<nav aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-100 px-4 py-3 md:w-[300px] md:flex-col md:border-b-0 md:border-r md:px-6 md:py-6">
				{SECTIONS.map(s => (
					<button
						key={s.key}
						type="button"
						onClick={() => setParams(s.key === 'bookings' ? {} : { tab: s.key }, { replace: true })}
						aria-current={section === s.key ? 'page' : undefined}
						className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition-colors ${section === s.key ? 'bg-ink-900 font-medium text-white' : 'text-ink-700 hover:bg-ink-50'}`}
					>
						<Icon name={s.icon} size={17} /> {s.label}
					</button>
				))}
			</nav>
			<div className="min-w-0 flex-1 px-4 py-6 md:px-8">
				{section === 'bookings' && <Bookings />}
				{section === 'earnings' && <div className="-mx-4 -my-6 md:-mx-8"><FreelancerWallet /></div>}
				{section === 'billing' && <Billing />}
			</div>
		</div>
	)
}
