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

export const useAuthStore = create((set) => ({
	user: saved.user || null,
	accessToken: saved.accessToken || null,
	refreshToken: saved.refreshToken || null,
	isAuthed: !!(saved.accessToken && saved.user),

	setAuth: (user, accessToken, refreshToken) => {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ user, accessToken, refreshToken })
		)
		set({ user, accessToken, refreshToken, isAuthed: true })
	},

	logout: () => {
		sessionStorage.removeItem(STORAGE_KEY)
		set({ user: null, accessToken: null, refreshToken: null, isAuthed: false })
	},
}))
