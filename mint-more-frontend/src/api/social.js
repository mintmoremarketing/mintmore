import { api } from './client'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

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

  connectYouTube: (accessToken) => {
    window.location.href = `${BASE}/social/connect/youtube?token=${encodeURIComponent(accessToken)}`
  },

  // Posts
  listPosts:  (params) => api.get('/social/posts', { params }),
  getPost:    (id)     => api.get(`/social/posts/${id}`),
  createPost: (data)   => api.post('/social/posts', data),
  addMedia:   (id, fd) => api.post(`/social/posts/${id}/media`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  publishPost:(id, data) => api.post(`/social/posts/${id}/publish`, data),
  cancelPost: (id)     => api.post(`/social/posts/${id}/cancel`),
  getAnalytics:(id)    => api.get(`/social/posts/${id}/analytics`),
}