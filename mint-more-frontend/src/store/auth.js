import { create } from 'zustand'

const STORAGE_KEY = 'mm_auth'

function loadFromStorage() {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return {}
		const parsed = JSON.parse(raw)
		return parsed.isGuest ? {} : parsed
	} catch {
		return {}
	}
}

const saved = loadFromStorage()
export const useAuthStore = create((set) => ({
	user: saved.user || null,
	accessToken: saved.accessToken || null,
	refreshToken: saved.refreshToken || null,
	isGuest: Boolean(saved.isGuest),
	isAuthed: !!(saved.accessToken && saved.user),

	setAuth: (user, accessToken, refreshToken) => {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ user, accessToken, refreshToken, isGuest: false })
		)
		set({ user, accessToken, refreshToken, isGuest: false, isAuthed: true })
	},

	impersonate: (user, accessToken, refreshToken) => {
		// Save the current admin session
		const currentRaw = sessionStorage.getItem(STORAGE_KEY)
		if (currentRaw) {
			sessionStorage.setItem('mm_admin_auth', currentRaw)
		}
		
		// Set the new impersonated session
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ user, accessToken, refreshToken, isGuest: false })
		)
		set({ user, accessToken, refreshToken, isGuest: false, isAuthed: true })
	},

	stopImpersonating: () => {
		const adminRaw = sessionStorage.getItem('mm_admin_auth')
		if (adminRaw) {
			sessionStorage.setItem(STORAGE_KEY, adminRaw)
			sessionStorage.removeItem('mm_admin_auth')
			
			const parsed = JSON.parse(adminRaw)
			set({ 
				user: parsed.user, 
				accessToken: parsed.accessToken, 
				refreshToken: parsed.refreshToken, 
				isGuest: false, 
				isAuthed: true 
			})
		} else {
			// Fallback to logout if something went wrong
			sessionStorage.removeItem(STORAGE_KEY)
			set({ user: null, accessToken: null, refreshToken: null, isGuest: false, isAuthed: false })
		}
	},

	logout: () => {
		sessionStorage.removeItem(STORAGE_KEY)
		sessionStorage.removeItem('mm_admin_auth') // Clean up just in case
		set({ user: null, accessToken: null, refreshToken: null, isGuest: false, isAuthed: false })
	},
}))
