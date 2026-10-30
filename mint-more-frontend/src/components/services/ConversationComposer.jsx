import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { CONTACT_BLOCKED_MESSAGE, findContactInfo } from '../../utils/contactGuard'

const kindOf = (file) => {
	const type = (file.type || '').split('/')[0]
	return ['image', 'video', 'audio'].includes(type) ? type : 'document'
}

const formatSize = (bytes) => {
	const value = Number(bytes || 0)
	if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
	if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
	return `${Math.max(1, Math.round(value / 1024))} KB`
}

/** Shown under a box whose text would be rejected for sharing contact details. */
function ContactWarning({ className = '' }) {
	return (
		<p role="alert" className={`flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800 ${className}`}>
			<Icon name="shield" size={14} className="mt-px shrink-0" />
			{CONTACT_BLOCKED_MESSAGE}
		</p>
	)
}

/** Big preview of one picked file inside the send sheet. */
function StagePreview({ item }) {
	if (item.kind === 'image') return <img src={item.url} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
	if (item.kind === 'video') return <video src={item.url} controls className="max-h-full max-w-full rounded-xl" />
	if (item.kind === 'audio') return <audio src={item.url} controls className="w-full max-w-sm" />
	return (
		<div className="flex flex-col items-center gap-3 text-center">
			<span className="grid h-20 w-20 place-items-center rounded-2xl bg-white text-ink-600 shadow-sm"><Icon name="file" size={34} /></span>
			<div className="max-w-xs truncate font-medium text-white">{item.file.name}</div>
			<div className="text-sm text-white/60">{formatSize(item.file.size)}</div>
		</div>
	)
}

/**
 * WhatsApp-style send sheet: preview every picked file, add a caption to each,
 * remove or add more, then send them all.
 */
function SendSheet({ items, setItems, onSend, onCancel, onAddMore, hint, sendLabel }) {
	const [active, setActive] = useState(0)
	const current = items[Math.min(active, items.length - 1)]
	const blockedIndex = items.findIndex(item => findContactInfo(item.caption).blocked)
	const setCaption = (value) => setItems(list => list.map((item, i) => (i === active ? { ...item, caption: value } : item)))
	const remove = (index) => {
		setItems(list => list.filter((_, i) => i !== index))
		setActive(a => Math.max(0, a >= index ? a - 1 : a))
	}

	useEffect(() => {
		const esc = (e) => e.key === 'Escape' && onCancel()
		document.addEventListener('keydown', esc)
		return () => document.removeEventListener('keydown', esc)
	}, [onCancel])

	if (!current) return null
	return (
		<div className="conversation-sheet absolute inset-0 z-20 flex flex-col bg-[#16110f]" role="dialog" aria-label="Send files">
			<div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3">
				<button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Cancel">
					<Icon name="x" size={18} />
				</button>
				<div className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{current.file.name}</div>
				<span className="text-xs text-ink-500">{formatSize(current.file.size)}</span>
			</div>

			<div className="flex min-h-0 flex-1 items-center justify-center p-4">
				<StagePreview item={current} />
			</div>

			<div className="border-t border-ink-200 bg-white px-3 pb-3 pt-2.5">
				{blockedIndex >= 0 ? <ContactWarning className="mb-2" /> : hint && <p className="mb-2 px-1 text-xs text-ink-500">{hint}</p>}
				<div className="mb-2.5 flex items-center gap-2 overflow-x-auto pb-1">
					{items.map((item, index) => (
						<div key={item.id} className="relative shrink-0">
							<button type="button" onClick={() => setActive(index)} aria-label={`Preview ${item.file.name}`}
								className={`grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-ink-100 text-ink-500 ring-2 transition ${index === active ? 'ring-mint-500' : findContactInfo(item.caption).blocked ? 'ring-amber-400' : 'ring-transparent'}`}>
								{item.kind === 'image' ? <img src={item.url} alt="" className="h-full w-full object-cover" /> : <Icon name={item.kind === 'video' ? 'video' : 'file'} size={20} />}
							</button>
							<button type="button" onClick={() => remove(index)} aria-label={`Remove ${item.file.name}`} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink-900 text-white">
								<Icon name="x" size={11} />
							</button>
						</div>
					))}
					<button type="button" onClick={onAddMore} aria-label="Add more files" className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-dashed border-ink-300 text-ink-500 hover:border-ink-500 hover:text-ink-800">
						<Icon name="plus" size={20} />
					</button>
				</div>
				<div className="flex items-end gap-2">
					<input
						autoFocus
						value={current.caption}
						onChange={e => setCaption(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (blockedIndex < 0) onSend() } }}
						placeholder="Add a caption…"
						maxLength={500}
						className="h-11 min-w-0 flex-1 rounded-full border border-ink-200 bg-ink-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-500 focus:border-ink-400 focus:outline-none"
					/>
					<button type="button" onClick={onSend} disabled={blockedIndex >= 0} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-mint-500 px-4 text-sm font-semibold text-white hover:bg-mint-600 disabled:bg-ink-200 disabled:text-ink-400">
						{sendLabel} {items.length > 1 && <span className="rounded-full bg-white/25 px-1.5 text-xs tabular-nums">{items.length}</span>}
						<Icon name="send" size={15} />
					</button>
				</div>
			</div>
		</div>
	)
}

