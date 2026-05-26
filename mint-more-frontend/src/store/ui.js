import { create } from 'zustand'

export const useUIStore = create((set) => ({
	toasts: [],
	showTopUp: false,
	showNotif: false,

	pushToast: (toast) => {
		const id = `t${Date.now()}${Math.random()}`
		set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
		}, 3600)
	},

	setShowTopUp: (v) => set({ showTopUp: v }),
	setShowNotif: (v) => set({ showNotif: v }),
}))
