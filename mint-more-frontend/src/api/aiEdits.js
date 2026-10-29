import { api } from './client'

export const aiEditsApi = {
	list: () => api.get('/ai-edits'),
	create: (data) => api.post('/ai-edits', data),
	get: (id) => api.get(`/ai-edits/${id}`),
	pay: (id) => api.post(`/ai-edits/${id}/pay`),
	verify: (id, data) => api.post(`/ai-edits/${id}/verify`, data),
	connect: (id, data) => api.post(`/ai-edits/${id}/connect`, data),
}
