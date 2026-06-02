import { api } from './client'

export const negotiationsApi = {
	getStatus: (jobId) => api.get(`/negotiations/jobs/${jobId}/status`),

	clientRespond: (jobId, data) =>
		api.patch(`/negotiations/jobs/${jobId}/client-respond`, data),

	initiate: (jobId, data) =>
		api.post(`/negotiations/jobs/${jobId}/initiate`, data),

	freelancerRespond: (jobId, data) =>
		api.patch(`/negotiations/jobs/${jobId}/freelancer-respond`, data),

	assignmentRespond: (jobId, action) =>
		api.patch(`/negotiations/jobs/${jobId}/assignment-respond`, { action }),

	pendingApprovals: () => api.get('/negotiations/admin/pending-approvals'),

	approveDeal: (jobId, admin_note) =>
		api.post(`/negotiations/admin/jobs/${jobId}/approve-deal`, { admin_note }),

	rejectDeal: (jobId, admin_note) =>
		api.post(`/negotiations/admin/jobs/${jobId}/reject-deal`, { admin_note }),
}
