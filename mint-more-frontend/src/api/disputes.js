import { api } from './client'

export const disputesApi = {
  list: (params) => api.get('/disputes', { params }),
  get: (id) => api.get(`/disputes/${id}`),
  open: (jobId, data) => api.post(`/disputes/jobs/${jobId}`, data),
  message: (id, body) => api.post(`/disputes/${id}/messages`, { body }),
  resolve: (id, data) => api.patch(`/disputes/${id}/resolve`, data),
}
