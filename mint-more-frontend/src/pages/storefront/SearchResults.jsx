import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { StoreCard } from '../../components/storefront/storefront'

export default function SearchResults() {
	const [params] = useSearchParams()
	const q = params.get('q') || ''
	const { data: results = [], isLoading } = useQuery({
		queryKey: ['service-search', q],
		queryFn: () => servicesApi.catalog({ q }).then(res => res.data.data),
	})

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">{q ? <>Results for “{q}”</> : 'All services'}</h1>
			<p className="mt-1 text-ink-500">{isLoading ? 'Searching…' : `${results.length} service${results.length === 1 ? '' : 's'}`}</p>
			{!isLoading && results.length === 0 ? (
				<div className="mt-10 rounded-2xl border border-dashed border-ink-300 p-12 text-center">
					<p className="text-lg text-ink-700">No services match that search.</p>
					<Link to="/services" className="mt-4 inline-flex rounded-full bg-black px-6 py-3 text-white">Browse categories</Link>
				</div>
			) : (
				<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{results.map(service => <StoreCard key={service.id} service={service} />)}
				</div>
			)}
		</div>
	)
}
