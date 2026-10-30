import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { mintboxApi } from '../../api/mintbox'
import Icon from '../../components/ui/Icon'
import MediaViewer from '../../components/ui/MediaViewer'

const contentUrl = (token) => (token ? `${api.defaults.baseURL}/mintbox/public/files/${token}/content` : '')
const kindOf = (file) => (file.mime_type?.startsWith('image/') ? 'image' : file.mime_type?.startsWith('video/') ? 'video' : 'file')
const monthKey = (at) => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const dayLabel = (at) => new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toUpperCase().slice(0, 4) : 'FILE')

const FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'image', label: 'Images' },
	{ value: 'video', label: 'Videos' },
	{ value: 'file', label: 'Other files' },
]

/** One delivered file. Media fills the square; anything else shows its type, never a broken image. */
function Tile({ file, index, onOpen }) {
	const kind = kindOf(file)
	const [broken, setBroken] = useState(false)
	const src = contentUrl(file.file_token)
	return (
		<li className="dash-rise" style={{ '--i': Math.min(index, 12) }}>
			<button
				type="button"
				onClick={onOpen}
				className="group block w-full text-left focus-visible:outline-none"
				aria-label={`Open ${file.original_name} from ${file.order_title}`}
			>
				<span className="relative block aspect-square overflow-hidden rounded-xl bg-ink-100 ring-offset-2 transition-shadow duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ink-900">
					{kind === 'image' && src && !broken ? (
						<img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]" />
					) : kind === 'video' && src && !broken ? (
						<>
							<video src={`${src}#t=0.5`} muted playsInline preload="metadata" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]" />
							<span className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"><Icon name="video" size={13} /></span>
						</>
					) : (
						<span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-500">
							<Icon name="file" size={26} />
							<span className="text-[12px] font-semibold tracking-[0.02em] text-ink-700">{extOf(file.original_name)}</span>
						</span>
					)}
				</span>
				<span className="mt-2 block truncate text-[14px] font-medium text-ink-900">{file.order_title}</span>
				<span className="block truncate text-[12px] text-ink-500">{dayLabel(file.created_at)}{file.status !== 'approved' ? ' · waiting for your review' : ''}</span>
			</button>
		</li>
	)
}

/** The shared full-screen viewer, with this page's actions: open the order's chat, download. */
function Viewer({ files, index, onIndex, onClose }) {
	const items = files.map(file => ({
		id: file.id,
		src: contentUrl(file.file_token),
		kind: kindOf(file),
		name: file.original_name,
		title: file.order_title,
		meta: `${file.original_name} · ${sizeLabel(Number(file.size_bytes || 0))} · ${dayLabel(file.created_at)}`,
		file,
		locked: !file.downloadable,
	}))
	return (
		<MediaViewer
			items={items}
			index={index}
			onIndex={onIndex}
			onClose={onClose}
			label="Delivered files"
			actions={({ file, src }) => (
				<>
					{file.room_id && (
						<Link to={`/chat?room=${file.room_id}`} className="hidden h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-medium transition-colors hover:bg-white/20 sm:inline-flex">
							<Icon name="chat" size={14} /> Open chat
						</Link>
					)}
					{file.downloadable && src && (
						<a href={`${src}?download=1`} download={file.original_name} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-ink-900 transition-transform active:scale-[0.97]">
							<Icon name="download" size={14} /> <span className="hidden sm:inline">Download</span>
						</a>
					)}
				</>
			)}
			note={({ file }) => (file.downloadable ? null : 'Approve this delivery in the order chat to download it.')}
		/>
	)
}

/**
 * The client's Files: everything their freelancers delivered, across every order, by month.
 * The per-order folders are still at /mintbox/folders.
 */
export default function Files() {
	const [params, setParams] = useSearchParams()
	const filter = FILTERS.some(f => f.value === params.get('type')) ? params.get('type') : 'all'
	const [open, setOpen] = useState(null)
	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ['mintbox-gallery'],
		queryFn: () => mintboxApi.getGallery().then(res => res.data.data.files),
	})
	const files = useMemo(() => data || [], [data])
	const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.value, f.value === 'all' ? files.length : files.filter(file => kindOf(file) === f.value).length])), [files])
	const shown = useMemo(() => (filter === 'all' ? files : files.filter(file => kindOf(file) === filter)), [files, filter])
	const months = useMemo(() => {
		const groups = []
		shown.forEach((file, index) => {
			const key = monthKey(file.created_at)
			if (groups.at(-1)?.key !== key) groups.push({ key, items: [] })
			groups.at(-1).items.push({ file, index })
		})
		return groups
	}, [shown])
	const orders = new Set(files.map(file => file.job_id)).size

	return (
		<div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-7 font-store md:px-8 md:pt-9">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-[26px] font-medium tracking-[-0.02em] text-ink-900 md:text-[30px]">Files</h1>
					<p className="mt-1 text-[15px] text-ink-600">
						{files.length ? <>Everything delivered to you, newest first. <span className="font-medium text-ink-900">{files.length} file{files.length === 1 ? '' : 's'}</span> from {orders} order{orders === 1 ? '' : 's'}.</> : 'Everything your freelancers deliver, by month.'}
					</p>
				</div>
				{files.length > 0 && (
					<div role="tablist" aria-label="Filter files" className="flex gap-1 rounded-full bg-ink-100 p-1">
						{FILTERS.filter(f => f.value === 'all' || counts[f.value] > 0).map(f => (
							<button
								key={f.value}
								type="button"
								role="tab"
								aria-selected={filter === f.value}
								onClick={() => setParams(f.value === 'all' ? {} : { type: f.value }, { replace: true })}
								className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${filter === f.value ? 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-600 hover:text-ink-900'}`}
							>
								{f.label} <span className="tabular-nums text-ink-500">{counts[f.value]}</span>
							</button>
						))}
					</div>
				)}
			</div>

			{isLoading ? (
				<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-ink-100" />)}</div>
			) : isError ? (
				<p className="mt-10 text-[15px] text-ink-600">Couldn't load your files. <button type="button" onClick={() => refetch()} className="font-medium text-ink-900 underline underline-offset-4">Try again</button></p>
			) : files.length === 0 ? (
				<div className="mt-10 max-w-md">
					<h2 className="text-xl font-medium text-ink-900">Nothing delivered yet</h2>
					<p className="mt-1 text-[15px] text-ink-600">When a freelancer delivers your work, it shows up here, grouped by month.</p>
					<Link to="/services" className="mt-5 inline-flex h-11 items-center rounded-xl bg-ink-900 px-5 text-[15px] font-medium text-white transition-transform active:scale-[0.97]">Browse services</Link>
				</div>
			) : (
				months.map(month => (
					<section key={month.key} className="mt-9">
						<div className="mb-3 flex items-baseline justify-between gap-3">
							<h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink-900">{monthLabel(month.key)}</h2>
							<span className="text-[13px] tabular-nums text-ink-500">{month.items.length} file{month.items.length === 1 ? '' : 's'}</span>
						</div>
						<ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
							{month.items.map(({ file, index }, i) => <Tile key={file.id} file={file} index={i} onOpen={() => setOpen(index)} />)}
						</ul>
					</section>
				))
			)}

			{open !== null && shown[open] && <Viewer files={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
		</div>
	)
}
