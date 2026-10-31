import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'
import OrderOffers from '../../components/services/OrderOffers'
import { videoOf } from '../../components/freelancer/postMedia'
import MediaViewer from '../../components/ui/MediaViewer'
import { referenceVideos } from '../../components/storefront/referencePhotos'

const PAGE_SIZE = 21
// Vary card heights so the wall reads as a masonry grid even with same-ratio covers.
const RATIOS = ['aspect-[9/16]', 'aspect-[4/5]', 'aspect-[9/16]', 'aspect-square', 'aspect-[3/4]', 'aspect-[9/16]']

// Height per unit width for each card shape, used to keep the masonry columns even.
const RATIO_HEIGHT = { 'aspect-[9/16]': 16 / 9, 'aspect-[4/5]': 5 / 4, 'aspect-square': 1, 'aspect-[3/4]': 4 / 3 }
const COLUMN_STEPS = [[1280, 6], [1024, 4], [640, 3], [0, 2]]
const columnCount = () => COLUMN_STEPS.find(([min]) => window.innerWidth >= min)[1]

function useColumnCount() {
	const [count, setCount] = useState(columnCount)
	useEffect(() => {
		const onResize = () => setCount(columnCount())
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])
	return count
}

/** Deals cards into the shortest column, so every column fills (CSS columns leave the last one empty). */
const toColumns = (items, count) => {
	const cols = Array.from({ length: count }, () => ({ height: 0, items: [] }))
	items.forEach(item => {
		const target = cols.reduce((low, col) => (col.height < low.height ? col : low), cols[0])
		target.items.push(item)
		target.height += item.height
	})
	return cols.map(col => col.items)
}

const initialOf = name => (name || '').match(/\p{L}/u)?.[0]?.toUpperCase() || 'C'

/** Plays muted while at least half on screen; loads nothing until it first is. */
function useInViewPlayback(src) {
	const ref = useRef(null)
	useEffect(() => {
		const video = ref.current
		if (!video || !src || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const io = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				if (!video.src) video.src = src
				video.play().catch(() => {})
			} else video.pause()
		}, { threshold: 0.5 })
		io.observe(video)
		return () => io.disconnect()
	}, [src])
	return ref
}

function PostCard({ post, index }) {
	const video = videoOf(post)
	const videoRef = useInViewPlayback(video)
	const [viewing, setViewing] = useState(false)
	return (
		<article className="group relative overflow-hidden rounded-2xl bg-ink-100">
			<div className={video ? 'aspect-[9/16] bg-ink-900' : RATIOS[index % RATIOS.length]}>
				{video
					? <video ref={videoRef} poster={post.cover_image_url || undefined} muted loop playsInline preload="none" aria-label={post.title} className="h-full w-full object-cover" />
					: post.cover_image_url
						? <img src={post.cover_image_url} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
						: <div className="grid h-full w-full place-items-center p-4 text-center text-sm text-ink-500">{post.title}</div>}
			</div>
			{video && <button type="button" onClick={() => setViewing(true)} aria-label={`Play ${post.title}`} className="absolute inset-0 z-10 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">Play video</span></button>}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
				<p className="line-clamp-2 text-sm font-medium leading-snug">{post.title}</p>
				<div className="mt-2 flex items-center gap-2 text-xs text-white/85">
					<span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-[11px] font-semibold">
						{post.freelancer_avatar ? <img src={post.freelancer_avatar} alt="" className="h-full w-full object-cover" /> : initialOf(post.freelancer_name)}
					</span>
					<span className="truncate">{post.freelancer_name}</span>
				</div>
			</div>
			{viewing && <MediaViewer items={[{ id: post.id, src: video, kind: 'video', name: post.title }]} index={0} onIndex={() => {}} onClose={() => setViewing(false)} label="Video post" />}
		</article>
	)
}

