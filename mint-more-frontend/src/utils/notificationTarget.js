// Where clicking a notification should take the user. Service orders (and the
// jobs that back them) open the order workspace; social/calendar links stay
// pointed at admin/designer tools since those pages are hidden from clients.
export function notificationTarget(notification, role) {
	const data = notification.data || {}
	const type = notification.type

	if (type === 'calendar_completed') return '/admin/operations?tab=clients'
	if (type === 'designer_assigned') return '/designer/tasks'
	if (type === 'creative_uploaded') return '/admin/operations?tab=review'
	if (type?.startsWith('creative_')) return role === 'designer' ? '/designer/tasks' : null

	if (notification.entity_type === 'dispute' || data.dispute_id) {
		return `/disputes?id=${notification.entity_id || data.dispute_id}`
	}

	const bookingId = notification.entity_type === 'service_booking' ? notification.entity_id : data.booking_id
	const jobId = notification.entity_type === 'job' ? notification.entity_id : data.job_id || data.jobId || data.job?.id
	const orderId = bookingId || jobId
	if (orderId) {
		if (role === 'admin') return bookingId ? '/admin/service-orders' : `/jobs/${jobId}`
		if (role === 'freelancer') return `/work/${orderId}`
		if (role === 'client') return `/orders/${orderId}`
		return `/jobs/${jobId || orderId}`
	}

	if (notification.entity_type === 'wallet' || type === 'wallet') return '/wallet'
	return null
}
