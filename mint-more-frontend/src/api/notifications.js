import { api } from './client'

export const notificationsApi = {
	list: (params) => api.get('/notifications', { params }),
	unreadCount: () => api.get('/notifications/unread-count'),
	markRead: (id) => api.patch(`/notifications/${id}/read`),
	markAllRead: () => api.patch('/notifications/read-all'),
}
