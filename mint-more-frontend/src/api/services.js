import { api } from './client'

export const servicesApi = {
	// Public catalogue
	storefront: () => api.get('/services/storefront'),
	categories: () => api.get('/services/categories'),
	categoryPage: (slug) => api.get(`/services/categories/${slug}`),
	catalog: (params) => api.get('/services/catalog', { params }),
	catalogItem: (slug) => api.get(`/services/catalog/${slug}`),

	// Client
	checkout: (data) => api.post('/services/checkout', data),
	verifyCheckout: (checkoutId, data) => api.post(`/services/checkout/${checkoutId}/verify`, data),
	bookings: (params) => api.get('/services/bookings', { params }),
	booking: (id) => api.get(`/services/bookings/${id}`),
	updateBookingBrief: (id, data) => api.patch(`/services/bookings/${id}/brief`, data),
	pastFreelancers: (params) => api.get('/services/past-freelancers', { params }),

	// Freelancer
	templates: () => api.get('/services/templates'),
	optIn: (templateId) => api.post(`/services/templates/${templateId}/opt-in`),
	optOut: (templateId) => api.delete(`/services/templates/${templateId}/opt-in`),
	work: (params) => api.get('/services/work', { params }),
	dashboard: () => api.get('/services/dashboard'),
	workItem: (id) => api.get(`/services/work/${id}`),
	offers: () => api.get('/services/offers'),
	acceptOffer: (bookingId) => api.post(`/services/offers/${bookingId}/accept`),
	declineOffer: (bookingId) => api.post(`/services/offers/${bookingId}/decline`),

	// Admin
	adminTemplates: () => api.get('/services/admin/templates'),
	adminBriefDefaults: () => api.get('/services/admin/brief-defaults'),
	adminCreateTemplate: (data) => api.post('/services/admin/templates', data),
	adminUpdateTemplate: (id, data) => api.put(`/services/admin/templates/${id}`, data),
	adminBookings: (params) => api.get('/services/admin/bookings', { params }),
	adminEligibleFreelancers: (bookingId) => api.get(`/services/admin/bookings/${bookingId}/freelancers`),
	adminAssign: (bookingId, data) => api.post(`/services/admin/bookings/${bookingId}/assign`, data),
}
