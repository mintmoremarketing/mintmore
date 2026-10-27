import { api } from './client'

export const assessmentsApi = {
	list: () => api.get('/assessments'),
	get: (slug) => api.get(`/assessments/${slug}`),
	start: (slug) => api.post(`/assessments/${slug}/start`),
	attempt: (attemptId) => api.get(`/assessments/attempts/${attemptId}`),
	prepareFile: (attemptId, data) => api.post(`/assessments/attempts/${attemptId}/files`, data),
	completeFile: (attemptId, itemId) => api.post(`/assessments/attempts/${attemptId}/files/${itemId}/complete`),
	addLink: (attemptId, data) => api.post(`/assessments/attempts/${attemptId}/links`, data),
	removeItem: (attemptId, itemId) => api.delete(`/assessments/attempts/${attemptId}/items/${itemId}`),
	submit: (attemptId, data) => api.post(`/assessments/attempts/${attemptId}/submit`, data),
	// Admin
	adminAttempts: (params) => api.get('/assessments/admin/attempts', { params }),
	adminReview: (attemptId, data) => api.post(`/assessments/admin/attempts/${attemptId}/review`, data),
}
