// Shared storefront constants and helpers (kept apart from components for fast refresh).

export const CATEGORY_STYLE = {
	'video-editing': { tile: 'bg-[#f6a6cf]', art: 'from-[#ff5f9e] to-[#ffb3d1]', label: 'Video Editing' },
	design: { tile: 'bg-[#8fe3f7]', art: 'from-[#38bdf8] to-[#a5f3fc]', label: 'Design' },
	'ai-service': { tile: 'bg-[#eefa8f]', art: 'from-[#a3e635] to-[#fef08a]', label: 'AI Services' },
	'content-creation': { tile: 'bg-[#dcd2fb]', art: 'from-[#a78bfa] to-[#ede9fe]', label: 'Content Creation' },
	'content-writing': { tile: 'bg-[#9cc9fb]', art: 'from-[#60a5fa] to-[#dbeafe]', label: 'Content Writing' },
	consultation: { tile: 'bg-[#fbb77c]', art: 'from-[#fb923c] to-[#fed7aa]', label: 'Consultation' },
}
export const fallbackStyle = { tile: 'bg-ink-100', art: 'from-ink-300 to-ink-100' }

export const deliveryLabel = (days) => `${days} Day${Number(days) === 1 ? '' : 's'}`

export const cartItemFromCard = (service) => ({
	variant_id: service.default_variant_id,
	template_id: service.id,
	slug: service.slug,
	title: service.title,
	category_slug: service.category_slug,
	option_label: service.option_label,
	option_group_label: service.option_group_label,
	pack_size: Number(service.pack_size || 1),
	unit_price: Number(service.price),
	mrp: service.mrp ? Number(service.mrp) : null,
	delivery_days: service.delivery_days,
	revisions: service.revisions,
	unit_label: service.unit_label,
	quantity: 1,
})
