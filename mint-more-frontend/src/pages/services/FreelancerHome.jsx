import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { walletApi } from '../../api/wallet'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import { dueText, freelancerNextAction, inr, variantLabel } from '../../components/services/serviceUtils'

export default function FreelancerHome() {
	const name = useAuthStore(s => s.user?.full_name)
	const [now] = useState(() => Date.now())
	const { data: work = [], isLoading } = useQuery({
		queryKey: ['service-bookings', 'freelancer'],
		queryFn: () => servicesApi.work().then(res => res.data.data),
		refetchInterval: 30_000,
	})
	const { data: templates } = useQuery({
		queryKey: ['freelancer-templates'],
		queryFn: () => servicesApi.templates().then(res => res.data.data),
	})
	const { data: wallet } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then(res => res.data.data),
	})

	const open = work.filter(w => ['in_progress', 'revision_requested'].includes(w.stage))
	const dueSoon = open.filter(w => w.due_at && new Date(w.due_at).getTime() - now < 24 * 3_600_000)
	const awaiting = work.filter(w => ['delivered', 'approved'].includes(w.stage))
	const optedIn = (templates?.templates || []).filter(t => t.opted_in).length
	const kycVerified = templates?.eligibility?.kyc_status === 'verified'

	const stats = [
		{ label: 'Due in 24h', value: dueSoon.length, tone: dueSoon.length ? 'text-rose-600' : 'text-ink-900' },
		{ label: 'Revisions requested', value: open.filter(w => w.stage === 'revision_requested').length },
		{ label: 'Awaiting client', value: awaiting.length },
		{ label: 'Available balance', value: inr(wallet?.balance || 0) },
	]

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
			<div className="mb-6">
				<div className="text-[11px] font-bold uppercase tracking-wider text-mint-500">Workspace</div>
				<h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-900">Hi{name ? ` ${name.split(' ')[0]}` : ''}, here's your work</h1>
			</div>

			{templates && !kycVerified && (
				<div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
					<strong>Complete KYC to receive orders.</strong> Orders are only assigned to freelancers with verified KYC. <Link to="/settings" className="font-bold underline">Go to settings</Link>
				</div>
			)}
			{templates && kycVerified && optedIn === 0 && (
				<div className="mb-4 rounded-2xl border border-mint-200 bg-mint-50 p-4 text-sm text-ink-800">
					<strong>Pick the services you deliver.</strong> You'll only get orders for services you opt into. <Link to="/my-services" className="font-bold text-mint-600 underline">Choose services</Link>
				</div>
			)}

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{stats.map(stat => (
					<div key={stat.label} className="rounded-2xl border border-ink-200 bg-white p-4">
						<div className={`text-2xl font-bold tabular-nums ${stat.tone || 'text-ink-900'}`}>{isLoading ? '–' : stat.value}</div>
						<div className="text-xs text-ink-500">{stat.label}</div>
					</div>
				))}
			</div>

			<section className="mt-8">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-bold text-ink-900">Active work</h2>
					<Link to="/work" className="text-xs font-bold text-mint-600">View all</Link>
				</div>
				{open.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-500">
						No active orders. New orders are assigned automatically for the {optedIn} service{optedIn === 1 ? '' : 's'} you offer.
					</div>
				) : (
					<div className="space-y-2">
						{open.map(row => (
							<Link key={row.id} to={`/work/${row.id}`} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 transition hover:border-mint-300">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2"><span className="text-[11px] font-bold tabular-nums text-ink-400">{row.booking_number}</span><StageBadge stage={row.stage} /></div>
									<div className="mt-0.5 truncate text-sm font-bold text-ink-900">{row.snapshot?.title}</div>
									<div className="truncate text-xs text-ink-500">{variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)} · {row.client_name}</div>
								</div>
								<div className="text-right">
									<div className={`text-xs font-semibold ${row.due_at && new Date(row.due_at).getTime() < now ? 'text-rose-600' : 'text-ink-600'}`}>{dueText(row.due_at)}</div>
									<div className="text-sm font-bold tabular-nums text-ink-900">{inr(row.freelancer_payout)}</div>
									<div className="text-[11px] font-bold text-mint-600">{freelancerNextAction(row.stage)} →</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</section>

			<div className="mt-8 grid gap-3 sm:grid-cols-3">
				<Link to="/my-services" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-mint-300"><Icon name="layers" size={18} className="text-mint-500" /><div className="mt-2 text-sm font-bold">My services</div><div className="text-xs text-ink-500">{optedIn} opted in</div></Link>
				<Link to="/wallet" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-mint-300"><Icon name="wallet" size={18} className="text-mint-500" /><div className="mt-2 text-sm font-bold">Earnings</div><div className="text-xs text-ink-500">Withdraw to bank or UPI</div></Link>
				<Link to="/portfolio" className="rounded-2xl border border-ink-200 bg-white p-4 hover:border-mint-300"><Icon name="portfolio" size={18} className="text-mint-500" /><div className="mt-2 text-sm font-bold">Portfolio</div><div className="text-xs text-ink-500">Show your best work</div></Link>
			</div>
		</div>
	)
}
