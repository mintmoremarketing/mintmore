// Web addresses in plain text: http(s)://… or www.…, stopping before trailing punctuation.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi

// Blue on light bubbles, as in WhatsApp; dark bubbles pass their own colour.
const LINK_TONE = 'text-[#0a66c2] decoration-[#0a66c2]/40 hover:decoration-[#0a66c2]'

/** Turns the web addresses in a message into links that open in a new tab. */
export function linkify(text, tone = LINK_TONE) {
	if (typeof text !== 'string' || !text) return text
	const parts = []
	let last = 0
	for (const match of text.matchAll(URL_PATTERN)) {
		if (match.index > last) parts.push(text.slice(last, match.index))
		const href = match[0].startsWith('www.') ? `https://${match[0]}` : match[0]
		parts.push(
			<a key={match.index} href={href} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className={`underline underline-offset-2 [overflow-wrap:anywhere] ${tone}`}>
				{match[0]}
			</a>
		)
		last = match.index + match[0].length
	}
	if (!parts.length) return text
	if (last < text.length) parts.push(text.slice(last))
	return parts
}
