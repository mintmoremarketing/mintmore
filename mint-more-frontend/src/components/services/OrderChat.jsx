// LAUNCH-HIDDEN: replaced by OrderConversation (deliveries now live in the order conversation). Kept for reference.
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '../../api/chat'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { timeAgo } from '../../utils/format'

// Compact single-room chat for an order page. The full inbox stays at /chat.
export default function OrderChat({ roomId, role, counterpartName }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const streamRef = useRef(null)
	const [draft, setDraft] = useState('')

	const { data, isLoading } = useQuery({
		queryKey: ['chat', roomId],
		queryFn: () => chatApi.messages(roomId, { limit: 100 }).then(res => res.data?.data),
		enabled: Boolean(roomId),
		refetchInterval: 15_000,
	})
	const messages = data?.messages || []

	useEffect(() => {
		streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' })
	}, [messages.length])

	const send = useMutation({
		mutationFn: () => chatApi.send(roomId, { content: draft.trim() }),
		onSuccess: () => {
			setDraft('')
			queryClient.invalidateQueries({ queryKey: ['chat', roomId] })
			queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
		},
		onError: err => pushToast({ title: 'Message not sent', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	if (!roomId) {
		return (
			<div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
				The order chat opens as soon as a freelancer is assigned.
			</div>
		)
	}

	return (
		<div className="flex flex-col rounded-2xl border border-ink-200 bg-white overflow-hidden">
			<div ref={streamRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-ink-50/40" style={{ minHeight: 320, maxHeight: 460 }}>
				{isLoading ? (
					<div className="text-sm text-ink-500">Loading messages…</div>
				) : messages.length === 0 ? (
					<div className="text-sm text-ink-500 text-center py-10">No messages yet. Say hello and share your references.</div>
				) : messages.map(message => {
					const system = message.sender_role === 'system'
					const mine = message.sender_role === role
					if (system) {
						return (
							<div key={message.id} className="mx-auto max-w-[92%] rounded-xl bg-white border border-ink-200 px-4 py-3 text-[12.5px] text-ink-700 whitespace-pre-wrap">
								<div className="text-[11px] font-bold uppercase tracking-wider text-mint-500 mb-1">Order update</div>
								{message.content}
							</div>
						)
					}
					return (
						<div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
							<div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'bg-mint-500 text-white rounded-br-md' : 'bg-white border border-ink-200 text-ink-900 rounded-bl-md'}`}>
								{!mine && <div className="text-[11px] font-bold text-ink-500 mb-0.5">{message.sender_name || counterpartName}</div>}
								<div className="whitespace-pre-wrap break-words">{message.content}</div>
								{message.attachment_url && (
									<a href={message.attachment_url} target="_blank" rel="noreferrer" className={`mt-1 inline-flex items-center gap-1 text-xs underline ${mine ? 'text-white' : 'text-mint-600'}`}>
										<Icon name="paperclip" size={11} /> Attachment
									</a>
								)}
								<div className={`mt-1 text-[11px] ${mine ? 'text-white/75' : 'text-ink-400'}`}>{timeAgo(message.created_at)}</div>
							</div>
						</div>
					)
				})}
			</div>
			<form
				className="flex items-end gap-2 p-3 border-t border-ink-100"
				onSubmit={e => {
					e.preventDefault()
					if (draft.trim() && !send.isPending) send.mutate()
				}}
			>
				<textarea
					rows={2}
					value={draft}
					onChange={e => setDraft(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault()
							if (draft.trim() && !send.isPending) send.mutate()
						}
					}}
					placeholder={`Message ${counterpartName || ''}…`}
					className="flex-1 resize-none rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:border-mint-400"
				/>
				<button type="submit" disabled={!draft.trim() || send.isPending} className="btn primary" aria-label="Send message">
					<Icon name="send" size={14} />
				</button>
			</form>
		</div>
	)
}
