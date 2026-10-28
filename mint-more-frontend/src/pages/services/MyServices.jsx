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

export default function MyServices() {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const { data, isLoading } = useQuery({
		queryKey: ['freelancer-templates'],
		queryFn: () => servicesApi.templates().then(res => res.data.data),
	})

	const toggle = useMutation({
		mutationFn: ({ id, optedIn }) => (optedIn ? servicesApi.optOut(id) : servicesApi.optIn(id)),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ['freelancer-templates'] })
			announceProfileUpdated()
			pushToast({ title: res.data.message, icon: 'check' })
		},
		onError: err => pushToast({ title: 'Could not update', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const templates = data?.templates || []
	const kycVerified = data?.eligibility?.kyc_status === 'verified'
	const byCategory = templates.reduce((acc, t) => {
		(acc[t.category_name || 'Other'] ||= []).push(t)
		return acc
	}, {})

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
			<div className="mb-6">
				<h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-900">My services</h1>
				<p className="mt-2 max-w-2xl text-sm text-ink-600">Turn on the services you can deliver. When a client books one, it is offered to one freelancer who provides it, who then has 30 minutes to accept. Your payout per order is shown below.</p>
			</div>

			{data && !kycVerified && (
				<div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
					Your KYC isn't verified yet, so you won't be assigned orders until it is. You can still choose services now.
				</div>
			)}

			{isLoading ? (
				<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-100" />)}</div>
			) : Object.entries(byCategory).map(([category, list]) => (
				<section key={category} className="mb-8">
					<h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">{category}</h2>
					<div className="space-y-3">
						{list.map(t => (
							<div key={t.id} className={`rounded-2xl border bg-white p-4 ${t.opted_in ? 'border-mint-300' : 'border-ink-200'}`}>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
									<div className="min-w-0 flex-1">
										<div className="font-bold text-ink-900">{t.title}</div>
										<div className="text-xs text-ink-500">{t.summary}</div>
										{/* The price range is enough to decide; every option is one tap away. */}
										<details className="group mt-3">
											<summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-ink-700 [&::-webkit-details-marker]:hidden">
												You earn <strong className="tabular-nums text-ink-900">{payoutRange(t.variants)}</strong>
												<span className="text-ink-400">·</span>
												<span className="font-medium text-ink-900 underline-offset-4 group-hover:underline">{t.variants.length} option{t.variants.length === 1 ? '' : 's'}</span>
												<Icon name="chevronDown" size={14} className="text-ink-500 transition-transform duration-200 group-open:rotate-180" />
											</summary>
											<ul className="mt-2 divide-y divide-ink-100 rounded-xl bg-ink-50 px-3 text-sm">
												{t.variants.map(v => (
													<li key={v.id} className="flex items-center gap-3 py-2">
														<span className="min-w-0 flex-1 text-ink-700">{variantLabel(v)}</span>
														<span className="text-ink-500">{deliveryText(v.delivery_days)}</span>
														<strong className="w-16 text-right tabular-nums text-ink-900">{inr(v.freelancer_payout)}</strong>
													</li>
												))}
											</ul>
										</details>
										<div className="mt-2 text-[11px] text-ink-400">{t.revisions} revisions included · {t.freelancer_count} freelancer{t.freelancer_count === 1 ? '' : 's'} offer this</div>
									</div>
									<button
										className={`btn ${t.opted_in ? 'ghost' : 'primary'} whitespace-nowrap`}
										disabled={toggle.isPending}
										onClick={() => toggle.mutate({ id: t.id, optedIn: t.opted_in })}
									>
										{t.opted_in ? <><Icon name="check" size={14} /> Offering</> : <><Icon name="plus" size={14} /> Offer this</>}
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	)
}
