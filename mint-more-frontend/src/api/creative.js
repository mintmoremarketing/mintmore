import { api } from './client'

export const creativeApi = {
  calendar: (params) => api.get('/creative/calendar', { params }),
  selectEvent: (eventId, payload = {}) => api.post(`/creative/calendar/${eventId}/select`, payload),
  work: () => api.get('/creative/work'),
  createRequest: (payload) => api.post('/creative/requests', payload),
  cancelRequest: (requestId, payload = {}) => api.delete(`/creative/requests/${requestId}`, { data: payload }),
  cancelSelection: (selectionId, payload = {}) => api.delete(`/creative/selections/${selectionId}`, { data: payload }),
  designerTasks: () => api.get('/creative/designer/tasks'),
  updateDesignerTask: (taskId, payload) => api.patch(`/creative/designer/tasks/${taskId}`, payload),
  brandContext: (userId) => api.get(`/creative/brands/${userId}/context`),
  adminOverview: () => api.get('/creative/admin/overview'),
  eventSuggestions: (params) => api.get('/creative/admin/events/suggestions', { params }),
  createEvent: (payload) => api.post('/creative/admin/events', payload),
  updateEvent: (eventId, payload) => api.patch(`/creative/admin/events/${eventId}`, payload),
  deleteEvent: (eventId) => api.delete(`/creative/admin/events/${eventId}`),
  syncTaskSheet: () => api.post('/creative/admin/tasks/sync-sheet'),
  updateTask: (taskId, payload) => api.patch(`/creative/admin/tasks/${taskId}`, payload),
  approveRequest: (requestId, payload) => api.post(`/creative/admin/requests/${requestId}/approve`, payload),
  rejectRequest: (requestId, payload) => api.post(`/creative/admin/requests/${requestId}/reject`, payload),
  approveSelection: (selectionId, payload) => api.post(`/creative/admin/selections/${selectionId}/approve`, payload),
  rejectSelection: (selectionId, payload) => api.post(`/creative/admin/selections/${selectionId}/reject`, payload),
}
