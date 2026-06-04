import { api } from './client'

export const addonsApi = {
	plans: () => api.get('/addons/plans'),

	myAddons: () => api.get('/addons/my'),

	check: (feature) => api.get(`/addons/check/${feature}`),

	purchase: (plan_id) => api.post('/addons/purchase', { plan_id }),

	adminPlans: (params) => api.get('/addons/admin/plans', { params }),
	adminCreatePlan: (data) => api.post('/addons/admin/plans', data),
	adminUpdatePlan: (planId, data) => api.patch(`/addons/admin/plans/${planId}`, data),
}
