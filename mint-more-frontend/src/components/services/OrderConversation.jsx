import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { chatApi } from '../../api/chat'
import { mintboxApi } from '../../api/mintbox'
import { uploadMintboxFile } from '../../utils/mintboxUpload'
import { useUIStore } from '../../store/ui'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import ConversationComposer from './ConversationComposer'

const RATING_FIELDS = [
	['rating_quality', 'Quality of work'],
	['rating_communication', 'Communication'],
	['timeliness_rating', 'Timeliness'],
	['brief_adherence_rating', 'Followed the brief'],
]

const contentUrl = token => `${api.defaults.baseURL}/mintbox/public/files/${token}/content`
const clock = value => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
const dayLabel = (value) => {
	const date = new Date(value)
	const today = new Date()
	const yesterday = new Date(today)
	yesterday.setDate(today.getDate() - 1)
	if (date.toDateString() === today.toDateString()) return 'Today'
	if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}
const formatSize = (bytes) => {
	const value = Number(bytes || 0)
	if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
	if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
	return `${Math.max(1, Math.round(value / 1024))} KB`
}
const kindOf = mime => {
	const type = String(mime || '').split('/')[0]
	return ['image', 'video', 'audio'].includes(type) ? type : 'document'
}

/**
 * Message receipt, like WhatsApp: one grey tick = sent, two grey = reached
 * their app, two blue = they opened the chat. Pending uploads show a clock.
 */
