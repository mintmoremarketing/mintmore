import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useCartStore } from '../../store/cart'
import { useUIStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import { ImageSlot, PriceTag } from '../../components/storefront/storefront'
import { deliveryLabel } from '../../components/storefront/storefrontUtils'
import { referenceCover, referenceGallery } from '../../components/storefront/referencePhotos'

const chip = (active) =>
	`rounded-full border px-5 py-2.5 font-store text-[17px] transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 ${active ? 'border-black bg-black text-white' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-400'}`

function Section({ title, children }) {
	return (
		<section className="mt-10">
			<h2 className="mb-4 font-store text-2xl font-medium text-ink-900">{title}</h2>
			{children}
		</section>
	)
}

const RATING_ROWS = [
	['rating_quality', 'Quality of work'],
	['rating_communication', 'Communication'],
	['timeliness_rating', 'Timeliness'],
	['brief_adherence_rating', 'Followed the brief'],
]

/** Service page laid out like the reference storefront: media + details left, sticky booking card right. */
export default function ServiceDetail() {
	const { slug } = useParams()
	const navigate = useNavigate()
	const role = useAuthStore(s => s.user?.role)
	const addItem = useCartStore(s => s.addItem)
	const pushToast = useUIStore(s => s.pushToast)
	const [choice, setChoice] = useState({ option: null, pack: 1 })
	const [quantity, setQuantity] = useState(1)

	const { data: service, isLoading, isError } = useQuery({
		queryKey: ['service-detail', slug],
		queryFn: () => servicesApi.catalogItem(slug).then(res => res.data.data),
	})

	const variants = useMemo(() => service?.variants || [], [service])
	const options = useMemo(() => [...new Set(variants.map(v => v.option_label))], [variants])
	const fallback = variants.find(v => v.is_default) || variants[0]
	const option = choice.option ?? fallback?.option_label
	const packs = useMemo(
		() => variants.filter(v => v.option_label === option).sort((a, b) => a.pack_size - b.pack_size),
		[variants, option]
	)
	const variant = packs.find(v => Number(v.pack_size) === choice.pack) || packs[0]

	if (isLoading) return <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8"><div className="h-[520px] animate-pulse rounded-2xl bg-ink-100" /></div>
	if (isError || !service) {
		return (
			<div className="mx-auto max-w-xl px-4 py-20 text-center font-store">
				<h1 className="text-2xl font-medium text-ink-900">This service isn't available</h1>
				<Link to="/services" className="mt-4 inline-flex rounded-full bg-black px-6 py-3 text-white">Browse services</Link>
			</div>
		)
	}

	const canBuy = !role || role === 'client'
	const highlights = service.highlights?.length ? service.highlights : (service.summary ? [service.summary] : [])
	const reviews = service.reviews || []
	const cover = service.cover_url || referenceCover(service.slug)
	const ownGallery = service.gallery?.length ? service.gallery : referenceGallery(service.slug)
	const gallery = ownGallery.length ? ownGallery : [{ type: 'image', url: cover }, null]
	const avg = (key) => {
		const values = reviews.map(r => Number(r[key])).filter(Boolean)
		return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null
	}

	const toCart = (goToCart) => {
		if (!variant) return
		addItem({
			variant_id: variant.id,
			template_id: service.id,
			slug: service.slug,
			title: service.title,
			category_slug: service.category_slug,
			option_label: variant.option_label,
			option_group_label: service.option_group_label,
			pack_size: Number(variant.pack_size),
			unit_price: Number(variant.price),
			mrp: variant.mrp ? Number(variant.mrp) : null,
			delivery_days: variant.delivery_days,
			revisions: service.revisions,
			unit_label: service.unit_label,
			quantity,
		})
		if (goToCart) navigate('/cart')
		else pushToast({ title: 'Added to cart', body: service.title, icon: 'shoppingBag' })
	}

	const share = async () => {
		const url = window.location.href
		try {
			if (navigator.share) await navigator.share({ title: service.title, url })
			else { await navigator.clipboard.writeText(url); pushToast({ title: 'Link copied', icon: 'copy' }) }
		} catch { /* share dismissed */ }
	}

	const stepper = (
		<div className="flex items-center gap-4 rounded-xl border border-ink-200 bg-white px-4 py-2.5 font-store">
			<button className="text-2xl leading-none text-ink-500 disabled:opacity-30" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)} aria-label="Decrease quantity">−</button>
			<span className="w-5 text-center text-lg font-medium tabular-nums">{quantity}</span>
			<button className="text-2xl leading-none text-ink-900 disabled:opacity-30" disabled={quantity >= 20} onClick={() => setQuantity(q => q + 1)} aria-label="Increase quantity">+</button>
		</div>
	)

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 font-store md:px-8 lg:pb-16">
			<div className="flex items-center justify-between">
				<Link to={service.category_slug ? `/categories/${service.category_slug}` : '/services'} className="inline-flex items-center gap-3 text-xl text-ink-900">
					<Icon name="arrowLeft" size={22} /> {service.category_name || 'Services'}
				</Link>
				{/* The cart lives in the header (public and app layouts), so only Share stays here. */}
				<button
					onClick={share}
					className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] text-ink-900 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-100 active:scale-95"
				>
					<Icon name="arrowUpRight" size={18} /> Share
				</button>
			</div>

			<div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_540px]">
				<div className="min-w-0">
					{/* PHOTO-SLOT: "Outcome you can expect" samples — service_templates.gallery (images/videos) */}
					<div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
						{gallery.map((item, i) => (
							<div key={item?.url || i} className="aspect-[4/5] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[calc(50%-8px)]">
								{item?.type === 'video'
									? <video src={item.poster ? item.url : `${item.url}#t=0.5`} poster={item.poster || undefined} className="h-full w-full rounded-2xl bg-black object-cover" muted loop playsInline controls preload="metadata" />
									: <ImageSlot src={item?.url || (i === 0 ? cover : null)} title={i === 0 ? service.title : 'Sample work'} category={service.category_slug} rounded="rounded-2xl" size="lg" />}
							</div>
						))}
					</div>

					<h1 className="mt-8 text-3xl font-medium leading-tight tracking-tight text-ink-900 md:text-[40px]">{service.title}</h1>
					{Number(service.rating_count) > 0 && (
						<div className="mt-2 inline-flex items-center gap-1.5 text-lg text-ink-700">
							<Icon name="star" size={18} className="fill-amber-400 text-amber-400" /> {Number(service.rating_avg).toFixed(2)}
							<span className="text-ink-500">({service.rating_count})</span>
						</div>
					)}
					{variant && <div className="mt-3"><PriceTag price={variant.price} mrp={variant.mrp} size="lg" /></div>}

					{highlights.length > 0 && (
						<Section title="About this Service">
							<ul className="list-disc space-y-1.5 pl-6 text-[17px] text-ink-700">
								{highlights.map(item => <li key={item}>{item}</li>)}
							</ul>
						</Section>
					)}

					{(service.tools || []).length > 0 && (
						<Section title="Tools used">
							<div className="flex flex-wrap gap-2">
								{service.tools.map(tool => <span key={tool} className="rounded-lg bg-ink-100 px-3 py-1.5 text-[15px] text-ink-800">{tool}</span>)}
							</div>
						</Section>
					)}

					<section className="mt-10 grid gap-4 rounded-2xl bg-ink-50 p-6 sm:grid-cols-3">
						{[
							['shoppingBag', 'Book a service', 'Pay once at a fixed price'],
							['zap', 'Freelancer assigned', 'Chat opens instantly'],
							['checkCircle', 'Approve & complete', `${service.revisions} revisions included`],
						].map(([icon, title, body], i) => (
							<div key={title} className="flex items-start gap-3">
								<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-ink-900"><Icon name={icon} size={18} /></div>
								<div><div className="text-sm text-ink-500">Step {i + 1}</div><div className="text-[17px] font-medium text-ink-900">{title}</div><div className="text-sm text-ink-600">{body}</div></div>
							</div>
						))}
					</section>

					<div className="mt-6 grid gap-0 rounded-2xl bg-ink-50 p-6 sm:grid-cols-2 sm:divide-x sm:divide-ink-200">
						<div className="sm:pr-6">
							<h3 className="mb-3 text-xl font-medium text-ink-900">Included</h3>
							<ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-700">{(service.includes || []).map(item => <li key={item}>{item}</li>)}</ul>
						</div>
						<div className="mt-6 sm:mt-0 sm:pl-6">
							<h3 className="mb-3 text-xl font-medium text-ink-900">Excluded</h3>
							{(service.excludes || []).length
								? <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-700">{service.excludes.map(item => <li key={item}>{item}</li>)}</ul>
								: <p className="text-[15px] text-ink-500">Nothing listed</p>}
						</div>
					</div>

					<div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-ink-50 p-6">
						<div className="flex items-center gap-3 text-[17px] text-ink-900"><Icon name="shield" size={22} /> Secure Payments</div>
						<div className="flex items-center gap-3 border-l border-ink-200 pl-4 text-[17px] text-ink-900"><Icon name="user" size={22} /> Verified freelancers</div>
					</div>

					{reviews.length > 0 && (
						<Section title={<span className="inline-flex items-center gap-2"><Icon name="star" size={22} className="fill-ink-900" /> {Number(service.rating_avg).toFixed(2)}</span>}>
							<div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
								{RATING_ROWS.map(([key, label]) => avg(key) && (
									<div key={key} className="flex items-center justify-between text-[17px] text-ink-800">
										{label}<span className="inline-flex items-center gap-1"><Icon name="star" size={15} className="fill-ink-900" /> {avg(key)}</span>
									</div>
								))}
							</div>
							<div className="mt-6 space-y-3">
								{reviews.map((review, i) => (
									<div key={i} className="rounded-2xl border border-ink-200 p-4">
										<div className="flex items-center justify-between"><span className="font-medium text-ink-900">{review.client_name}</span><span className="inline-flex items-center gap-1 text-sm"><Icon name="star" size={13} className="fill-amber-400 text-amber-400" /> {Number(review.rating_overall).toFixed(1)}</span></div>
										{review.review_text && <p className="mt-1 text-[15px] text-ink-700">{review.review_text}</p>}
									</div>
								))}
							</div>
						</Section>
					)}

					{(service.faqs || []).length > 0 && (
						<Section title="FAQs">
							<div className="divide-y divide-ink-200 rounded-2xl border border-ink-200">
								{service.faqs.map(faq => (
									<details key={faq.q} className="group px-6 py-4">
										<summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium text-ink-900">{faq.q}<Icon name="chevronDown" size={18} className="shrink-0 transition group-open:rotate-180" /></summary>
										<p className="mt-2 text-[15px] text-ink-600">{faq.a}</p>
									</details>
								))}
							</div>
						</Section>
					)}
				</div>

				<aside className="lg:sticky lg:top-24 lg:self-start">
					<div className="rounded-2xl bg-ink-50 p-7">
						{options.length > 1 && (
							<div className="mb-6">
								<div className="mb-3 text-[15px] uppercase tracking-wide text-ink-500">{service.option_group_label || 'Option'}</div>
								<div className="flex flex-wrap gap-3">
									{options.map(label => (
										<button key={label} className={chip(option === label)} onClick={() => setChoice({ option: label, pack: 1 })}>{label}</button>
									))}
								</div>
							</div>
						)}
						{packs.length > 1 && (
							<div className="mb-6">
								<div className="mb-3 text-[15px] uppercase tracking-wide text-ink-500">Pack</div>
								<div className="flex flex-wrap gap-3">
									{packs.map(v => (
										<button key={v.id} className={chip(Number(v.pack_size) === Number(variant?.pack_size))} onClick={() => setChoice({ option, pack: Number(v.pack_size) })}>
											{Number(v.pack_size) === 1 ? 'Single' : `Pack of ${v.pack_size}`}
										</button>
									))}
								</div>
							</div>
						)}
						<div className="mb-6">
							<div className="mb-3 text-[15px] uppercase tracking-wide text-ink-500">Quantity</div>
							<div className="inline-flex">{stepper}</div>
						</div>
						{variant && Number(variant.pack_size) > 1 && (
							<p className="mb-4 text-[15px] text-ink-600">{variant.pack_size} {(service.unit_label || 'item').toLowerCase()}s · ₹{Math.round(Number(variant.price) / Number(variant.pack_size)).toLocaleString('en-IN')} each</p>
						)}
						{canBuy ? (
							<div className="grid gap-3">
								<button className="rounded-2xl bg-black py-4 text-xl font-medium text-white hover:bg-ink-800" onClick={() => toCart(true)}>Book Now</button>
								<button className="flex items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white py-4 text-xl font-medium text-ink-900 hover:bg-ink-50" onClick={() => toCart(false)}><Icon name="shoppingBag" size={20} /> Add to cart</button>
							</div>
						) : (
							<div className="rounded-2xl bg-white p-4 text-[15px] text-ink-600">Sign in with a client account to book services.</div>
						)}
						<p className="mt-3 text-center text-sm text-ink-500">+ 18% GST at checkout · payment held until you approve</p>
					</div>
					{variant && (
						<div className="mt-5 flex items-center justify-between rounded-2xl bg-ink-50 px-7 py-5 text-[17px] text-ink-900">
							<span className="inline-flex items-center gap-2"><Icon name="clock" size={20} /> {deliveryLabel(variant.delivery_days)} Delivery</span>
							<span className="inline-flex items-center gap-2"><Icon name="refresh" size={20} /> {service.revisions} Revisions</span>
						</div>
					)}
				</aside>
			</div>

			{/* Phone: sticky booking bar */}
			{canBuy && variant && (
				<div className="fixed inset-x-0 z-40 flex items-center gap-3 border-t border-ink-200 bg-white px-4 py-3 lg:hidden" style={{ bottom: 'var(--bottom-nav-h, 0px)' }}>
					{stepper}
					<button className="flex-1 rounded-xl border border-[#0b7a41] py-3 text-lg font-medium text-[#0b7a41]" onClick={() => toCart(false)}>Add to Cart</button>
					<button className="flex-1 rounded-xl bg-[#0b7a41] py-3 text-lg font-medium text-white" onClick={() => toCart(true)}>Book Now</button>
				</div>
			)}
		</div>
	)
}
