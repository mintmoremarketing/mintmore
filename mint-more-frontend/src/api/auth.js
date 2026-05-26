import { api } from './client'

export const authApi = {
	login: (email, password) => api.post('/auth/login', { email, password }),
	register: (data) => api.post('/auth/register', data),
	logout: () => api.post('/auth/logout'),
	me: () => api.get('/auth/me'),
}
