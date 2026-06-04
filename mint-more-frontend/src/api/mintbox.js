import { api } from './client'

export const mintboxApi = {
	getFolders: () => api.get('/mintbox'),
	getJobFolder: (jobId) => api.get(`/mintbox/jobs/${jobId}`),
	getSharedFolder: (token) => api.get(`/mintbox/share/${token}`),
	uploadWork: (jobId, formData) => api.post(`/mintbox/jobs/${jobId}/files`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	}),
	reviewFile: (fileId, data) => api.patch(`/mintbox/files/${fileId}/review`, data),
}
