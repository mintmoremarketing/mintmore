import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { chatApi } from '../../api/chat'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Avatar from '../../components/ui/Avatar'
import Icon from '../../components/ui/Icon'
import { timeAgo } from '../../utils/format'

export default function Chat() {
	const role = useAuthStore(s => s.user?.role)
	const pushToast = useUIStore(s => s.pushToast)
	const queryClient = useQueryClient()
	const streamRef = useRef(null)
	const [params, setParams] = useSearchParams()
	const [draft, setDraft] = useState('')
	const [attachmentUrl, setAttachmentUrl] = useState('')
	const [showAttachment, setShowAttachment] = useState(false)
	const [search, setSearch] = useState('')

	const { data: rooms = [], isLoading: roomsLoading } = useQuery({
		queryKey: ['chat-rooms'],
		queryFn: () => chatApi.rooms().then(res => res.data?.data?.rooms || []),
		refetchInterval: 15_000,
	})
	const selectedId = params.get('room') || rooms.find(room => room.job_id === params.get('job'))?.id || rooms[0]?.id || ''
	const selectedRoom = rooms.find(room => room.id === selectedId)

	useEffect(() => {
		if (!params.get('room') && selectedId) setParams({ room: selectedId }, { replace: true })
	}, [selectedId, params, setParams])

	useEffect(() => {
		chatApi.online().catch(() => {})
		const offline = () => chatApi.offline().catch(() => {})
		window.addEventListener('beforeunload', offline)
		return () => {
			window.removeEventListener('beforeunload', offline)
			offline()
		}
	}, [])

	const { data: room } = useQuery({
		queryKey: ['chat-room', selectedId],
		queryFn: () => chatApi.room(selectedId).then(res => res.data?.data?.room),
		enabled: Boolean(selectedId),
	})
	const { data: messageData, isLoading: messagesLoading } = useQuery({
		queryKey: ['chat', selectedId],
		queryFn: () => chatApi.messages(selectedId, { limit: 100 }).then(res => res.data?.data),
		enabled: Boolean(selectedId),
		refetchInterval: 15_000,
	})
	const messages = messageData?.messages || []

	useEffect(() => {
		streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' })
	}, [messages.length, selectedId])

	const sendMutation = useMutation({
		mutationFn: () => chatApi.send(selectedId, { content: draft.trim(), attachment_url: attachmentUrl.trim() || undefined, attachment_type: attachmentUrl.trim() ? 'document' : undefined }),
		onSuccess: () => {
			setDraft('')
			setAttachmentUrl('')
			setShowAttachment(false)
			queryClient.invalidateQueries({ queryKey: ['chat', selectedId] })
			queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
		},
		onError: err => pushToast({ title: 'Message not sent', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const filteredRooms = useMemo(() => {
		const needle = search.trim().toLowerCase()
		if (!needle) return rooms
		return rooms.filter(item => [item.job_title, item.client_name, item.freelancer_name, item.last_message_preview].some(value => String(value || '').toLowerCase().includes(needle)))
	}, [rooms, search])

	const roomLabel = item => role === 'admin'
		? `${item.client_name} / ${item.freelancer_name}`
		: role === 'client'
			? item.mm_channel_name || 'Mint More creative'
			: item.client_name || 'Client'

	return (
		<div className="reveal chat-workspace" style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', minHeight: 'calc(100vh - 130px)', border: '1px solid var(--hairline)', background: 'var(--paper)' }}>
			<aside className="chat-room-list" style={{ borderRight: '1px solid var(--hairline)', minWidth: 0 }}>
				<div style={{ padding: 16, borderBottom: '1px solid var(--hairline)' }}>
					<div className="row between" style={{ marginBottom: 12 }}>
						<div>
							<div className="h-eyebrow">{role === 'admin' ? 'Admin' : 'Workspace'}</div>
							<h1 className="h-display h-2" style={{ margin: '4px 0 0' }}>{role === 'admin' ? 'All chats' : 'Messages'}</h1>
						</div>
						<span className="badge neutral">{rooms.length}</span>
					</div>
					<div style={{ position: 'relative' }}>
						<Icon name="search" size={13} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--ink-500)' }} />
						<input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" style={{ paddingLeft: 32 }} />
					</div>
				</div>
				<div style={{ maxHeight: 'calc(100vh - 245px)', overflowY: 'auto' }}>
					{roomsLoading ? <div className="muted" style={{ padding: 18 }}>Loading chats...</div> : filteredRooms.length === 0 ? (
						<div className="empty" style={{ border: 0, padding: 28 }}><h3>No chats yet</h3><p>Chats appear once a project begins.</p></div>
					) : filteredRooms.map(item => (
						<button
							key={item.id}
							onClick={() => setParams({ room: item.id })}
							style={{ width: '100%', padding: 14, border: 0, borderBottom: '1px solid var(--hairline)', background: selectedId === item.id ? 'var(--mint-50)' : 'transparent', textAlign: 'left', cursor: 'pointer' }}
						>
							<div className="row" style={{ gap: 10 }}>
								<Avatar name={roomLabel(item)} size="sm" />
								<div style={{ minWidth: 0, flex: 1 }}>
									<div className="row between" style={{ gap: 8 }}>
										<strong style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomLabel(item)}</strong>
										{Number(item.unread_count) > 0 && <span className="badge mint">{item.unread_count}</span>}
									</div>
									<div style={{ fontSize: 11.5, color: 'var(--ink-600)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.job_title}</div>
									<div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.last_message_preview || 'No messages yet'}</div>
								</div>
							</div>
						</button>
					))}
				</div>
			</aside>

			<section style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
				{!selectedId ? (
					<div className="empty" style={{ border: 0, margin: 'auto' }}><h3>Select a chat</h3></div>
				) : (
					<>
						<header className="row between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline)', gap: 14 }}>
							<div className="row" style={{ gap: 10, minWidth: 0 }}>
								<Avatar name={roomLabel(selectedRoom || {})} />
								<div style={{ minWidth: 0 }}>
									<strong style={{ fontSize: 13.5 }}>{roomLabel(selectedRoom || {})}</strong>
									<div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{room?.job_title || selectedRoom?.job_title}</div>
								</div>
							</div>
							<div className="row" style={{ gap: 7 }}>
								{room?.client_wa_number && <span className="badge mint"><Icon name="chat" size={10} /> WhatsApp connected</span>}
								{role === 'admin' && <span className="badge neutral"><Icon name="eye" size={10} /> Read only</span>}
							</div>
						</header>

						<div ref={streamRef} className="chat-stream" style={{ flex: 1, maxHeight: 'none', borderRadius: 0, minHeight: 420 }}>
							{messagesLoading ? <div className="muted">Loading messages...</div> : messages.length === 0 ? (
								<div className="empty" style={{ border: 0, margin: 'auto' }}><h3>Start the conversation</h3><p>Messages stay attached to this project.</p></div>
							) : messages.map(message => {
								const mine = message.sender_role === role
								const system = message.sender_role === 'system'
								const read = role === 'client' ? message.read_by_freelancer : message.read_by_client
								return (
									<div key={message.id} className={`bubble-row ${system ? 'system' : mine ? 'me' : 'them'}`}>
										<div className="bubble">
											{!mine && !system && <div className="who">{message.sender_name}</div>}
											<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}</div>
											{message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6 }}><Icon name="paperclip" size={11} /> Open attachment</a>}
											<span className="meta">{message.channel === 'whatsapp' ? 'WhatsApp · ' : ''}{timeAgo(message.created_at)}{mine ? ` · ${read ? 'Seen' : 'Sent'}` : ''}</span>
										</div>
									</div>
								)
							})}
						</div>

						{role !== 'admin' && (
							<form
								onSubmit={e => {
									e.preventDefault()
									if ((draft.trim() || attachmentUrl.trim()) && !sendMutation.isPending) sendMutation.mutate()
								}}
								style={{ padding: 14, borderTop: '1px solid var(--hairline)' }}
							>
								{showAttachment && <input className="input" value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="Paste a Mintbox file share link" style={{ marginBottom: 8 }} />}
								<div className="row" style={{ gap: 8 }}>
									<button className="icon-btn" type="button" onClick={() => setShowAttachment(value => !value)} title="Attach Mintbox link"><Icon name="paperclip" size={14} /></button>
									<textarea className="textarea" rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message..." style={{ resize: 'none' }} />
									<button className="btn primary" type="submit" disabled={(!draft.trim() && !attachmentUrl.trim()) || sendMutation.isPending} aria-label="Send message"><Icon name="send" size={14} /></button>
								</div>
							</form>
						)}
					</>
				)}
			</section>
		</div>
	)
}
