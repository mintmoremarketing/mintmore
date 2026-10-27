import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import { StoreRow } from '../../components/storefront/storefront'
import { referenceCover } from '../../components/storefront/referencePhotos'
import { clientNextAction, dueText, formatDate, inr, variantLabel } from '../../components/services/serviceUtils'

// Four plain steps for the progress bar; every booking stage maps onto one of them.
const STEPS = ['Booked', 'In progress', 'Delivered', 'Done']
const STEP_OF = { finding_freelancer: 0, in_progress: 1, revision_requested: 1, delivered: 2, approved: 2, completed: 3 }

const greeting = () => {
	const hour = new Date().getHours()
	return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

function OrderCard({ row }) {
	const step = STEP_OF[row.stage] ?? 0
	return (
		<Link
			to={`/orders/${row.id}`}
			className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-4 transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-ink-300 active:scale-[0.99] md:p-5"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs tabular-nums text-ink-500">{row.booking_number}</span>
				<StageBadge stage={row.stage} />
			</div>
			<div className="mt-2 line-clamp-1 text-[17px] font-medium text-ink-900">{row.snapshot?.title}</div>
			<div className="mt-0.5 truncate text-sm text-ink-500">
				{variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)}{row.freelancer_name ? ` · ${row.freelancer_name}` : ''}
			</div>

			<div className="mt-4" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
				<div className="grid grid-cols-4 gap-1">
					{STEPS.map((label, i) => (
						<span key={label} className={`h-1.5 rounded-full ${i <= step ? 'bg-ink-900' : 'bg-ink-100'}`} />
					))}
				</div>
				<div className="mt-1.5 flex justify-between text-xs text-ink-500">
					<span className="font-medium text-ink-900">{STEPS[step]}</span>
					<span>{row.stage === 'completed' ? `Completed ${formatDate(row.completed_at)}` : dueText(row.due_at)}</span>
				</div>
			</div>

			<span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-mint-600">
				{clientNextAction(row.stage)} <Icon name="arrowRight" size={14} />
			</span>
		</Link>
	)
}

function SectionHead({ title, to, label = 'View all' }) {
	return (
		<div className="mb-4 flex items-end justify-between gap-3">
			<h2 className="text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">{title}</h2>
			{to && (
				<Link to={to} className="inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 hover:underline">
					{label} <Icon name="arrowRight" size={14} />
				</Link>
			)}
		</div>
	)
}

function OrderSection({ title, rows, to }) {
	if (!rows.length) return null
	return (
		<section className="mt-10">
			<SectionHead title={title} to={to} />
			<div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
				{rows.slice(0, 3).map(row => (
					<div key={row.id} className="w-[85%] shrink-0 snap-start md:w-auto"><OrderCard row={row} /></div>
				))}
			</div>
		</section>
	)
}

/** One past order per service still on sale, with a one-tap way back to it. */
function BookAgain({ rows }) {
	const { data: catalog = [] } = useQuery({
		queryKey: ['services-catalog'],
		queryFn: () => servicesApi.catalog().then(res => res.data.data),
		enabled: rows.length > 0,
		staleTime: 5 * 60_000,
	})
	const onSale = new Map(catalog.map(item => [item.slug, item]))
	const seen = new Set()
	const unique = rows.filter(row => {
		const slug = row.template_slug || row.snapshot?.slug
		if (!slug || seen.has(slug) || !onSale.has(slug)) return false
		seen.add(slug)
		return true
	}).slice(0, 4)
	if (!unique.length) return null
	return (
		<section className="mt-12">
			<SectionHead title="Book again" />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{unique.map(row => {
					const slug = row.template_slug || row.snapshot?.slug
					const cover = onSale.get(slug)?.cover_url || referenceCover(slug)
					return (
						<Link
							key={row.id}
							to={`/services/${slug}`}
							className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-ink-300 active:scale-[0.99]"
						>
							<div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-100 text-ink-500">
								{cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Icon name="refresh" size={18} />}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium text-ink-900">{row.snapshot?.title}</div>
								<div className="text-sm text-ink-500">
									{row.freelancer_name ? `with ${row.freelancer_name}` : `Last paid ${inr(row.subtotal)}`}
								</div>
							</div>
							<Icon name="arrowRight" size={16} className="shrink-0 text-ink-500" />
						</Link>
					)
				})}
			</div>
		</section>
	)
}

