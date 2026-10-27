export const inr = (value) => {
	const amount = Number(value || 0)
	return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: amount % 1 ? 2 : 0 })}`
}

export const percentOff = (price, mrp) => {
	if (!mrp || Number(mrp) <= Number(price)) return 0
	return Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100)
}

export const deliveryText = (days) => `${days} day${Number(days) === 1 ? '' : 's'}`

export const variantLabel = (variant, optionGroupLabel) => {
	const parts = []
	if (variant.option_label && variant.option_label !== 'Standard') parts.push(variant.option_label)
	if (Number(variant.pack_size) > 1) parts.push(`Pack of ${variant.pack_size}`)
	return parts.join(' · ') || optionGroupLabel || 'Standard'
}

// Stage values come from the backend's deriveStage().
export const STAGE_META = {
	finding_freelancer: { label: 'Assigning freelancer', tone: 'bg-amber-50 text-amber-700 ' },
	in_progress: { label: 'In progress', tone: 'bg-sky-50 text-sky-700 ' },
	revision_requested: { label: 'Revision requested', tone: 'bg-violet-50 text-violet-700 ' },
	delivered: { label: 'Delivered', tone: 'bg-mint-50 text-mint-600 ' },
	approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 ' },
	completed: { label: 'Completed', tone: 'bg-ink-100 text-ink-700 ' },
	cancelled: { label: 'Cancelled', tone: 'bg-rose-50 text-rose-700 ' },
	awaiting_payment: { label: 'Awaiting payment', tone: 'bg-ink-50 text-ink-600 ' },
}

export const clientNextAction = (stage) => ({
	finding_freelancer: 'We are matching a freelancer',
	in_progress: 'Share files in chat',
	revision_requested: 'Freelancer is revising',
	delivered: 'Review delivery',
	approved: 'Complete & rate',
	completed: 'View files',
}[stage] || 'Open order')

export const freelancerNextAction = (stage) => ({
	in_progress: 'Upload delivery',
	revision_requested: 'Deliver revision',
	delivered: 'Waiting for client review',
	approved: 'Waiting for client to complete',
	completed: 'Paid to wallet',
}[stage] || 'Open order')

export const dueText = (dueAt) => {
	if (!dueAt) return 'Due date set on assignment'
	const diffMs = new Date(dueAt).getTime() - Date.now()
	const hours = Math.round(diffMs / 3_600_000)
	if (hours < 0) return `Overdue by ${Math.abs(hours) < 24 ? `${Math.abs(hours)}h` : `${Math.round(Math.abs(hours) / 24)}d`}`
	if (hours < 24) return `Due in ${Math.max(1, hours)}h`
	return `Due in ${Math.round(hours / 24)}d`
}

export const formatDate = (value) => (value
	? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
	: '—')
