import { create } from 'zustand'
import { briefFiles } from './briefFiles'

// Cart lives in localStorage so a visitor can build it before signing in.
const STORAGE_KEY = 'creatyv_cart'

const readCart = () => {
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
		// Carts saved before the item limit may hold more than it allows.
		return Array.isArray(parsed) ? parsed.map(item => ({ ...item, quantity: Math.min(maxQuantity(item.pack_size), Number(item.quantity) || 1) })) : []
	} catch {
		return []
	}
}

const writeCart = (items) => {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /* storage unavailable */ }
	return items
}

// Items one service option can buy from freelancers: two packs of three count as six.
// The backend enforces the same limit. Above it, the service page shows Hire a Pro instead.
export const MAX_ITEMS_PER_SELECTION = 10
export const itemCount = (item) => Number(item.pack_size || 1) * Number(item.quantity || 1)
export const maxQuantity = (packSize) => Math.max(1, Math.floor(MAX_ITEMS_PER_SELECTION / Number(packSize || 1)))

export const useCartStore = create((set, get) => ({
	items: readCart(),

	// item: { variant_id, template_id, slug, title, option_label, pack_size, unit_price, mrp, delivery_days, revisions, unit_label, quantity,
	//         brief_fields, brief: { [fieldKey]: answer | fileNames[] }, instructions }
	addItem: (item) => set(() => {
		const items = [...get().items]
		const existing = items.find((entry) => entry.variant_id === item.variant_id)
		if (existing) {
			existing.quantity = Math.min(maxQuantity(existing.pack_size), existing.quantity + (item.quantity || 1))
			if (item.brief) Object.assign(existing, { brief: item.brief, brief_fields: item.brief_fields, instructions: item.instructions ?? existing.instructions })
			else if (item.instructions?.trim()) existing.instructions = item.instructions.trim()
		}
		else items.push({ instructions: '', ...item, quantity: Math.min(maxQuantity(item.pack_size), item.quantity || 1) })
		return { items: writeCart(items) }
	}),
	updateItem: (variantId, patch) => set(() => ({
		items: writeCart(get().items.map((entry) => (entry.variant_id === variantId ? { ...entry, ...patch } : entry))),
	})),
	removeItem: (variantId) => {
		briefFiles.remove(variantId)
		set(() => ({ items: writeCart(get().items.filter((entry) => entry.variant_id !== variantId)) }))
	},
	clear: () => { briefFiles.clear(); set(() => ({ items: writeCart([]) })) },
}))

export const GST_RATE = 18

export function cartTotals(items) {
	const itemTotal = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)
	const mrpTotal = items.reduce((sum, item) => sum + Number(item.mrp || item.unit_price) * item.quantity, 0)
	const gst = Math.round(itemTotal * GST_RATE) / 100
	return { itemTotal, mrpTotal, savings: Math.max(0, mrpTotal - itemTotal), gst, total: Math.round((itemTotal + gst) * 100) / 100 }
}
