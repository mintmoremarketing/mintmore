import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'

const PAGE_SIZE = 21
// Vary card heights so the wall reads as a masonry grid even with same-ratio covers.
const RATIOS = ['aspect-[9/16]', 'aspect-[4/5]', 'aspect-[9/16]', 'aspect-square', 'aspect-[3/4]', 'aspect-[9/16]']

const initialOf = name => (name || '').match(/\p{L}/u)?.[0]?.toUpperCase() || 'C'

function PostCard({ post, index }) {
	return (
		<article className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-ink-100">
			<div className={RATIOS[index % RATIOS.length]}>
				{post.cover_image_url
					? <img src={post.cover_image_url} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
					: <div className="grid h-full w-full place-items-center p-4 text-center text-sm text-ink-500">{post.title}</div>}
			</div>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
				<p className="line-clamp-2 text-sm font-medium leading-snug">{post.title}</p>
				<div className="mt-2 flex items-center gap-2 text-xs text-white/85">
					<span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-[11px] font-semibold">
						{post.freelancer_avatar ? <img src={post.freelancer_avatar} alt="" className="h-full w-full object-cover" /> : initialOf(post.freelancer_name)}
					</span>
					<span className="truncate">{post.freelancer_name}</span>
				</div>
			</div>
		</article>
	)
}

/** Freelancer home: a wall of work posted by freelancers on Creatyv. */
export default function Explore() {
	const sentinel = useRef(null)
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
		queryKey: ['explore-feed'],
		queryFn: ({ pageParam }) => api.get('/portfolio/feed', { params: { page: pageParam, limit: PAGE_SIZE } }).then(r => r.data.data.items),
		initialPageParam: 1,
		getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : undefined),
	})
	const posts = data?.pages.flat() || []

	useEffect(() => {
		const el = sentinel.current
		if (!el || !hasNextPage) return
		const io = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: '600px' })
		io.observe(el)
		return () => io.disconnect()
	}, [hasNextPage, isFetchingNextPage, fetchNextPage])

	const columns = 'columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-6'

	if (isLoading) {
		return (
			<div className={`${columns} px-3 py-6 md:px-4`} aria-busy="true">
				{Array.from({ length: 12 }, (_, i) => <div key={i} className={`mb-3 break-inside-avoid animate-pulse rounded-2xl bg-ink-100 ${RATIOS[i % RATIOS.length]}`} />)}
			</div>
		)
	}

	if (!posts.length) {
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
			<div className={columns}>
				{posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
			</div>
			<div ref={sentinel} className="h-8" />
			{isFetchingNextPage && <p className="py-4 text-center text-sm text-ink-500">Loading more…</p>}
		</div>
	)
}
