import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import { ImageSlot, StoreRow } from '../../components/storefront/storefront'
import { CATEGORY_STYLE } from '../../components/storefront/storefrontUtils'
import StoreStack from '../../components/storefront/StoreStack'
import ShopperHero from '../../components/storefront/ShopperHero'
import SurfCards from '../../components/storefront/SurfCards'
import { useAuthStore } from '../../store/auth'
import { USE_REFERENCE_PHOTOS, referenceCategoryTile, referenceVideos } from '../../components/storefront/referencePhotos'

function CategoryTile({ category }) {
	const style = CATEGORY_STYLE[category.slug] || {}
	const soon = Number(category.service_count) === 0
	const tileArt = !category.icon_url && referenceCategoryTile(category.slug)
	if (tileArt) {
		// TEMP-REFERENCE-PHOTOS: the artwork already contains the name and "Explore Now" button.
		return (
			<Link to={`/categories/${category.slug}`} aria-label={category.name} className="block overflow-hidden rounded-2xl transition hover:-translate-y-0.5">
				<picture>
					<source media="(max-width: 639px)" srcSet={tileArt.mobile} />
					<img src={tileArt.desktop} alt={category.name} className="h-auto w-full" loading="lazy" />
				</picture>
			</Link>
		)
	}
	return (
		<Link
			to={`/categories/${category.slug}`}
			className={`group relative flex h-44 overflow-hidden rounded-2xl ${style.tile || 'bg-ink-100'} p-7 font-store transition hover:-translate-y-0.5`}
		>
			<div className="relative z-10 flex flex-col justify-between">
				<h3 className="text-2xl font-medium text-ink-900">{category.name}</h3>
				<span className="inline-flex w-fit rounded-lg bg-black px-5 py-3 text-lg font-medium text-white">{soon ? 'Coming soon' : 'Explore Now'}</span>
			</div>
			{/* PHOTO-SLOT: category artwork (categories.icon_url) */}
			<div className="absolute -bottom-2 right-4 h-40 w-44 rotate-3 transition group-hover:rotate-0">
				{category.icon_url
					? <img src={category.icon_url} alt="" className="h-full w-full object-contain" />
					: <ImageSlot title={category.name} category={category.slug} className="opacity-90 shadow-lg" rounded="rounded-2xl" />}
			</div>
		</Link>
	)
}

/** A muted reel that plays only while most of it is on screen. */
function ReelClip({ clip }) {
	const ref = useRef(null)
	useEffect(() => {
		const video = ref.current
		if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		// The src is attached on first view, so off-screen clips never download.
		const io = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				if (!video.src) video.src = clip.src
				video.play().catch(() => {})
			} else video.pause()
		}, { threshold: 0.6 })
		io.observe(video)
		return () => io.disconnect()
	}, [clip.src])
	return (
		<Link to={`/services/${clip.slug}`} className="group w-[168px] shrink-0 snap-start md:w-[216px]">
			<div className="aspect-[9/16] overflow-hidden rounded-2xl bg-ink-900">
				<video ref={ref} poster={clip.poster || undefined} muted loop playsInline preload="none" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
			</div>
			<p className="mt-2 line-clamp-1 text-[15px] font-medium text-ink-900 group-hover:underline">{clip.title}</p>
		</Link>
	)
}

/** TEMP-REFERENCE-VIDEOS: strip of work-sample reels, each linking to its service. */
function WorkReels() {
	const clips = referenceVideos()
	if (!clips.length) return null
	return (
		<section className="mt-20">
			<h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">See the work</h2>
			<p className="mt-2 text-[15px] text-ink-600">Reels in the styles you can book. Tap one to open the service.</p>
			<div className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:-mx-8 md:gap-4 md:px-8">
				{clips.map(clip => <ReelClip key={clip.slug} clip={clip} />)}
			</div>
		</section>
	)
}

function Faqs({ faqs }) {
	const [open, setOpen] = useState(0)
	if (!faqs?.length) return null
	return (
		<section className="mt-20">
			<h2 className="mb-6 font-store text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">Frequently Asked Questions</h2>
			<div className="divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
				{faqs.map((faq, i) => (
					<div key={faq.q}>
						<button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-store text-lg font-medium text-ink-900" onClick={() => setOpen(open === i ? -1 : i)}>
							{faq.q}
							<Icon name="chevronDown" size={18} className={`shrink-0 transition ${open === i ? 'rotate-180' : ''}`} />
						</button>
						{open === i && <p className="px-6 pb-5 font-store text-[15px] leading-relaxed text-ink-600">{faq.a}</p>}
					</div>
				))}
			</div>
		</section>
	)
}

const HERO_LINE = 'CREATYV moves your business'
const HERO_CTA_LINE = 'Book your first service'

