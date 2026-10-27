import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import { COMPLETION_QUERY_KEY, OPEN_COMPLETION_EVENT, fetchCompletion } from '../../components/freelancer/completionApi'

// Levels per category. There is no graded test yet: qualifying for a service
// means opting into it on My Services, so Apply Now goes there.
const CATEGORIES = [
	{
		key: 'video-editing',
		label: 'Video Editing',
		levels: [
			{ level: 1, title: 'Basic reel editing', hours: 8 },
			{ level: 2, title: 'Advanced reels and long-form edits', hours: 24 },
		],
	},
	{
		key: 'design',
		label: 'Design',
		levels: [
			{ level: 1, title: 'Social posts and thumbnails', hours: 8 },
			{ level: 2, title: 'Brand kits and campaign creatives', hours: 24 },
		],
	},
]

const FAQS = [
	['Who can apply?', 'Any freelancer who has finished their basic details, tools, at least 3 posts and KYC.'],
	['What happens after I qualify?', 'You can be auto-assigned paid orders for services in that category.'],
	['Can I apply for more than one category?', 'Yes. Each category has its own levels.'],
	['What is the time limit?', 'The time shown on each level is how long you have to submit once you start.'],
]

function Faq({ q, a }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="border-b border-ink-100">
			<button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-medium text-ink-900">
				{q}
				<Icon name="chevronDown" size={18} className={`shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
			</button>
			{open && <p className="pb-4 text-sm text-ink-600">{a}</p>}
		</div>
	)
}

/** Assessments: get qualified, by level, for each service category. */
export default function Assessments() {
	const [tab, setTab] = useState(CATEGORIES[0].key)
	const { data: completion } = useQuery({ queryKey: COMPLETION_QUERY_KEY, queryFn: fetchCompletion, staleTime: 30_000 })
	// Every step except "services" itself must be done before applying.
	const ready = completion?.steps?.filter(s => s.key !== 'services').every(s => s.done)
	const category = CATEGORIES.find(c => c.key === tab)

	return (
		<div className="mx-auto w-full max-w-[900px] px-4 py-8 font-store md:px-6">
			<h1 className="text-2xl font-semibold tracking-tight text-ink-900">Assessments</h1>
			<p className="mt-1 text-[15px] text-ink-500">Qualify for a service category to start getting orders in it.</p>

			{completion && !ready && (
				<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-amber-900">Complete your basic details, tools, posts, and KYC to apply for assessments.</p>
					<button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMPLETION_EVENT))} className="inline-flex h-9 shrink-0 items-center rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700">Complete profile</button>
				</div>
			)}

			<div role="tablist" className="mt-6 flex gap-2">
				{CATEGORIES.map(c => (
					<button key={c.key} type="button" role="tab" aria-selected={tab === c.key} onClick={() => setTab(c.key)}
						className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${tab === c.key ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'}`}>
						{c.label}
					</button>
				))}
			</div>

			<ul className="mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-100">
				{category.levels.map(l => (
					<li key={l.level} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
						<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-50 text-sm font-bold text-mint-600">L{l.level}</span>
						<div className="min-w-0 flex-1">
							<div className="font-medium text-ink-900">Level {l.level} – {l.title}</div>
							<div className="mt-0.5 inline-flex items-center gap-1 text-sm text-ink-500"><Icon name="clock" size={14} /> {l.hours} Hours Time limit</div>
						</div>
						{ready
							? <Link to="/my-services" className="inline-flex h-9 items-center justify-center rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700">Apply Now</Link>
							: <button type="button" disabled className="h-9 cursor-not-allowed rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-400">Apply Now</button>}
					</li>
				))}
			</ul>

			<h2 className="mt-10 text-lg font-semibold text-ink-900">Frequently asked questions</h2>
			<div className="mt-2">{FAQS.map(([q, a]) => <Faq key={q} q={q} a={a} />)}</div>
		</div>
	)
}
