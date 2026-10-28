// Files picked for a service brief stay in memory until payment, then upload into the
// order. They can't go in localStorage with the rest of the cart, so after a page reload
// the cart asks for them again.
const files = new Map() // variant_id -> { [fieldKey]: File[] }

export const briefFiles = {
	get: (variantId) => files.get(variantId) || {},
	set: (variantId, value) => files.set(variantId, value),
	remove: (variantId) => files.delete(variantId),
	clear: () => files.clear(),
}

/** Fields whose files the cart remembers by name but no longer holds (page was reloaded). */
export function missingBriefFiles(item) {
	const held = briefFiles.get(item.variant_id)
	return (item.brief_fields || []).filter(f => f.type === 'files' && (item.brief?.[f.key] || []).length > 0 && !(held[f.key] || []).length)
}

/** Required questions the cart item hasn't answered. */
export function unansweredBrief(item) {
	return (item.brief_fields || []).filter(f => {
		if (!f.required) return false
		const value = item.brief?.[f.key]
		return Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()
	})
}
