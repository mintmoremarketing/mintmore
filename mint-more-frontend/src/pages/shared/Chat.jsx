import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { chatApi } from '../../api/chat'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Avatar from '../../components/ui/Avatar'
import Icon from '../../components/ui/Icon'
import { timeAgo } from '../../utils/format'
import { servicesApi } from '../../api/services'
import OrderConversation from '../../components/services/OrderConversation'
import OrderDetailsPane from '../../components/services/OrderDetailsPane'
import InlineBriefEditor from '../../components/services/InlineBriefEditor'
import RaiseIssueSheet from '../../components/support/RaiseIssueSheet'

const fileNameFromUrl = (url = '') => {
	try {
		const clean = String(url).split('?')[0]
		return decodeURIComponent(clean.split('/').filter(Boolean).pop() || 'Mintbox file')
	} catch {
		return 'Mintbox file'
	}
}

const DONE_STATUSES = ['completed', 'cancelled', 'closed']
const FILTERS = [
	{ key: 'all', label: 'All' },
	{ key: 'active', label: 'Active' },
	{ key: 'completed', label: 'Completed' },
]

const deliveryAction = (message) => {
	if (!message.attachment_url) return null
	if (message.sender_role === 'client') return 'shared a reference'
	if (message.sender_role === 'designer' || message.sender_role === 'freelancer') return 'shared a delivery'
	return 'shared a file'
}

// The details column's open/closed choice is remembered per browser.
const DETAILS_KEY = 'creatyv_chat_details'
const readColumnPref = () => { try { return localStorage.getItem(DETAILS_KEY) !== 'closed' } catch { return true } }
const isWide = () => window.matchMedia('(min-width: 1280px)').matches

/**
 * An order's chat inside the inbox, with the order's details in a column beside it.
 * Wide screens show the column and the Details button hides or shows it; narrower ones
 * slide it over the chat. Raise an issue opens a dispute that carries the order and chat.
 */
