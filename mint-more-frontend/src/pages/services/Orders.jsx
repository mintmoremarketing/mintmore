import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import { StoreCard } from '../../components/storefront/storefront'
import { clientNextAction, dueText, formatDate, freelancerNextAction, inr, variantLabel } from '../../components/services/serviceUtils'

const CLIENT_TABS = [
	{ value: 'all', label: 'All' },
	{ value: 'active', label: 'Active' },
	{ value: 'delivered', label: 'Needs review' },
	{ value: 'completed', label: 'Completed' },
]
const FREELANCER_TABS = [
	{ value: 'active', label: 'In progress' },
	{ value: 'delivered', label: 'Delivered' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'all', label: 'All' },
]

/** Order list for clients (/orders) and freelancers (/work). */
export default function Orders({ audience = 'client' }) {
	const isClient = audience === 'client'
	const location = useLocation()
	const [params, setParams] = useSearchParams()
	const tab = params.get('tab') || (isClient ? 'all' : 'active')

	const { data: rows = [], isLoading, isError, refetch } = useQuery({
		queryKey: ['service-bookings', audience],
		queryFn: () => (isClient ? servicesApi.bookings() : servicesApi.work()).then(res => res.data.data),
		refetchInterval: 30_000,
	})

	const groups = {
		active: ['finding_freelancer', 'in_progress', 'revision_requested'],
		delivered: ['delivered', 'approved'],
		completed: ['completed'],
	}
	const visible = tab === 'all' ? rows : rows.filter(row => groups[tab]?.includes(row.stage))
	const tabs = (isClient ? CLIENT_TABS : FREELANCER_TABS).map(item => ({
		...item,
		count: item.value === 'all' ? rows.length : rows.filter(row => groups[item.value]?.includes(row.stage)).length,
	}))
	const base = isClient ? '/orders' : '/work'

	// Empty account: suggest a few services instead of a bare box (same query/cache as the storefront).
	const showSuggestions = isClient && !isLoading && !isError && rows.length === 0
	const { data: storefront } = useQuery({
		queryKey: ['storefront'],
		queryFn: () => servicesApi.storefront().then(res => res.data.data),
		enabled: showSuggestions,
	})
	const suggestions = (storefront?.rows?.[0]?.services || []).slice(0, 4)

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<div className="flex items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">{isClient ? 'My orders' : 'My work'}</h1>
					<p className="mt-1 text-ink-600">
						{isClient ? 'Track progress, review deliveries and approve work.' : 'Everything assigned to you, by stage.'}
					</p>
				</div>
				{isClient && (
					<Link to="/services" className="landing-cta shrink-0 gap-1.5 !min-h-11 !px-5 !text-[15px]">
						<Icon name="plus" size={16} /> New order
					</Link>
				)}
			</div>

			{location.state?.placed > 1 && (
				<div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
					{location.state.placed} orders placed. Each one gets its own freelancer and chat.
				</div>
			)}

			<div role="tablist" aria-label="Filter orders" className="mt-6 flex gap-6 overflow-x-auto border-b border-ink-200 [scrollbar-width:none]">
				{tabs.map(item => {
					const active = item.value === tab
					return (
						<button
							key={item.value}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => setParams({ tab: item.value })}
							className={`relative shrink-0 whitespace-nowrap pb-3 pt-1 text-[15px] transition-colors duration-150 ${active ? 'font-medium text-ink-900' : 'text-ink-500 hover:text-ink-900'}`}
						>
							{item.label}
							{item.count > 0 && <span className="ml-1.5 tabular-nums text-ink-500">{item.count}</span>}
							<span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-0.5 origin-left rounded-full bg-ink-900 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${active ? 'scale-x-100' : 'scale-x-0'}`} />
						</button>
					)
				})}
			</div>

			<div className="mt-5 space-y-3">
				{isLoading ? (
					Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-100" />)
				) : isError ? (
					<div className="rounded-2xl border border-ink-200 bg-white p-8 text-center text-ink-600">
						Couldn't load orders. <button className="ml-2 font-medium text-ink-900 underline underline-offset-4" onClick={() => refetch()}>Retry</button>
					</div>
				) : visible.length === 0 ? (
					<div className="py-10 text-center">
						<h2 className="text-xl font-medium text-ink-900">{rows.length === 0 ? (isClient ? 'No orders yet' : 'No work assigned yet') : 'Nothing here right now'}</h2>
						<p className="mt-1 text-ink-600">
							{rows.length === 0
								? (isClient ? 'Book a fixed-price service and it will show up here.' : 'Opt into services so orders can be assigned to you.')
								: 'Orders in this stage will appear here.'}
						</p>
						{rows.length === 0 && !isClient && (
							<Link to="/my-services" className="landing-cta mt-5 !min-h-11 !px-5 !text-[15px]">Choose services</Link>
						)}
					</div>
				) : visible.map(row => (
					<Link
						key={row.id}
						to={`${base}/${row.id}`}
						className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-4 transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-ink-300 active:scale-[0.99] sm:flex-row sm:items-center sm:p-5"
					>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs tabular-nums text-ink-500">{row.booking_number}</span>
								<StageBadge stage={row.stage} />
							</div>
							<div className="mt-1.5 truncate text-[17px] font-medium text-ink-900">{row.snapshot?.title}</div>
							<div className="mt-0.5 text-sm text-ink-500">
								{variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)}
								{Number(row.quantity) > 1 ? ` × ${row.quantity}` : ''}
								{isClient
									? (row.freelancer_name ? ` · ${row.freelancer_name}` : '')
									: (row.client_name ? ` · ${row.client_name}` : '')}
							</div>
						</div>
						<div className="flex items-center gap-4 border-t border-ink-100 pt-3 sm:border-0 sm:pt-0 sm:text-right">
							<div className="text-sm text-ink-500">
								{row.stage === 'completed' ? `Completed ${formatDate(row.completed_at)}` : dueText(row.due_at)}
							</div>
							<div className="text-[17px] font-semibold tabular-nums text-ink-900">{inr(isClient ? row.subtotal : row.freelancer_payout)}</div>
							<span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-mint-600 sm:ml-0">
								{isClient ? clientNextAction(row.stage) : freelancerNextAction(row.stage)} <Icon name="arrowRight" size={14} />
							</span>
						</div>
					</Link>
				))}
			</div>

			{showSuggestions && suggestions.length > 0 && (
				<section className="mt-6">
					<h2 className="mb-5 text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">Popular to start with</h2>
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{suggestions.map(service => <StoreCard key={service.id} service={service} />)}
					</div>
				</section>
			)}
		</div>
	)
}
