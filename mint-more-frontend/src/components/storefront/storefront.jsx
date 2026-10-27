import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/cart'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { inr, percentOff } from '../services/serviceUtils'
import { CATEGORY_STYLE, cartItemFromCard, deliveryLabel, fallbackStyle } from './storefrontUtils'
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
export function AddStepper({ service, className = '' }) {
	const role = useAuthStore(s => s.user?.role)
	const pushToast = useUIStore(s => s.pushToast)
	const line = useCartStore(s => s.items.find(item => item.variant_id === service.default_variant_id))
	const addItem = useCartStore(s => s.addItem)
	const updateItem = useCartStore(s => s.updateItem)
	const removeItem = useCartStore(s => s.removeItem)
	if (!service.default_variant_id || (role && role !== 'client')) return null

	const stop = (fn) => (event) => { event.preventDefault(); event.stopPropagation(); fn() }
	const base = `rounded-xl border border-[#16b364]/60 bg-white font-store shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 ${className}`
	if (!line) {
		return (
			<button
				type="button"
				className={`${base} px-4 py-2 text-[17px] font-medium text-ink-900 hover:bg-emerald-50`}
				onClick={stop(() => { addItem(cartItemFromCard(service)); pushToast({ title: 'Added to cart', body: service.title, icon: 'shoppingBag' }) })}
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

/** Service card: image, delivery, Add/stepper, title, green price, % off, rating. */
export function StoreCard({ service }) {
	return (
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
				<AddStepper service={service} className="absolute -bottom-5 right-0" />
			</div>
			<div className="mt-2 flex items-center gap-1.5 border-b border-ink-100 pb-3 text-[15px] text-ink-500">
				<Icon name="clock" size={15} /> {deliveryLabel(service.delivery_days)}
			</div>
			<h3 className="mt-3 line-clamp-1 text-[17px] font-medium text-ink-900">{service.title}</h3>
			<div className="mt-1.5"><PriceTag price={service.price} mrp={service.mrp} /></div>
			<div className="mt-1.5 min-h-5"><Rating value={service.rating_avg} count={service.rating_count} /></div>
		</Link>
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
