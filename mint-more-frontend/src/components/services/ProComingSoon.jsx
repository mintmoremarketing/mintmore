import Icon from '../ui/Icon'

// What the Pro Plan includes, in the words of the Terms of Use (Pro Plan clause).
const FEATURES = [
	{ icon: 'calendar', title: 'A content calendar', body: 'See every post for the month in one place and move things around as plans change.' },
	{ icon: 'send', title: 'Scheduling and publishing', body: 'Connect your social accounts and let posts go out on time, without you at the keyboard.' },
	{ icon: 'sparkles', title: 'AI for words, images and video', body: 'Higher generation limits for captions, visuals and short videos.' },
	{ icon: 'checks', title: 'Review and approval', body: 'Nothing goes live until you have seen it and said yes.' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// An illustrative week, not real data: it shows the shape of the calendar, so it says so on screen.
const POSTS = [
	{ day: 0, row: 0, kind: 'Reel', platform: 'instagram', state: 'Posted' },
	{ day: 1, row: 1, kind: 'Thumbnail', platform: 'youtube', state: 'Posted' },
	{ day: 2, row: 0, kind: 'Carousel', platform: 'instagram', state: 'Scheduled' },
	{ day: 3, row: 1, kind: 'Video', platform: 'youtube', state: 'In review' },
	{ day: 4, row: 0, kind: 'Reel', platform: 'instagram', state: 'Scheduled' },
	{ day: 5, row: 1, kind: 'Story', platform: 'facebook', state: 'Draft' },
	{ day: 6, row: 0, kind: 'Reel', platform: 'instagram', state: 'Draft' },
]

const STATE_STYLE = {
	Posted: 'bg-ink-100 text-ink-600',
	Scheduled: 'bg-orange-100 text-orange-800',
	'In review': 'bg-amber-100 text-amber-900',
	Draft: 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200',
}

function CalendarPreview() {
	return (
		<div className="relative rounded-2xl bg-[#f7f5f2] p-3 sm:p-4" aria-hidden="true">
			<div className="mb-3 flex items-center justify-between px-1">
				<span className="text-[15px] font-medium text-ink-900">This week</span>
				<span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 shadow-[0_1px_2px_rgb(0_0_0/0.06)]">Preview</span>
			</div>
			<div className="grid grid-cols-7 gap-1.5 sm:gap-2">
				{DAYS.map((day, index) => (
					<div key={day} className="flex min-w-0 flex-col gap-1.5 sm:gap-2">
						<span className="px-1 text-center text-[11px] font-medium text-ink-500 sm:text-xs">{day}</span>
						{[0, 1].map(row => {
							const post = POSTS.find(item => item.day === index && item.row === row)
							if (!post) return <div key={row} className="h-[76px] rounded-xl border border-dashed border-ink-200 sm:h-[92px]" />
							return (
								<div
									key={row}
									className="pro-preview-post flex h-[76px] min-w-0 flex-col justify-between rounded-xl bg-white p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_14px_-8px_rgb(120_40_0/0.25)] sm:h-[92px] sm:p-2"
									style={{ '--delay': `${index * 70 + row * 40}ms` }}
								>
									<Icon name={post.platform} size={14} className="text-ink-700" />
									<div className="min-w-0">
										<div className="truncate text-[11px] font-medium text-ink-900 sm:text-xs">{post.kind}</div>
										<span className={`mt-1 hidden truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:inline-block ${STATE_STYLE[post.state]}`}>{post.state}</span>
									</div>
								</div>
							)
						})}
					</div>
				))}
			</div>
		</div>
	)
}

/** The Creatyv Pro tab while the plan is still being built. */
export default function ProComingSoon({ onTryAi }) {
	return (
		<section className="grid items-start gap-10 py-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
			<div className="min-w-0">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
					<Icon name="clock" size={14} /> Coming soon
				</span>
				<h2 className="mt-4 max-w-[18ch] text-balance text-3xl font-medium tracking-tight text-ink-950 md:text-[40px] md:leading-[1.1]">
					Plan, make and post your content from one place
				</h2>
				<p className="mt-3 max-w-[56ch] text-pretty text-lg text-ink-700">
					Creatyv Pro brings your calendar, your AI tools and your social accounts together, so a month of posts is something you review rather than chase.
				</p>

				<ul className="mt-8 divide-y divide-ink-100 border-y border-ink-100">
					{FEATURES.map(feature => (
						<li key={feature.title} className="flex gap-4 py-4">
							<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7f5f2] text-ink-800">
								<Icon name={feature.icon} size={18} />
							</span>
							<div className="min-w-0">
								<div className="text-[17px] font-medium text-ink-900">{feature.title}</div>
								<p className="mt-0.5 text-[15px] text-ink-600">{feature.body}</p>
							</div>
						</li>
					))}
				</ul>

				<div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
					<button
						type="button"
						onClick={onTryAi}
						className="inline-flex h-12 items-center gap-1.5 rounded-full bg-ink-950 px-6 text-base font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
					>
						Edit with AI today <Icon name="arrowRight" size={16} />
					</button>
					<span className="text-[15px] text-ink-600">Pro will appear here when it opens.</span>
				</div>
			</div>

			<CalendarPreview />
		</section>
	)
}