const HOW_IT_WORKS = [
	{ title: 'Pick a service', body: 'Fixed price, fixed scope. Choose the length and pack you need.' },
	{ title: 'A freelancer starts', body: 'A vetted freelancer is assigned right away and a chat opens.' },
	{ title: 'Approve, then pay out', body: 'Ask for revisions, approve the work, and payment is released.' },
]

/** First-run screen: no orders yet. Keeps the title, then shows how it works and where to start. */
function GettingStarted({ categories = [], popular }) {
	return (
		<>
			<section className="mt-8">
				<h2 className="mb-4 text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">How it works</h2>
				<ol className="grid gap-3 sm:grid-cols-3">
					{HOW_IT_WORKS.map((step, i) => (
						<li key={step.title} className="rounded-2xl border border-ink-200 bg-white p-5">
							<span className="text-sm font-medium tabular-nums text-ink-400">Step {i + 1}</span>
							<div className="mt-2 text-[17px] font-medium text-ink-900">{step.title}</div>
							<p className="mt-1 text-[15px] text-ink-600">{step.body}</p>
						</li>
					))}
				</ol>
			</section>

			{categories.length > 0 && (
				<section className="mt-10">
					<SectionHead title="Browse by category" to="/services" label="All services" />
					<div className="flex flex-wrap gap-2">
						{categories.map(category => (
							<Link
								key={category.id}
								to={`/categories/${category.slug}`}
								className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-[15px] text-ink-900 transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-ink-300 active:scale-[0.98]"
							>
								{category.name}
								{Number(category.service_count) > 0 && <span className="tabular-nums text-ink-500">{category.service_count}</span>}
							</Link>
						))}
					</div>
				</section>
			)}

			{popular?.services?.length > 0 && (
				<StoreRow
					title="Popular right now"
					services={popular.services.slice(0, 8)}
					action={<Link to="/services" className="inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 hover:underline">See all services <Icon name="arrowRight" size={14} /></Link>}
				/>
			)}
		</>
	)
}

/** Client home: what is happening with your orders. The full catalogue lives on /services. */
export default function ClientHome() {
	const name = useAuthStore(s => s.user?.full_name || '')
	const { data: orders = [], isLoading } = useQuery({
		queryKey: ['service-bookings', 'client'],
		queryFn: () => servicesApi.bookings().then(res => res.data.data),
		refetchInterval: 30_000,
	})
	const { data: storefront } = useQuery({
		queryKey: ['storefront'],
		queryFn: () => servicesApi.storefront().then(res => res.data.data),
	})

	const needsReview = orders.filter(o => ['delivered', 'approved'].includes(o.stage))
	const active = orders.filter(o => ['finding_freelancer', 'in_progress', 'revision_requested'].includes(o.stage))
	const completed = orders.filter(o => o.stage === 'completed')
	const popular = storefront?.rows?.[0]
	const firstRun = !isLoading && orders.length === 0

	const summary = isLoading
		? ' '
		: firstRun
			? 'Book your first service. It takes about a minute, and a freelancer starts right away.'
			: [
				needsReview.length ? `${needsReview.length} ${needsReview.length === 1 ? 'delivery is' : 'deliveries are'} waiting for your review` : '',
				active.length ? `${active.length} ${active.length === 1 ? 'order is' : 'orders are'} in progress` : '',
			].filter(Boolean).join(' and ') + (needsReview.length || active.length ? '.' : ' Everything is wrapped up — ready for the next one?')

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[44px]">
						{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}
					</h1>
					<p className="mt-2 max-w-xl text-lg text-ink-600">{summary}</p>
				</div>
				<Link to="/services" className="landing-cta shrink-0 gap-1.5 self-start !min-h-12 !px-6 !text-base sm:self-auto">
					<Icon name="plus" size={16} /> New order
				</Link>
			</div>

			{firstRun ? (
				<GettingStarted categories={storefront?.categories || []} popular={popular} />
			) : (
				<>
					<OrderSection title="Ready for your review" rows={needsReview} to="/orders?tab=delivered" />
					<OrderSection title="In progress" rows={active} to="/orders?tab=active" />
					<BookAgain rows={completed} />

					{popular?.services?.length > 0 && (
						<StoreRow
							title="Popular right now"
							services={popular.services.slice(0, 8)}
							action={<Link to="/services" className="inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 hover:underline">See all services <Icon name="arrowRight" size={14} /></Link>}
						/>
					)}
				</>
			)}
		</div>
	)
}
