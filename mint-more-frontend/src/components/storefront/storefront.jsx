import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { useCartStore } from '../../store/cart'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { inr, percentOff } from '../services/serviceUtils'
import { CATEGORY_STYLE, deliveryLabel, fallbackStyle } from './storefrontUtils'
import { referenceCover } from './referencePhotos'

// Shared building blocks for the storefront (home, category, service pages).


/**
 * Image slot. Shows the uploaded cover when there is one; otherwise a
 * placeholder (title on a category gradient) until real photos are added.
 * PHOTO-SLOT: replace via admin "Cover image URL" (service_templates.cover_url).
 */
export function ImageSlot({ src, title, category, className = '', rounded = 'rounded-xl', size = 'md' }) {
	if (src) return <img src={src} alt={title || ''} className={`h-full w-full object-cover ${rounded} ${className}`} loading="lazy" />
	const style = CATEGORY_STYLE[category] || fallbackStyle
	return (
		<div data-photo-slot className={`relative flex h-full w-full items-end overflow-hidden bg-gradient-to-br ${style.art} ${rounded} ${className}`}>
			<span className={`relative p-3 font-store font-bold uppercase leading-[1.05] tracking-tight text-black/80 ${size === 'lg' ? 'text-3xl md:text-4xl' : 'text-lg'}`}>
				{title}
			</span>
		</div>
	)
}

/** Green ticket-style price with struck MRP, as on the reference storefront. */
export function PriceTag({ price, mrp, size = 'md' }) {
	const off = percentOff(price, mrp)
	const big = size === 'lg'
	return (
		<div>
			<div className="flex items-center gap-2">
				<span
					className={`inline-block bg-[#0b7a41] font-store font-semibold tabular-nums text-white ${big ? 'px-3 py-1 text-3xl' : 'px-2 py-0.5 text-xl'}`}
					style={{
						WebkitMask: 'radial-gradient(circle 3px at 0 50%, #0000 98%, #000) left / 51% 8px repeat-y, radial-gradient(circle 3px at 100% 50%, #0000 98%, #000) right / 51% 8px repeat-y',
						mask: 'radial-gradient(circle 3px at 0 50%, #0000 98%, #000) left / 51% 8px repeat-y, radial-gradient(circle 3px at 100% 50%, #0000 98%, #000) right / 51% 8px repeat-y',
					}}
				>
					{inr(price)}
				</span>
				{off > 0 && <span className={`font-store tabular-nums text-ink-500 line-through ${big ? 'text-lg' : 'text-sm'}`}>{inr(mrp)}</span>}
			</div>
			{off > 0 && <div className={`mt-1 font-store text-[#2563eb] ${big ? 'text-base' : 'text-sm'}`}>{off}% OFF on MRP</div>}
		</div>
	)
}

export function Rating({ value, count }) {
	if (!(Number(count) > 0)) return null
	return (
		<span className="inline-flex items-center gap-1 font-store text-sm text-ink-600">
			<Icon name="star" size={14} className="fill-amber-400 text-amber-400" /> {Number(value).toFixed(1)}
		</span>
	)
}


/** "Add" pill that turns into a − n + stepper once the item is in the cart. */
export function AddStepper({ service, className = '', onOpen }) {
	const role = useAuthStore(s => s.user?.role)
	const line = useCartStore(s => s.items.find(item => item.variant_id === service.default_variant_id) || s.items.find(item => item.template_id === service.id))
	const updateItem = useCartStore(s => s.updateItem)
	const removeItem = useCartStore(s => s.removeItem)
	if (!service.default_variant_id || (role && role !== 'client')) return null

	const stop = (fn) => (event) => { event.preventDefault(); event.stopPropagation(); fn() }
	const base = `rounded-xl border border-[#16b364]/60 bg-white font-store shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${className}`
	if (!line) {
		return (
			<button
				type="button"
				className={`${base} px-4 py-2 text-[17px] font-medium text-ink-900 hover:bg-emerald-50`}
				onClick={stop(onOpen)}
			>
				Add
			</button>
		)
	}
	return (
		<div className={`${base} flex items-center gap-3 px-3 py-2`} onClick={stop(() => {})}>
			<button type="button" aria-label="Decrease quantity" className="text-xl leading-none text-[#0b7a41]" onClick={stop(() => (line.quantity > 1 ? updateItem(line.variant_id, { quantity: line.quantity - 1 }) : removeItem(line.variant_id)))}>−</button>
			<span className="min-w-4 text-center text-[17px] font-medium tabular-nums">{line.quantity}</span>
			<button type="button" aria-label="Increase quantity" className="text-xl leading-none text-[#0b7a41]" onClick={stop(() => updateItem(line.variant_id, { quantity: Math.min(20, line.quantity + 1) }))}>+</button>
		</div>
	)
}

