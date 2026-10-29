import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { aiEditsApi } from '../../api/aiEdits'
import Icon from '../ui/Icon'
import { aiEditSummary } from './aiEditStatus'
import { referenceCover } from '../storefront/referencePhotos'

/** The client home's "Edit with AI" tab: their AI edits, or how to start one. */
export default function AiEditsPanel() {
	const { data: edits = [], isLoading } = useQuery({
		queryKey: ['ai-edits'],
		queryFn: () => aiEditsApi.list().then(res => res.data.data),
		refetchInterval: 60_000,
	})

	if (isLoading) return <div className="mt-10 h-40 animate-pulse rounded-2xl bg-ink-100" />

	if (!edits.length) {
		return (
			<section className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
				<div>
					<h2 className="text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">Edit your reels with AI</h2>
					<p className="mt-3 max-w-[48ch] text-lg text-ink-700">
						Pick a reel style and the Creatyv editor cuts, captions and renders it on your own computer, usually within an hour.
					</p>
					<Link to="/categories/video-editing" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 px-6 text-base font-semibold text-white transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">
						Pick a reel style <Icon name="arrowRight" size={16} />
					</Link>
				</div>
				<ol className="grid gap-5 self-center rounded-2xl bg-ink-50 p-5 text-[15px] md:p-6">
					<li><span className="font-medium text-ink-900">Choose the reel on its service page.</span> <span className="text-ink-600">Every reel style has a Make with AI option next to Hire freelancer.</span></li>
					<li><span className="font-medium text-ink-900">Pay once, install the helper once.</span> <span className="text-ink-600">A small download that does the editing on your computer.</span></li>
					<li><span className="font-medium text-ink-900">Edit right here in your browser.</span> <span className="text-ink-600">Add footage and a brief, approve the outline, get the reel. Your footage never leaves your computer.</span></li>
				</ol>
			</section>
		)
	}

	return (
		<section className="mt-10">
			<div className="mb-3 flex items-baseline gap-2.5">
				<h2 className="text-2xl font-medium tracking-tight text-ink-900 md:text-3xl">Your AI edits</h2>
				<span className="text-lg tabular-nums text-ink-900 md:text-xl">{edits.length}</span>
				<Link to="/categories/video-editing" className="ml-auto inline-flex shrink-0 items-center gap-1 text-[15px] font-medium text-ink-900 underline-offset-4 hover:underline">
					Start another <Icon name="arrowRight" size={14} />
				</Link>
			</div>
			<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">
				{edits.map(edit => {
					const state = aiEditSummary(edit)
					const cover = edit.cover_url || referenceCover(edit.template_slug)
					return (
						<li key={edit.id}>
							<Link to={`/ai-edits/${edit.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-ink-50/70 focus-visible:bg-ink-50/70 focus-visible:outline-none md:px-5">
								<div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-100 text-ink-400 md:h-14 md:w-20">
									{cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Icon name="sparkles" size={18} />}
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate text-[17px] font-medium text-ink-900">{edit.title}</div>
									<div className="mt-0.5 flex items-center gap-2 text-sm text-ink-600">
										<span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
										<span className="truncate">{state.text}</span>
									</div>
								</div>
								<span className="hidden shrink-0 text-sm tabular-nums text-ink-500 sm:block">{edit.videos} video{edit.videos === 1 ? '' : 's'}</span>
								<Icon name="chevronRight" size={16} className="shrink-0 text-ink-300 transition-colors group-hover:text-ink-600" />
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
