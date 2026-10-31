import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import OrderOffers from '../../components/services/OrderOffers'
import { StoreCard } from '../../components/storefront/storefront'
import OptInPrompt from '../../components/freelancer/OptInPrompt'
import { clientNextAction, dueText, formatDate, freelancerNextAction, inr, itemChatLink, itemStageText, STAGE_META, variantLabel } from '../../components/services/serviceUtils'

const CLIENT_TABS = [
	{ value: 'all', label: 'All' },
	{ value: 'active', label: 'Active' },
	{ value: 'delivered', label: 'Needs review' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'items', label: 'Purchased orders' },
]
const FREELANCER_TABS = [
	{ value: 'active', label: 'In progress' },
	{ value: 'delivered', label: 'Delivered' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'all', label: 'All' },
]

/** Order list for clients (/orders) and freelancers (/work). */
const hoursLeft = (at) => (at ? (new Date(at).getTime() - Date.now()) / 3_600_000 : null)
const span = (h) => (Math.abs(h) < 24 ? `${Math.max(1, Math.round(Math.abs(h)))}h` : `${Math.round(Math.abs(h) / 24)}d`)
const OPEN_STAGES = ['in_progress', 'revision_requested']

/** Due date, coloured only when it needs attention: late is rose, under a day is amber. */
function WorkDue({ row }) {
	if (row.stage === 'completed') return <span className="text-ink-500">Paid {formatDate(row.completed_at)}</span>
	if (!OPEN_STAGES.includes(row.stage)) return <span className="text-ink-500">{freelancerNextAction(row.stage)}</span>
	const h = hoursLeft(row.due_at)
	if (h === null) return <span className="text-ink-500">No due date</span>
	if (h < 0) return <span className="font-medium text-rose-600">{span(h)} overdue</span>
	if (h < 24) return <span className="font-medium text-amber-700">Due in {span(h)}</span>
	return <span className="text-ink-600">Due in {span(h)}</span>
}

