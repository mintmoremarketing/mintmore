import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Icon from '../ui/Icon'
import { COMPLETION_QUERY_KEY, OPEN_COMPLETION_EVENT, fetchCompletion } from './completionApi'

/**
 * What stands between a freelancer and their first order, said once at the top of a page.
 * Passed an assessment but offers nothing: opt in now. Otherwise, while the profile is
 * unfinished (and `showProfile` is set): what's left. Nothing once they're set up.
 */
export default function OptInPrompt({ showProfile = true, className = '' }) {
	const { data } = useQuery({ queryKey: COMPLETION_QUERY_KEY, queryFn: fetchCompletion, staleTime: 30_000 })
	if (!data || data.isComplete) return null
	const services = data.steps.find(step => step.key === 'services')
	const left = data.total - data.completed

	if (services && !services.done && services.qualified) {
		return (
			<section className={`dash-rise flex flex-col gap-4 rounded-2xl bg-ink-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between md:p-6 ${className}`} aria-labelledby="optin-title">
				<div className="min-w-0">
					<h2 id="optin-title" className="text-[19px] font-semibold tracking-[-0.01em]">You aren't offering any services yet</h2>
					<p className="mt-1 max-w-[60ch] text-[15px] text-white/75">You passed your assessment. Turn on the services you'll deliver and orders start coming to you.</p>
				</div>
				<Link to="/my-services" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-ink-900 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">
					Opt in now <Icon name="arrowRight" size={16} />
				</Link>
			</section>
		)
	}

	if (!showProfile) return null
	return (
		<section className={`dash-rise flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between ${className}`} aria-labelledby="profile-left-title">
			<div className="flex min-w-0 items-center gap-4">
				<span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink-900">{data.percent}%</span>
				<div className="min-w-0">
					<h2 id="profile-left-title" className="text-[16px] font-semibold text-ink-900">Finish your profile</h2>
					<p className="text-[14px] text-ink-600">{left} step{left === 1 ? '' : 's'} left before orders can reach you.</p>
				</div>
			</div>
			<button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMPLETION_EVENT))} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-ink-200 px-5 text-[15px] font-medium text-ink-900 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.97]">
				See what's left <Icon name="arrowRight" size={16} />
			</button>
		</section>
	)
}
