import { api } from './client'

function normalizeUploadPayload(payload = {}) {
  if (typeof payload === 'string') {
    return { creative_url: payload }
  }
  const {
    creative_url,
    creativeUrl,
    media_type,
    mediaType,
    content_type,
    contentType,
    ...rest
  } = payload || {}

  const finalUrl = creative_url || creativeUrl || ''
  const finalMediaType = media_type || mediaType || content_type || contentType || 'image'

  return {
    ...rest,
    creative_url: finalUrl,
    media_type: finalMediaType,
    content_type: finalMediaType,
  }
}

export const creativeApi = {
  // ── Designer Endpoints ──
  // GET /creative/designer/social-queue
  getDesignerSocialQueue: () => api.get('/creative/designer/social-queue'),
  designerSocialQueue: () => api.get('/creative/designer/social-queue'),

  // PATCH /creative/designer/social-queue/:postId/upload
  uploadCreative: (postId, payload) =>
    api.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),
  uploadCreativeToSocialPost: (postId, payload) =>
    api.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),
  reuploadCreative: (postId, payload) =>
    api.patch(`/creative/designer/social-queue/${postId}/upload`, normalizeUploadPayload(payload)),

  // GET /creative/designer/tasks
  getDesignerTasks: () => api.get('/creative/designer/tasks'),
  designerTasks: () => api.get('/creative/designer/tasks'),

  // PATCH /creative/designer/tasks/:taskId
  updateDesignerTask: (taskId, payload) =>
    api.patch(`/creative/designer/tasks/${taskId}`, payload),

  // GET /creative/brands/:userId/context
  getBrandContext: (userId) => api.get(`/creative/brands/${userId}/context`),
  brandContext: (userId) => api.get(`/creative/brands/${userId}/context`),

  // ── Client Endpoints ──
  // POST /creative/calendar/complete
  completeCalendar: (_calendarIdOrData, payload = {}) => {
    const body = typeof _calendarIdOrData === 'object' && _calendarIdOrData !== null
      ? _calendarIdOrData
      : payload
    return api.post('/creative/calendar/complete', body)
  },

  // GET /creative/client/pending-review
  getClientPendingReview: () => api.get('/creative/client/pending-review'),
  clientPendingReview: () => api.get('/creative/client/pending-review'),
  getClientSocialPosts: (params) => {
    if (!params || params.status === 'pending_client_review' || params.status === 'in_review') {
      return api.get('/creative/client/pending-review')
    }
    return api.get('/creative/client/pending-review', { params })
  },

  // POST /creative/client/posts/:postId/approve
  clientApproveCreative: (postId) => api.post(`/creative/client/posts/${postId}/approve`),
  clientApprovePost: (postId) => api.post(`/creative/client/posts/${postId}/approve`),

  // POST /creative/client/posts/:postId/reject
  clientRejectCreative: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '')
    return api.post(`/creative/client/posts/${postId}/reject`, { reason })
  },
  clientRejectPost: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '')
    return api.post(`/creative/client/posts/${postId}/reject`, { reason })
  },

  // Client Calendar & Work
  calendar: (params) => api.get('/creative/calendar', { params }),
  selectEvent: (eventId, payload = {}) => api.post(`/creative/calendar/${eventId}/select`, payload),
  work: () => api.get('/creative/work'),
  createRequest: (payload) => api.post('/creative/requests', payload),
  cancelRequest: (requestId, payload = {}) => api.delete(`/creative/requests/${requestId}`, { data: payload }),
  cancelSelection: (selectionId, payload = {}) => api.delete(`/creative/selections/${selectionId}`, { data: payload }),

  // ── Admin Endpoints ──
  // GET /creative/admin/clients
  getAdminClients: () => api.get('/creative/admin/clients'),
  listAdminClients: () => api.get('/creative/admin/clients'),
  getAdminBrands: (params) => api.get('/admin/brands', { params }),

  // GET /creative/admin/designers
  getAdminDesigners: () => api.get('/creative/admin/designers'),
  listAdminDesigners: () => api.get('/creative/admin/designers'),

  // PATCH /creative/admin/clients/:clientId/assign-designer
  assignDesignerToClient: (clientId, designerIdOrPayload) => {
    const designer_id = typeof designerIdOrPayload === 'object' && designerIdOrPayload !== null
      ? designerIdOrPayload.designer_id
      : designerIdOrPayload
    return api.patch(`/creative/admin/clients/${clientId}/assign-designer`, { designer_id: designer_id ?? null })
  },
  assignClientDesigner: (clientId, designerIdOrPayload) => {
    const designer_id = typeof designerIdOrPayload === 'object' && designerIdOrPayload !== null
      ? designerIdOrPayload.designer_id
      : designerIdOrPayload
    return api.patch(`/creative/admin/clients/${clientId}/assign-designer`, { designer_id: designer_id ?? null })
  },

  // GET /creative/admin/review-queue
  getAdminPendingCreatives: () => api.get('/creative/admin/review-queue'),
  getAdminReviewQueue: () => api.get('/creative/admin/review-queue'),
  listAdminReviewQueue: () => api.get('/creative/admin/review-queue'),

  // Admin Review Dispatcher
  adminReviewCreative: (postId, { decision = 'approve', feedback = '', reason = '', ...rest } = {}) => {
    if (decision === 'reject') {
      return api.post(`/creative/admin/posts/${postId}/reject`, { reason: feedback || reason })
    }
    return api.post(`/creative/admin/posts/${postId}/approve`, rest)
  },

  // POST /creative/admin/posts/:postId/approve
  adminApproveCreative: (postId, payload = {}) => api.post(`/creative/admin/posts/${postId}/approve`, payload),
  adminApprovePost: (postId, payload = {}) => api.post(`/creative/admin/posts/${postId}/approve`, payload),

  // POST /creative/admin/posts/:postId/reject
  adminRejectCreative: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '')
    return api.post(`/creative/admin/posts/${postId}/reject`, { reason })
  },
  adminRejectPost: (postId, payload = {}) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '')
    return api.post(`/creative/admin/posts/${postId}/reject`, { reason })
  },

  // POST /creative/admin/direct-upload
  adminDirectUpload: (payload) => api.post('/creative/admin/direct-upload', payload),

  // Analytics & Admin Ops
  getCreativeAnalytics: (params) => api.get('/creative/admin/overview', { params }),
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

export default creativeApi