function RoomOrderConversation({ bookingId, role, title, onBack }) {
	const audience = role === 'client' ? 'client' : 'freelancer'
	const queryClient = useQueryClient()
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [column, setColumn] = useState(readColumnPref)
	const [issueOpen, setIssueOpen] = useState(false)
	const [editingBrief, setEditingBrief] = useState(false)
	const toggleDetails = () => {
		if (!isWide()) { setDetailsOpen(true); return }
		setColumn(prev => {
			try { localStorage.setItem(DETAILS_KEY, prev ? 'closed' : 'open') } catch { /* private mode */ }
			return !prev
		})
	}
	const queryKey = ['service-booking', audience, bookingId]
	const { data: booking } = useQuery({
		queryKey,
		queryFn: () => (audience === 'client' ? servicesApi.booking(bookingId) : servicesApi.workItem(bookingId)).then(res => res.data.data),
		refetchInterval: 20_000,
	})
	if (!booking) return <div className="m-auto text-sm text-ink-500">Loading conversation…</div>
	const counterpart = audience === 'client'
		? { name: booking.freelancer_name, avatar: booking.freelancer_avatar, label: 'Your freelancer' }
		: { name: booking.client_name, avatar: booking.client_avatar, label: 'Client' }
	const details = (
		<OrderDetailsPane booking={booking} snapshot={booking.snapshot || {}} isClient={audience === 'client'} counterpart={counterpart} onMessage={() => setDetailsOpen(false)} embedded />
	)
	return (
		<div className="relative flex min-h-0 flex-1">
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
		{editingBrief ? (
			<InlineBriefEditor booking={booking} onBack={() => setEditingBrief(false)} onSaved={() => setEditingBrief(false)} />
		) : <OrderConversation
			booking={booking}
			role={audience}
			counterpartName={counterpart.name}
			counterpartAvatar={counterpart.avatar}
			onChanged={() => queryClient.invalidateQueries({ queryKey })}
			className="h-full"
			briefNotice={audience === 'client' && !booking.brief_complete && !['completed', 'cancelled'].includes(booking.stage) ? (
				<div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
					<div className="min-w-0 flex-1"><div className="text-sm font-medium text-ink-900">Your full brief is incomplete</div><p className="mt-0.5 text-sm text-ink-600">Your progress is saved. Continue your brief so your freelancer has the details to get started.</p></div>
					<button type="button" onClick={() => setEditingBrief(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 text-sm font-medium text-white transition-transform hover:bg-ink-700 active:scale-[0.97]">Continue brief <Icon name="arrowRight" size={14} /></button>
				</div>
			) : null}
			header={(
				<header className="flex items-center gap-3 border-b border-ink-200 px-3 py-3 md:px-5">
					<button type="button" className="icon-btn md:hidden" aria-label="Back to conversations" onClick={onBack}>
						<Icon name="chevronLeft" size={18} />
					</button>
					<Avatar name={title || counterpart.name} />
					<div className="min-w-0 flex-1">
						<div className="truncate text-[17px] font-medium text-ink-900">{title || counterpart.name}</div>
						<div className="truncate text-sm text-ink-500">{booking.booking_number} · {booking.snapshot?.title}</div>
					</div>
					<button type="button" onClick={() => setIssueOpen(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-ink-600 transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-100 hover:text-ink-900 active:scale-[0.97]" title="Raise an issue with support">
						<Icon name="shield" size={15} /> <span className="hidden sm:inline">Raise an issue</span>
					</button>
					<button
						type="button"
						onClick={toggleDetails}
						aria-pressed={column}
						className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${column ? 'xl:border-ink-900 xl:bg-ink-900 xl:text-white xl:hover:bg-ink-700' : ''} border-ink-200 text-ink-800 hover:bg-ink-50`}
					>
						<Icon name="file" size={15} /> Details
					</button>
				</header>
			)}
		/>}
		</div>
		{/* Wide screens: the details stay open as a third column. */}
		{column && <aside className="detail-column hidden w-[340px] shrink-0 overflow-y-auto border-l border-ink-200 xl:block" aria-label="Order details">{details}</aside>}
		{issueOpen && <RaiseIssueSheet order={booking} role={audience} onClose={() => setIssueOpen(false)} />}
		{/* Narrower screens: the same details slide over the chat. */}
		{detailsOpen && (
			<div className="absolute inset-0 z-20 flex justify-end bg-black/30 xl:hidden" onClick={() => setDetailsOpen(false)}>
				<aside onClick={e => e.stopPropagation()} className="brief-sheet flex h-full w-full max-w-[380px] flex-col bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)]" aria-label="Order details">
					<div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
						<span className="text-[17px] font-medium text-ink-900">Order details</span>
						<button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details" className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"><Icon name="x" size={18} /></button>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">{details}</div>
				</aside>
			</div>
		)}
		</div>
	)
}

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
	const [chatSearch, setChatSearch] = useState('')
	const [filter, setFilter] = useState('all')
	const [editingPendingBrief, setEditingPendingBrief] = useState(false)
	const navigate = useNavigate()

	const { data: rooms = [], isLoading: roomsLoading } = useQuery({
		queryKey: ['chat-rooms'],
		queryFn: () => chatApi.rooms().then(res => res.data?.data?.rooms || []),
		refetchInterval: 60_000,
	})
	const { data: searchMessages = [] } = useQuery({
		queryKey: ['chat-search', search.trim()],
		queryFn: () => chatApi.search({ q: search.trim() }).then(res => res.data?.data?.messages || []),
		enabled: search.trim().length >= 2,
	})
	const searchedRoomIds = useMemo(() => new Set(searchMessages.map(item => item.room_id)), [searchMessages])
	const requestedJob = params.get('job')
	const selectedId = params.get('room') || rooms.find(room => room.job_id === requestedJob)?.id || (requestedJob ? '' : rooms[0]?.id || '')
	const selectedRoom = rooms.find(room => room.id === selectedId)
	const { data: pendingBooking } = useQuery({
		queryKey: ['pending-order-chat', requestedJob],
		queryFn: () => servicesApi.booking(requestedJob).then(res => res.data.data),
		enabled: role === 'client' && Boolean(requestedJob) && !selectedId,
		refetchInterval: 20_000,
	})

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
		refetchInterval: 60_000,
	})
	const messages = messageData?.messages || []
	const { data: chatSearchResults = [] } = useQuery({
		queryKey: ['chat-search-room', selectedId, chatSearch.trim()],
		queryFn: () => chatApi.search({ q: chatSearch.trim(), room_id: selectedId }).then(res => res.data?.data?.messages || []),
		enabled: Boolean(selectedId) && chatSearch.trim().length >= 2 && !selectedRoom?.booking_id,
	})

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
		return rooms.filter(item => {
			const done = DONE_STATUSES.includes(item.job_status)
			if ((filter === 'active' && done) || (filter === 'completed' && !done)) return false
			return !needle || [item.brief_title, item.job_title, item.client_name, item.freelancer_name, item.last_message_preview].some(value => String(value || '').toLowerCase().includes(needle)) || searchedRoomIds.has(item.id)
		})
	}, [rooms, search, filter, searchedRoomIds])

	// Rooms lead with what the client asked for in the brief, or the service until there is one.
	// Admins see who is talking to whom.
	const roomTitle = item => (role === 'admin' ? roomLabel(item) : item.brief_title || item.job_title || roomLabel(item))
	const roomSubtitle = item => (role === 'client' ? roomLabel(item) : item.job_title)
	const roomLabel = item => role === 'admin'
		? `${item.client_name} / ${item.freelancer_name}`
		: role === 'client'
			? item.freelancer_name || item.mm_channel_name || 'Your freelancer'
			: item.client_name || 'Client'

	const send = () => {
		if ((draft.trim() || attachmentUrl.trim()) && !sendMutation.isPending) sendMutation.mutate()
	}
	// Phones show one pane at a time: the list, or the chat once a conversation is picked.
	const chatOpen = Boolean(params.get('room') || params.get('job'))
	const canSend = Boolean(draft.trim() || attachmentUrl.trim()) && !sendMutation.isPending

	return (
		<div className="grid h-[calc(100dvh-64px-var(--bottom-nav-h,0px))] w-full grid-cols-1 bg-white font-store md:grid-cols-[320px_1fr]">
			<aside className={`${chatOpen ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-col border-r border-ink-200`}>
				<div className="px-4 pb-3 pt-5 md:px-5">
					<div className="flex items-center gap-2">
						<button type="button" onClick={() => navigate(-1)} className="grid h-8 w-8 place-items-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Back">
							<Icon name="arrowLeft" size={18} />
						</button>
						<h1 className="text-xl font-semibold tracking-tight text-ink-900">{role === 'admin' ? 'All chats' : 'Messages'}</h1>
					</div>
					<div className="relative mt-4">
						<Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
						<input
							className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-3 text-[15px] text-ink-900 placeholder:text-ink-500 transition-colors focus:border-ink-400 focus:outline-none"
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="What are you looking for?"
							aria-label="Search conversations"
						/>
					</div>
					<div className="mt-3 flex gap-2" role="tablist" aria-label="Filter conversations">
						{FILTERS.map(f => (
							<button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
								className={`h-8 rounded-full px-3.5 text-sm font-medium transition-colors ${filter === f.key ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'}`}>
								{f.label}
							</button>
						))}
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
					{roomsLoading ? (
						Array.from({ length: 3 }).map((_, i) => <div key={i} className="mx-2 my-2 h-16 animate-pulse rounded-xl bg-ink-100" />)
					) : filteredRooms.length === 0 ? (
						<div className="flex flex-col items-center px-3 py-12 text-center">
							<Icon name="chat" size={28} className="text-ink-300" />
							<div className="mt-3 font-medium text-ink-900">{search || filter !== 'all' ? 'No matches' : 'No conversations yet'}</div>
							<p className="mt-1 text-sm text-ink-500">{search || filter !== 'all' ? 'Try another name, service or filter.' : "You don't have any messages yet."}</p>
						</div>
					) : filteredRooms.map(item => {
						const active = selectedId === item.id
						const unread = Number(item.unread_count) > 0
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => setParams({ room: item.id })}
								aria-current={active ? 'true' : undefined}
								className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] ${active ? 'bg-ink-100' : 'hover:bg-ink-50'}`}
							>
								<Avatar name={roomTitle(item)} />
								<span className="min-w-0 flex-1">
									<span className="flex items-center justify-between gap-2">
										<span className={`truncate text-[15px] ${unread ? 'font-semibold' : 'font-medium'} text-ink-900`}>{roomTitle(item)}</span>
										{unread && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-mint-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">{item.unread_count}</span>}
									</span>
									<span className={`mt-0.5 block truncate text-sm ${unread ? 'text-ink-900' : 'text-ink-500'}`}>{item.last_message_preview || roomSubtitle(item) || 'No messages yet'}</span>
								</span>
							</button>
						)
					})}
				</div>
			</aside>

			<section className={`${chatOpen ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
				{selectedRoom?.booking_id && ['client', 'freelancer', 'designer'].includes(role) ? (
					<RoomOrderConversation key={selectedRoom.id} bookingId={selectedRoom.booking_id} role={role} title={roomTitle(selectedRoom)} onBack={() => setParams({})} />
				) : !selectedId && pendingBooking ? (
					<div className="flex min-h-0 flex-1 flex-col xl:flex-row">
						{editingPendingBrief ? (
							<InlineBriefEditor booking={pendingBooking} onBack={() => setEditingPendingBrief(false)} onSaved={() => setEditingPendingBrief(false)} />
						) : <div className="flex min-h-[280px] flex-1 flex-col">
							<header className="flex items-center gap-3 border-b border-ink-200 px-4 py-3">
								<button type="button" className="icon-btn md:hidden" aria-label="Back to conversations" onClick={() => setParams({})}><Icon name="chevronLeft" size={18} /></button>
								<span className="grid h-10 w-10 place-items-center rounded-full bg-ink-100 text-ink-600"><Icon name="clock" size={17} /></span>
								<div className="min-w-0"><div className="truncate text-[16px] font-medium text-ink-900">{pendingBooking.snapshot?.title || 'Your order'}</div><div className="text-sm text-ink-500">{pendingBooking.booking_number} · Finding your freelancer</div></div>
							</header>
							<div className="grid flex-1 place-items-center px-6 py-12 text-center">
								{pendingBooking.brief_complete ? (
									<div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="clock" size={21} /></span><h2 className="mt-4 text-lg font-medium text-ink-900">Your brief is saved</h2><p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-500">The order details are here while we find your freelancer. The conversation will open as soon as they’re assigned.</p></div>
								) : (
									<div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
										<span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-amber-700"><Icon name="file" size={20} /></span>
										<h2 className="mt-4 text-lg font-medium text-ink-900">Your full brief is incomplete</h2>
										<p className="mt-1 text-sm leading-relaxed text-ink-600">Your progress is saved. Add the remaining required details so your freelancer knows how to get started.</p>
										<button type="button" onClick={() => setEditingPendingBrief(true)} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white transition-transform hover:bg-ink-700 active:scale-[0.97]">Continue your brief <Icon name="arrowRight" size={16} /></button>
									</div>
								)}
							</div>
						</div>}
						<aside className="min-h-0 w-full overflow-y-auto border-t border-ink-200 xl:w-[360px] xl:border-l xl:border-t-0" aria-label="Order details">
							<OrderDetailsPane booking={pendingBooking} snapshot={pendingBooking.snapshot || {}} isClient counterpart={{ name: pendingBooking.freelancer_name, avatar: pendingBooking.freelancer_avatar, label: 'Your freelancer' }} embedded />
						</aside>
					</div>
				) : !selectedId ? (
					<div className="m-auto flex flex-col items-center px-6 text-center">
						<span className="grid h-14 w-14 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="chat" size={24} /></span>
						<div className="mt-4 text-lg font-semibold text-ink-900">Your inbox is empty—for now</div>
						<p className="mt-1 max-w-xs text-sm text-ink-500">{role === 'client' ? 'A chat opens as soon as a freelancer is assigned to your order.' : 'A chat opens here as soon as you are assigned an order.'}</p>
					</div>
				) : (
					<>
						<header className="flex items-center gap-3 border-b border-ink-200 px-3 py-3 md:px-5">
							<button type="button" className="icon-btn md:hidden" aria-label="Back to conversations" onClick={() => setParams({})}>
								<Icon name="chevronLeft" size={18} />
							</button>
							<Avatar name={roomTitle(selectedRoom || {})} />
							<div className="min-w-0 flex-1">
								<div className="truncate text-[17px] font-medium text-ink-900">{roomTitle(selectedRoom || {})}</div>
								<div className="truncate text-sm text-ink-500">{role === 'client' && !selectedRoom?.brief_title ? roomLabel(selectedRoom || {}) : room?.job_title || selectedRoom?.job_title}</div>
							</div>
							{room?.client_wa_number && <span className="hidden rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 sm:inline">WhatsApp connected</span>}
							{role === 'admin' && <span className="rounded-md bg-ink-100 px-2 py-1 text-xs font-medium text-ink-600">Read only</span>}
						</header>
						<div className="border-b border-ink-100 px-3 py-2 md:px-5"><div className="relative max-w-sm"><Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={chatSearch} onChange={event => setChatSearch(event.target.value)} placeholder="Search this chat" aria-label="Search this chat" className="h-9 w-full rounded-full border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-ink-400" /></div></div>

						<div ref={streamRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink-50/50 px-3 py-5 md:px-6">
							{chatSearch.trim().length >= 2 ? chatSearchResults.length ? chatSearchResults.map(result => <div key={result.id} className="mx-auto max-w-xl rounded-xl border border-ink-200 bg-white px-3 py-2.5"><div className="mb-1 text-xs text-ink-500">{result.sender_role} · {timeAgo(result.created_at)}</div><p className="whitespace-pre-wrap text-sm text-ink-900">{result.content}</p></div>) : <div className="py-12 text-center text-sm text-ink-500">No messages found.</div> : messagesLoading ? (
								<div className="text-sm text-ink-500">Loading messages…</div>
							) : messages.length === 0 ? (
								<div className="py-16 text-center">
									<div className="font-medium text-ink-900">Say hello</div>
									<p className="mt-1 text-sm text-ink-500">Share your references and instructions here. Files and feedback stay with this order.</p>
								</div>
							) : messages.map(message => {
								const mine = message.sender_role === role || (role === 'designer' && message.sender_role === 'freelancer')
								const system = message.sender_role === 'system'
								const read = role === 'client' ? message.read_by_freelancer : message.read_by_client
								const fileAction = deliveryAction(message)
								const meta = `${message.channel === 'whatsapp' ? 'WhatsApp · ' : ''}${timeAgo(message.created_at)}${mine ? ` · ${read ? 'Seen' : 'Sent'}` : ''}`
								if (system) {
									return (
										<div key={message.id} className="mx-auto max-w-md py-1 text-center text-[13px] text-ink-500">
											<span className="whitespace-pre-wrap">{message.content}</span>
											<span className="ml-1.5">· {timeAgo(message.created_at)}</span>
										</div>
									)
								}
								if (fileAction) {
									return (
										<div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
											<div className="w-[min(520px,88%)] rounded-2xl border border-ink-200 bg-white p-4">
												<div className="text-sm text-ink-500"><span className="font-medium text-ink-900">{mine ? 'You' : message.sender_name}</span> {fileAction}</div>
												<a href={message.attachment_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl bg-ink-50 p-3 transition-colors hover:bg-ink-100">
													<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-ink-700"><Icon name="file" size={18} /></span>
													<span className="min-w-0">
														<span className="block truncate font-medium text-ink-900">{fileNameFromUrl(message.attachment_url)}</span>
														<span className="text-sm text-ink-500">Open file</span>
													</span>
												</a>
												{message.content && <p className="mt-3 whitespace-pre-wrap text-[15px] text-ink-800 [overflow-wrap:anywhere]">{message.content}</p>}
												<div className="mt-3 text-xs text-ink-500">{meta}</div>
											</div>
										</div>
									)
								}
								return (
									<div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
										<div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-ink-900 text-white' : 'rounded-bl-md border border-ink-200 bg-white text-ink-900'}`}>
											{!mine && <div className="mb-0.5 text-[13px] font-medium text-ink-500">{message.sender_name}</div>}
											<div className="whitespace-pre-wrap text-[15px] [overflow-wrap:anywhere]">{message.content}</div>
											{message.attachment_url && (
												<a href={message.attachment_url} target="_blank" rel="noreferrer" className={`mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-2 ${mine ? 'text-white' : 'text-ink-900'}`}>
													<Icon name="paperclip" size={12} /> Open attachment
												</a>
											)}
											<div className={`mt-1 text-xs ${mine ? 'text-white/70' : 'text-ink-500'}`}>{meta}</div>
										</div>
									</div>
								)
							})}
						</div>

						{role !== 'admin' && (
							<form
								onSubmit={e => { e.preventDefault(); send() }}
								className="border-t border-ink-200 bg-white px-3 py-3 md:px-5"
							>
								{showAttachment && (
									<input
										className="mb-2 h-11 w-full rounded-xl border border-ink-200 px-3 text-[15px] placeholder:text-ink-500 focus:border-ink-400 focus:outline-none"
										value={attachmentUrl}
										onChange={e => setAttachmentUrl(e.target.value)}
										placeholder="Paste a Mintbox file share link"
										aria-label="Attachment link"
									/>
								)}
								<div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-white p-1.5 pl-2 transition-colors focus-within:border-ink-400">
									<button className="icon-btn shrink-0" type="button" onClick={() => setShowAttachment(value => !value)} aria-label="Attach a Mintbox link" aria-pressed={showAttachment}>
										<Icon name="paperclip" size={16} />
									</button>
									<textarea
										rows={1}
										value={draft}
										onChange={e => setDraft(e.target.value)}
										onKeyDown={e => {
											if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
										}}
										placeholder="Write a message"
										aria-label="Message"
										className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink-900 placeholder:text-ink-500 focus:outline-none [field-sizing:content]"
									/>
									<button
										type="submit"
										disabled={!canSend}
										aria-label="Send message"
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 disabled:opacity-30"
									>
										<Icon name="send" size={16} />
									</button>
								</div>
							</form>
						)}
					</>
				)}
			</section>
		</div>
	)
}
