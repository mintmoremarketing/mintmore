import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../api/chat'

/** Unread chat messages across rooms. Shares the Chat page's room list cache. */
export function useChatUnread(enabled = true) {
	const { data: rooms = [] } = useQuery({
		queryKey: ['chat-rooms'],
		queryFn: () => chatApi.rooms().then(res => res.data?.data?.rooms || []),
		refetchInterval: 60_000,
		enabled,
	})
	return rooms.reduce((sum, room) => sum + Number(room.unread_count || 0), 0)
}
