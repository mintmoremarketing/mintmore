import { api } from './client'

export const portfolioApi = {
	getMyPortfolio: () => api.get('/portfolio'),

	create: (formData) =>
		api.post('/portfolio', formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		}),

	update: (itemId, data) => api.patch(`/portfolio/${itemId}`, data),

	remove: (itemId) => api.delete(`/portfolio/${itemId}`),
}