function QuickAddSheet({ service, onClose }) {
	const addItem = useCartStore(s => s.addItem)
	const pushToast = useUIStore(s => s.pushToast)
	const [option, setOption] = useState('')
	const [packSize, setPackSize] = useState(null)
	const [quantity, setQuantity] = useState(1)
	const [quickNote, setQuickNote] = useState('')
	const { data, isLoading, isError } = useQuery({
		queryKey: ['quick-add-service', service.slug],
		queryFn: () => servicesApi.catalogItem(service.slug).then(res => res.data.data),
	})
	const variants = data?.variants || []
	const options = [...new Set(variants.map(variant => variant.option_label))]
	const selectedOption = option || variants.find(variant => variant.is_default)?.option_label || variants[0]?.option_label
	const packs = variants.filter(variant => variant.option_label === selectedOption).sort((a, b) => Number(a.pack_size) - Number(b.pack_size))
	const variant = packs.find(item => Number(item.pack_size) === Number(packSize)) || packs.find(item => item.is_default) || packs[0]

	useEffect(() => {
		const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
		document.addEventListener('keydown', closeOnEscape)
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', closeOnEscape)
			document.body.style.overflow = previousOverflow
		}
	}, [onClose])

	const add = () => {
		if (!variant) return
		addItem({
			variant_id: variant.id,
			template_id: data.id,
			slug: data.slug,
			title: data.title,
			category_slug: data.category_slug,
			option_label: variant.option_label,
			option_group_label: data.option_group_label,
			pack_size: Number(variant.pack_size),
			unit_price: Number(variant.price),
			mrp: variant.mrp ? Number(variant.mrp) : null,
			delivery_days: variant.delivery_days,
			revisions: data.revisions,
			unit_label: data.unit_label,
			quantity,
			brief_fields: data.brief_fields || [],
			instructions: quickNote.trim(),
		})
		pushToast({ title: 'Added to cart', body: data.title, icon: 'shoppingBag' })
		onClose()
	}

	return createPortal((
		<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 font-store md:items-stretch md:justify-end" onClick={onClose}>
			<aside role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onClick={event => event.stopPropagation()} className="brief-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-none md:max-w-[440px] md:rounded-none">
				<div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4 md:px-7 md:py-5">
					<div className="min-w-0 flex-1">
						<h2 id="quick-add-title" className="text-xl font-medium tracking-tight text-ink-900">Add to cart</h2>
						<p className="mt-0.5 truncate text-sm text-ink-500">Choose an option and quantity</p>
					</div>
					<button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Close"><Icon name="x" size={16} /></button>
				</div>

				<div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-7">
					<div className="flex gap-4">
						<div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-ink-50"><ImageSlot src={service.cover_url || referenceCover(service.slug)} title={service.title} category={service.category_slug} /></div>
						<div className="min-w-0"><h3 className="text-[17px] font-medium text-ink-900">{service.title}</h3><p className="mt-1 text-sm text-ink-500">{deliveryLabel(service.delivery_days)} delivery · {service.revisions} revisions</p></div>
					</div>
					{isLoading ? <div className="h-24 animate-pulse rounded-xl bg-ink-100" /> : isError || !variants.length ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Could not load options for this service. Please try again.</p> : <>
						{options.length > 1 && <div><h3 className="mb-2 text-sm font-medium text-ink-900">{data.option_group_label || 'Choose an option'}</h3><div className="flex flex-wrap gap-2">{options.map(label => <button type="button" key={label} onClick={() => { setOption(label); setPackSize(null) }} className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${selectedOption === label ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-800 hover:border-ink-400'}`}>{label}</button>)}</div></div>}
						{packs.length > 1 && <div><h3 className="mb-2 text-sm font-medium text-ink-900">Pack size</h3><div className="flex flex-wrap gap-2">{packs.map(item => <button type="button" key={item.id} onClick={() => setPackSize(Number(item.pack_size))} className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${Number(variant?.pack_size) === Number(item.pack_size) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-800 hover:border-ink-400'}`}>{Number(item.pack_size) === 1 ? 'Single' : `Pack of ${item.pack_size}`}</button>)}</div></div>}
						<div><h3 className="mb-2 text-sm font-medium text-ink-900">Quantity</h3><div className="inline-flex items-center gap-4 rounded-xl border border-ink-200 px-3 py-2"><button type="button" onClick={() => setQuantity(count => Math.max(1, count - 1))} className="text-xl leading-none text-ink-700" aria-label="Decrease quantity">−</button><span className="min-w-5 text-center text-[15px] font-medium tabular-nums">{quantity}</span><button type="button" onClick={() => setQuantity(count => Math.min(20, count + 1))} className="text-xl leading-none text-ink-700" aria-label="Increase quantity">+</button></div></div>
						<div>
							<label htmlFor="quick-add-note" className="flex items-center gap-2 text-sm font-medium text-ink-900">{data.category_slug === 'video-editing' ? 'What is this video for?' : 'What is this service for?'}<span className="font-normal text-ink-400">Optional</span></label>
							<p className="mt-1 text-sm leading-relaxed text-ink-500">A short note is enough to check out. You can send your full brief and files after payment.</p>
							<textarea id="quick-add-note" rows={3} value={quickNote} onChange={event => setQuickNote(event.target.value)} placeholder="What should your freelancer know?" className="mt-2 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-ink-500 focus:outline-none" />
						</div>
					</>}
				</div>

				<div className="flex items-center gap-4 border-t border-ink-100 px-5 py-4 md:px-7">
					<div className="min-w-0 flex-1"><div className="text-xs text-ink-500">Total before GST</div><div className="text-xl font-semibold tabular-nums text-ink-900">{variant ? inr(Number(variant.price) * quantity) : '—'}</div></div>
					<button type="button" disabled={isLoading || isError || !variant} onClick={add} className="h-11 rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">Add to cart</button>
				</div>
			</aside>
		</div>
	), document.body)
}

/** Service card: image, delivery, Add/stepper, title, green price, % off, rating. */
export function StoreCard({ service }) {
	const [quickAddOpen, setQuickAddOpen] = useState(false)
	return (
		<div className="relative h-full">
			<Link to={`/services/${service.slug}`} className="group flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-3 font-store transition-[border-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-ink-300 active:scale-[0.985]">
				<div className="relative aspect-[16/9]">
					{/* Pinned to the frame: covers come in any shape, and aspect-ratio alone lets tall images stretch the card. */}
					<div className="absolute inset-0 overflow-hidden rounded-xl bg-ink-50">
						<ImageSlot src={service.cover_url || referenceCover(service.slug)} title={service.title} category={service.category_slug} />
					</div>
					{service.badge && (
						<span className="absolute -left-3 -top-3 rounded-tl-xl bg-[#ef233c] px-3 py-1 text-xs font-bold uppercase text-white" style={{ clipPath: 'polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)' }}>
							{service.badge}
						</span>
					)}
					<AddStepper service={service} onOpen={() => setQuickAddOpen(true)} className="absolute -bottom-5 right-0" />
				</div>
				<div className="mt-2 flex items-center gap-1.5 border-b border-ink-100 pb-3 text-[15px] text-ink-500"><Icon name="clock" size={15} /> {deliveryLabel(service.delivery_days)}</div>
				<h3 className="mt-3 line-clamp-1 text-[17px] font-medium text-ink-900">{service.title}</h3>
				<div className="mt-1.5"><PriceTag price={service.price} mrp={service.mrp} /></div>
				<div className="mt-1.5 min-h-5"><Rating value={service.rating_avg} count={service.rating_count} /></div>
			</Link>
			{quickAddOpen && <QuickAddSheet service={service} onClose={() => setQuickAddOpen(false)} />}
		</div>
	)
}

/** Section heading + 4-up grid (scrolls sideways on phones). */
export function StoreRow({ title, services, action }) {
	if (!services?.length) return null
	return (
		<section className="mt-14">
			<div className="mb-6 flex items-end justify-between gap-3">
				<h2 className="font-store text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">{title}</h2>
				{action}
			</div>
			<div className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-4 pt-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
				{services.map(service => (
					<div key={service.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto"><StoreCard service={service} /></div>
				))}
			</div>
		</section>
	)
}
