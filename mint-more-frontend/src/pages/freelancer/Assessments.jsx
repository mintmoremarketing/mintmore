import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import { assessmentsApi } from '../../api/assessments'
import { LevelAction, ProfileNotice } from '../../components/assessments/AssessmentBits'
import { durationLabel } from '../../utils/assessments'

const FAQS = [
	['What is an assessment?', 'A timed task for one skill level, set and reviewed by the Creatyv team. Pass it and the services that need that level open up on My Services, so you can be matched to paid orders.'],
	['How long do I have?', 'The clock starts when you press Start and runs for the time shown on the level. You can still submit after it runs out, but the reviewer will see it was late.'],
	['What happens after I submit?', 'Your work goes to review. You get a notification with the result, and if it was not approved the feedback is on the assessment page.'],
	['Can I retry if I fail?', 'Yes, once the waiting period for that level has passed and while you still have attempts left. Other levels stay open in the meantime.'],
	['Do I need to pass Level 1 before Level 2?', 'No. Take levels in any order. You can only have one assessment in progress at a time.'],
]

function Faq({ q, a, open, onToggle }) {
	return (
		<div className="rounded-xl bg-ink-50">
			<button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-[15px] font-medium text-ink-900 md:px-5">
				{q}
				<Icon name="chevronDown" size={18} className={`shrink-0 text-ink-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
			</button>
			{open && <p className="px-4 pb-4 text-sm leading-relaxed text-ink-600 md:px-5">{a}</p>}
		</div>
	)
}

function LevelRow({ level }) {
	return (
		<li className="flex flex-col gap-3 rounded-2xl bg-ink-50 p-3 sm:flex-row sm:items-center sm:gap-4 md:p-4">
			<div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
				<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-ink-900 md:h-[52px] md:w-[52px]">L{level.level}</span>
				<div className="min-w-0">
					<div className="text-[15px] font-medium text-ink-900 md:text-lg">Level {level.level} – {level.level_name}</div>
					<div className="mt-0.5 text-sm text-ink-500 sm:hidden">{durationLabel(level.duration_minutes)} time limit</div>
				</div>
			</div>
			<div className="hidden shrink-0 text-[15px] text-ink-700 sm:block md:w-40 md:text-right">{durationLabel(level.duration_minutes)} time limit</div>
			<div className="shrink-0"><LevelAction level={level} /></div>
		</li>
	)
}

function ListSkeleton() {
	return (
		<ul className="mt-4 space-y-3">
			{[0, 1].map(i => <li key={i} className="h-[76px] animate-pulse rounded-2xl bg-ink-50" />)}
		</ul>
	)
}

/** Assessments: get qualified, level by level, for each service category. */
export default function Assessments() {
	const [params, setParams] = useSearchParams()
	const [openFaq, setOpenFaq] = useState(0)
	const { data, isLoading, isError } = useQuery({
		queryKey: ['assessments'],
		queryFn: () => assessmentsApi.list().then(res => res.data.data),
	})
	const categories = data?.categories || []
	const active = categories.find(c => c.slug === params.get('category')) || categories[0]

	return (
		<div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 font-store md:px-10 md:pt-10">
			<h1 className="text-[28px] font-medium tracking-[-0.02em] text-ink-900 md:text-[40px]">Assessments</h1>
			<p className="mt-2 text-[15px] text-ink-500 md:text-base">Pass a level to qualify for the services that need it, and start getting orders.</p>

			{data && !data.profile.ready && <ProfileNotice className="mt-5" />}

			{data?.open_attempt_id && (
				<Link to={`/assessments/attempts/${data.open_attempt_id}`} className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3 text-sm text-ink-800 transition-colors hover:border-ink-300">
					<span><span className="font-semibold">You have an assessment in progress.</span> Pick up where you left off.</span>
					<Icon name="arrowRight" size={16} className="shrink-0" />
				</Link>
			)}

			{categories.length > 1 && (
				<div role="tablist" aria-label="Category" className="mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-ink-50 p-1.5 md:mt-8 md:p-2">
					{categories.map(c => {
						const on = c.id === active?.id
						return (
							<button key={c.id} type="button" role="tab" aria-selected={on}
								onClick={() => setParams(p => { const next = new URLSearchParams(p); next.set('category', c.slug); return next }, { replace: true })}
								className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 md:px-4 md:py-2 md:text-base ${on ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-white'}`}>
								{c.name}
							</button>
						)
					})}
				</div>
			)}

			<div className="mt-4 border-t border-ink-100 md:mt-6" />

			{isLoading ? <ListSkeleton /> : isError ? (
				<p className="mt-6 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">Assessments could not load right now. Refresh to try again.</p>
			) : !active ? (
				<p className="mt-6 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">No assessments are open yet. New levels will show up here.</p>
			) : (
				<ul className="mt-4 space-y-3 md:mt-6 md:space-y-4">
					{active.levels.map(level => <LevelRow key={level.id} level={level} />)}
				</ul>
			)}

			<section className="mt-14 grid gap-6 md:mt-20 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
				<div>
					<h2 className="text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink-900 md:text-[40px]">Frequently asked questions</h2>
					<p className="mt-3 text-[15px] text-ink-500">Something else on your mind? <Link to="/disputes" className="font-medium text-ink-900 underline underline-offset-2">Contact support</Link></p>
				</div>
				<div className="space-y-2">
					{FAQS.map(([q, a], i) => <Faq key={q} q={q} a={a} open={openFaq === i} onToggle={() => setOpenFaq(o => (o === i ? -1 : i))} />)}
				</div>
			</section>
		</div>
	)
}
