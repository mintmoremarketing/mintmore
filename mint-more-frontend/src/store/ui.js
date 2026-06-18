import { create } from 'zustand'

export const useUIStore = create((set) => ({
	// Toasts
	toasts: [],

	pushToast: (toast) => {
		const id = `t${Date.now()}${Math.random()}`
		set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
		}, 3600)
	},

	// Modals
	showTopUp: false,
	showNotif: false,
	setShowTopUp: (v) => set({ showTopUp: v }),
	setShowNotif: (v) => set({ showNotif: v }),

	// Notifications
	notifs: [],
	unreadCount: 0,

	addNotif: (notif) =>
		set((s) => ({
			notifs: [notif, ...s.notifs].slice(0, 50),
			unreadCount: s.unreadCount + 1,
		})),

	setNotifs: (notifs) => set({ notifs }),

	setUnreadCount: (n) => set({ unreadCount: n }),

	markAllNotifsRead: () => set({ unreadCount: 0, notifs: [] }),

	// AI progress
	aiProgress: {},

	setAIProgress: (generationId, status, data) =>
		set((s) => ({
			aiProgress: { ...s.aiProgress, [generationId]: { status, ...data } },
		})),

	clearAIProgress: (generationId) =>
		set((s) => {
			const next = { ...s.aiProgress }
			delete next[generationId]
			return { aiProgress: next }
		}),
}))
