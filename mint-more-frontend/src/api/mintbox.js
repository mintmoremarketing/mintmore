import { api } from './client'

export const mintboxApi = {
	getFolders: () => api.get('/mintbox'),
	getJobFolder: (jobId) => api.get(`/mintbox/jobs/${jobId}`),
	markSeen: (jobId) => api.patch(`/mintbox/jobs/${jobId}/seen`),
	getSharedFolder: (token) => api.get(`/mintbox/share/${token}`),
	prepareUpload: (jobId, data) => api.post(`/mintbox/jobs/${jobId}/uploads/prepare`, data),
	completeUpload: (uploadId) => api.post(`/mintbox/uploads/${uploadId}/complete`),
	cancelUpload: (uploadId) => api.delete(`/mintbox/uploads/${uploadId}`),
	reviewFile: (fileId, data) => api.patch(`/mintbox/files/${fileId}/review`, data),
}
