import { api } from './client'

const BASE = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const socialApi = {
  // Accounts
  getAccounts: () =>
    api.get('/social/accounts'),

  disconnect: (id) =>
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
  addMedia:   (id, data) => api.post(
    `/social/posts/${id}/media`,
    data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  ),
  publishPost:(id)       => api.post(`/social/posts/${id}/publish`),
  cancelPost: (id)     => api.post(`/social/posts/${id}/cancel`),
  getAnalytics:(id)    => api.get(`/social/posts/${id}/analytics`),
  getAnalyticsSummary: (params) => api.get('/social/analytics/summary', { params }),
  getMediaLibrary: () => api.get('/social/media-library'),
}