/** A muted reel that loads on first view and plays only while it's on screen. */
function ReelCard({ clip }) {
	const ref = useInViewPlayback(clip.src)
	return (
		<Link to={`/services/${clip.slug}`} className="group relative block overflow-hidden rounded-2xl bg-ink-900">
			<div className="aspect-[9/16]">
				<video ref={ref} poster={clip.poster || undefined} muted loop playsInline preload="none" aria-label={clip.title} className="h-full w-full object-cover" />
			</div>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12 text-white">
				<p className="line-clamp-2 text-sm font-medium leading-snug">{clip.title.replace(/:\s*Reel$/i, '')}</p>
			</div>
		</Link>
	)
}

// TEMP-REFERENCE-VIDEOS: until freelancers post real reels, the wall is filled with the
// reference clips, and the generated gradient demo posts (/demo-posts/) are hidden.
const isGeneratedDemo = post => String(post.cover_image_url || '').startsWith('/demo-posts/')

/** Freelancer home: new order offers on top, then a wall of work posted on Creatyv. */
export default function Explore() {
	const sentinel = useRef(null)
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
		queryKey: ['explore-feed'],
		queryFn: ({ pageParam }) => api.get('/portfolio/feed', { params: { page: pageParam, limit: PAGE_SIZE } }).then(r => r.data.data.items),
		initialPageParam: 1,
		getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
	})
	const reels = referenceVideos()
	const posts = (data?.pages.flat() || []).filter(post => !reels.length || !isGeneratedDemo(post))
	// Reels are woven in every third slot so real posts still lead.
	const wall = []
	let r = 0
	posts.forEach((post, i) => {
		wall.push({ type: 'post', post })
		if (i % 2 === 1 && r < reels.length) wall.push({ type: 'reel', clip: reels[r++] })
	})
	while (r < reels.length) wall.push({ type: 'reel', clip: reels[r++] })

	useEffect(() => {
		const el = sentinel.current
		if (!el || !hasNextPage) return
		const io = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: '600px' })
		io.observe(el)
		return () => io.disconnect()
	}, [hasNextPage, isFetchingNextPage, fetchNextPage])

	const count = useColumnCount()
	const columns = 'columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-6'
	const sized = wall.map((item, i) => ({
		...item,
		index: i,
		height: item.type === 'reel' || (item.type === 'post' && videoOf(item.post)) ? 16 / 9 : RATIO_HEIGHT[RATIOS[i % RATIOS.length]],
	}))

	if (isLoading) {
		return (
			<div className={`${columns} px-3 py-6 md:px-4`} aria-busy="true">
				{Array.from({ length: 12 }, (_, i) => <div key={i} className={`mb-3 break-inside-avoid animate-pulse rounded-2xl bg-ink-100 ${RATIOS[i % RATIOS.length]}`} />)}
			</div>
		)
	}

	if (!wall.length) {
		return (
			<div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center font-store">
				<span className="grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="image" size={22} /></span>
				<h1 className="mt-4 text-xl font-semibold text-ink-900">No posts yet</h1>
				<p className="mt-1 text-[15px] text-ink-500">Work that freelancers post shows up here. Post yours so clients can see what you make.</p>
				<Link to="/profile?new=1" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-900 hover:bg-ink-50">
					<Icon name="plus" size={15} /> Create Post
				</Link>
			</div>
		)
	}

	return (
		<div className="px-3 py-6 md:px-4">
			<h1 className="sr-only">Explore</h1>
			<OrderOffers className="mb-6 font-store" />
			<div className="flex items-start gap-3">
				{toColumns(sized, count).map((col, c) => (
					<div key={c} className="flex min-w-0 flex-1 flex-col gap-3">
						{col.map(item => item.type === 'reel'
							? <ReelCard key={`reel-${item.clip.slug}`} clip={item.clip} />
							: <PostCard key={item.post.id} post={item.post} index={item.index} />)}
					</div>
				))}
			</div>
			<div ref={sentinel} className="h-8" />
			{isFetchingNextPage && <p className="py-4 text-center text-sm text-ink-500">Loading more…</p>}
		</div>
	)
}