/** The landing page's rolling headline: letters rise in, hold, then lift away on a loop. */
function HeroPhrase() {
	const [ctaActive, setCtaActive] = useState(false)
	const line = ctaActive ? HERO_CTA_LINE : HERO_LINE
	const words = line.split(' ')
	const starts = words.map((_, w) => words.slice(0, w).join('').length)
	return (
		<Link
			to="/categories/video-editing"
			className="store-hero-phrase"
			aria-label={line}
			onPointerEnter={() => setCtaActive(true)}
			onPointerLeave={() => setCtaActive(false)}
			onFocus={() => setCtaActive(true)}
			onBlur={() => setCtaActive(false)}
		>
			<h1 className="store-hero-line" key={line} aria-hidden="true">
				{words.map((word, w) => (
					<span key={`${word}-${w}`}>
						{w > 0 && ' '}
						<span className="store-hero-word">
							{word.split('').map((char, c) => (
								<span key={c} className="landing-hero-char" style={{ '--char-delay': `${(starts[w] + c) * 34}ms` }}>{char}</span>
							))}
						</span>
					</span>
				))}
			</h1>
			<span className="landing-hero-cta-hint">Click to start</span>
		</Link>
	)
}

const HOW_IT_WORKS = [
	{ title: 'Pick a service', body: 'Fixed price, fixed scope. Choose the option and pack you need.' },
	{ title: 'Freelancer assigned', body: 'A vetted freelancer is assigned instantly and a chat opens for your files.' },
	{ title: 'Approve & pay out', body: 'Request revisions, then approve. Payment is released only then.' },
]

/** Storefront homepage (public at "/" and "/services"; also shown inside the app shell). */
export default function StoreHome({ embedded = false }) {
	const { data, isLoading } = useQuery({
		queryKey: ['storefront'],
		queryFn: () => servicesApi.storefront().then(res => res.data.data),
	})
	// The rolling CREATYV headline and scroll-stack are the public pitch; signed-in shoppers get a working header.
	const signedIn = useAuthStore(s => s.isAuthed)
	const pitch = !embedded && !signedIn

	return (
		<div className={`mx-auto w-full max-w-[1400px] px-4 font-store md:px-8 ${embedded ? 'pb-10' : 'py-8 md:py-10'}`}>
			{!embedded && signedIn && <div className="pt-2 md:pt-0"><ShopperHero services={data?.rows?.[0]?.services} /></div>}
			{pitch && (
				/* The landing's rolling headline replaces the old magenta campaign banner (PHOTO-SLOT). */
				<section className="store-surf-hero">
					<div className="store-surf-copy relative z-10 text-center">
						<HeroPhrase />
						<p className="mx-auto mt-5 max-w-xl text-lg text-ink-700">Reels, thumbnails, designs and scripts at fixed prices.</p>
						<Link to="/categories/video-editing" className="landing-cta mt-7 gap-2 !min-h-12 !px-6 !text-base">
							Explore services <Icon name="arrowRight" size={18} />
						</Link>
					</div>
					{/* The work drifts past behind the pitch: Surf mode from the Lookback archive. */}
					<SurfCards />
				</section>
			)}

			<section className={pitch ? 'mt-14 md:mt-20' : 'mt-10'}>
				<h2 className="mb-6 text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">Top Categories</h2>
				<div className={`grid sm:grid-cols-2 lg:grid-cols-3 ${USE_REFERENCE_PHOTOS ? 'grid-cols-2 gap-3 sm:gap-5' : 'gap-5'}`}>
					{isLoading
						? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-ink-100" />)
						: data?.categories.map(category => <CategoryTile key={category.id} category={category} />)}
				</div>
			</section>

			{data?.rows.map(row => <StoreRow key={row.title} title={row.title} services={row.services} />)}

			<WorkReels />

			{/* LAUNCH-HIDDEN: "Trusted by 200K+ users" and creator testimonial strips — add once we have our own numbers and creators. */}

			{/* Public visitors get the scroll-stacked cards below instead; signed-in shoppers keep this list. */}
			{!pitch && (
			<section className="mt-20">
				<h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">How it works</h2>
				<ol className="mt-6 divide-y divide-ink-200 border-y border-ink-200 md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
					{HOW_IT_WORKS.map((step, i) => (
						<li key={step.title} className="flex gap-4 py-5 md:flex-col md:gap-2 md:px-6 md:first:pl-0">
							<span className="text-2xl font-semibold tabular-nums text-mint-600">{i + 1}</span>
							<div>
								<h3 className="text-xl font-medium text-ink-900">{step.title}</h3>
								<p className="mt-1 max-w-sm text-[15px] text-ink-600">{step.body}</p>
							</div>
						</li>
					))}
				</ol>
			</section>
			)}

			<Faqs faqs={data?.faqs} />

			{pitch && <StoreStack />}
		</div>
	)
}
