import { api } from './client'

export const commerceApi = {
  entitlements: () => api.get('/commerce/entitlements/me'),
  credits: () => api.get('/commerce/credits/me'),
  membership: () => api.get('/commerce/membership/me'),
  checkout: (payload) => api.post('/commerce/membership/checkout', payload),
  verify: (payload) => api.post('/commerce/membership/verify', payload),
  pause: () => api.post('/commerce/membership/pause'),
  adminSettings: () => api.get('/commerce/admin/settings'),
  updateSetting: (key, value) => api.put(`/commerce/admin/settings/${encodeURIComponent(key)}`, { value }),
  audit: (params) => api.get('/commerce/admin/audit', { params }),
  getTiers: () => api.get('/commerce/tiers'),
  createTier: (payload) => api.post('/commerce/admin/tiers', payload),
  updateTier: (id, payload) => api.put(`/commerce/admin/tiers/${id}`, payload),
  deleteTier: (id) => api.delete(`/commerce/admin/tiers/${id}`),
}
