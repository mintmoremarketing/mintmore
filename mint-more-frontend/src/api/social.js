import { api } from './client'

const BASE = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const socialApi = {
  // Accounts
  getAccounts: () =>
    api.get('/social/accounts'),

  disconnect: (id) =>
    api.delete(`/social/accounts/${id}`),

  disconnectAccount: (id) =>
    api.delete(`/social/accounts/${id}`),

  // OAuth — opens in same tab
  connectFacebook: (accessToken) => {
    window.location.href = `${BASE}/social/connect/facebook?token=${encodeURIComponent(accessToken)}`
  },

  connectInstagram: (accessToken) => {
    window.location.href = `${BASE}/social/connect/instagram?token=${encodeURIComponent(accessToken)}`
  },

  connectYouTube: (accessToken) => {
    window.location.href = `${BASE}/social/connect/youtube?token=${encodeURIComponent(accessToken)}`
  },

  // Posts
  listPosts:  (params) => api.get('/social/posts', { params }),
  getPost:    (id)     => api.get(`/social/posts/${id}`),
  createPost: (data)   => api.post('/social/posts', data),
  updatePost: (id, data) => api.patch(`/social/posts/${id}`, data),
  deletePost: (id) => api.delete(`/social/posts/${id}`),
  addMedia:   (id, data) => api.post(
    `/social/posts/${id}/media`,
    data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  ),
  publishPost:(id)       => api.post(`/social/posts/${id}/publish`),
  cancelPost: (id)     => api.post(`/social/posts/${id}/cancel`),
  getAnalytics:(id)    => api.get(`/social/posts/${id}/analytics`),
  getAnalyticsSummary: (params) => api.get('/social/analytics/summary', { params }),
  refreshFromMeta: () => api.post('/social/accounts/refresh'),
  syncAccounts:    () => api.post('/social/accounts/refresh'),
  getHealth: () => api.get('/social/health'),
  getMediaLibrary: () => api.get('/social/media-library'),

  // Calendar — posts grouped by date for a given month (YYYY-MM) or year (YYYY)
  getCalendarPosts: (month, year) => api.get('/social/calendar', { params: { month, year } }),
}
