import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import { StoreRow } from '../../components/storefront/storefront'
import { referenceCover } from '../../components/storefront/referencePhotos'
import { inr, variantLabel } from '../../components/services/serviceUtils'
import AiEditsPanel from '../../components/services/AiEditsPanel'

const greeting = () => {
	const hour = new Date().getHours()
	return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const ago = (value) => {
	if (!value) return ''
	const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
	if (minutes < 60) return `${minutes} min ago`
	const hours = Math.round(minutes / 60)
	return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

/** Due date for work still underway. Late work is the one thing here that should stand out. */
const hoursUntil = (at) => Math.round((new Date(at).getTime() - Date.now()) / 3_600_000)

function Due({ at }) {
	if (!at) return <span className="text-ink-400">Starts on assignment</span>
	const hours = hoursUntil(at)
	const span = (h) => (Math.abs(h) < 24 ? `${Math.abs(h)}h` : `${Math.round(Math.abs(h) / 24)}d`)
	if (hours < 0) return <span className="font-medium text-rose-600">{span(hours)} late</span>
	if (hours < 24) return <span className="font-medium text-amber-700">Due in {span(Math.max(1, hours))}</span>
	return <span className="text-ink-600">Due in {span(hours)}</span>
}

const WORK_STATE = {
	finding_freelancer: { dot: 'bg-amber-500', text: 'Finding a freelancer' },
	in_progress: { dot: 'bg-sky-500', text: 'Being worked on' },
	revision_requested: { dot: 'bg-ink-500', text: 'Revision underway' },
}

function Thumb({ src }) {
	return (
		<div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-100 text-ink-400 md:h-14 md:w-20">
			{src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Icon name="layers" size={18} />}
		</div>
	)
}

const meta = (row) => [
	row.booking_number,
	variantLabel(row.snapshot || {}, row.snapshot?.option_group_label),
	row.freelancer_name,
].filter(Boolean).join(' · ')

function SectionHead({ title, count, to, label = 'View all' }) {
	return (
		<div className="mb-3 flex items-baseline gap-2.5">
			<h2 className="text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">{title}</h2>
			{count > 0 && <span className="text-lg tabular-nums text-ink-900 md:text-xl">{count}</span>}
			{to && (
				<Link to={to} className="ml-auto inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 underline-offset-4 hover:underline">
					{label} <Icon name="arrowRight" size={14} />
				</Link>
			)}
		</div>
	)
}

const rowCls = 'group flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors duration-150 hover:bg-ink-50/70 focus-visible:bg-ink-50/70 focus-visible:outline-none md:flex-nowrap md:px-5'

/** Deliveries waiting on the client. Each row says what arrived and offers the one next step. */
function ReviewQueue({ rows, coverFor }) {
	if (!rows.length) return null
	return (
		<section className="mt-10">
			<SectionHead title="Ready for your review" count={rows.length} to="/orders?tab=delivered" />
			<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
				{rows.slice(0, 5).map(row => {
					const approved = row.stage === 'approved'
					return (
						<li key={row.id}>
							<Link to={row.room_id ? `/chat?room=${row.room_id}` : `/chat?job=${row.job_id}`} className={rowCls}>
								<Thumb src={coverFor(row)} />
								<div className="min-w-0 flex-1 basis-[calc(100%-5rem)] md:basis-auto">
									<div className="truncate text-[17px] font-medium text-ink-900">{row.snapshot?.title}</div>
									<div className="truncate text-sm text-ink-500">{meta(row)}</div>
								</div>
								<div className="text-sm text-ink-600 md:w-56 md:shrink-0 md:text-right">
									{approved
										? 'Approved. Complete it to release payment.'
										: `Delivered ${ago(row.latest_delivery_at)}${Number(row.delivery_count) > 1 ? ` · version ${row.delivery_count}` : ''}`}
								</div>
								<span className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink-900 px-4 text-[15px] font-medium text-white transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.97] max-md:w-full max-md:justify-center">
									{approved ? 'Complete & rate' : 'Review delivery'}
								</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

/** Orders a freelancer is working on: who has it, what's happening, and when it's due. */
function WorkList({ rows, coverFor }) {
	if (!rows.length) return null
	return (
		<section className="mt-10">
			<SectionHead title="In progress" count={rows.length} to="/orders?tab=active" />
			<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
				{rows.slice(0, 6).map(row => {
					const state = WORK_STATE[row.stage] || WORK_STATE.in_progress
					return (
						<li key={row.id}>
							<Link to={row.room_id ? `/chat?room=${row.room_id}` : `/chat?job=${row.job_id}`} className={`${rowCls} !flex-nowrap`}>
								<Thumb src={coverFor(row)} />
								<div className="min-w-0 flex-1">
									<div className="truncate text-[17px] font-medium text-ink-900">{row.snapshot?.title}</div>
									<div className="truncate text-sm text-ink-500">{meta(row)}</div>
									{/* Phones: state and due date tuck under the title. */}
									<div className="mt-1 flex items-center gap-2 text-sm md:hidden">
										<span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
										<span className="truncate text-ink-700">{state.text}</span>
										<span className="text-ink-300">·</span>
										<span className="shrink-0"><Due at={row.due_at} /></span>
									</div>
								</div>
								<div className="hidden w-44 shrink-0 items-center gap-2 text-sm text-ink-700 md:flex">
									<span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
									{state.text}
								</div>
								<div className="hidden w-28 shrink-0 text-right text-sm tabular-nums md:block"><Due at={row.due_at} /></div>
								<Icon name="chevronRight" size={16} className="shrink-0 text-ink-300 transition-colors group-hover:text-ink-600" />
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

/** One past order per service still on sale, with a one-tap way back to it. */
function BookAgain({ rows, onSale }) {
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

// Folder tab sides, drawn in a 44×56 box: the curve eases flat into the panel's top edge.
const CURVED_SIDE = 'M0 0C13 0 18 7 21.5 24.5C25 42 30 56 44 56H0Z'
const TUCKED_SIDE = 'M0 0H44V56H0Z'

const CLIENT_HOME_AREAS = [
	{ id: 'ai', label: 'Edit with AI' },
	{ id: 'hire', label: 'Hire a creator' },
	{ id: 'pro', label: 'Creatyv Pro' },
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
	const [activeArea, setActiveArea] = useState('hire')
	const areaTabs = useRef([])
	const name = useAuthStore(s => s.user?.full_name || '')
	const { data: orders = [], isLoading } = useQuery({
		queryKey: ['service-bookings', 'client'],
		queryFn: () => servicesApi.bookings().then(res => res.data.data),
		refetchInterval: 30_000,
	})
	const { data: catalog = [] } = useQuery({
		queryKey: ['services-catalog'],
		queryFn: () => servicesApi.catalog().then(res => res.data.data),
		enabled: orders.length > 0,
		staleTime: 5 * 60_000,
	})
	const onSale = new Map(catalog.map(item => [item.slug, item]))
	const coverFor = (row) => {
		const slug = row.template_slug || row.snapshot?.slug
		return onSale.get(slug)?.cover_url || referenceCover(slug)
	}
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
			<div
				className="-mb-[2px] flex max-w-[960px] items-end px-4 sm:px-6 md:px-7"
				role="tablist"
				aria-label="Choose a Creatyv service"
			>
				{CLIENT_HOME_AREAS.map((area, index) => {
					const selected = activeArea === area.id
					// Folder tabs: the open one joins the panel, the rest step back in tone the further they sit.
					const activeIndex = CLIENT_HOME_AREAS.findIndex(a => a.id === activeArea)
					const tone = selected ? 'open' : Math.abs(index - activeIndex) === 1 ? 'near' : 'far'
					// Left over right like real folders. Closed tabs sit behind the panel (z 5), which covers
					// their bottoms with its own clean edge; the open one comes in front and joins it.
					const layer = i => (i === activeIndex ? 10 : CLIENT_HOME_AREAS.length - i)
					const coveredLeft = index > 0 && layer(index - 1) > layer(index)
					const coveredRight = index < CLIENT_HOME_AREAS.length - 1 && layer(index + 1) > layer(index)
					return (
						<button
							key={area.id}
							ref={element => { areaTabs.current[index] = element }}
							type="button"
							role="tab"
							id={`client-home-tab-${area.id}`}
							aria-selected={selected}
							aria-controls={`client-home-panel-${area.id}`}
							tabIndex={selected ? 0 : -1}
							onClick={() => setActiveArea(area.id)}
							onKeyDown={event => {
								const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
								const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + direction + 3) % 3
								if (direction || event.key === 'Home' || event.key === 'End') {
									event.preventDefault()
									const nextArea = ['ai', 'hire', 'pro'][nextIndex]
									setActiveArea(nextArea)
									areaTabs.current[nextIndex]?.focus()
								}
							}}
							style={{ zIndex: layer(index) }}
							className={`folder-tab folder-tab--${tone} group relative flex h-12 min-w-0 flex-1 focus-visible:outline-none sm:h-14 ${index > 0 ? '-ml-6 sm:-ml-9 md:-ml-11' : ''}`}
						>
							{/* Each side curves into the panel's top edge. A side tucked under a neighbour is drawn
							    straight, so the front tab's curve always lies over solid tab, never a gap. */}
							<svg className="folder-tab__ear h-full w-6 shrink-0 -scale-x-100 sm:w-9 md:w-11" viewBox="0 0 44 56" preserveAspectRatio="none" aria-hidden="true">
								<path d={coveredLeft ? TUCKED_SIDE : CURVED_SIDE} />
							</svg>
							<span className="folder-tab__body -mx-px min-w-0 flex-1" />
							<svg className="folder-tab__ear h-full w-6 shrink-0 sm:w-9 md:w-11" viewBox="0 0 44 56" preserveAspectRatio="none" aria-hidden="true">
								<path d={coveredRight ? TUCKED_SIDE : CURVED_SIDE} />
							</svg>
							{/* The label spans the body and the top of both curves, clear of any side a neighbour covers. */}
							<span className={`pointer-events-none absolute inset-y-0 flex items-center justify-center ${coveredLeft ? 'left-6 sm:left-9 md:left-11' : 'left-3 sm:left-5 md:left-6'} ${coveredRight ? 'right-6 sm:right-9 md:right-11' : 'right-3 sm:right-5 md:right-6'}`}>
								<span className={`truncate text-[13px] font-medium sm:text-[15px] ${selected ? 'text-ink-950' : 'text-ink-600 group-hover:text-ink-900'}`}>{area.label}</span>
							</span>
						</button>
					)
				})}
			</div>

			<div className="relative z-[5] overflow-hidden rounded-[20px] bg-white sm:rounded-[24px] md:rounded-[28px]">
				{/* The bright band the open tab grows out of; the work below sits on white. */}
				<div className="folder-hero flex flex-col gap-5 px-4 pb-8 pt-6 sm:flex-row sm:items-end sm:justify-between md:px-8 md:pb-10 md:pt-8">
					<div className="min-w-0">
						<h1 className="text-3xl font-medium tracking-tight text-ink-950 md:text-[44px]">
							{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}
						</h1>
						<p className="mt-2 max-w-xl text-balance text-lg text-ink-900">{summary}</p>
					</div>
					<Link to="/services" className="inline-flex h-12 shrink-0 items-center gap-1.5 self-start rounded-full bg-white px-6 text-base font-semibold text-ink-950 shadow-[0_1px_2px_rgb(120_40_0/0.12),0_10px_24px_-10px_rgb(120_40_0/0.45)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-orange-50 active:scale-[0.97] sm:self-auto">
						<Icon name="plus" size={16} /> New order
					</Link>
				</div>
				<div className="p-4 md:p-8">
					{CLIENT_HOME_AREAS.map(area => (
						<div
							key={area.id}
							id={`client-home-panel-${area.id}`}
							role="tabpanel"
							aria-labelledby={`client-home-tab-${area.id}`}
							tabIndex={activeArea === area.id ? 0 : -1}
							hidden={activeArea !== area.id}
							className="min-h-[40vh] focus-visible:outline-none"
						>
					{area.id === 'ai' && <AiEditsPanel />}
					{area.id === 'hire' && <>
					{firstRun ? (
						<GettingStarted categories={storefront?.categories || []} popular={popular} />
					) : (
						<>
							<ReviewQueue rows={needsReview} coverFor={coverFor} />
							<WorkList rows={active} coverFor={coverFor} />
							<BookAgain rows={completed} onSale={onSale} />

							{popular?.services?.length > 0 && (
								<StoreRow
									title="Popular right now"
									services={popular.services.slice(0, 8)}
									action={<Link to="/services" className="inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 hover:underline">See all services <Icon name="arrowRight" size={14} /></Link>}
								/>
							)}
						</>
					)}
							</>}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
