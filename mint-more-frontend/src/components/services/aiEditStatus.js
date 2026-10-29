/** What a paid AI video is doing, as the helper last reported it. */
export const APP_STATE = {
	draft: { text: 'Adding footage', dot: 'bg-ink-300' },
	queued: { text: 'Waiting to start', dot: 'bg-amber-400' },
	planning: { text: 'Planning the edit', dot: 'bg-amber-400' },
	plan_ready: { text: 'Plan ready to review', dot: 'bg-orange-500' },
	building: { text: 'Editing and rendering', dot: 'bg-amber-400' },
	done: { text: 'Video ready', dot: 'bg-emerald-500' },
	failed: { text: 'Needs attention', dot: 'bg-red-500' },
	stopped: { text: 'Stopped', dot: 'bg-ink-300' },
	interrupted: { text: 'Paused, open it to continue', dot: 'bg-red-500' },
}

/** One line for a whole AI edit: unpaid, not started, or how its videos are doing. */
export const aiEditSummary = (edit) => {
	if (edit.status !== 'paid') return { text: 'Not paid yet', dot: 'bg-ink-300' }
	const states = edit.unlocks.map(u => u.app_state).filter(Boolean)
	if (!edit.used) return { text: 'Paid, ready to edit', dot: 'bg-orange-500' }
	const done = states.filter(s => s === 'done').length
	if (done === edit.videos) return APP_STATE.done
	const latest = edit.unlocks.filter(u => u.app_state_at).sort((a, b) => new Date(b.app_state_at) - new Date(a.app_state_at))[0]
	const state = APP_STATE[latest?.app_state] || APP_STATE.draft
	return edit.videos > 1 ? { ...state, text: `${done} of ${edit.videos} ready · ${state.text.toLowerCase()}` } : state
}
