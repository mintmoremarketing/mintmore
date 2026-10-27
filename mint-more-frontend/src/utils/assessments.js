// Formatting shared by the assessment list, detail and attempt pages.

export const durationLabel = (minutes) => {
	const m = Number(minutes) || 0
	if (m % 1440 === 0) { const d = m / 1440; return `${d} ${d === 1 ? 'Day' : 'Days'}` }
	if (m % 60 === 0) { const h = m / 60; return `${h} ${h === 1 ? 'Hour' : 'Hours'}` }
	return `${m} min`
}

export const sizeLabel = (mb) => (Number(mb) >= 1024 ? `${+(Number(mb) / 1024).toFixed(1)} GB` : `${mb} MB`)

export const bytesLabel = (bytes) => {
	const b = Number(bytes) || 0
	if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
	if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`
	return `${Math.max(1, Math.round(b / 1024))} KB`
}

/** "02:14:09" for a positive gap in ms. */
export const clock = (ms) => {
	const s = Math.max(0, Math.floor(ms / 1000))
	const pad = n => String(n).padStart(2, '0')
	return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** "3h 20m" style gap, used for "Overdue by". */
export const roughGap = (ms) => {
	const mins = Math.max(1, Math.round(Math.abs(ms) / 60000))
	if (mins < 60) return `${mins}m`
	const h = Math.floor(mins / 60)
	if (h < 48) return `${h}h ${mins % 60}m`
	return `${Math.round(h / 24)} days`
}

export const dateTime = (value) => (value
	? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
	: '—')

export const dateOnly = (value) => (value
	? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
	: '—')

export const fileExt = (name = '') => (name.includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : 'FILE')

// Action buttons: full width on phones, a fixed 210px column on desktop.
export const BTN = 'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-[15px] font-medium whitespace-nowrap transition-colors duration-150 md:w-[210px]'
export const BTN_DARK = `${BTN} bg-ink-900 text-white hover:bg-ink-700`
export const BTN_LINE = `${BTN} border border-ink-200 bg-white text-ink-900 hover:border-ink-300`
export const BTN_OFF = 'cursor-not-allowed opacity-50'
