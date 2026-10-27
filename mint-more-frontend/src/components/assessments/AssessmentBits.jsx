import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import { OPEN_COMPLETION_EVENT } from '../freelancer/completionApi'

import { BTN, BTN_DARK, BTN_LINE, BTN_OFF } from '../../utils/assessments'

/** The one action a level row offers, picked by the server-side state. */
export function LevelAction({ level }) {
	const detail = `/assessments/${level.slug}`
	const attempt = level.latest_attempt ? `/assessments/attempts/${level.latest_attempt.id}` : null
	switch (level.state) {
		case 'held':
			return <Link to={attempt || detail} className={`${BTN} bg-mint-500 text-white hover:bg-mint-600`}><Icon name="checkCircle" size={16} /> Passed</Link>
		case 'in_progress':
			return <Link to={attempt} className={BTN_DARK}>Continue</Link>
		case 'submitted':
			return <Link to={attempt} className={BTN_LINE}>Under review</Link>
		case 'cooldown':
			return <Link to={attempt || detail} className={BTN_LINE} title="See the result and when you can retake it">Not approved</Link>
		case 'profile_required':
			return <span aria-disabled="true" className={`${BTN_DARK} ${BTN_OFF}`}>Apply now</span>
		case 'busy':
			return <span className={`${BTN_LINE} ${BTN_OFF}`} title="Finish the assessment you already started">Finish current first</span>
		case 'no_attempts_left':
			return attempt
				? <Link to={attempt} className={BTN_LINE}>No attempts left</Link>
				: <span className={`${BTN_LINE} ${BTN_OFF}`}>No attempts left</span>
		default:
			return <Link to={detail} className={BTN_DARK}>Apply now</Link>
	}
}

/** Shown while basic details, tools, posts or KYC are missing. */
export function ProfileNotice({ className = '' }) {
	return (
		<div className={`flex flex-col gap-3 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-800 sm:flex-row sm:items-center sm:justify-between ${className}`}>
			<p><span className="font-semibold">Before you apply:</span> finish your basic details, tools, 3 portfolio posts and KYC.</p>
			<button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMPLETION_EVENT))} className="shrink-0 self-start rounded-md text-sm font-semibold text-mint-700 underline underline-offset-2 hover:text-mint-900 sm:self-auto">
				Complete profile
			</button>
		</div>
	)
}

/** Grey rounded block used for every side panel and section card. */
export function Block({ title, children, className = '' }) {
	return (
		<section className={`rounded-2xl bg-ink-50 p-5 md:p-6 ${className}`}>
			{title && <h2 className="mb-4 text-lg font-semibold text-ink-900 md:text-xl">{title}</h2>}
			{children}
		</section>
	)
}

export function Chip({ children, tone = 'ink' }) {
	const tones = {
		ink: 'border border-ink-200 bg-white text-ink-800',
		mint: 'bg-mint-50 text-mint-700',
		sky: 'bg-sky-50 text-sky-800',
	}
	return <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${tones[tone]}`}>{children}</span>
}

/** Label on the left, value on the right, hairline between rows. */
export function SpecRow({ label, children }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b border-ink-200/70 py-3 first:pt-0 last:border-0 last:pb-0">
			<span className="text-[15px] font-medium text-ink-900">{label}</span>
			<span className="text-right text-sm text-ink-500">{children}</span>
		</div>
	)
}

export function Checklist({ items }) {
	return (
		<ul className="space-y-1.5">
			{items.map(item => (
				<li key={item} className="flex gap-2 text-sm text-ink-600"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-mint-500" />{item}</li>
			))}
		</ul>
	)
}
