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

	logout: () => {
		sessionStorage.removeItem(STORAGE_KEY)
		set({ user: null, accessToken: null, refreshToken: null, isGuest: false, isAuthed: false })
	},
}))
