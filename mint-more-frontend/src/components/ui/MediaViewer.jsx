import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/**
 * Full-screen viewer for photos and videos. It renders into <body>, so no sticky bar,
 * tab bar or stacking context of the page can sit on top of it.
 * Arrows or ←/→ move, Esc closes, a swipe moves on touch screens.
 *
 * items: [{ id, src, kind: 'image' | 'video' | 'file', name, title?, meta?, locked? }]
 * A locked item is a preview awaiting approval: no save-as, download or picture-in-picture.
 */
export default function MediaViewer({ items, index, onIndex, onClose, actions, note, thumbnails = false, label = 'Media viewer' }) {
	const item = items[index]
	const many = items.length > 1
	const closeRef = useRef(null)
	const touch = useRef(null)
	const [failed, setFailed] = useState({})
	const step = useCallback(delta => onIndex((index + delta + items.length) % items.length), [index, items.length, onIndex])

	useEffect(() => {
		const onKey = event => {
			if (event.key === 'Escape') onClose()
			if (many && event.key === 'ArrowRight') step(1)
			if (many && event.key === 'ArrowLeft') step(-1)
		}
		document.addEventListener('keydown', onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		closeRef.current?.focus()
		return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
	}, [many, onClose, step])

	if (!item) return null
	const broken = failed[item.id]
	const guard = item.locked ? { onContextMenu: event => event.preventDefault() } : {}
	const kind = broken ? 'file' : item.kind
	const onTouchStart = event => { touch.current = event.touches[0].clientX }
	const onTouchEnd = event => {
		if (touch.current === null || !many) return
		const dx = event.changedTouches[0].clientX - touch.current
		touch.current = null
		if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
	}

	return createPortal(
		<div className="files-viewer fixed inset-0 z-[1000] flex flex-col bg-[#0b0b0c] font-store text-white" role="dialog" aria-modal="true" aria-label={label}>
			<div className="flex items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] md:px-6 md:pt-4">
				<div className="min-w-0 flex-1">
					<p className="truncate text-[15px] font-medium">{item.title || item.name}</p>
					{(item.meta || (item.title && item.name)) && <p className="truncate text-[13px] text-white/60">{item.meta || item.name}</p>}
				</div>
				{many && <span className="hidden text-[13px] tabular-nums text-white/60 sm:inline">{index + 1} / {items.length}</span>}
				{actions?.(item)}
				<button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
					<Icon name="x" size={20} />
				</button>
			</div>

			<div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 md:px-20 md:pb-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
				{kind === 'image' ? (
					<img key={item.id} src={item.src} alt={item.name || ''} onError={() => setFailed(prev => ({ ...prev, [item.id]: true }))} className="files-viewer-media max-h-full max-w-full select-none rounded-sm object-contain" draggable={false} {...guard} />
				) : kind === 'video' ? (
					<video key={item.id} src={item.src} controls autoPlay playsInline {...guard} {...(item.locked ? { controlsList: 'nodownload noremoteplayback', disablePictureInPicture: true } : {})} onError={() => setFailed(prev => ({ ...prev, [item.id]: true }))} className="files-viewer-media max-h-full max-w-full rounded-sm bg-black" />
				) : (
					<div key={item.id} className="files-viewer-media max-w-xs text-center">
						<span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10"><Icon name="file" size={28} className="text-white/80" /></span>
						<p className="mt-4 break-words text-[15px]">{item.name}</p>
						<p className="mt-1 text-[13px] text-white/60">{broken ? 'This file can’t be previewed here.' : 'No preview for this type of file.'}</p>
					</div>
				)}
				{many && (
					<>
						<button type="button" onClick={() => step(-1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-95 md:grid md:left-5"><Icon name="chevronLeft" size={20} /></button>
						<button type="button" onClick={() => step(1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-95 md:grid md:right-5"><Icon name="chevronRight" size={20} /></button>
					</>
				)}
			</div>

			{note && <p className="px-4 pb-2 text-center text-[13px] text-white/60">{note(item)}</p>}
			{(thumbnails && many) ? (
				<div className="flex justify-center gap-2 overflow-x-auto px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 [scrollbar-width:none]">
					{items.map((entry, i) => (
						<button key={entry.id} type="button" onClick={() => onIndex(i)} aria-label={`Show ${i + 1} of ${items.length}`} aria-current={i === index ? 'true' : undefined}
							className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10 transition-opacity duration-150 ${i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-50 hover:opacity-80'}`}>
							{entry.kind === 'video'
								? <video src={`${entry.src}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
								: entry.kind === 'image' ? <img src={entry.src} alt="" className="h-full w-full object-cover" /> : <Icon name="file" size={18} className="mx-auto text-white/70" />}
						</button>
					))}
				</div>
			) : many ? (
				<p className="pb-[max(12px,env(safe-area-inset-bottom))] text-center text-[13px] tabular-nums text-white/60 sm:hidden">{index + 1} / {items.length}</p>
			) : <div className="pb-[env(safe-area-inset-bottom)]" />}
		</div>,
		document.body
	)
}
