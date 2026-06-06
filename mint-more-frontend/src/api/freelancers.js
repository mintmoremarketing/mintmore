import { api } from './client'

export const freelancersApi = {
	browse: (params) => api.get('/freelancers', { params }),

	getProfile: (freelancerId) => api.get(`/freelancers/${freelancerId}`),
	setPreferred: (freelancerId, preferred) =>
		preferred
			? api.post(`/freelancers/${freelancerId}/preferred`)
			: api.delete(`/freelancers/${freelancerId}/preferred`),

	getReviews: (freelancerId, params) =>
		api.get(`/reviews/freelancer/${freelancerId}`, { params }),

	sendInquiry: (data) => api.post('/inquiries', data),
}
