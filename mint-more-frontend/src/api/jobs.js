import { api } from './client'

export const jobsApi = {
	list: (params) => api.get('/jobs', { params }),
	get: (id) => api.get(`/jobs/${id}`),
	create: (data) => api.post('/jobs', data),
	draft: (data) => api.post('/jobs/draft', data),
	publish: (id) => api.patch(`/jobs/${id}/publish`),
	update: (id, d) => api.patch(`/jobs/${id}`, d),
	pauseMatching: (id) => api.patch(`/jobs/${id}/pause-matching`),
	cancel: (id) => api.patch(`/jobs/${id}/cancel`),
	categories: () => api.get('/categories'),
}
