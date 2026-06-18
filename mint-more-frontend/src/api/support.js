import { api } from './client'

export const supportApi = {
  list: (params) => api.get('/support', { params }),
  get: (ticketId) => api.get(`/support/${ticketId}`),
  create: (payload) => api.post('/support', payload),
  message: (ticketId, body) => api.post(`/support/${ticketId}/messages`, { body }),
  update: (ticketId, payload) => api.patch(`/support/${ticketId}`, payload),
}