function Ticks({ state }) {
	if (state === 'pending') return <Icon name="clock" size={13} className="text-black/40" />
	const color = state === 'read' ? 'text-[#3497f9]' : 'text-black/40'
	const label = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : 'Sent'
	return (
		<svg viewBox="0 0 18 12" width="17" height="12" className={color} role="img" aria-label={label}>
			<title>{label}</title>
			<path d="M1 6.5 4.3 10 11 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
			{state !== 'sent' && <path d="M7.4 9.6 8 10 14.7 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
		</svg>
	)
}

const receiptOf = (message, role) => {
	const other = role === 'client' ? 'freelancer' : 'client'
	if (message[`read_by_${other}`]) return 'read'
	if (message[`delivered_at_${other}`]) return 'delivered'
	return 'sent'
}

// A delivery under review is a preview: no download, picture-in-picture or save-as from the
// player. This is friction, not protection; the clean file should unlock only on approval.
const blockMenu = (event) => event.preventDefault()

function FileBody({ kind, src, name, size, poster, preview = false }) {
	if (preview && kind === 'image' && src) {
		return <img src={src} alt={name} loading="lazy" draggable={false} onContextMenu={blockMenu} className="max-h-80 w-full select-none rounded-md bg-black/5 object-cover" />
	}
	if (preview && kind === 'video' && src) {
		return <video src={src} poster={poster} controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={blockMenu} preload="metadata" className="max-h-80 w-full rounded-md bg-black" />
	}
	if (kind === 'image' && src) {
		return (
			<a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-black/5">
				<img src={src} alt={name} loading="lazy" className="max-h-80 w-full object-cover" />
			</a>
		)
	}
	if (kind === 'video' && src) return <video src={src} poster={poster} controls preload="metadata" className="max-h-80 w-full rounded-md bg-black" />
	if (kind === 'audio' && src) return <audio src={src} controls className="w-64 max-w-full" />
	const ext = String(name || '').split('.').pop()
	return (
		<a href={src || undefined} target="_blank" rel="noreferrer" className="block">
			<span className="flex items-center gap-2 rounded-md bg-[rgba(118,118,128,0.12)] px-2 py-1.5 transition-colors hover:bg-[rgba(118,118,128,0.18)]">
				<span className="grid h-[27px] w-[22px] shrink-0 place-items-center rounded-[2px] bg-white text-[#007aff] shadow-[0_0_0_0.4px_#d1d1d6]"><Icon name="file" size={13} /></span>
				<span className="min-w-0 truncate text-[16px] text-black/70">{name}</span>
			</span>
			<span className="mt-1 block px-1 text-[11px] text-black/45">{size ? formatSize(size) : 'File'}{ext && ext !== name ? ` · ${ext}` : ''}</span>
		</a>
	)
}

const DELIVERY_STATUS = {
	submitted: { label: 'Awaiting review', cls: 'bg-amber-50 text-amber-700' },
	approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
	revision_requested: { label: 'Revision requested', cls: 'bg-violet-50 text-violet-700' },
}

const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000

/** True while the sender may still edit this message: own text or caption, within 2 hours. */
const canEdit = (m, mine) => mine && m.sender_role !== 'system'
	&& !(m.file_id && m.file_purpose === 'delivery' && m.sender_role === 'client')
	&& (m.content || '').trim().length > 0
	&& Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS

/** Right-click on desktop, long-press on phones: opens the message menu at the pointer. */
function useMessageMenu(onOpen) {
	const timer = useRef(null)
	if (!onOpen) return {}
	const clear = () => clearTimeout(timer.current)
	return {
		onContextMenu: e => {
			e.preventDefault()
			clear()
			// Android long-press fires contextmenu too; treat any coarse pointer as touch.
			onOpen(e.clientX, e.clientY, e.nativeEvent.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches)
		},
		onTouchStart: e => {
			const { clientX, clientY } = e.touches[0]
			clear()
			timer.current = setTimeout(() => onOpen(clientX, clientY, true), 450)
		},
		onTouchMove: clear,
		onTouchEnd: clear,
	}
}

/** The little curl on the last bubble of a run, as in WhatsApp. */
function Tail({ mine }) {
	return (
		<svg viewBox="0 0 8 13" width="8" height="13" aria-hidden="true" className={`absolute bottom-0 ${mine ? '-right-[7px] text-[#dcf7c5]' : '-left-[7px] -scale-x-100 text-[#fafafa]'}`}>
			<path d="M0 0v13h7.2c.5 0 .8-.6.4-1C5 9.4 1.3 5.5 0 0Z" fill="currentColor" />
		</svg>
	)
}

/**
 * One chat bubble (WhatsApp UI kit: #dcf7c5 sent, #fafafa received, 8px corners).
 * Short text keeps the time on its last line; longer bodies push it below.
 */
function Bubble({ mine, children, time, receipt, wide, edited, onMenu, active, tail = true, inlineMeta = false }) {
	const menuHandlers = useMessageMenu(onMenu)
	const meta = (
		<>
			{edited && <span>Edited</span>}
			<span className="tabular-nums">{time}</span>
			{mine && receipt && <Ticks state={receipt} />}
		</>
	)
	return (
		<div className={`flex ${mine ? 'justify-end pr-2' : 'justify-start pl-2'} ${tail ? 'mb-2' : 'mb-0.5'}`}>
			<div
				{...menuHandlers}
				className={`bubble relative ${wide ? 'w-[min(340px,84%)]' : 'max-w-[80%]'} rounded-lg px-2 pb-1 pt-1.5 text-black shadow-[0_1px_1.5px_rgba(0,0,0,0.16)] transition-[box-shadow,transform] duration-150 ${
					mine ? 'bg-[#dcf7c5]' : 'bg-[#fafafa]'
				} ${tail ? (mine ? 'rounded-br-none' : 'rounded-bl-none') : ''} ${active ? 'shadow-[0_0_0_2px_rgba(232,59,3,0.45),0_1px_1.5px_rgba(0,0,0,0.16)]' : ''}`}
			>
				{children}
				{inlineMeta ? (
					// Reserve room on the last line, then pin the meta into it.
					<span className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] text-black/45">{meta}</span>
				) : (
					<div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-black/45">{meta}</div>
				)}
				{tail && <Tail mine={mine} />}
			</div>
		</div>
	)
}

/** Message text with an invisible spacer so the time can sit on its last line. */
function BubbleText({ children, mine, edited }) {
	const spacer = `${edited ? 'Edited ' : ''}00:00 pm${mine ? ' ✓✓' : ''}`
	return (
		<p className="whitespace-pre-wrap px-1 text-[16px] leading-[21px] [overflow-wrap:anywhere]">
			{children}
			<span aria-hidden="true" className="invisible inline-block pl-3 text-[11px]">{spacer}</span>
		</p>
	)
}

