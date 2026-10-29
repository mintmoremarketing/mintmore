// The editor's outline and delivery notes are Markdown it writes itself. This renders the parts it
// uses (headings, lists, tables, bold, code) as React elements: no HTML from the file is ever
// injected, so a reference website's text can't become markup on Creatyv.

const inline = (text, keyBase) => {
	const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
	return parts.map((part, index) => {
		const key = `${keyBase}-${index}`
		if (part.startsWith('**') && part.endsWith('**')) return <strong key={key} className="font-semibold text-ink-900">{part.slice(2, -2)}</strong>
		if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="rounded bg-ink-100 px-1 text-[0.92em]">{part.slice(1, -1)}</code>
		return part
	})
}

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())

export default function PlainMarkdown({ source }) {
	const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
	const blocks = []
	let index = 0
	while (index < lines.length) {
		const line = lines[index]
		const key = `b${index}`
		if (!line.trim()) { index += 1; continue }
		const heading = /^(#{1,4})\s+(.*)$/.exec(line)
		if (heading) {
			const level = heading[1].length
			const size = level <= 2 ? 'text-lg' : 'text-base'
			blocks.push(<p key={key} className={`mt-6 font-medium text-ink-900 first:mt-0 ${size}`}>{inline(heading[2], key)}</p>)
			index += 1
			continue
		}
		if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] || '')) {
			const head = cells(line)
			const rows = []
			index += 2
			while (index < lines.length && /^\s*\|/.test(lines[index])) { rows.push(cells(lines[index])); index += 1 }
			blocks.push(
				<div key={key} className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[480px] text-left text-sm">
						<thead><tr className="border-b border-ink-200">{head.map((cell, i) => <th key={i} className="py-2 pr-4 font-medium text-ink-900">{inline(cell, `${key}h${i}`)}</th>)}</tr></thead>
						<tbody>{rows.map((row, r) => <tr key={r} className="border-b border-ink-100 align-top">{row.map((cell, i) => <td key={i} className="py-2 pr-4 text-ink-700">{inline(cell, `${key}r${r}c${i}`)}</td>)}</tr>)}</tbody>
					</table>
				</div>
			)
			continue
		}
		if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
			const ordered = /^\s*\d+\./.test(line)
			const items = []
			while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
				items.push(lines[index].replace(/^\s*([-*]|\d+\.)\s+/, ''))
				index += 1
			}
			const List = ordered ? 'ol' : 'ul'
			blocks.push(
				<List key={key} className={`mt-3 space-y-1.5 pl-5 text-[15px] text-ink-700 ${ordered ? 'list-decimal' : 'list-disc'}`}>
					{items.map((item, i) => <li key={i}>{inline(item, `${key}i${i}`)}</li>)}
				</List>
			)
			continue
		}
		const paragraph = []
		while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[index])) {
			paragraph.push(lines[index])
			index += 1
		}
		if (!paragraph.length) { paragraph.push(line); index += 1 }
		blocks.push(<p key={key} className="mt-3 text-[15px] leading-relaxed text-ink-700">{inline(paragraph.join(' '), key)}</p>)
	}
	return <div className="max-w-[72ch]">{blocks}</div>
}
