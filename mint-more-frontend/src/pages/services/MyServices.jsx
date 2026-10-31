import { useSearchParams } from 'react-router-dom'
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
function OfferSwitch({ on, busy, locked, onToggle, label }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={locked ? `${label}: pass an assessment to unlock` : `${on ? 'Stop offering' : 'Offer'} ${label}`}
			disabled={busy || locked}
			onClick={onToggle}
			className="group inline-flex shrink-0 items-center rounded-full p-1 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
		>
			<span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible:ring-2 group-focus-visible:ring-ink-900 group-focus-visible:ring-offset-2 ${on ? 'bg-mint-500' : 'bg-ink-200 group-hover:bg-ink-300'}`}>
				<span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-90 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
			</span>
		</button>
	)
}

function ServiceRow({ t, busy, onToggle }) {
	const locked = t.can_opt_in === false && !t.opted_in
	const days = [...new Set((t.variants || []).map(v => Number(v.delivery_days)))].sort((a, b) => a - b)
	const turnaround = days.length > 1 ? `${days[0]}–${deliveryText(days[days.length - 1])}` : days.length ? deliveryText(days[0]) : null
	return (
		<li>
			<details className="group/row">
				<summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-ink-50/70 md:gap-4 md:px-5 [&::-webkit-details-marker]:hidden">
					<div className="min-w-0 flex-1">
						<p className={`truncate text-[15px] font-medium ${t.opted_in ? 'text-ink-900' : 'text-ink-700'}`}>{t.title}</p>
						<p className="hidden truncate text-[13px] text-ink-500 sm:block">
							{[turnaround, `${t.revisions} revision${Number(t.revisions) === 1 ? '' : 's'}`, `${t.variants.length} option${t.variants.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
						</p>
						{/* Phones: what you earn comes first, then the turnaround. */}
						<p className="truncate text-[13px] text-ink-500 sm:hidden">
							<span className="font-medium tabular-nums text-ink-900">{payoutRange(t.variants)}</span>{turnaround ? ` · ${turnaround}` : ''}
						</p>
						{locked && <p className="text-[13px] text-ink-600">Pass an assessment to unlock</p>}
					</div>
					<span className="hidden w-36 shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink-900 sm:block">{payoutRange(t.variants)}</span>
					<Icon name="chevronDown" size={16} className="shrink-0 text-ink-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open/row:rotate-180" />
					{/* The switch sits inside the summary; stop it from also opening the row. */}
					<span onClick={event => event.preventDefault()} className="shrink-0">
						<OfferSwitch on={t.opted_in} busy={busy} locked={locked} onToggle={onToggle} label={t.title} />
					</span>
				</summary>
				<div className="px-4 pb-4 md:px-5">
					{t.summary && <p className="text-[13px] text-ink-600">{t.summary}</p>}
					<ul className="mt-2 max-w-xl rounded-xl bg-ink-50 px-3 py-1 text-[13px]">
						{t.variants.map(v => (
							<li key={v.id} className="flex items-center gap-3 py-1.5">
								<span className="min-w-0 flex-1 text-ink-700">{variantLabel(v)}</span>
								<span className="text-ink-500">{deliveryText(v.delivery_days)}</span>
								<span className="w-20 text-right font-medium tabular-nums text-ink-900">{inr(v.freelancer_payout)}</span>
							</li>
						))}
					</ul>
					<p className="mt-2 text-[12px] text-ink-500">{t.freelancer_count} freelancer{t.freelancer_count === 1 ? '' : 's'} offer{t.freelancer_count === 1 ? 's' : ''} this</p>
				</div>
			</details>
		</li>
	)
}

export default function MyServices() {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [params, setParams] = useSearchParams()
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
	// One category at a time, so the page never needs a long scroll.
	const categories = Object.keys(byCategory)
	const active = categories.includes(params.get('category')) ? params.get('category') : categories[0]
	const list = byCategory[active] || []

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
				<div className="min-w-0">
					<h1 className="text-3xl font-medium leading-tight tracking-tight text-ink-900 md:text-[40px]">My services</h1>
					<p className="mt-1 max-w-[68ch] text-[15px] text-ink-600">
						Turn on what you can deliver. Each booking is offered to one freelancer at a time, who has 30 minutes to accept.
					</p>
				</div>
				{templates.length > 0 && <p className="text-[15px] text-ink-600">You offer <span className="font-medium tabular-nums text-ink-900">{offered} of {templates.length}</span></p>}
			</div>

			{data && !kycVerified && (
				<p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
					Your KYC isn't verified yet, so no orders reach you until it is. You can still choose services now.
				</p>
			)}

			{isLoading ? (
				<div className="mt-7 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-ink-100" />)}</div>
			) : (
				// Desktop: categories down the left, their services beside them. Phones: tabs on top.
				<div className="mt-7 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
					<div role="tablist" aria-label="Service categories" className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1 [scrollbar-width:none] lg:sticky lg:top-[88px] lg:flex-col lg:self-start lg:overflow-visible lg:bg-transparent lg:p-0">
						{categories.map(category => {
							const on = byCategory[category].filter(t => t.opted_in).length
							const selected = category === active
							return (
								<button
									key={category}
									type="button"
									role="tab"
									aria-selected={selected}
									onClick={() => setParams({ category }, { replace: true })}
									className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-[14px] font-medium transition-colors duration-150 lg:py-2.5 lg:text-[15px] ${selected ? 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] lg:bg-ink-100 lg:shadow-none' : 'text-ink-600 hover:text-ink-900 lg:hover:bg-ink-50'}`}
								>
									<span className="truncate">{category}</span>
									<span className={`tabular-nums ${on ? 'text-mint-600' : 'text-ink-400'}`}>{on}/{byCategory[category].length}</span>
								</button>
							)
						})}
					</div>
					<ul role="tabpanel" aria-label={active} className="divide-y divide-ink-100 self-start rounded-2xl border border-ink-200 bg-white">
						{list.map(t => (
							<ServiceRow
								key={t.id}
								t={t}
								busy={toggle.isPending && toggle.variables?.id === t.id}
								onToggle={() => toggle.mutate({ id: t.id, optedIn: t.opted_in })}
							/>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