/** One assigned order. The only strong signals are lateness and a revision request. */
function WorkRow({ row, showStage }) {
	const open = OPEN_STAGES.includes(row.stage)
	const late = open && hoursLeft(row.due_at) < 0
	return (
		<li>
			<Link
				to={row.room_id ? `/chat?room=${row.room_id}` : `/work/${row.id}`}
				className="group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-ink-50/70 focus-visible:bg-ink-50/70 focus-visible:outline-none md:gap-6 md:px-5"
			>
				<span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${late ? 'bg-rose-500' : row.stage === 'revision_requested' ? 'bg-violet-500' : open ? 'bg-sky-500' : 'bg-ink-300'}`} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-[17px] font-medium text-ink-900">{row.snapshot?.title}</span>
						{(showStage || row.stage === 'revision_requested') && <StageBadge stage={row.stage} />}
					</div>
					<div className="mt-0.5 truncate text-sm text-ink-500">
						{[row.booking_number, `${variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)}${Number(row.quantity) > 1 ? ` × ${row.quantity}` : ''}`, row.client_name].filter(Boolean).join(' · ')}
					</div>
					<div className="mt-1 text-sm md:hidden"><WorkDue row={row} /> <span className="text-ink-300">·</span> <span className="tabular-nums text-ink-700">{inr(row.freelancer_payout)}</span></div>
				</div>
				<div className="hidden w-40 shrink-0 text-right text-sm tabular-nums md:block"><WorkDue row={row} /></div>
				<div className="hidden w-20 shrink-0 text-right text-[15px] tabular-nums text-ink-700 md:block">{inr(row.freelancer_payout)}</div>
				<span className="hidden w-36 shrink-0 items-center justify-end gap-1 text-sm font-medium text-ink-900 lg:inline-flex">
					{open ? <>{freelancerNextAction(row.stage)} <Icon name="arrowRight" size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" /></> : null}
				</span>
				<Icon name="chevronRight" size={16} className="shrink-0 text-ink-300 transition-colors group-hover:text-ink-600 lg:hidden" />
			</Link>
		</li>
	)
}

// The client must act on these; everything else is waiting on someone else.
const CLIENT_ACTS = ['delivered', 'approved']

/** One client order as a row: what it is, where it stands, when it's due, what it cost. */
function ClientRow({ row }) {
	const meta = STAGE_META[row.stage] || { label: row.stage, tone: '' }
	const statusTone = (meta.tone.match(/text-[a-z]+-\d+/) || ['text-ink-700'])[0]
	const acts = CLIENT_ACTS.includes(row.stage)
	const when = row.stage === 'completed' ? `Completed ${formatDate(row.completed_at)}` : dueText(row.due_at)
	return (
		<li>
			<Link
				to={row.room_id ? `/chat?room=${row.room_id}` : `/chat?job=${row.job_id}`}
				className="group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-ink-50/70 focus-visible:bg-ink-50/70 focus-visible:outline-none md:gap-6 md:px-5"
			>
				<div className="min-w-0 flex-1">
					<span className="block truncate text-[17px] font-medium text-ink-900">{row.snapshot?.title}</span>
					<div className="mt-0.5 truncate text-sm text-ink-500">
						{[row.booking_number, `${variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)}${Number(row.quantity) > 1 ? ` × ${row.quantity}` : ''}`, row.freelancer_name].filter(Boolean).join(' · ')}
					</div>
					<div className="mt-1 text-sm md:hidden">
						<span className={`font-medium ${statusTone}`}>{meta.label}</span> <span className="text-ink-300">·</span> <span className="tabular-nums text-ink-700">{inr(row.subtotal)}</span>
					</div>
				</div>
				<div className="hidden w-60 shrink-0 md:block">
					<div className={`text-[15px] font-medium ${statusTone}`}>{meta.label}</div>
					<div className="mt-0.5 text-sm text-ink-500">{when}</div>
				</div>
				<div className="hidden w-20 shrink-0 text-right text-[15px] font-medium tabular-nums text-ink-900 md:block">{inr(row.subtotal)}</div>
				{acts && (
					<span className="hidden w-36 shrink-0 items-center justify-end gap-1 text-sm font-medium text-ink-900 lg:inline-flex">
						{clientNextAction(row.stage)} <Icon name="arrowRight" size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
					</span>
				)}
				<Icon name="chevronRight" size={16} className={`shrink-0 text-ink-300 transition-colors group-hover:text-ink-600 ${acts ? 'lg:hidden' : ''}`} />
			</Link>
		</li>
	)
}

/** One multi-item purchase in the Purchased items tab: each item and what to do next with it. */
function PurchaseGroup({ group }) {
	const snapshot = group.snapshot || {}
	const open = group.items.filter(item => item.stage === 'needs_brief').length
	return (
		<section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
			<Link to={`/purchases/${group.id}`} className="group flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-ink-50/70 md:px-5">
				<div className="min-w-0">
					<h2 className="truncate text-[17px] font-medium text-ink-900">{snapshot.title || group.template_title}</h2>
					<p className="mt-0.5 text-sm text-ink-500">{group.item_count} orders · {variantLabel(snapshot, snapshot.option_group_label)}{Number(snapshot.pack_size) > 1 && group.item_count > Number(snapshot.pack_size) ? ` × ${group.item_count / Number(snapshot.pack_size)}` : ''} · paid {formatDate(group.paid_at)}</p>
				</div>
				<span className={`inline-flex shrink-0 items-center gap-1 text-sm font-medium ${open ? 'text-amber-700' : 'text-ink-600'}`}>
					{open ? `${open} need${open === 1 ? 's' : ''} a brief` : 'All briefed'} <Icon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
				</span>
			</Link>
			<ul className="divide-y divide-ink-100 border-t border-ink-100">
				{group.items.map(item => (
					<li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-[15px] md:px-5">
						<span className="w-20 shrink-0 font-medium text-ink-900">Order {item.item_index}</span>
						<span className={`min-w-0 flex-1 truncate ${item.stage === 'needs_brief' && !item.has_draft ? 'text-ink-500' : 'text-ink-700'}`}>{itemStageText(item)}</span>
						{item.stage === 'needs_brief' ? (
							<Link to={`/purchases/${group.id}?item=${item.id}`} className="shrink-0 text-sm font-medium text-ink-900 underline-offset-4 hover:underline">{item.has_draft ? 'Continue brief' : 'Write brief'}</Link>
						) : item.job_id && item.stage !== 'matching' && item.stage !== 'refunded' ? (
							<Link to={itemChatLink(item)} className="shrink-0 text-sm font-medium text-ink-900 underline-offset-4 hover:underline">Open chat</Link>
						) : null}
					</li>
				))}
			</ul>
		</section>
	)
}

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

	const { data: purchases = [], isLoading: purchasesLoading, isError: purchasesError, refetch: refetchPurchases } = useQuery({
		queryKey: ['service-purchases'],
		queryFn: () => servicesApi.purchases().then(res => res.data.data),
		enabled: isClient,
	})
	const purchasedCount = purchases.reduce((sum, group) => sum + group.items.length, 0)

	const groups = {
		active: ['finding_freelancer', 'in_progress', 'revision_requested'],
		delivered: ['delivered', 'approved'],
		completed: ['completed'],
	}
	const filtered = tab === 'all' ? rows : rows.filter(row => groups[tab]?.includes(row.stage))
	// Freelancers see the most urgent work first: earliest due date on top.
	const visible = isClient ? filtered : [...filtered].sort((a, b) => {
		const ao = OPEN_STAGES.includes(a.stage), bo = OPEN_STAGES.includes(b.stage)
		if (ao !== bo) return ao ? -1 : 1
		return new Date(a.due_at || 8.64e15) - new Date(b.due_at || 8.64e15)
	})
	const overdue = isClient ? 0 : rows.filter(row => OPEN_STAGES.includes(row.stage) && hoursLeft(row.due_at) < 0).length
	const dueToday = isClient ? 0 : rows.filter(row => OPEN_STAGES.includes(row.stage) && hoursLeft(row.due_at) >= 0 && hoursLeft(row.due_at) < 24).length
	const tabs = (isClient ? CLIENT_TABS : FREELANCER_TABS).map(item => ({
		...item,
		count: item.value === 'all' ? rows.length : item.value === 'items' ? purchasedCount : rows.filter(row => groups[item.value]?.includes(row.stage)).length,
	})).filter(item => item.value !== 'items' || purchasedCount > 0 || tab === 'items')

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
					<h1 className="text-3xl font-medium leading-tight tracking-tight text-ink-900 md:text-[40px]">{isClient ? 'My orders' : 'My work'}</h1>
					{isClient || (!overdue && !dueToday) ? (
						<p className="mt-1 text-ink-600">
							{isClient ? 'Track progress, review deliveries and approve work.' : 'Everything assigned to you, by stage.'}
						</p>
					) : (
						<p className="mt-1.5 text-[17px] text-ink-700">
							{overdue > 0 && <span className="font-medium text-rose-600">{overdue} overdue</span>}
							{overdue > 0 && dueToday > 0 && <span className="text-ink-300"> · </span>}
							{dueToday > 0 && <span className="font-medium text-amber-700">{dueToday} due today</span>}
						</p>
					)}
				</div>
				{isClient && (
					<Link to="/services" className="landing-cta shrink-0 gap-1.5 !min-h-11 !px-5 !text-[15px]">
						<Icon name="plus" size={16} /> New order
					</Link>
				)}
			</div>

			{!isClient && <OrderOffers className="mt-8" />}

			{location.state?.placed > 1 && (
				<div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
					{location.state.placed} orders placed. Each one gets its own freelancer and chat.
				</div>
			)}

			{!isClient && <OptInPrompt showProfile={false} className="mt-6" />}

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

			{tab === 'items' ? (
				<div className="mt-5 space-y-4">
					{purchasesLoading ? (
						<div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
					) : purchasesError ? (
						<div className="rounded-2xl border border-ink-200 bg-white p-8 text-center text-ink-600">
							Couldn't load purchased orders. <button className="ml-2 font-medium text-ink-900 underline underline-offset-4" onClick={() => refetchPurchases()}>Retry</button>
						</div>
					) : purchases.length === 0 ? (
						<div className="py-10 text-center">
							<h2 className="text-xl font-medium text-ink-900">No purchased orders</h2>
							<p className="mt-1 text-ink-600">When you buy more than one of a service, each order waits here for its brief.</p>
						</div>
					) : purchases.map(group => <PurchaseGroup key={group.id} group={group} />)}
				</div>
			) : (
			<div className="mt-5 space-y-3">
				{isLoading ? (
					Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-100" />)
				) : isError ? (
					<div className="rounded-2xl border border-ink-200 bg-white p-8 text-center text-ink-600">
						Couldn't load orders. <button className="ml-2 font-medium text-ink-900 underline underline-offset-4" onClick={() => refetch()}>Retry</button>
					</div>
				) : visible.length === 0 ? (
					<div className="rounded-2xl bg-ink-50 px-6 py-8 md:px-8">
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
				) : !isClient ? (
					<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
						{visible.map(row => <WorkRow key={row.id} row={row} showStage={tab === 'all'} />)}
					</ul>
				) : (
					<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
						{visible.map(row => <ClientRow key={row.id} row={row} />)}
					</ul>
				)}
			</div>
			)}

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