/** Small menu at the pointer for one message: copy, and edit while the window is open. */
function MessageMenu({ menu, onCopy, onEdit, onClose }) {
	const ref = useRef(null)
	useEffect(() => {
		const away = e => { if (!ref.current?.contains(e.target)) onClose() }
		const esc = e => e.key === 'Escape' && onClose()
		document.addEventListener('pointerdown', away)
		document.addEventListener('keydown', esc)
		window.addEventListener('resize', onClose)
		ref.current?.querySelector('button')?.focus()
		return () => {
			document.removeEventListener('pointerdown', away)
			document.removeEventListener('keydown', esc)
			window.removeEventListener('resize', onClose)
		}
	}, [onClose])
	// Keep the menu on screen and grow it from the corner nearest the pointer.
	const width = 184
	const height = menu.editable ? 92 : 48
	const flipX = menu.x + width > window.innerWidth - 8
	const flipY = menu.y + height > window.innerHeight - 8
	const style = {
		left: flipX ? Math.max(8, menu.x - width) : menu.x,
		top: flipY ? Math.max(8, menu.y - height) : menu.y,
		width,
		transformOrigin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
	}
	const item = 'flex h-11 w-full items-center gap-3 px-4 text-left text-[14.5px] text-ink-900 transition-colors hover:bg-ink-50 focus:bg-ink-50 focus:outline-none'

	// Press-and-hold on a phone: an action sheet from the bottom (WhatsApp UI kit "Chat Actions").
	if (menu.touch) {
		const row = 'flex h-[57px] w-full items-center justify-center text-[20px] text-mint-600 transition-colors active:bg-black/5 focus:outline-none focus-visible:bg-black/5'
		return (
			<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 px-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] message-sheet-backdrop">
				<div ref={ref} role="menu" aria-label="Message options" className="message-sheet">
					<div className="overflow-hidden rounded-[14px] bg-[#f9f9f9]/95 backdrop-blur">
						<p className="line-clamp-2 border-b border-black/10 px-5 py-3 text-center text-[13px] leading-snug text-[#8e8e93]">{menu.message.content || menu.message.file_name}</p>
						<button type="button" role="menuitem" className={row} onClick={onCopy}>Copy</button>
						{menu.editable && <button type="button" role="menuitem" className={`${row} border-t border-black/10`} onClick={onEdit}>Edit</button>}
					</div>
					<button type="button" onClick={onClose} className="mt-2 h-[57px] w-full rounded-[14px] bg-white text-[19px] font-semibold text-mint-600 active:bg-ink-50">Cancel</button>
				</div>
			</div>
		)
	}

	return (
		<div ref={ref} role="menu" aria-label="Message options" style={style} className="message-menu fixed z-50 overflow-hidden rounded-xl bg-white py-1 shadow-[0_8px_28px_rgba(11,20,26,0.18),0_1px_3px_rgba(11,20,26,0.08)]">
			<button type="button" role="menuitem" className={item} onClick={onCopy}><Icon name="copy" size={16} className="text-ink-500" />Copy</button>
			{menu.editable && <button type="button" role="menuitem" className={item} onClick={onEdit}><Icon name="edit" size={16} className="text-ink-500" />Edit</button>}
		</div>
	)
}

/**
 * The order as one conversation: messages, client references and freelancer
 * deliveries in a single timeline, with review actions on the deliveries.
 */
