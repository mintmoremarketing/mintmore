import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'
import { StoreSearch } from '../layout/PublicOrShell'
import { inr } from '../services/serviceUtils'

const WORDS = ['scroll-stopping reel', 'thumbnail that gets clicks', 'script that hooks', 'logo that sticks', 'UGC ad that sells']
const WORD_MS = 2600

/** Signed-in storefront header: a rolling "what do you need" line, search, quick picks and live order status. */
export default function ShopperHero({ services = [], showOrderStatus = true }) {
	const name = useAuthStore(s => s.user?.full_name || s.user?.name || '')
	const isClient = useAuthStore(s => s.user?.role === 'client')
	const [wordIndex, setWordIndex] = useState(0)

	useEffect(() => {
		const id = setInterval(() => setWordIndex(i => (i + 1) % WORDS.length), WORD_MS)
		return () => clearInterval(id)
	}, [])

	const { data: orders = [] } = useQuery({
		queryKey: ['service-bookings', 'client'],
		queryFn: () => servicesApi.bookings().then(res => res.data.data),
		enabled: isClient && showOrderStatus,
	})
	const inProgress = orders.filter(o => ['finding_freelancer', 'in_progress', 'revision_requested'].includes(o.stage)).length
	const toReview = orders.filter(o => o.stage === 'delivered').length

	const word = WORDS[wordIndex]
	const picks = services.slice(0, 6)

	return (
		<section className="overflow-hidden rounded-2xl bg-ink-900 px-5 py-8 text-white md:px-10 md:py-12">
			<p className="text-white/70">{name ? `Hi ${name.split(' ')[0]},` : 'Hi,'} what are we making today?</p>
			<h1 className="mt-2 text-[34px] font-medium leading-[1.08] tracking-tight md:text-[56px]">
				I need a{' '}
				<span className="block min-h-[2.16em] text-[#ffb21a] sm:min-h-[1.08em]" aria-live="polite">
					<span key={word} className="shopper-word" aria-label={word}>
						{word.split('').map((char, i) => (
							<span key={i} aria-hidden="true" style={{ animationDelay: `${i * 18}ms` }}>{char === ' ' ? ' ' : char}</span>
						))}
					</span>
				</span>
			</h1>

			<StoreSearch className="mt-6 max-w-2xl [&_input]:text-ink-900" />

			{picks.length > 0 && (
				<div className="mt-6">
					<div className="text-sm text-white/60">Quick picks</div>
					<div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
						{picks.map(service => (
							<Link
								key={service.id}
								to={`/services/${service.slug}`}
								className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[15px] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white/20 active:scale-[0.97]"
							>
								{service.title}
								<span className="tabular-nums text-white/60">{inr(service.price)}</span>
							</Link>
						))}
					</div>
				</div>
			)}

			{showOrderStatus && (inProgress > 0 || toReview > 0) && (
				<Link
					to={toReview > 0 ? '/orders?tab=delivered' : '/orders?tab=active'}
					className="mt-6 flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-ink-900 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] md:inline-flex"
				>
					<Icon name={toReview > 0 ? 'checkCircle' : 'clock'} size={18} className="shrink-0 text-mint-600" />
					<span className="min-w-0 flex-1 text-[15px]">
						{inProgress > 0 && <>{inProgress} {inProgress === 1 ? 'order' : 'orders'} in progress</>}
						{inProgress > 0 && toReview > 0 && ' · '}
						{toReview > 0 && <span className="font-medium">{toReview} ready for your review</span>}
					</span>
					<Icon name="arrowRight" size={16} className="shrink-0" />
				</Link>
			)}
		</section>
	)
}
