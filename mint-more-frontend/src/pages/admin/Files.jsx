import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { mintboxApi } from '../../api/mintbox'
import Icon from '../../components/ui/Icon'
import MediaViewer from '../../components/ui/MediaViewer'
import { AdminPage, EmptyState, PageHeader, Panel } from '../../components/admin/AdminUI'

const FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'image', label: 'Images' },
	{ value: 'video', label: 'Videos' },
]
const kindOf = file => (String(file.mime_type || '').startsWith('image/') ? 'image' : 'video')
const sizeLabel = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const dayLabel = at => new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const monthKey = at => { const date = new Date(at); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = key => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

function Tile({ file, index, onOpen }) {
	const kind = kindOf(file)
	return (
		<li className="dash-rise" style={{ '--i': Math.min(index, 12) }}>
			<button type="button" onClick={onOpen} className="group block w-full text-left focus-visible:outline-none" aria-label={`Open ${file.original_name}`}>
				<span className="relative block aspect-square overflow-hidden rounded-xl bg-ink-100 ring-offset-2 transition-shadow duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ink-900">
					{file.preview_url ? kind === 'image' ? (
						<img src={file.preview_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]" />
					) : (
						<><video src={`${file.preview_url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]" /><span className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"><Icon name="video" size={13} /></span></>
					) : <span className="flex h-full items-center justify-center text-ink-400"><Icon name={kind === 'video' ? 'video' : 'image'} size={28} /></span>}
				</span>
				<span className="mt-2 block truncate text-[14px] font-medium text-ink-900">{file.original_name}</span>
				<span className="block truncate text-[12px] text-ink-500">{file.order_title} · {dayLabel(file.created_at)}</span>
			</button>
		</li>
	)
}

function Viewer({ files, index, onIndex, onClose }) {
	const items = files.map(file => ({ id: file.id, src: file.preview_url, kind: kindOf(file), name: file.original_name, title: file.order_title, meta: `${file.creator_name || 'Creator'} · ${file.client_name || 'Client'} · ${sizeLabel(Number(file.size_bytes || 0))}`, file }))
	return <MediaViewer items={items} index={index} onIndex={onIndex} onClose={onClose} label="Admin media gallery" thumbnails actions={({ file, src }) => src && <a href={src} download={file.original_name} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-ink-900 transition-transform active:scale-[0.97]"><Icon name="download" size={14} /> <span className="hidden sm:inline">Download</span></a>} />
}

export default function AdminFiles() {
	const [params, setParams] = useSearchParams()
	const filter = FILTERS.some(item => item.value === params.get('type')) ? params.get('type') : 'all'
	const [open, setOpen] = useState(null)
	const { data: files = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin-mintbox-gallery'], queryFn: () => mintboxApi.adminGallery().then(res => res.data.data.files || []), refetchInterval: 60_000 })
	const counts = useMemo(() => Object.fromEntries(FILTERS.map(item => [item.value, item.value === 'all' ? files.length : files.filter(file => kindOf(file) === item.value).length])), [files])
	const shown = useMemo(() => filter === 'all' ? files : files.filter(file => kindOf(file) === filter), [files, filter])
	const months = useMemo(() => shown.reduce((groups, file, index) => { const key = monthKey(file.created_at); let group = groups.at(-1); if (!group || group.key !== key) { group = { key, items: [] }; groups.push(group) } group.items.push({ file, index }); return groups }, []), [shown])

	return <AdminPage wide>
		<PageHeader title="Files" description="All approved and delivered images and videos, streamed directly from R2 for operations review." actions={files.length > 0 && <div role="tablist" aria-label="Filter files" className="flex gap-1 rounded-full bg-ink-100 p-1">{FILTERS.map(item => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} onClick={() => setParams(item.value === 'all' ? {} : { type: item.value }, { replace: true })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${filter === item.value ? 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-600 hover:text-ink-900'}`}>{item.label} <span className="tabular-nums text-ink-500">{counts[item.value]}</span></button>)}</div>} />
		<Panel>
			{isLoading ? <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-xl bg-ink-100" />)}</div> : isError ? <p className="px-5 py-8 text-sm text-ink-600">Couldn’t load media. <button type="button" onClick={() => refetch()} className="font-medium text-ink-900 underline underline-offset-4">Try again</button></p> : shown.length === 0 ? <EmptyState title="No media files yet" body="Images and videos delivered through Creatyv will appear here." /> : <div className="px-5 pb-7">{months.map(month => <section key={month.key} className="mt-7 first:mt-5"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{monthLabel(month.key)}</h2><span className="text-[13px] tabular-nums text-ink-500">{month.items.length} file{month.items.length === 1 ? '' : 's'}</span></div><ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">{month.items.map(({ file, index }) => <Tile key={file.id} file={file} index={index} onOpen={() => setOpen(index)} />)}</ul></section>)}</div>}
		</Panel>
		{open !== null && shown[open] && <Viewer files={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
	</AdminPage>
}
