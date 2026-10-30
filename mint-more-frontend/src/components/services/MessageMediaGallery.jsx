import { useState } from 'react'
import Icon from '../ui/Icon'
import { api } from '../../api/client'

const mediaUrl = (message) => message.file_token ? `${api.defaults.baseURL}/mintbox/public/files/${message.file_token}/content` : ''

export default function MessageMediaGallery({ messages, mine, time, receipt, tail }) {
	const [active, setActive] = useState(null)
	const files = messages.map(message => ({ ...message, src: mediaUrl(message) }))
	const visible = files.slice(0, 4)
	const close = () => setActive(null)
	return (
		<>
			<div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
				<div className={`max-w-[min(440px,86%)] rounded-2xl p-2 ${mine ? `bg-[#d9fdd3] ${tail ? 'rounded-br-md' : ''}` : `bg-white ${tail ? 'rounded-bl-md' : ''}`} shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]`}>
					<div className={`grid gap-1 overflow-hidden rounded-xl ${visible.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
						{visible.map((file, index) => (
							<button key={file.id} type="button" onClick={() => setActive(index)} aria-label={`Open media ${index + 1} of ${files.length}`} className="relative aspect-square min-w-0 overflow-hidden bg-ink-100">
								{file.file_mime?.startsWith('video/')
									? <video src={file.src} muted preload="metadata" className="h-full w-full object-cover" />
									: <img src={file.src} alt={file.file_name || 'Shared image'} loading="lazy" className="h-full w-full object-cover" />}
								{index === 3 && files.length > 4 && <span className="absolute inset-0 grid place-items-center bg-black/55 text-2xl font-semibold text-white">+{files.length - 4}</span>}
								{file.content && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-5 text-left text-xs text-white">{file.content}</span>}
							</button>
						))}
					</div>
					<div className={`flex items-center justify-end gap-1 px-1 pt-1 text-[11px] ${mine ? 'text-[#526b5b]' : 'text-ink-500'}`}>
						{time}{mine && receipt && <Icon name={receipt === 'read' ? 'checks' : 'check'} size={13} className={receipt === 'read' ? 'text-sky-500' : ''} />}
					</div>
				</div>
			</div>
			{active !== null && (
				<div className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-4 text-white" role="dialog" aria-modal="true" aria-label="Shared media gallery">
					<div className="flex items-center justify-between"><span className="text-sm">{active + 1} / {files.length}</span><button type="button" onClick={close} aria-label="Close gallery" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"><Icon name="x" size={22} /></button></div>
					<div className="flex min-h-0 flex-1 items-center justify-center py-4">
						{files[active].file_mime?.startsWith('video/')
							? <video src={files[active].src} controls autoPlay className="max-h-full max-w-full" />
							: <img src={files[active].src} alt={files[active].file_name || 'Shared image'} className="max-h-full max-w-full object-contain" />}
					</div>
					<div className="flex gap-2 overflow-x-auto py-2">{files.map((file, index) => <button key={file.id} type="button" onClick={() => setActive(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${active === index ? 'ring-white' : 'ring-transparent'}`}>
						{file.file_mime?.startsWith('video/') ? <video src={file.src} muted preload="metadata" className="h-full w-full object-cover" /> : <img src={file.src} alt="" className="h-full w-full object-cover" />}
					</button>)}</div>
				</div>
			)}
		</>
	)
}
