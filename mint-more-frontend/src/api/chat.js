import { api } from './client'

export const chatApi = {
	rooms: () => api.get('/chat/rooms'),
	search: (params) => api.get('/chat/search', { params }),
	room: (roomId) => api.get(`/chat/rooms/${roomId}`),
	messages: (roomId, params) => api.get(`/chat/rooms/${roomId}/messages`, { params }),
	send: (roomId, data) => api.post(`/chat/rooms/${roomId}/messages`, data),
	edit: (messageId, content) => api.patch(`/chat/messages/${messageId}`, { content }),
	markDelivered:() => api.post('/chat/delivered'),
	online: () => api.post('/chat/presence/online'),
	offline: () => api.post('/chat/presence/offline'),
	moderate: (roomId, data) => api.post(`/chat/admin/rooms/${roomId}/moderation`, data),
	moderationHistory: (roomId) => api.get(`/chat/admin/rooms/${roomId}/moderation`),
}
