import { create } from 'zustand'

const STORAGE_KEY = 'mm_auth'

function loadFromStorage() {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return {}
		return JSON.parse(raw)
	} catch {
		return {}
	}
}

const saved = loadFromStorage()
const DEMO_USER = {
	id: 'demo-client',
	full_name: 'Demo Business',
	email: 'demo@mintmore.local',
	role: 'client',
	is_approved: true,
	kyc_level: 0,
}

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

	enterDemo: () => {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user: DEMO_USER, isGuest: true }))
		set({
			user: DEMO_USER,
			accessToken: null,
			refreshToken: null,
			isGuest: true,
			isAuthed: false,
		})
	},

	logout: () => {
		sessionStorage.removeItem(STORAGE_KEY)
		set({ user: null, accessToken: null, refreshToken: null, isGuest: false, isAuthed: false })
	},
}))
