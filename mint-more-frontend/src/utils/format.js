export function rupee(n, opts = {}) {
	const sign = n < 0 ? '-' : ''
	const abs = Math.abs(n)
	const formatted = abs.toLocaleString('en-IN')
	return `${sign}₹${formatted}${opts.decimals ? '.00' : ''}`
}

export function timeAgo(dateStr) {
	const diff = Date.now() - new Date(dateStr).getTime()
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins}m ago`
	const hrs = Math.floor(mins / 60)
	if (hrs < 24) return `${hrs}h ago`
	return `${Math.floor(hrs / 24)}d ago`
}

export const STATUS_META = {
	draft: { label: 'Draft', tone: 'neutral' },
	open: { label: 'Open', tone: 'violet' },
	matching: { label: 'Matching', tone: 'violet' },
	locked: { label: 'Locked', tone: 'amber' },
	negotiating: { label: 'Negotiating', tone: 'amber' },
	pending_admin_approval: { label: 'Pending approval', tone: 'amber' },
	assigned: { label: 'Assigned', tone: 'mint' },
	in_progress: { label: 'In progress', tone: 'mint' },
	completed: { label: 'Completed', tone: 'sky' },
	cancelled: { label: 'Cancelled', tone: 'rose' },
}
