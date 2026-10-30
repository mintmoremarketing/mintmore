import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { deliveryText, inr, variantLabel } from '../../components/services/serviceUtils'
import { announceProfileUpdated } from '../../components/freelancer/completionApi'

const payoutRange = (variants = []) => {
	const values = variants.map(v => Number(v.freelancer_payout)).filter(Number.isFinite)
	if (!values.length) return '—'
	const low = Math.min(...values), high = Math.max(...values)
	return low === high ? inr(low) : `${inr(low)}–${inr(high)}`
}

/** On/off for one service. The state is the switch itself, so the row needs no outline or badge. */
function OfferSwitch({ on, busy, onToggle, label }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={`${on ? 'Stop offering' : 'Offer'} ${label}`}
			disabled={busy}
			onClick={onToggle}
			className="group inline-flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 text-[14px] font-medium text-ink-700 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
		>
			<span className="w-[52px] text-right tabular-nums">{on ? 'On' : 'Off'}</span>
			<span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible:ring-2 group-focus-visible:ring-ink-900 group-focus-visible:ring-offset-2 ${on ? 'bg-mint-500' : 'bg-ink-200 group-hover:bg-ink-300'}`}>
				<span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-90 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
			</span>
		</button>
	)
}

function ServiceRow({ t, busy, onToggle }) {
	const days = [...new Set((t.variants || []).map(v => Number(v.delivery_days)))].sort((a, b) => a - b)
	const turnaround = days.length > 1 ? `${days[0]}–${deliveryText(days[days.length - 1])}` : days.length ? deliveryText(days[0]) : null
	return (
		<li className="px-4 py-4 md:px-5">
			<div className="flex items-start gap-4">
				<div className="min-w-0 flex-1">
					<p className={`text-[15px] font-medium ${t.opted_in ? 'text-ink-900' : 'text-ink-700'}`}>{t.title}</p>
					{t.summary && <p className="mt-0.5 text-[13px] text-ink-500">{t.summary}</p>}
					<p className="mt-1.5 text-[13px] text-ink-500">
						{[turnaround, `${t.revisions} revision${Number(t.revisions) === 1 ? '' : 's'}`, `${t.freelancer_count} freelancer${t.freelancer_count === 1 ? '' : 's'} offer${t.freelancer_count === 1 ? 's' : ''} it`].filter(Boolean).join(' · ')}
					</p>
					{/* Every option is one tap away; the range above is enough to decide. */}
					<details className="group mt-2">
						<summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[13px] font-medium text-ink-700 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 [&::-webkit-details-marker]:hidden">
							{t.variants.length} option{t.variants.length === 1 ? '' : 's'}
							<Icon name="chevronDown" size={14} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180" />
						</summary>
						<ul className="mt-2 max-w-xl rounded-xl bg-ink-50 px-3 py-1 text-[13px]">
							{t.variants.map(v => (
								<li key={v.id} className="flex items-center gap-3 py-1.5">
									<span className="min-w-0 flex-1 text-ink-700">{variantLabel(v)}</span>
									<span className="text-ink-500">{deliveryText(v.delivery_days)}</span>
									<span className="w-20 text-right font-medium tabular-nums text-ink-900">{inr(v.freelancer_payout)}</span>
								</li>
							))}
						</ul>
					</details>
				</div>
				<div className="hidden w-40 shrink-0 text-right sm:block">
					<p className="text-[12px] text-ink-500">You earn</p>
					<p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{payoutRange(t.variants)}</p>
				</div>
				<OfferSwitch on={t.opted_in} busy={busy} onToggle={onToggle} label={t.title} />
			</div>
			<p className="mt-2 text-[13px] text-ink-600 sm:hidden">You earn <span className="font-semibold tabular-nums text-ink-900">{payoutRange(t.variants)}</span></p>
		</li>
	)
}

export default function MyServices() {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const { data, isLoading } = useQuery({
		queryKey: ['freelancer-templates'],
		queryFn: () => servicesApi.templates().then(res => res.data.data),
	})

	const toggle = useMutation({
		mutationFn: ({ id, optedIn }) => (optedIn ? servicesApi.optOut(id) : servicesApi.optIn(id)),
		// Flip the switch straight away; the server answer settles it.
		onMutate: async ({ id, optedIn }) => {
			await queryClient.cancelQueries({ queryKey: ['freelancer-templates'] })
			const previous = queryClient.getQueryData(['freelancer-templates'])
			queryClient.setQueryData(['freelancer-templates'], current => current && ({
				...current,
				templates: current.templates.map(t => (t.id === id ? { ...t, opted_in: !optedIn } : t)),
			}))
			return { previous }
		},
		onSuccess: (res) => {
			announceProfileUpdated()
			pushToast({ title: res.data.message, icon: 'check' })
		},
		onError: (err, _vars, context) => {
			if (context?.previous) queryClient.setQueryData(['freelancer-templates'], context.previous)
			pushToast({ title: 'Could not update', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' })
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: ['freelancer-templates'] }),
	})

	const templates = data?.templates || []
	const offered = templates.filter(t => t.opted_in).length
	const kycVerified = data?.eligibility?.kyc_status === 'verified'
	const byCategory = templates.reduce((acc, t) => {
		(acc[t.category_name || 'Other'] ||= []).push(t)
		return acc
	}, {})

	return (
		<div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-7 font-store md:px-8 md:pt-9">
			<h1 className="text-[26px] font-medium tracking-[-0.02em] text-ink-900 md:text-[30px]">My services</h1>
			<p className="mt-1 max-w-[68ch] text-[15px] text-ink-600">
				Turn on what you can deliver. Each booking is offered to one freelancer at a time, who has 30 minutes to accept.
				{templates.length > 0 && <> You offer <span className="font-medium text-ink-900">{offered} of {templates.length}</span>.</>}
			</p>

			{data && !kycVerified && (
				<p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
					Your KYC isn't verified yet, so no orders reach you until it is. You can still choose services now.
				</p>
			)}

			{isLoading ? (
				<div className="mt-7 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />)}</div>
			) : Object.entries(byCategory).map(([category, list]) => (
				<section key={category} className="mt-8">
					<div className="mb-3 flex items-baseline justify-between gap-3">
						<h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{category}</h2>
						<span className="text-[13px] tabular-nums text-ink-500">{list.filter(t => t.opted_in).length} of {list.length} on</span>
					</div>
					<ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-white">
						{list.map(t => (
							<ServiceRow
								key={t.id}
								t={t}
								busy={toggle.isPending && toggle.variables?.id === t.id}
								onToggle={() => toggle.mutate({ id: t.id, optedIn: t.opted_in })}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}