/**
 * Message box for an order conversation: text, plus files that open a preview
 * sheet with captions before they are sent. Files can also be dropped or pasted.
 */
export default function ConversationComposer({ placeholder, canAttach, firstDraftMode = false, onSendFirstDraft, attachDisabledReason, attachHint, sendLabel = 'Send', onSendText, onSendFiles, sending, dropTarget, editing = null, onSaveEdit, onCancelEdit }) {
	const inputRef = useRef(null)
	const draftInputRef = useRef(null)
	const plusButtonRef = useRef(null)
	const attachMenuRef = useRef(null)
	const firstDraftOptionRef = useRef(null)
	const textRef = useRef(null)
	const [draft, setDraft] = useState('')
	const draftBlocked = findContactInfo(draft).blocked
	const [items, setItems] = useState([])
	const [showAttachMenu, setShowAttachMenu] = useState(false)
	const parkedDraft = useRef('')

	useEffect(() => {
		if (!showAttachMenu) return undefined
		firstDraftOptionRef.current?.focus()
		const dismiss = (event) => {
			if (event.type === 'keydown' && event.key === 'Escape') {
				event.preventDefault()
				setShowAttachMenu(false)
				plusButtonRef.current?.focus()
			} else if (event.type === 'pointerdown' && !attachMenuRef.current?.contains(event.target)) {
				setShowAttachMenu(false)
			}
		}
		document.addEventListener('pointerdown', dismiss)
		document.addEventListener('keydown', dismiss)
		return () => {
			document.removeEventListener('pointerdown', dismiss)
			document.removeEventListener('keydown', dismiss)
		}
	}, [showAttachMenu])

	// Editing loads the message into the box; leaving edit mode brings back what was being typed.
	const editingId = editing?.id
	useEffect(() => {
		if (!editingId) return undefined
		setDraft(current => { parkedDraft.current = current; return editing.text })
		requestAnimationFrame(() => {
			const el = textRef.current
			if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
		})
		return () => setDraft(parkedDraft.current)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editingId])

	const addFiles = (fileList) => {
		const picked = Array.from(fileList || [])
		if (!picked.length) return
		setItems(list => [...list, ...picked.map(file => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, kind: kindOf(file), url: URL.createObjectURL(file), caption: '' }))])
	}
	const clear = () => {
		setItems(list => { list.forEach(item => URL.revokeObjectURL(item.url)); return [] })
		if (inputRef.current) inputRef.current.value = ''
	}

	// Drop files anywhere on the conversation, or paste an image into the box.
	useEffect(() => {
		const el = dropTarget?.current
		if (!el || !canAttach) return
		const over = (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); el.dataset.dragging = 'true' } }
		const leave = (e) => { if (e.target === el) delete el.dataset.dragging }
		const drop = (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); delete el.dataset.dragging; addFiles(e.dataTransfer.files) }
		el.addEventListener('dragover', over)
		el.addEventListener('dragleave', leave)
		el.addEventListener('drop', drop)
		return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop) }
	}, [dropTarget, canAttach])

	const sendText = () => {
		const text = draft.trim()
		if (!text || sending || draftBlocked) return
		if (editing) {
			if (text !== editing.text.trim()) onSaveEdit(text)
			else onCancelEdit()
			return
		}
		// The parent hands the text back if the server still refuses it.
		Promise.resolve(onSendText(text)).catch(() => setDraft(current => current || text))
		setDraft('')
	}
	const sendFiles = () => {
		if (!items.length) return
		onSendFiles(items.map(({ file, caption, url, kind, id }) => ({ id, file, caption: caption.trim(), url, kind })))
		// Object URLs stay alive for the uploading bubbles; the parent revokes them when done.
		setItems([])
		if (inputRef.current) inputRef.current.value = ''
	}

	return (
		<>
			{items.length > 0 && (
				<SendSheet items={items} setItems={setItems} onSend={sendFiles} onCancel={clear} onAddMore={() => inputRef.current?.click()} hint={attachHint} sendLabel={sendLabel} />
			)}
			<form onSubmit={e => { e.preventDefault(); sendText() }} className="bg-[#f6f6f6] px-2 py-2 shadow-[0_-0.5px_0_#a6a6aa] md:px-3">
				{draftBlocked && <ContactWarning className="mb-2" />}
				{editing && (
					<div className="composer-edit mb-2 flex items-center gap-3 rounded-xl bg-ink-50 py-2 pl-3 pr-1.5">
						<span className="h-9 w-[3px] shrink-0 rounded-full bg-mint-500" aria-hidden="true" />
						<div className="min-w-0 flex-1">
							<div className="text-[13px] font-semibold text-mint-600">{editing.isCaption ? 'Edit caption' : 'Edit message'}</div>
							<div className="truncate text-[13px] text-ink-600">{editing.text}</div>
						</div>
						<button type="button" onClick={onCancelEdit} aria-label="Cancel editing" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-800">
							<Icon name="x" size={16} />
						</button>
					</div>
				)}
				<div className="flex items-end gap-2">
					<div className="relative">
					<button
						ref={plusButtonRef}
						type="button"
						onClick={() => firstDraftMode ? setShowAttachMenu(value => !value) : inputRef.current?.click()}
						disabled={(!canAttach && !firstDraftMode) || Boolean(editing)}
						title={canAttach || firstDraftMode ? 'Add to chat' : attachDisabledReason}
						aria-label={firstDraftMode ? 'More chat options' : 'Attach files'}
						aria-haspopup={firstDraftMode ? 'menu' : undefined}
						aria-expanded={firstDraftMode ? showAttachMenu : undefined}
						className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-mint-600 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-black/5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Icon name={showAttachMenu ? 'x' : 'plus'} size={showAttachMenu ? 18 : 22} />
					</button>
					{firstDraftMode && (
						<div
							ref={attachMenuRef}
							role="menu"
							aria-label="Chat attachments"
							aria-hidden={!showAttachMenu}
							className={`absolute bottom-[calc(100%+10px)] left-0 z-30 w-[min(288px,calc(100vw-32px))] origin-bottom-left rounded-2xl border border-ink-200 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition-[opacity,transform,visibility] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${showAttachMenu ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible translate-y-1 scale-[0.98] opacity-0'}`}
						>
							<button
								ref={firstDraftOptionRef}
								type="button"
								role="menuitem"
								tabIndex={showAttachMenu ? 0 : -1}
								onClick={() => { setShowAttachMenu(false); plusButtonRef.current?.focus(); draftInputRef.current?.click() }}
								className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 active:scale-[0.97]"
							>
								<span className="min-w-0 flex-1">
									<span className="flex items-center gap-2 text-sm font-semibold text-ink-950">Send first draft <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-700">MP4</span></span>
									<span className="mt-0.5 block text-xs leading-4 text-ink-600">CREATYV reviews it before the client can see it.</span>
								</span>
							</button>
							{canAttach && (
								<button
									type="button"
									role="menuitem"
									tabIndex={showAttachMenu ? 0 : -1}
									onClick={() => { setShowAttachMenu(false); plusButtonRef.current?.focus(); inputRef.current?.click() }}
									className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 active:scale-[0.97]"
								>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-semibold text-ink-950">Send files</span>
										<span className="mt-0.5 block text-xs leading-4 text-ink-600">Designs, documents and other non-video work.</span>
									</span>
								</button>
							)}
						</div>
					)}
					{firstDraftMode && <input ref={draftInputRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={e => { onSendFirstDraft?.(Array.from(e.target.files || [])); e.target.value = '' }} />}
					<input ref={inputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
					</div>
					<textarea
						ref={textRef}
						rows={1}
						value={draft}
						onChange={e => setDraft(e.target.value)}
						onPaste={e => { if (canAttach && !editing && e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }}
						onKeyDown={e => {
							if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() }
							if (e.key === 'Escape' && editing) { e.preventDefault(); onCancelEdit() }
						}}
						placeholder={placeholder}
						aria-label="Message"
						aria-invalid={draftBlocked || undefined}
						className="max-h-36 min-h-10 flex-1 resize-none rounded-[20px] border border-[#8e8e93]/50 bg-white px-4 py-2 text-[16px] leading-[22px] text-black placeholder:text-[#8e8e93] aria-[invalid]:border-amber-400 [field-sizing:content] focus:border-[#8e8e93] focus:outline-none"
					/>
					<button
						type="submit"
						disabled={!draft.trim() || sending || draftBlocked}
						aria-label={editing ? 'Save edit' : 'Send message'}
						className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-500 text-white transition-[transform,background-color] duration-150 active:scale-95 disabled:bg-transparent disabled:text-[#8e8e93]"
					>
						<Icon name={editing ? 'check' : 'send'} size={17} />
					</button>
				</div>
			</form>
		</>
	)
}
