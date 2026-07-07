import axios from 'axios'
import { useAuthStore } from '../store/auth'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const api = axios.create({
	baseURL: BASE,
	headers: { 'Content-Type': 'application/json' },
})

const TOKEN_REFRESH_SKEW_MS = 60_000

const decodeJwtPayload = (token) => {
	try {
		const [, payload] = String(token || '').split('.')
		if (!payload) return null
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
		const json = decodeURIComponent(
			atob(normalized)
				.split('')
				.map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
				.join('')
		)
		return JSON.parse(json)
	} catch {
		return null
	}
}

export const getTokenExpiryMs = (token) => {
	const payload = decodeJwtPayload(token)
	return payload?.exp ? payload.exp * 1000 : null
}

const isTokenExpiringSoon = (token) => {
	const expiry = getTokenExpiryMs(token)
	if (!expiry) return false
	return expiry - Date.now() <= TOKEN_REFRESH_SKEW_MS
}

let refreshPromise = null

const isRefreshAuthFailure = (err) => {
	const status = err?.response?.status
	return status === 400 || status === 401 || status === 403
}

const isPublicAuthRoute = (url = '') => {
	const path = String(url)
	return ['/auth/login', '/auth/register', '/auth/refresh'].some((route) => path.includes(route))
}

export const refreshAccessToken = async () => {
	if (refreshPromise) return refreshPromise

	refreshPromise = (async () => {
		const { refreshToken, setAuth, user } = useAuthStore.getState()
		if (!refreshToken) {
			throw new Error('No refresh token')
		}

		const { data } = await axios.post(`${BASE}/auth/refresh`, {
			refresh_token: refreshToken,
		})

		const newAccess = data.data.accessToken
		const newRefresh = data.data.refreshToken
		setAuth(user, newAccess, newRefresh)
		return newAccess
	})()

	try {
		return await refreshPromise
	} finally {
		refreshPromise = null
	}
}

export const getValidAccessToken = async ({ force = false } = {}) => {
	const token = useAuthStore.getState().accessToken
	if (!token) return null
	if (force || isTokenExpiringSoon(token)) {
		return refreshAccessToken()
	}
	return token
}

api.interceptors.request.use(async (config) => {
	const token = isPublicAuthRoute(config.url) ? null : await getValidAccessToken()
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
	if (err.response?.status !== 401 || original?._retry || isPublicAuthRoute(original?.url)) return false
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
				const newAccess = await refreshAccessToken()
				queue.forEach((p) => p.resolve(newAccess))
				queue = []

				original.headers = original.headers || {}
				original.headers.Authorization = `Bearer ${newAccess}`
				return api(original)
			} catch (refreshErr) {
				queue.forEach((p) => p.reject(refreshErr))
				queue = []
				if (isRefreshAuthFailure(refreshErr) || refreshErr.message === 'No refresh token') {
					useAuthStore.getState().logout()
					window.location.href = '/login'
				}
				return Promise.reject(refreshErr)
			} finally {
				refreshing = false
			}
		}
		return Promise.reject(err)
	}
)
