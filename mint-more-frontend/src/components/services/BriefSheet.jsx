import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { briefFiles } from '../../store/briefFiles'

const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-ink-500 focus:outline-none'

const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

const withProtocol = (value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value)

function FilesInput({ id, files, onChange, names }) {
	const inputRef = useRef(null)
	// Names without files: picked before a reload, so they need picking again.
	const stale = !files.length && names.length > 0
	return (
		<div>
			{files.length > 0 && (
				<ul className="mb-2 space-y-1.5">
					{files.map((file, i) => (
						<li key={`${file.name}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50/60 px-3 py-2 text-sm">
							<Icon name="paperclip" size={14} className="shrink-0 text-ink-500" />
							<span className="min-w-0 flex-1 truncate text-ink-900">{file.name}</span>
							<span className="shrink-0 tabular-nums text-ink-500">{formatSize(file.size)}</span>
							<button type="button" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-white hover:text-rose-600" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`}>
								<Icon name="x" size={12} />
							</button>
						</li>
					))}
				</ul>
			)}
			{stale && <p className="mb-2 text-sm text-amber-700">Pick {names.length === 1 ? names[0] : `these ${names.length} files`} again. Files aren't kept after the page reloads.</p>}
			<button id={id} type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 px-3 py-3 text-sm font-medium text-ink-700 transition-colors hover:border-ink-500 hover:bg-ink-50">
				<Icon name="upload" size={15} /> {files.length ? 'Add more files' : 'Choose files'}
			</button>
			<input ref={inputRef} type="file" multiple className="hidden" onChange={e => { onChange([...files, ...Array.from(e.target.files || [])].slice(0, 20)); e.target.value = '' }} />
		</div>
	)
}

/**
 * The questions a client answers before booking a service. Answers are saved on the
 * cart item; picked files are held in memory and uploaded into the order after payment.
 */
export default function BriefSheet({ title, fields, variantId, initial = {}, initialNotes = '', submitLabel = 'Continue', onSubmit, onClose }) {
	const [answers, setAnswers] = useState(() => ({ ...initial }))
	const [files, setFiles] = useState(() => ({ ...briefFiles.get(variantId) }))
	const [notes, setNotes] = useState(initialNotes)
	const [showErrors, setShowErrors] = useState(false)

	useEffect(() => {
		const onKey = (e) => { if (e.key === 'Escape') onClose() }
		document.addEventListener('keydown', onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
	}, [onClose])

	const set = (key, value) => setAnswers(a => ({ ...a, [key]: value }))
	const problem = (f) => {
		if (f.type === 'files') return f.required && !(files[f.key] || []).length ? 'Attach at least one file' : null
		const value = String(answers[f.key] ?? '').trim()
		if (!value) return f.required ? 'Required' : null
		if (f.type === 'link') { try { new URL(withProtocol(value)) } catch { return 'Enter a valid link' } }
		return null
	}
	const problems = fields.map(problem)
	const done = fields.filter((f, i) => !problems[i] && (f.type === 'files' ? (files[f.key] || []).length : String(answers[f.key] ?? '').trim())).length

	const submit = (e) => {
		e.preventDefault()
		if (problems.some(Boolean)) {
			setShowErrors(true)
			const first = fields[problems.findIndex(Boolean)]
			document.getElementById(`brief-${first.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
			return
		}
		const cleaned = {}
		fields.forEach(f => {
			if (f.type === 'files') cleaned[f.key] = (files[f.key] || []).map(file => file.name)
			else if (f.type === 'link') cleaned[f.key] = withProtocol(String(answers[f.key] ?? '').trim())
			else cleaned[f.key] = String(answers[f.key] ?? '').trim()
		})
		briefFiles.set(variantId, files)
		onSubmit({ brief: cleaned, instructions: notes.trim() })
	}

	return (
		<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 font-store md:items-stretch md:justify-end" onClick={onClose}>
			<form onSubmit={submit} onClick={e => e.stopPropagation()} className="brief-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-none md:max-w-[520px] md:rounded-none" noValidate>
				<div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4 md:px-7 md:py-5">
					<div className="min-w-0 flex-1">
						<h2 className="text-xl font-medium tracking-tight text-ink-900">Your brief</h2>
						<p className="mt-0.5 truncate text-sm text-ink-500">{title} · the freelancer sees this as soon as they start</p>
					</div>
					<button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Close">
						<Icon name="x" size={16} />
					</button>
				</div>

				<div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-7">
					{fields.map((f, i) => {
						const error = showErrors && problems[i]
						const id = `brief-${f.key}`
						return (
							<div key={f.key}>
								<label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[15px] font-medium text-ink-900">
									{f.label}
									{!f.required && <span className="text-sm font-normal text-ink-400">Optional</span>}
								</label>
								{f.help && <p className="-mt-0.5 mb-2 text-sm text-ink-500">{f.help}</p>}
								{f.type === 'textarea' && <textarea id={id} rows={3} className={`${inputCls} resize-y leading-6`} value={answers[f.key] || ''} onChange={e => set(f.key, e.target.value)} />}
								{f.type === 'text' && <input id={id} className={inputCls} value={answers[f.key] || ''} onChange={e => set(f.key, e.target.value)} />}
								{f.type === 'link' && <input id={id} type="url" inputMode="url" className={inputCls} placeholder="https://" value={answers[f.key] || ''} onChange={e => set(f.key, e.target.value)} onBlur={e => e.target.value.trim() && set(f.key, withProtocol(e.target.value.trim()))} />}
								{f.type === 'choice' && (
									<div className="flex flex-wrap gap-2" id={id} role="radiogroup" aria-label={f.label}>
										{f.options.map(option => (
											<button key={option} type="button" role="radio" aria-checked={answers[f.key] === option} onClick={() => set(f.key, option)}
												className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${answers[f.key] === option ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-800 hover:border-ink-400'}`}>
												{option}
											</button>
										))}
									</div>
								)}
								{f.type === 'files' && <FilesInput id={id} files={files[f.key] || []} names={initial[f.key] || []} onChange={list => setFiles(s => ({ ...s, [f.key]: list }))} />}
								{error && <p className="mt-1.5 text-sm text-rose-600">{error}</p>}
							</div>
						)
					})}
					<div>
						<label htmlFor="brief-notes" className="mb-1.5 flex items-baseline gap-1.5 text-[15px] font-medium text-ink-900">Anything else <span className="text-sm font-normal text-ink-400">Optional</span></label>
						<textarea id="brief-notes" rows={2} className={`${inputCls} resize-y leading-6`} value={notes} onChange={e => setNotes(e.target.value)} />
					</div>
				</div>

				<div className="flex items-center gap-3 border-t border-ink-100 px-5 py-4 md:px-7">
					<span className="flex-1 text-sm tabular-nums text-ink-500">{done} of {fields.length} answered</span>
					<button type="submit" className="rounded-xl bg-black px-6 py-3 text-[15px] font-medium text-white transition-transform hover:bg-ink-800 active:scale-[0.98]">{submitLabel}</button>
				</div>
			</form>
		</div>
	)
}
