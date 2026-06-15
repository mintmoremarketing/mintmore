import axios from 'axios'
import { useAuthStore } from '../store/auth'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const api = axios.create({
	baseURL: BASE,
	headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
	const token = useAuthStore.getState().accessToken
	if (token) config.headers.Authorization = `Bearer ${token}`
	return config
})

let refreshing = false
let queue = []

const AUTH_FAILURE_MESSAGES = [
	'access token expired',
	'invalid access token',
	'authorization header missing or malformed',
	'token not provided',
	'token has been revoked',
	'not authenticated',
]

const shouldRefreshAccessToken = (err, original) => {
	if (err.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/')) return false
	const message = String(err.response?.data?.message || '').toLowerCase()
	return AUTH_FAILURE_MESSAGES.some((candidate) => message.includes(candidate))
}

api.interceptors.response.use(
	(res) => res,
	async (err) => {
		const original = err.config
		if (shouldRefreshAccessToken(err, original)) {
			if (refreshing) {
				return new Promise((resolve, reject) => {
					queue.push({ resolve, reject })
				}).then((token) => {
					original.headers.Authorization = `Bearer ${token}`
					return api(original)
				})
			}

			original._retry = true
			refreshing = true

			try {
				const { refreshToken, setAuth } = useAuthStore.getState()
				if (!refreshToken) throw new Error('No refresh token')

				const { data } = await axios.post(`${BASE}/auth/refresh`, {
					refresh_token: refreshToken,
				})

				const newAccess = data.data.accessToken
				const newRefresh = data.data.refreshToken

				setAuth(useAuthStore.getState().user, newAccess, newRefresh)
				queue.forEach((p) => p.resolve(newAccess))
				queue = []

				original.headers = original.headers || {}
				original.headers.Authorization = `Bearer ${newAccess}`
				return api(original)
			} catch (refreshErr) {
				queue.forEach((p) => p.reject(refreshErr))
				queue = []
				useAuthStore.getState().logout()
				window.location.href = '/login'
				return Promise.reject(refreshErr)
			} finally {
				refreshing = false
			}
		}
		return Promise.reject(err)
	}
)
