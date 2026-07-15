import { api } from './client'
import { supabase } from './supabase'

export const authApi = {
	login: (email, password) => api.post('/auth/login', { email, password }),
	register: (data) => api.post('/auth/register', data),
	logout: () => api.post('/auth/logout'),
	me: () => api.get('/auth/me'),
	resetPassword: (email, newPassword) => api.post('/auth/reset-password', { email, newPassword }),
	socialLogin: (provider) => supabase.auth.signInWithOAuth({ 
		provider, 
		options: { redirectTo: window.location.origin + '/auth/callback' } 
	})
}
