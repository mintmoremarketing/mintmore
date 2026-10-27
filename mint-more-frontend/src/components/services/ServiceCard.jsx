import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import { deliveryText, inr, percentOff } from './serviceUtils'

// Flat tints (no two-hue gradients) for the placeholder art.
const CATEGORY_TINT = {
	'video-editing': 'from-orange-50 to-orange-50 text-mint-600',
	'graphic-design': 'from-sky-50 to-sky-50 text-sky-700',
	'content-writing': 'from-emerald-50 to-emerald-50 text-emerald-700',
	'ugc-creation': 'from-amber-50 to-amber-50 text-amber-700',
}
const CATEGORY_ICON = {
	'video-editing': 'video',
	'graphic-design': 'image',
	'content-writing': 'type',
	'ugc-creation': 'microphone',
}

export function ServiceCover({ service, className = '' }) {
	if (service.cover_url) {
		return <img src={service.cover_url} alt="" className={`h-full w-full object-cover ${className}`} />
	}
	const tint = CATEGORY_TINT[service.category_slug] || 'from-ink-100 to-ink-50 text-ink-600'
	return (
		<div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${tint} ${className}`}>
			<Icon name={CATEGORY_ICON[service.category_slug] || 'sparkles'} size={34} />
		</div>
	)
}

export default function ServiceCard({ service }) {
	const off = percentOff(service.price, service.mrp)
	return (
		<Link
			to={`/services/${service.slug}`}
			className="group flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition hover:-translate-y-0.5 hover:border-mint-300 hover:shadow-lg"
		>
			<div className="relative aspect-[16/10] overflow-hidden">
				<ServiceCover service={service} className="transition-transform duration-500 group-hover:scale-105" />
				<span className="absolute left-3 top-3 rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-ink-700">
					{service.category_name}
				</span>
			</div>
			<div className="flex flex-1 flex-col p-4">
				<h3 className="text-[15px] font-bold leading-snug text-ink-900">{service.title}</h3>
				{service.summary && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{service.summary}</p>}
				<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-600">
					<span className="inline-flex items-center gap-1"><Icon name="clock" size={12} /> {deliveryText(service.delivery_days)}</span>
					<span className="inline-flex items-center gap-1"><Icon name="refresh" size={12} /> {service.revisions} revision{Number(service.revisions) === 1 ? '' : 's'}</span>
					{Number(service.rating_count) > 0 && (
						<span className="inline-flex items-center gap-1"><Icon name="star" size={12} className="text-amber-400" /> {service.rating_avg} ({service.rating_count})</span>
					)}
				</div>
				<div className="mt-auto flex items-end justify-between pt-4">
					<div>
						<div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Starting at</div>
						<div className="flex items-baseline gap-2">
							<span className="text-lg font-bold tabular-nums text-ink-900">{inr(service.starting_price || service.price)}</span>
							{off > 0 && <span className="text-xs tabular-nums text-ink-400 line-through">{inr(service.mrp)}</span>}
						</div>
					</div>
					{off > 0 && <span className="rounded-md bg-mint-50 px-2 py-0.5 text-xs font-semibold text-mint-700">{off}% off</span>}
				</div>
			</div>
		</Link>
	)
}
