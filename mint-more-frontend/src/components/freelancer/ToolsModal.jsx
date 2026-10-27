import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'

const MAX_TOOLS = 30
const SUGGESTIONS = [
	'Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Final Cut Pro', 'CapCut', 'VN Editor', 'Filmora',
	'Photoshop', 'Illustrator', 'Lightroom', 'InDesign', 'Figma', 'Canva', 'Blender', 'Cinema 4D',
	'Audition', 'ElevenLabs', 'Runway', 'Kling AI', 'Midjourney', 'ChatGPT', 'Notion', 'Google Docs', 'Grammarly',
]

/** "Add Tools": type a tool and press Enter, or pick a suggestion. */
export default function ToolsModal({ open, initial = [], saving = false, onClose, onSave }) {
	const [tools, setTools] = useState(initial)
	const [text, setText] = useState('')
	const [focused, setFocused] = useState(false)
	const inputRef = useRef(null)

	useEffect(() => {
		if (!open) return
		setTools(initial); setText('')
		const onKey = e => e.key === 'Escape' && onClose()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	if (!open) return null

	const has = name => tools.some(tool => tool.toLowerCase() === name.toLowerCase())
	const add = raw => {
		const name = raw.trim().slice(0, 40)
		if (!name || has(name) || tools.length >= MAX_TOOLS) return
		setTools(list => [...list, name])
		setText('')
		inputRef.current?.focus()
	}
	const remove = name => setTools(list => list.filter(tool => tool !== name))
	const query = text.trim().toLowerCase()
	const matches = SUGGESTIONS.filter(name => !has(name) && (!query || name.toLowerCase().includes(query))).slice(0, 8)

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 font-store" role="dialog" aria-modal="true" aria-labelledby="tools-title" onMouseDown={e => e.target === e.currentTarget && onClose()}>
			<div className="kyc-modal w-full max-w-md rounded-2xl bg-white shadow-xl">
				<div className="border-b border-ink-100 px-5 py-4">
					<h2 id="tools-title" className="text-base font-semibold text-ink-900">Add Tools</h2>
				</div>
				<div className="px-5 py-5">
					<label htmlFor="tools-input" className="mb-2 block text-[13px] font-medium text-ink-700">Tools you use</label>
					<div className={`flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors ${focused ? 'border-mint-500' : 'border-ink-200'}`} onClick={() => inputRef.current?.focus()}>
						{tools.map(tool => (
							<span key={tool} className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pl-3 pr-1.5 text-[13px] text-ink-900">
								{tool}
								<button type="button" onClick={() => remove(tool)} aria-label={`Remove ${tool}`} className="grid h-5 w-5 place-items-center rounded-full text-ink-500 hover:bg-ink-200 hover:text-ink-900">
									<Icon name="x" size={12} />
								</button>
							</span>
						))}
						<input
							id="tools-input"
							ref={inputRef}
							value={text}
							onChange={e => setText(e.target.value)}
							onFocus={() => setFocused(true)}
							onBlur={() => setFocused(false)}
							onKeyDown={e => {
								if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) }
								if (e.key === 'Backspace' && !text && tools.length) remove(tools[tools.length - 1])
							}}
							placeholder={tools.length ? '' : 'Type a tool and press Enter…'}
							disabled={tools.length >= MAX_TOOLS}
							className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
						/>
					</div>
					<p className="mt-1.5 text-xs text-ink-500">Pick from suggestions or type your own. Max {MAX_TOOLS}.</p>
					{matches.length > 0 && tools.length < MAX_TOOLS && (
						<div className="mt-3 flex flex-wrap gap-1.5">
							{matches.map(name => (
								<button key={name} type="button" onClick={() => add(name)} className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1 text-[13px] text-ink-700 transition-colors hover:border-ink-400 hover:text-ink-900">
									<Icon name="plus" size={12} /> {name}
								</button>
							))}
						</div>
					)}
				</div>
				<div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
					<button type="button" onClick={onClose} className="h-10 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-100">Cancel</button>
					<button type="button" onClick={() => onSave(tools)} disabled={saving} className="h-10 rounded-xl bg-mint-500 px-5 text-sm font-semibold text-white hover:bg-mint-600 disabled:opacity-60">
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	)
}
