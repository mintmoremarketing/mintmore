import { api } from './client'

export const aiApi = {
  // Models
  getModels: () =>
    api.get('/ai/models'),

  getEngineModels: (params) =>
    api.get('/ai/engine/models', { params }),

  getStylePresets: () =>
    api.get('/ai/engine/styles'),

  uploadReference: (formData) =>
    api.post('/ai/engine/references', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Generate
  generate: (data) =>
    api.post('/ai/generate', data),

  generateEngineImage: (data) =>
    api.post('/ai/engine/image/generate', data),

  generateEngineVideo: (data) =>
    api.post('/ai/engine/video/generate', data),

  // History
  getGenerations: (params) =>
    api.get('/ai/generations', { params }),

  getPublishedPosts: (params) =>
    api.get('/ai/published-posts', { params }),

  getGeneration: (id) =>
    api.get(`/ai/generations/${id}`),

  favoriteGeneration: (id, is_favorite) =>
    api.patch(`/ai/generations/${id}/favorite`, { is_favorite }),

  deleteGeneration: (id) =>
    api.delete(`/ai/generations/${id}`),

  deleteGenerations: (generation_ids) =>
    api.delete('/ai/generations', { data: { generation_ids } }),

  deletePublishedPost: (id) =>
    api.delete(`/ai/published-posts/${id}`),

  publishGeneration: (id, data) =>
    api.post(`/ai/generations/${id}/publish`, data),

  // Usage
  getUsage: (params) =>
    api.get('/ai/usage', { params }),

  // Admin
  adminStats: () =>
    api.get('/ai/admin/stats'),

  adminModelStats: (modelId) =>
    api.get(`/ai/admin/models/${modelId}/stats`),

  browseOpenRouter: (params) =>
    api.get('/ai/admin/openrouter/browse', { params }),

  addModel: (data) =>
    api.post('/ai/admin/models', data),

  updateModel: (modelId, data) =>
    api.patch(`/ai/admin/models/${modelId}`, data),

  toggleModel: (modelId) =>
    api.patch(`/ai/admin/models/${modelId}/toggle`),

  deleteModel: (modelId) =>
    api.delete(`/ai/admin/models/${modelId}`),

  syncOpenRouter: () =>
    api.post('/ai/admin/openrouter/sync'),
}
