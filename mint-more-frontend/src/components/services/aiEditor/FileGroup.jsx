import { useRef, useState } from 'react'
import Icon from '../../ui/Icon'
import { formatSize, helperApi, uploadToHelper } from '../../../api/helper'

const press = 'transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]'
const LINK_LABEL = { gdrive: 'Google Drive', 'gdrive-folder': 'Drive folder', dropbox: 'Dropbox', 'video-site': 'Video link', direct: 'Link', 'maybe-website': 'Web link' }

/** A dropped folder (Chrome and Edge) as a flat list of files. */
async function filesFromDrop(dataTransfer) {
	const entries = [...dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean)
	if (!entries.length) return [...dataTransfer.files]
	const out = []
	const walk = (entry) => new Promise((resolve) => {
		if (entry.isFile) return entry.file((file) => { out.push(file); resolve() }, resolve)
		const reader = entry.createReader()
		const all = []
		const read = () => reader.readEntries(async (batch) => {
			if (!batch.length) {
				for (const child of all) await walk(child)
				return resolve()
			}
			all.push(...batch)
			return read()
		}, resolve)
		return read()
	})
	for (const entry of entries) await walk(entry)
	return out.filter(file => !file.name.startsWith('.'))
}

/** One input group (A-roll, B-roll, references, audio, brand): files copied to the helper, or links. */
export default function FileGroup({ jobId, group, items, locked }) {
	const [over, setOver] = useState(false)
	const [uploads, setUploads] = useState([])
	const [link, setLink] = useState('')
	const [linkError, setLinkError] = useState('')
	const fileInput = useRef(null)

	const send = async (files) => {
		for (const file of files) {
			const key = `${file.name}-${file.size}-${Math.random()}`
			setUploads(list => [...list, { key, name: file.name, size: file.size, progress: 0 }])
			try {
				await uploadToHelper(jobId, group.id, file, progress => setUploads(list => list.map(u => (u.key === key ? { ...u, progress } : u))))
				setUploads(list => list.filter(u => u.key !== key))
			} catch (error) {
				setUploads(list => list.map(u => (u.key === key ? { ...u, error: error.message } : u)))
			}
		}
	}

	const addLink = async (url) => {
		setLinkError('')
		try {
			await helperApi.addLink(jobId, group.id, url)
			setLink('')
		} catch (error) {
			setLinkError(error.message)
		}
	}

	const onDrop = async (event) => {
		event.preventDefault()
		setOver(false)
		if (locked) return
		const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
		const files = await filesFromDrop(event.dataTransfer)
		if (files.length) send(files)
		else if (/^https?:\/\//.test(text)) addLink(text.split('\n')[0])
	}

	const mine = items.filter(item => item.group === group.id)

	return (
		<section
			className={`rounded-xl border bg-white p-4 transition-colors duration-150 ${over ? 'border-ink-900' : 'border-ink-200'}`}
			onDragOver={(event) => { event.preventDefault(); if (!locked) setOver(true) }}
			onDragLeave={() => setOver(false)}
			onDrop={onDrop}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h4 className="font-medium text-ink-900">{group.label}</h4>
					<p className="mt-0.5 text-sm text-ink-600">{group.hint}</p>
				</div>
				{!locked && (
					<button type="button" onClick={() => fileInput.current?.click()} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink-200 px-3.5 text-sm font-medium text-ink-900 hover:border-ink-400 ${press}`}>
						<Icon name="plus" size={14} /> Add files
					</button>
				)}
			</div>
			<input ref={fileInput} type="file" multiple hidden onChange={(event) => { send([...event.target.files]); event.target.value = '' }} />

			{(mine.length > 0 || uploads.length > 0) && (
				<ul className="mt-3 divide-y divide-ink-100">
					{uploads.map(upload => (
						<li key={upload.key} className="flex items-center gap-3 py-2 text-sm">
							<span className="min-w-0 flex-1 truncate text-ink-900">{upload.name}</span>
							{upload.error
								? <span className="text-red-700">{upload.error}</span>
								: <span className="tabular-nums text-ink-600">{Math.round(upload.progress * 100)}% of {formatSize(upload.size)}</span>}
						</li>
					))}
					{mine.map(item => {
						const busy = item.status === 'downloading' || item.status === 'queued'
						return (
							<li key={item.id} className="flex items-center gap-3 py-2 text-sm">
								<span className="min-w-0 flex-1 truncate text-ink-900" title={item.url || item.name}>{item.name}</span>
								<span className={`shrink-0 tabular-nums ${item.status === 'error' ? 'text-red-700' : 'text-ink-600'}`}>
									{item.status === 'error'
										? item.error
										: busy
											? `${LINK_LABEL[item.linkType] || 'Link'}, downloading ${item.progress ? `${Math.round(item.progress * 100)}%` : '…'}`
											: item.kind === 'website' ? 'Website' : formatSize(item.size)}
								</span>
								{!locked && !busy && (
									<button type="button" onClick={() => helperApi.removeItem(jobId, item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label={`Remove ${item.name}`}>
										<Icon name="x" size={14} />
									</button>
								)}
							</li>
						)
					})}
				</ul>
			)}

			{!locked && (
				<form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (link.trim()) addLink(link.trim()) }}>
					<input
						value={link}
						onChange={(event) => setLink(event.target.value)}
						placeholder="Or paste a link: Drive, Dropbox, YouTube, Instagram, a website"
						className="h-10 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none"
						aria-label={`Link for ${group.label}`}
					/>
					<button disabled={!link.trim()} className={`h-10 shrink-0 rounded-lg bg-ink-100 px-3.5 text-sm font-medium text-ink-900 hover:bg-ink-200 disabled:opacity-50 ${press}`}>Add</button>
				</form>
			)}
			{linkError && <p className="mt-2 text-sm text-red-700" role="alert">{linkError}</p>}
		</section>
	)
}
