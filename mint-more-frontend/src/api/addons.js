import { api } from './client'

export const addonsApi = {
	plans: () => api.get('/addons/plans'),

	myAddons: () => api.get('/addons/my'),

	check: (feature) => api.get(`/addons/check/${feature}`),

	purchase: (plan_id) => api.post('/addons/purchase', { plan_id }),
}
