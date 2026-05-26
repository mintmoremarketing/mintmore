import { create } from 'zustand'

export const useAuthStore = create((set) => ({
	user: null,
	accessToken: null,
	refreshToken: null,
	isAuthed: false,

	setAuth: (user, accessToken, refreshToken) =>
		set({ user, accessToken, refreshToken, isAuthed: true }),

	logout: () =>
		set({ user: null, accessToken: null, refreshToken: null, isAuthed: false }),
}))
