// LAUNCH-HIDDEN: first catalogue grid, replaced by pages/storefront/*. Not routed; kept for reference.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import ServiceCard from '../../components/services/ServiceCard'
import Icon from '../../components/ui/Icon'

export default function Services() {
	const [params, setParams] = useSearchParams()
	const category = params.get('category') || ''
	const [search, setSearch] = useState(params.get('q') || '')
	const q = params.get('q') || ''

	const { data: categories = [] } = useQuery({
		queryKey: ['service-categories'],
		queryFn: () => servicesApi.categories().then(res => res.data.data),
		staleTime: 5 * 60_000,
	})
	const { data: services = [], isLoading, isError, refetch } = useQuery({
		queryKey: ['service-catalog', category, q],
		queryFn: () => servicesApi.catalog({ category: category || undefined, q: q || undefined }).then(res => res.data.data),
	})

	const setFilter = (next) => {
		const merged = { category, q, ...next }
		setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value)))
	}

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
			<div className="mb-6">
				<div className="text-[11px] font-bold uppercase tracking-wider text-mint-500">Fixed price · Pay once · Delivered by vetted freelancers</div>
				<h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">Book creative work in minutes</h1>
				<p className="mt-2 max-w-2xl text-sm text-ink-600">Pick a service, choose your option, and pay. A freelancer is assigned automatically and a chat opens so you can share your files.</p>
			</div>

			<form
				className="relative mb-4 max-w-xl"
				onSubmit={e => { e.preventDefault(); setFilter({ q: search.trim() }) }}
			>
				<Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
				<input
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder="Search reels, thumbnails, logos…"
					className="w-full rounded-full border border-ink-200 bg-white py-3 pl-11 pr-24 text-sm focus:border-mint-400 focus:outline-none"
				/>
				<button type="submit" className="btn primary sm absolute right-1.5 top-1/2 -translate-y-1/2">Search</button>
			</form>

			<div className="mb-6 flex gap-2 overflow-x-auto pb-1">
				<button
					onClick={() => setFilter({ category: '' })}
					className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${!category ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'}`}
				>
					All services
				</button>
				{categories.map(item => (
					<button
						key={item.slug}
						onClick={() => setFilter({ category: item.slug })}
						className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${category === item.slug ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'}`}
					>
						{item.name} <span className="ml-1 text-xs opacity-60">{item.service_count}</span>
					</button>
				))}
			</div>

			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-ink-100" />)}
				</div>
			) : isError ? (
				<div className="rounded-2xl border border-ink-200 bg-white p-10 text-center">
					<p className="text-sm text-ink-600">We couldn't load services.</p>
					<button className="btn ghost mt-3" onClick={() => refetch()}>Try again</button>
				</div>
			) : services.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center">
					<h3 className="font-bold text-ink-900">No services match{q ? ` “${q}”` : ''}</h3>
					<button className="btn ghost mt-3" onClick={() => { setSearch(''); setParams({}) }}>Clear filters</button>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{services.map(service => <ServiceCard key={service.id} service={service} />)}
				</div>
			)}
		</div>
	)
}
