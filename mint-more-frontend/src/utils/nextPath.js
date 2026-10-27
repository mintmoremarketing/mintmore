// Post-login return path from ?next=. Only same-origin app paths are allowed.
export function nextPathFromSearch(search, fallback) {
	const next = new URLSearchParams(search).get('next')
	if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next
	return fallback
}
