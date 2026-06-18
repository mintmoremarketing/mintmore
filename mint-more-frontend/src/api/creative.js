import { api } from './client'

export const creativeApi = {
  calendar: (params) => api.get('/creative/calendar', { params }),
  selectEvent: (eventId, payload = {}) => api.post(`/creative/calendar/${eventId}/select`, payload),
  work: () => api.get('/creative/work'),
  createRequest: (payload) => api.post('/creative/requests', payload),
  designerTasks: () => api.get('/creative/designer/tasks'),
  updateDesignerTask: (taskId, payload) => api.patch(`/creative/designer/tasks/${taskId}`, payload),
  adminOverview: () => api.get('/creative/admin/overview'),
  eventSuggestions: (params) => api.get('/creative/admin/events/suggestions', { params }),
  createEvent: (payload) => api.post('/creative/admin/events', payload),
  updateEvent: (eventId, payload) => api.patch(`/creative/admin/events/${eventId}`, payload),
  deleteEvent: (eventId) => api.delete(`/creative/admin/events/${eventId}`),
  updateTask: (taskId, payload) => api.patch(`/creative/admin/tasks/${taskId}`, payload),
  approveRequest: (requestId, payload) => api.post(`/creative/admin/requests/${requestId}/approve`, payload),
  approveSelection: (selectionId, payload) => api.post(`/creative/admin/selections/${selectionId}/approve`, payload),
  rejectSelection: (selectionId, payload) => api.post(`/creative/admin/selections/${selectionId}/reject`, payload),
}
