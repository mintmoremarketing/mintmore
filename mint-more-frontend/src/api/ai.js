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

  // History
  getGenerations: (params) =>
    api.get('/ai/generations', { params }),

  getGeneration: (id) =>
    api.get(`/ai/generations/${id}`),

  // Usage
  getUsage: () =>
    api.get('/ai/usage'),

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
}
