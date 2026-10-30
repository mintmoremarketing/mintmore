import { useState } from 'react'
import Icon from '../ui/Icon'
import MediaViewer from '../ui/MediaViewer'
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
				<MediaViewer
					items={files.map(file => ({
						id: file.id,
						src: file.src,
						kind: file.file_mime?.startsWith('video/') ? 'video' : 'image',
						name: file.file_name || 'Shared image',
						meta: file.content || undefined,
					}))}
					index={active}
					onIndex={setActive}
					onClose={close}
					thumbnails
					label="Shared media"
				/>
			)}
		</>
	)
}