export default function OrderConversation({ booking, role, counterpartName, counterpartAvatar, onChanged, header = null, className = '' }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const streamRef = useRef(null)
	const shellRef = useRef(null)
	const [pending, setPending] = useState([])
	const [revisionFor, setRevisionFor] = useState(null)
	// Approving is final for that version, so it takes a second, deliberate step.
	const [approveFor, setApproveFor] = useState(null)
	const [approveChecked, setApproveChecked] = useState(false)
	const [revisionNote, setRevisionNote] = useState('')
	const [showRating, setShowRating] = useState(false)
	const [ratings, setRatings] = useState({ rating_quality: 5, rating_communication: 5, timeliness_rating: 5, brief_adherence_rating: 5 })
	const [reviewText, setReviewText] = useState('')
	const [menu, setMenu] = useState(null)
	const [editing, setEditing] = useState(null)
	const closeMenu = useCallback(() => setMenu(null), [])

	const roomId = booking.room_id
	const jobId = booking.job_id
	const isClient = role === 'client'
	const completed = booking.stage === 'completed'
	const messagesKey = ['chat', roomId]

	const { data, isLoading } = useQuery({
		queryKey: messagesKey,
		queryFn: () => chatApi.messages(roomId, { limit: 200 }).then(res => res.data?.data),
		enabled: Boolean(roomId),
		refetchInterval: 5_000,
	})
	const messages = useMemo(() => data?.messages || [], [data])

	// Number the freelancer's deliveries v1, v2… in the order they were sent.
	const { versions, latestDelivery } = useMemo(() => {
		const map = {}
		let last = null
		for (const m of messages) {
			if (m.file_id && m.file_purpose === 'delivery' && m.sender_role === 'freelancer' && !map[m.file_id]) {
				map[m.file_id] = Object.keys(map).length + 1
				last = m
			}
		}
		return { versions: map, latestDelivery: last }
	}, [messages])

	useEffect(() => {
		streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' })
	}, [messages.length, pending.length])

	const refreshAll = () => {
		queryClient.invalidateQueries({ queryKey: messagesKey })
		queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
		onChanged?.()
	}
	// Review and completion post their chat line just after responding, so look twice.
	const refreshSoon = () => { setTimeout(refreshAll, 600); setTimeout(refreshAll, 2000) }

	const sendText = useMutation({
		mutationFn: content => chatApi.send(roomId, { content }),
		onSuccess: refreshAll,
		onError: err => pushToast({ title: 'Message not sent', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const editText = useMutation({
		mutationFn: ({ id, content }) => chatApi.edit(id, content).then(res => res.data?.data?.message),
		onMutate: ({ id, content }) => {
			// Show the new text straight away; the poll confirms it.
			queryClient.setQueryData(messagesKey, old => old && ({
				...old,
				messages: old.messages.map(m => (m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m)),
			}))
			setEditing(null)
		},
		onSettled: refreshAll,
		onError: err => pushToast({ title: 'Message not edited', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const openMenu = (m, mine) => (x, y, touch) => setMenu(current => (current?.message.id === m.id ? current : { message: m, x, y, touch, editable: canEdit(m, mine) }))
	const copyMessage = async () => {
		try { await navigator.clipboard.writeText(menu.message.content || '') } catch { /* clipboard blocked */ }
		setMenu(null)
		pushToast({ title: 'Message copied', icon: 'check' })
	}

	const sendFiles = async (items) => {
		setPending(list => [...list, ...items.map(item => ({ ...item, progress: 0, status: 'uploading' }))])
		for (const item of items) {
			const type = item.file.type || 'application/octet-stream'
			try {
				const prepared = await mintboxApi.prepareUpload(jobId, { name: item.file.name, size: item.file.size, type, note: item.caption || undefined })
				const config = prepared.data?.data?.upload
				await uploadMintboxFile({
					file: item.file,
					config,
					fileType: type,
					onProgress: (done, total) => setPending(list => list.map(p => (p.id === item.id ? { ...p, progress: Math.round((done / total) * 100) } : p))),
				})
				await mintboxApi.completeUpload(config.upload_id)
				// The server posts the chat message right after completing the upload.
				await new Promise(r => setTimeout(r, 700))
				await queryClient.invalidateQueries({ queryKey: messagesKey })
				setPending(list => list.filter(p => p.id !== item.id))
				URL.revokeObjectURL(item.url)
			} catch (error) {
				setPending(list => list.map(p => (p.id === item.id ? { ...p, status: 'failed' } : p)))
				pushToast({ title: `Couldn't send ${item.file.name}`, body: error.response?.data?.message || error.message || 'Try again', tone: 'amber', icon: 'x' })
			}
		}
		refreshAll()
	}

	const review = useMutation({
		mutationFn: ({ fileId, action, note }) => mintboxApi.reviewFile(fileId, { action, note }),
		onSuccess: (_res, vars) => {
			pushToast({ title: vars.action === 'approve' ? 'Delivery approved' : 'Revision requested', icon: 'check' })
			setRevisionFor(null)
			setApproveFor(null)
			setRevisionNote('')
			refreshSoon()
		},
		onError: err => pushToast({ title: 'Could not update delivery', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const complete = useMutation({
		mutationFn: () => mintboxApi.completeProject(jobId, { ...ratings, review_text: reviewText.trim() || undefined }),
		onSuccess: () => {
			pushToast({ title: 'Order completed', body: 'Thanks! Payment has been released to the freelancer.', icon: 'check' })
			setShowRating(false)
			refreshSoon()
		},
		onError: err => pushToast({ title: 'Could not complete order', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	if (!roomId) {
		return (
			<div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
				The conversation opens as soon as a freelancer is assigned.
			</div>
		)
	}

	const revisionsLeft = Number(booking.revisions_left ?? 0)
	const awaitingReview = isClient && !completed && latestDelivery?.file_status === 'submitted'
	const readyToComplete = isClient && !completed && latestDelivery?.file_status === 'approved'
	const revisionOpen = !isClient && !completed && latestDelivery?.file_status === 'revision_requested'
	const canAttach = !completed
	const attachHint = isClient
		? 'Files you send here are shared with your freelancer as references.'
		: `Each file is sent as a delivery the client can approve or send back. ${revisionsLeft} of ${booking.revisions_included} revisions left.`

	// Timeline rows with day separators.
	const rows = []
	let lastDay = null
	for (const m of messages) {
		const day = new Date(m.created_at).toDateString()
		if (day !== lastDay) { rows.push({ type: 'day', key: `day-${day}`, label: dayLabel(m.created_at) }); lastDay = day }
		rows.push({ type: 'message', key: m.id, message: m })
	}
	// A bubble gets its tail when it ends a run from the same sender on the same day.
	rows.forEach((row, i) => {
		if (row.type !== 'message') return
		const next = rows[i + 1]
		row.tail = !next || next.type !== 'message' || next.message.sender_role !== row.message.sender_role
	})

	const renderMessage = (m, tail) => {
		if (m.sender_role === 'system') {
			return (
				<div className="my-2 flex justify-center">
					<div className="max-w-[86%] whitespace-pre-wrap rounded-lg bg-[#fff5c4] px-3 py-1.5 text-center text-[12.5px] leading-snug text-[#54656f] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
						{m.content}
					</div>
				</div>
			)
		}
		const mine = m.sender_role === (isClient ? 'client' : 'freelancer')
		const time = clock(m.created_at)
		const receipt = mine ? receiptOf(m, role) : null
		const src = m.file_token ? contentUrl(m.file_token) : null
		const bubbleMenu = {
			edited: Boolean(m.edited_at),
			onMenu: openMenu(m, mine),
			active: menu?.message.id === m.id || editing?.id === m.id,
			tail,
		}

		// Client feedback on a delivery: quoted version + the note.
		if (m.file_id && m.file_purpose === 'delivery' && m.sender_role === 'client') {
			return (
				<Bubble mine={mine} time={time} receipt={receipt} {...bubbleMenu} inlineMeta>
					<div className="mb-1 overflow-hidden rounded-md bg-black/[0.05] py-1.5 pl-2.5 pr-2 shadow-[inset_4px_0_0_#8b5cf6]">
						<div className="text-[13px] font-semibold text-violet-700">Revision requested · v{versions[m.file_id] || '?'}</div>
						<div className="truncate text-[13px] text-black/55">{m.file_name}</div>
					</div>
					<BubbleText mine={mine} edited={bubbleMenu.edited}>{m.content}</BubbleText>
				</Bubble>
			)
		}

		if (m.file_id) {
			const isDelivery = m.file_purpose === 'delivery'
			const status = DELIVERY_STATUS[m.file_status]
			const isLatest = latestDelivery?.file_id === m.file_id
			return (
				<Bubble mine={mine} time={time} receipt={receipt} {...bubbleMenu} wide>
					{isDelivery && (
						<div className="mb-1.5 flex items-center justify-between gap-2 px-1">
							<span className="text-[13px] font-semibold text-black/80">Delivery · v{versions[m.file_id]}</span>
							{status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>}
						</div>
					)}
					<FileBody kind={kindOf(m.file_mime)} src={src} name={m.file_name} size={m.file_size} preview={isDelivery && isClient && m.file_status !== 'approved'} />
					{m.content && <p className="mt-1 whitespace-pre-wrap px-1 text-[16px] leading-[21px] [overflow-wrap:anywhere]">{m.content}</p>}
					{isDelivery && isClient && isLatest && m.file_status === 'submitted' && !completed && (
						<div className="mt-2 grid grid-cols-2 gap-2">
							<button type="button" disabled={review.isPending || revisionsLeft === 0} onClick={() => setRevisionFor(m)} title={revisionsLeft === 0 ? 'No revisions left for this service' : undefined}
								className="h-9 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50">
								Request changes
							</button>
							<button type="button" disabled={review.isPending} onClick={() => { setApproveFor(m); setApproveChecked(false) }}
								className="h-9 rounded-xl bg-ink-900 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-50">
								Approve
							</button>
						</div>
					)}
				</Bubble>
			)
		}

		return (
			<Bubble mine={mine} time={time} receipt={receipt} {...bubbleMenu} inlineMeta>
				<BubbleText mine={mine} edited={bubbleMenu.edited}>{m.content}</BubbleText>
			</Bubble>
		)
	}

	return (
		<div ref={shellRef} className={`conversation relative flex min-h-0 flex-col overflow-hidden bg-white ${className}`}>
			{header ?? (
				<div className="flex items-center gap-3 border-b border-ink-200 px-4 py-3">
					<Avatar name={counterpartName} src={counterpartAvatar} size="sm" />
					<div className="min-w-0">
						<div className="truncate font-medium text-ink-900">{counterpartName || 'Your freelancer'}</div>
						<div className="truncate text-xs text-ink-500">{booking.booking_number} · {booking.snapshot?.title}</div>
					</div>
				</div>
			)}

			{(awaitingReview || readyToComplete || revisionOpen) && (
				<div className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm ${readyToComplete ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : revisionOpen ? 'border-violet-100 bg-violet-50 text-violet-900' : 'border-amber-100 bg-amber-50 text-amber-900'}`}>
					<Icon name={readyToComplete ? 'checkCircle' : revisionOpen ? 'refresh' : 'eye'} size={16} className="shrink-0" />
					<span className="min-w-0 flex-1">
						{readyToComplete && 'You approved the latest version. Complete the order to release payment.'}
						{awaitingReview && `v${versions[latestDelivery.file_id]} is ready for your review.`}
						{revisionOpen && `Changes requested on v${versions[latestDelivery.file_id]}. Send the updated file here.`}
					</span>
					{readyToComplete && <button type="button" onClick={() => setShowRating(true)} className="h-8 shrink-0 rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white hover:bg-ink-700">Complete &amp; rate</button>}
				</div>
			)}

			<div ref={streamRef} className="conversation-stream min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-6">
				{isLoading ? (
					<div className="py-10 text-center text-sm text-ink-500">Loading conversation…</div>
				) : rows.length === 0 && !pending.length ? (
					<div className="py-16 text-center">
						<div className="font-medium text-ink-900">Start the conversation</div>
						<p className="mt-1 text-sm text-ink-500">{isClient ? 'Share your footage, references and instructions here.' : 'Say hello, ask questions and send your delivery here.'}</p>
					</div>
				) : rows.map(row => (
					row.type === 'day'
						? <div key={row.key} className="flex justify-center py-2"><span className="rounded-lg bg-[#dddde9] px-2.5 py-[3px] text-[12px] text-[#3c3c43] shadow-[0_-0.4px_0_#eeeef4,0_0.4px_0_rgba(98,98,98,0.2)]">{row.label}</span></div>
						: <div key={row.key}>{renderMessage(row.message, row.tail)}</div>
				))}
				{pending.map(item => (
					<Bubble key={item.id} mine time={item.status === 'failed' ? 'Not sent' : `${item.progress}%`} receipt={item.status === 'failed' ? null : 'pending'} wide>
						<div className="relative">
							<FileBody kind={item.kind} src={item.url} name={item.file.name} size={item.file.size} />
							{item.status === 'uploading' && (
								<div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/20">
									<div className="h-full bg-mint-500 transition-[width]" style={{ width: `${item.progress}%` }} />
								</div>
							)}
						</div>
						{item.caption && <p className="mt-1.5 whitespace-pre-wrap px-1 text-[15px] text-ink-900">{item.caption}</p>}
						{item.status === 'failed' && (
							<button type="button" onClick={() => setPending(list => list.filter(p => p.id !== item.id))} className="mt-1 px-1 text-xs font-medium text-rose-600 hover:underline">Dismiss</button>
						)}
					</Bubble>
				))}
			</div>

			<ConversationComposer
				dropTarget={shellRef}
				placeholder={isClient ? 'Message your freelancer' : `Message ${counterpartName || 'the client'}`}
				canAttach={canAttach}
				attachDisabledReason="This order is complete"
				attachHint={attachHint}
				sendLabel={isClient ? 'Send' : 'Send delivery'}
				sending={sendText.isPending}
				onSendText={content => sendText.mutateAsync(content)}
				onSendFiles={sendFiles}
				editing={editing}
				onSaveEdit={content => editText.mutate({ id: editing.id, content })}
				onCancelEdit={() => setEditing(null)}
			/>

			{menu && (
				<MessageMenu
					menu={menu}
					onClose={closeMenu}
					onCopy={copyMessage}
					onEdit={() => { setEditing({ id: menu.message.id, text: menu.message.content || '', isCaption: Boolean(menu.message.file_id) }); setMenu(null) }}
				/>
			)}

			{revisionFor && (
				<Modal
					title={`Request changes on v${versions[revisionFor.file_id]}`}
					subtitle={`${revisionsLeft} of ${booking.revisions_included} revision${Number(booking.revisions_included) === 1 ? '' : 's'} left. Put all your feedback in one go.`}
					onClose={() => setRevisionFor(null)}
					footer={(
						<>
							<button className="btn ghost" onClick={() => setRevisionFor(null)}>Cancel</button>
							<button className="btn primary" disabled={!revisionNote.trim() || review.isPending} onClick={() => review.mutate({ fileId: revisionFor.file_id, action: 'revision', note: revisionNote })}>
								Send feedback
							</button>
						</>
					)}
				>
					<textarea
						rows={5}
						autoFocus
						value={revisionNote}
						onChange={e => setRevisionNote(e.target.value)}
						placeholder="What should change? Mention timestamps, colours or text."
						className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-mint-400 focus:outline-none"
					/>
				</Modal>
			)}

			{approveFor && (
				<Modal
					title={`Approve v${versions[approveFor.file_id]}?`}
					subtitle="This tells your freelancer this version is final. You can't ask for changes on it afterwards."
					onClose={() => setApproveFor(null)}
					footer={(
						<>
							<button className="btn ghost" onClick={() => setApproveFor(null)}>Keep reviewing</button>
							<button className="btn primary" disabled={!approveChecked || review.isPending} onClick={() => review.mutate({ fileId: approveFor.file_id, action: 'approve' })}>
								{review.isPending ? 'Approving…' : 'Approve this version'}
							</button>
						</>
					)}
				>
					<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-3 text-sm text-ink-800">
						<input type="checkbox" checked={approveChecked} onChange={e => setApproveChecked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink-900" />
						<span>I watched the whole delivery and it's what I asked for.</span>
					</label>
					{revisionsLeft > 0 && (
						<p className="mt-3 text-sm text-ink-600">
							Not quite right? You still have {revisionsLeft} revision{revisionsLeft === 1 ? '' : 's'}.{' '}
							<button type="button" className="font-medium text-ink-900 underline underline-offset-2" onClick={() => { setRevisionFor(approveFor); setApproveFor(null) }}>Request changes instead</button>
						</p>
					)}
				</Modal>
			)}

			{showRating && (
				<Modal
					title="Complete order & rate"
					subtitle="Completing releases payment to the freelancer. This can't be undone."
					onClose={() => setShowRating(false)}
					footer={(
						<>
							<button className="btn ghost" onClick={() => setShowRating(false)}>Cancel</button>
							<button className="btn primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
								{complete.isPending ? 'Completing…' : 'Complete order'}
							</button>
						</>
					)}
				>
					<div className="space-y-3">
						{RATING_FIELDS.map(([key, label]) => (
							<div key={key} className="flex items-center justify-between gap-3">
								<span className="text-sm text-ink-700">{label}</span>
								<div className="flex gap-1">
									{[1, 2, 3, 4, 5].map(star => (
										<button key={star} type="button" aria-label={`${star} star${star === 1 ? '' : 's'}`} onClick={() => setRatings(prev => ({ ...prev, [key]: star }))} className={star <= ratings[key] ? 'text-amber-400' : 'text-ink-200'}>
											<Icon name="star" size={20} />
										</button>
									))}
								</div>
							</div>
						))}
						<textarea
							rows={3}
							value={reviewText}
							onChange={e => setReviewText(e.target.value)}
							placeholder="Anything you'd like to say about the work? (optional)"
							className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-mint-400 focus:outline-none"
						/>
					</div>
				</Modal>
			)}
		</div>
	)
}
