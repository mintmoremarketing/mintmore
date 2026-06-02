import { api } from './client'

export const freelancersApi = {
	browse: (params) => api.get('/freelancers', { params }),

	getProfile: (freelancerId) => api.get(`/freelancers/${freelancerId}`),

	getReviews: (freelancerId, params) =>
		api.get(`/reviews/freelancer/${freelancerId}`, { params }),

	sendInquiry: (data) => api.post('/inquiries', data),
}
