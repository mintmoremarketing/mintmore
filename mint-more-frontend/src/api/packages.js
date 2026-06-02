import { api } from './client'

export const packagesApi = {
	getMyPackages: () => api.get('/packages'),

	upsert: (data) => api.put('/packages', data),

	remove: (packageType) => api.delete(`/packages/${packageType}`),

	getFreelancerPackages: (freelancerId) =>
		api
			.get(`/freelancers/${freelancerId}`)
			.then((r) => r.data.data?.profile?.packages || []),
}
