import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import { StoreCard } from '../../components/storefront/storefront'
import { CATEGORY_STYLE } from '../../components/storefront/storefrontUtils'

/** Category page: one heading per sub-section, each with its service cards. */
export default function CategoryPage() {
	const { slug } = useParams()
	const { data, isLoading, isError } = useQuery({
		queryKey: ['category-page', slug],
		queryFn: () => servicesApi.categoryPage(slug).then(res => res.data.data),
	})
	const style = CATEGORY_STYLE[slug] || {}

	if (isError) {
		return (
			<div className="mx-auto max-w-xl px-4 py-20 text-center font-store">
				<h1 className="text-2xl font-medium">Category not found</h1>
				<Link to="/services" className="mt-4 inline-flex rounded-full bg-black px-6 py-3 text-white">Back to services</Link>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<Link to="/services" className="inline-flex items-center gap-2 text-lg text-ink-700 hover:text-ink-900">
				<Icon name="arrowLeft" size={18} /> All categories
			</Link>
			<div className={`mt-4 rounded-2xl ${style.tile || 'bg-ink-100'} px-7 py-8 md:px-10`}>
				<h1 className="text-4xl font-medium tracking-tight text-ink-900 md:text-5xl">{data?.name || ' '}</h1>
				{data?.description && <p className="mt-2 max-w-2xl text-lg text-ink-700">{data.description}</p>}
				{data?.sections.length > 1 && (
					<div className="mt-6 flex flex-wrap gap-2">
						{data.sections.map(section => (
							<a key={section.slug} href={`#${section.slug}`} className="rounded-full bg-white/80 px-4 py-2 text-[15px] text-ink-900 hover:bg-white">
								{section.name}
							</a>
						))}
					</div>
				)}
			</div>

			{isLoading ? (
				<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-ink-100" />)}
				</div>
			) : data?.sections.length === 0 ? (
				<div className="mt-12 rounded-2xl border border-dashed border-ink-300 p-12 text-center">
					<h2 className="text-2xl font-medium text-ink-900">Coming soon</h2>
					<p className="mt-2 text-ink-600">We're onboarding freelancers for this category. Check back shortly.</p>
				</div>
			) : data.sections.map(section => (
				<section key={section.slug} id={section.slug} className="mt-14 scroll-mt-24">
					<h2 className="mb-6 text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">{section.name}</h2>
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{section.services.map(service => <StoreCard key={service.id} service={service} />)}
					</div>
				</section>
			))}
		</div>
	)
}
