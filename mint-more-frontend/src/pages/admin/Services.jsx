import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { AdminPage, EmptyState, PageHeader, Panel, SkeletonRows } from '../../components/admin/AdminUI'
import { deliveryText, inr } from '../../components/services/serviceUtils'

const blankVariant = () => ({ option_label: 'Standard', pack_size: 1, price: '', mrp: '', freelancer_payout: '', delivery_days: 2, is_default: false, is_active: true })

const toForm = (t, categoryId = '') => ({
	id: t?.id || null,
	title: t?.title || '',
	slug: t?.slug || '',
	category_id: t?.category_id || categoryId || '',
	summary: t?.summary || '',
	description: t?.description || '',
	unit_label: t?.unit_label || '',
	option_group_label: t?.option_group_label || '',
	revisions: t?.revisions ?? 2,
	requirements_hint: t?.requirements_hint || '',
	cover_url: t?.cover_url || '',
	sort_order: t?.sort_order ?? 100,
	is_active: t?.is_active ?? true,
	includes: (t?.includes || []).join('\n'),
	excludes: (t?.excludes || []).join('\n'),
	tools: (t?.tools || []).join(', '),
	faqs: (t?.faqs || []).map(f => `${f.q} :: ${f.a}`).join('\n'),
	variants: (t?.variants?.length ? t.variants : [blankVariant()]).map(v => ({ ...v, mrp: v.mrp ?? '' })),
	// null = the category's default questions apply.
	brief_fields: t?.brief_fields?.length ? t.brief_fields.map(f => ({ ...f, options: (f.options || []).join(', ') })) : null,
})

const lines = (text) => text.split('\n').map(s => s.trim()).filter(Boolean)

const toPayload = (form) => ({
	title: form.title.trim(),
	slug: form.slug.trim(),
	category_id: form.category_id || null,
	summary: form.summary,
	description: form.description,
	unit_label: form.unit_label || null,
	option_group_label: form.option_group_label || null,
	revisions: Number(form.revisions),
	requirements_hint: form.requirements_hint || null,
	cover_url: form.cover_url || null,
	sort_order: Number(form.sort_order),
	is_active: form.is_active,
	includes: lines(form.includes),
	excludes: lines(form.excludes),
	tools: form.tools.split(',').map(s => s.trim()).filter(Boolean),
	faqs: lines(form.faqs).map(line => {
		const [q, ...rest] = line.split('::')
		return { q: q.trim(), a: rest.join('::').trim() }
	}).filter(f => f.q && f.a),
	variants: form.variants.map(({ id, option_label, pack_size, price, mrp, freelancer_payout, delivery_days, is_default, is_active }) => ({
		id, option_label, pack_size: Number(pack_size), price: Number(price), mrp: mrp === '' ? null : Number(mrp),
		freelancer_payout: Number(freelancer_payout), delivery_days: Number(delivery_days), is_default, is_active,
	})),
	brief_fields: form.brief_fields
		? form.brief_fields.map(f => ({ ...f, options: f.type === 'choice' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : [] }))
		: null,
})

const UNCATEGORISED = 'none'
const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const range = (values, fmt) => {
	if (!values.length) return '—'
	const lo = Math.min(...values)
	const hi = Math.max(...values)
	return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`
}

const Field = ({ label, children, hint, className = '' }) => (
	<label className={`block ${className}`}>
		<span className="mb-1.5 block text-[13px] font-medium text-ink-800">{label}</span>
		{children}
		{hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
	</label>
)
const control = 'w-full rounded-lg border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 hover:border-ink-300 focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-500/15'
const inputCls = `${control} h-10 px-3`
const areaCls = `${control} px-3 py-2.5 leading-6`
const cellInput = `${control} h-9 px-2.5 tabular-nums`

/** Native select with the platform arrow replaced, so it matches the text inputs. */
function Select({ className = '', children, ...props }) {
	return (
		<div className="relative">
			<select {...props} className={`${inputCls} appearance-none pr-9 ${className}`}>{children}</select>
			<Icon name="chevronDown" size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
		</div>
	)
}

/** Small on/off switch; used for Live in the list and in the editor. */
function Switch({ checked, onChange, label, disabled }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={e => { e.stopPropagation(); onChange(!checked) }}
			className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] disabled:opacity-50 ${checked ? 'bg-mint-500' : 'bg-ink-200'}`}
		>
			<span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(11,15,20,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${checked ? 'translate-x-4' : ''}`} />
		</button>
	)
}

function useSaveTemplate({ onDone, onError } = {}) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	return useMutation({
		mutationFn: ({ id, payload }) => (id ? servicesApi.adminUpdateTemplate(id, payload) : servicesApi.adminCreateTemplate(payload)),
		onSuccess: (_res, { toast }) => {
			queryClient.invalidateQueries({ queryKey: ['admin-service-templates'] })
			pushToast({ title: toast || 'Service saved', icon: 'check' })
			onDone?.()
		},
		onError: (err) => {
			const messages = !err.response
				? ['Could not reach the server. Nothing was changed; try again in a moment.']
				: err.response.data?.errors || [err.response.data?.message || `Save failed (error ${err.response.status}).`]
			if (onError) onError(messages)
			else pushToast({ title: 'Could not save', body: messages[0], tone: 'amber', icon: 'x' })
		},
	})
}

/** Labelled cell for a price option: the label shows on phones, the table header does the job on desktop. */
function OptionCell({ label, className = 'md:order-2 xl:order-none', children }) {
	return (
		<label className={`block min-w-0 ${className}`}>
			<span className="mb-1 block text-xs text-ink-500 xl:hidden">{label}</span>
			{children}
		</label>
	)
}

const OPTION_GRID = 'grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 md:grid-cols-6 xl:grid-cols-[minmax(0,1.6fr)_64px_96px_96px_96px_80px_64px_96px] xl:items-center xl:gap-y-0'

const BRIEF_TYPES = [
	['textarea', 'Long answer'],
	['text', 'Short answer'],
	['link', 'Link'],
	['choice', 'Pick one'],
	['files', 'File upload'],
]
const briefTypeLabel = (type) => BRIEF_TYPES.find(([value]) => value === type)?.[1] || type
const blankQuestion = () => ({ key: '', label: '', type: 'textarea', required: false, help: '', options: '' })

/** The questions clients answer before paying. Uses the category default until customised. */
function BriefEditor({ fields, categoryId, onChange }) {
	const { data: defaults } = useQuery({
		queryKey: ['service-brief-defaults'],
		queryFn: () => servicesApi.adminBriefDefaults().then(res => res.data.data),
		staleTime: Infinity,
	})
	const categoryDefault = (categoryId && defaults?.by_category?.[categoryId]) || defaults?.general || []
	const setField = (index, patch) => onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
	const move = (index, by) => {
		const next = [...fields]
		const [item] = next.splice(index, 1)
		next.splice(index + by, 0, item)
		onChange(next)
	}

	if (!fields) {
		return (
			<>
				<ul className="m-0 list-none divide-y divide-ink-100 p-0">
					{categoryDefault.map(f => (
						<li key={f.key} className="flex items-center gap-3 px-4 py-3 text-sm md:px-6">
							<span className="min-w-0 flex-1 truncate text-ink-900">{f.label}</span>
							<span className="shrink-0 text-xs text-ink-500">{briefTypeLabel(f.type)}{f.required ? ' · Required' : ''}</span>
						</li>
					))}
				</ul>
				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3 md:px-6">
					<span className="text-xs text-ink-500">This is the default for the category. Changing the category changes these questions.</span>
					<button type="button" className="btn ghost sm" onClick={() => onChange(categoryDefault.map(f => ({ ...f, options: (f.options || []).join(', ') })))}>
						<Icon name="edit" size={13} /> Customise for this service
					</button>
				</div>
			</>
		)
	}

	return (
		<>
			<div className="divide-y divide-ink-100">
				{fields.map((f, i) => (
					<div key={i} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-start md:px-6">
						<div className="grid gap-2">
							<input className={inputCls} value={f.label} onChange={e => setField(i, { label: e.target.value })} placeholder="Question, like Raw footage link" aria-label={`Question ${i + 1}`} />
							<input className={`${control} h-9 px-3`} value={f.help} onChange={e => setField(i, { help: e.target.value })} placeholder="Help text (optional)" aria-label={`Question ${i + 1} help text`} />
							{f.type === 'choice' && (
								<input className={`${control} h-9 px-3`} value={f.options} onChange={e => setField(i, { options: e.target.value })} placeholder="Options, separated by commas" aria-label={`Question ${i + 1} options`} />
							)}
						</div>
						<Select value={f.type} onChange={e => setField(i, { type: e.target.value })} aria-label={`Question ${i + 1} type`}>
							{BRIEF_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
						</Select>
						<div className="flex items-center gap-1 md:h-10">
							<label className="mr-2 flex items-center gap-2 text-xs text-ink-600">
								<Switch checked={!!f.required} onChange={v => setField(i, { required: v })} label="Required" /> Required
							</label>
							<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="chevronDown" size={14} className="rotate-180" /></button>
							<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-30" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="chevronDown" size={14} /></button>
							<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => onChange(fields.filter((_, j) => j !== i))} aria-label="Remove question"><Icon name="trash" size={14} /></button>
						</div>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3 md:px-6">
				<button type="button" className="btn ghost sm" disabled={fields.length >= 12} onClick={() => onChange([...fields, blankQuestion()])}><Icon name="plus" size={13} /> Add question</button>
				<button type="button" className="text-xs font-medium text-ink-500 hover:text-ink-900" onClick={() => onChange(null)}>Use the category default instead</button>
			</div>
		</>
	)
}

function Editor({ template, categories, defaultCategory, onClose }) {
	const [form, setForm] = useState(() => toForm(template, defaultCategory))
	const [errors, setErrors] = useState([])
	const save = useSaveTemplate({ onDone: onClose, onError: setErrors })
	const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
	const setVariant = (index, key, value) => setForm(f => ({ ...f, variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)) }))
	const setTitle = (e) => {
		const title = e.target.value
		// New services get a slug that follows the title until the slug is edited by hand.
		setForm(f => ({ ...f, title, slug: !f.id && (!f.slug || f.slug === slugify(f.title)) ? slugify(title) : f.slug }))
	}
	const activeOptions = form.variants.filter(v => v.is_active !== false).length
	const submit = () => { setErrors([]); save.mutate({ id: form.id, payload: toPayload(form) }) }

	const section = 'grid gap-x-5 gap-y-5 p-4 md:grid-cols-2 md:p-6'
	return (
		<div className="flex flex-col gap-5">
			{/* Sticky header holds the actions, so nothing floats over the form. */}
			<div className="sticky top-14 z-20 -mx-4 border-b border-ink-100 bg-ink-50/95 px-4 py-3 backdrop-blur md:top-16 md:-mx-8 md:px-8">
				<div className="flex items-center gap-3">
					<button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-50" aria-label="Back to catalogue">
						<Icon name="chevronLeft" size={16} />
					</button>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-lg font-semibold tracking-[-0.01em] text-ink-950">{form.title || 'New service'}</h2>
						<p className="truncate text-xs text-ink-500">
							{form.slug ? `/services/${form.slug}` : 'Add a title to create the link'} · {activeOptions} active option{activeOptions === 1 ? '' : 's'}
						</p>
					</div>
					<label className="hidden items-center gap-2 text-sm font-medium text-ink-700 sm:flex">
						<Switch checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} label="Live in catalogue" />
						{form.is_active ? 'Live' : 'Hidden'}
					</label>
					<button type="button" className="btn ghost hidden md:inline-flex" onClick={onClose}>Cancel</button>
					<button type="button" className="btn primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : form.id ? 'Save' : 'Create'}</button>
				</div>
				{errors.length > 0 && (
					<ul className="m-0 mt-3 list-none rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errors.map(e => <li key={e}>{e}</li>)}</ul>
				)}
			</div>

			<label className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm font-medium text-ink-800 sm:hidden">
				Show on the storefront
				<Switch checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} label="Live in catalogue" />
			</label>

			<Panel title="Basics" description="Where it sits in the catalogue and how clients find it.">
				<div className={section}>
					<Field label="Title"><input className={inputCls} value={form.title} onChange={setTitle} placeholder="Engaging Talking-Head Reel" /></Field>
					<Field label="Link name" hint={`creatyv…/services/${form.slug || 'link-name'}`}><input className={inputCls} value={form.slug} onChange={set('slug')} placeholder="engaging-talking-head-reel" /></Field>
					<Field label="Category">
						<Select value={form.category_id} onChange={set('category_id')}>
							<option value="">No category</option>
							{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
						</Select>
					</Field>
					<Field label="Position" hint="Lower numbers show first in the category"><input type="number" className={inputCls} value={form.sort_order} onChange={set('sort_order')} /></Field>
					<Field label="Summary" hint="One line on the service card" className="md:col-span-2"><input className={inputCls} value={form.summary} onChange={set('summary')} placeholder="Hook-first edit with captions and sound design" /></Field>
					<Field label="Cover image" hint="Paste an image link. Square or 4:3 works best." className="md:col-span-2">
						<div className="flex items-center gap-3">
							<div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-200 bg-ink-50 text-ink-400">
								{form.cover_url ? <img src={form.cover_url} alt="" className="h-full w-full object-cover" /> : <Icon name="image" size={16} />}
							</div>
							<input className={inputCls} value={form.cover_url} onChange={set('cover_url')} placeholder="https://" />
						</div>
					</Field>
				</div>
			</Panel>

			<Panel title="Price options" description="Prices exclude GST. Payout is what the freelancer earns per order.">
				<div className="grid gap-x-5 gap-y-5 border-b border-ink-100 p-4 sm:grid-cols-3 md:p-6">
					<Field label="Choice label" hint='Heading above the options, like "Reel length"'><input className={inputCls} value={form.option_group_label} onChange={set('option_group_label')} placeholder="Reel length" /></Field>
					<Field label="Unit" hint='What one order delivers, like "reel"'><input className={inputCls} value={form.unit_label} onChange={set('unit_label')} placeholder="reel" /></Field>
					<Field label="Revisions included"><input type="number" min="0" className={inputCls} value={form.revisions} onChange={set('revisions')} /></Field>
				</div>

				<div className={`${OPTION_GRID} hidden border-b border-ink-100 px-6 py-2.5 text-xs text-ink-500 xl:grid`}>
					<span>Option</span><span>Pack</span><span>Price ₹</span><span>MRP ₹</span><span>Payout ₹</span><span className="text-right">Margin</span><span>Days</span><span className="text-right">Default · On</span>
				</div>
				<div className="divide-y divide-ink-100">
					{form.variants.map((v, i) => {
						const margin = Number(v.price) - Number(v.freelancer_payout)
						const marginKnown = v.price !== '' && v.freelancer_payout !== ''
						const off = v.is_active === false
						return (
							<div key={v.id || `new-${i}`} className={`${OPTION_GRID} px-4 py-4 md:px-6 xl:py-2.5 ${off ? 'bg-ink-50/70' : ''}`}>
								<OptionCell label="Option" className="col-span-2 sm:col-span-3 md:col-span-4 xl:col-span-1">
									<input className={`${cellInput} ${off ? 'text-ink-400' : ''}`} value={v.option_label} onChange={e => setVariant(i, 'option_label', e.target.value)} placeholder="Up to 60 seconds" />
								</OptionCell>
								<OptionCell label="Pack"><input type="number" min="1" className={cellInput} value={v.pack_size} onChange={e => setVariant(i, 'pack_size', e.target.value)} /></OptionCell>
								<OptionCell label="Price ₹"><input type="number" min="1" className={cellInput} value={v.price} onChange={e => setVariant(i, 'price', e.target.value)} /></OptionCell>
								<OptionCell label="MRP ₹"><input type="number" className={cellInput} value={v.mrp} onChange={e => setVariant(i, 'mrp', e.target.value)} placeholder="—" /></OptionCell>
								<OptionCell label="Payout ₹"><input type="number" min="0" className={cellInput} value={v.freelancer_payout} onChange={e => setVariant(i, 'freelancer_payout', e.target.value)} /></OptionCell>
								<div className="min-w-0 md:order-2 xl:order-none xl:text-right">
									<span className="mb-1 block text-xs text-ink-500 xl:hidden">Margin</span>
									<span className={`flex h-9 items-center text-sm tabular-nums xl:justify-end ${marginKnown && margin < 0 ? 'font-semibold text-rose-600' : 'text-ink-700'}`}>{marginKnown ? inr(margin) : '—'}</span>
								</div>
								<OptionCell label="Days"><input type="number" min="1" className={cellInput} value={v.delivery_days} onChange={e => setVariant(i, 'delivery_days', e.target.value)} /></OptionCell>
								<div className="col-span-2 flex items-center gap-4 sm:col-span-3 md:order-1 md:col-span-2 md:justify-end md:self-end md:pb-0.5 xl:order-none xl:col-span-1 xl:gap-3 xl:self-auto xl:pb-0">
									<label className="flex items-center gap-1.5 text-xs text-ink-600" title="Selected by default on the service page">
										<input type="radio" name="default-variant" className="h-4 w-4 accent-mint-500" checked={!!v.is_default} onChange={() => setForm(f => ({ ...f, variants: f.variants.map((x, j) => ({ ...x, is_default: j === i })) }))} />
										<span className="xl:sr-only">Default</span>
									</label>
									<Switch checked={!off} onChange={on => setVariant(i, 'is_active', on)} label="Option active" />
									{!v.id ? (
										<button type="button" className="ml-auto grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600 xl:ml-0" aria-label="Remove option" onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))}>
											<Icon name="trash" size={14} />
										</button>
									) : <span className="hidden w-8 xl:block" />}
								</div>
							</div>
						)
					})}
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3 md:px-6">
					<button type="button" className="btn ghost sm" onClick={() => setForm(f => ({ ...f, variants: [...f.variants, blankVariant()] }))}><Icon name="plus" size={13} /> Add option</button>
					<span className="text-xs text-ink-500">Options used by past orders can't be removed. Switch them off to retire them.</span>
				</div>
			</Panel>

			<Panel title="Client brief" description="Questions clients answer when they book. The answers are the first message the freelancer sees.">
				<BriefEditor fields={form.brief_fields} categoryId={form.category_id} onChange={brief_fields => setForm(f => ({ ...f, brief_fields }))} />
			</Panel>

			<Panel title="Service page" description="What clients read before they book.">
				<div className={section}>
					<Field label="Description" className="md:col-span-2"><textarea rows={4} className={areaCls} value={form.description} onChange={set('description')} /></Field>
					<Field label="Included" hint="One item per line"><textarea rows={5} className={areaCls} value={form.includes} onChange={set('includes')} /></Field>
					<Field label="Not included" hint="One item per line"><textarea rows={5} className={areaCls} value={form.excludes} onChange={set('excludes')} /></Field>
					<Field label="Tools" hint="Separate with commas"><input className={inputCls} value={form.tools} onChange={set('tools')} placeholder="Premiere Pro, After Effects" /></Field>
					<Field label="FAQs" hint="One per line, as Question :: Answer" className="md:col-span-2"><textarea rows={4} className={areaCls} value={form.faqs} onChange={set('faqs')} /></Field>
				</div>
			</Panel>

			<div className="flex justify-end gap-2 pb-2">
				<button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
				<button type="button" className="btn primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create service'}</button>
			</div>
		</div>
	)
}

function ServiceRow({ template, onEdit, onToggle, toggling }) {
	const active = template.variants.filter(v => v.is_active)
	return (
		<div role="button" tabIndex={0} onClick={onEdit} onKeyDown={e => e.key === 'Enter' && onEdit()} className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/70 md:px-5">
			<div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">
				{template.cover_url && <img src={template.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className={`truncate text-sm font-semibold ${template.is_active ? 'text-ink-900' : 'text-ink-500'}`}>{template.title}</span>
					{!template.is_active && <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-500">Hidden</span>}
				</div>
				<div className="truncate text-xs text-ink-500">
					{active.length} option{active.length === 1 ? '' : 's'} · {template.revisions} revisions · {range(active.map(v => Number(v.delivery_days)), deliveryText)}
				</div>
			</div>
			<div className="hidden shrink-0 whitespace-nowrap text-right md:block">
				<div className="text-sm font-semibold tabular-nums text-ink-900">{range(active.map(v => Number(v.price)), inr)}</div>
				<div className="text-xs tabular-nums text-ink-400">payout {range(active.map(v => Number(v.freelancer_payout)), inr)}</div>
			</div>
			<div className="hidden w-24 shrink-0 text-right text-xs text-ink-500 xl:block">
				<div><span className="font-semibold tabular-nums text-ink-800">{template.freelancer_count}</span> freelancers</div>
				<div><span className="font-semibold tabular-nums text-ink-800">{template.order_count}</span> orders</div>
			</div>
			<Switch checked={template.is_active} onChange={onToggle} disabled={toggling} label={`${template.title} live`} />
			<Icon name="chevronRight" size={15} className="shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-500" />
		</div>
	)
}

export default function AdminServices() {
	const [params, setParams] = useSearchParams()
	const [editing, setEditing] = useState(null) // template object, 'new', or null
	const [search, setSearch] = useState('')
	const [status, setStatus] = useState('all')
	const selected = params.get('category') || 'all'
	const { data: templates = [], isLoading } = useQuery({
		queryKey: ['admin-service-templates'],
		queryFn: () => servicesApi.adminTemplates().then(res => res.data.data),
	})
	const { data: categories = [] } = useQuery({
		queryKey: ['service-categories'],
		queryFn: () => servicesApi.categories().then(res => res.data.data),
	})
	const toggle = useSaveTemplate()

	// Category list for the rail: every known category plus "Uncategorised" when anything lacks one.
	const groups = useMemo(() => {
		const byId = new Map(categories.map(c => [c.id, { id: c.id, name: c.name, items: [] }]))
		const none = { id: UNCATEGORISED, name: 'Uncategorised', items: [] }
		for (const t of [...templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title))) {
			const group = byId.get(t.category_id) || (t.category_id && t.category_name
				? byId.set(t.category_id, { id: t.category_id, name: t.category_name, items: [] }).get(t.category_id)
				: none)
			group.items.push(t)
		}
		return [...byId.values(), ...(none.items.length ? [none] : [])]
	}, [templates, categories])

	const q = search.trim().toLowerCase()
	const visibleGroups = groups
		.filter(g => selected === 'all' || g.id === selected)
		.map(g => ({ ...g, items: g.items.filter(t => (status === 'all' || (status === 'live') === t.is_active) && (!q || t.title.toLowerCase().includes(q) || t.slug.includes(q))) }))
		.filter(g => g.items.length || selected !== 'all')

	const pick = id => setParams(prev => { const p = new URLSearchParams(prev); if (id === 'all') p.delete('category'); else p.set('category', id); return p }, { replace: true })
	const flip = t => toggle.mutate({ id: t.id, payload: { ...toPayload(toForm(t)), is_active: !t.is_active }, toast: t.is_active ? `${t.title} hidden` : `${t.title} is live` })
	const liveCount = templates.filter(t => t.is_active).length
	const defaultCategory = selected !== 'all' && selected !== UNCATEGORISED ? selected : ''

	if (editing) {
		return (
			<AdminPage>
				<Editor key={editing === 'new' ? 'new' : editing.id} template={editing === 'new' ? null : editing} categories={categories} defaultCategory={defaultCategory} onClose={() => setEditing(null)} />
			</AdminPage>
		)
	}

	const railItem = (id, name, count, live) => {
		const on = selected === id
		return (
			<button key={id} type="button" onClick={() => pick(id)} aria-current={on ? 'true' : undefined}
				className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors md:w-full ${on ? 'bg-mint-50 font-semibold text-mint-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}>
				<span className="truncate md:flex-1">{name}</span>
				<span className={`text-xs tabular-nums ${on ? 'text-mint-600' : 'text-ink-400'}`}>{live != null ? `${live}/${count}` : count}</span>
			</button>
		)
	}

	return (
		<AdminPage wide>
			<PageHeader
				title="Service catalogue"
				description={`${liveCount} of ${templates.length} services live. Pick a category to edit its services; the switch takes a service on or off the storefront.`}
				actions={<button type="button" className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> New service</button>}
			/>

			<div className="grid items-start gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
				<nav aria-label="Categories" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-[88px] md:mx-0 md:flex-col md:overflow-visible md:rounded-xl md:border md:border-ink-100 md:bg-white md:p-2">
					{railItem('all', 'All categories', templates.length)}
					{groups.map(g => railItem(g.id, g.name, g.items.length, g.items.filter(t => t.is_active).length))}
				</nav>

				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<label className="relative block flex-1">
							<span className="sr-only">Search services</span>
							<Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
							<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or slug" className="h-9 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-mint-400 focus:outline-none" />
						</label>
						<div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5 text-sm" role="group" aria-label="Status">
							{[['all', 'All'], ['live', 'Live'], ['hidden', 'Hidden']].map(([value, label]) => (
								<button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value}
									className={`rounded-md px-3 py-1.5 transition-colors ${status === value ? 'bg-ink-950 font-medium text-white' : 'text-ink-600 hover:text-ink-900'}`}>{label}</button>
							))}
						</div>
					</div>

					{isLoading ? <Panel><SkeletonRows rows={6} /></Panel> : visibleGroups.length === 0 ? (
						<Panel><EmptyState title="No services match" body="Clear the search or switch the status filter back to All." /></Panel>
					) : visibleGroups.map(g => (
						<Panel
							key={g.id}
							title={g.name}
							description={`${g.items.filter(t => t.is_active).length} live · ${g.items.length} total`}
							actions={g.id !== UNCATEGORISED && (
								<button type="button" className="btn ghost sm" onClick={() => { pick(g.id); setEditing('new') }}><Icon name="plus" size={13} /> Add</button>
							)}
						>
							{g.items.length === 0 ? (
								<EmptyState title={`No ${g.name} services yet`} body="Add one and it appears on the storefront under this category once it is live." />
							) : (
								<div className="divide-y divide-ink-100">
									{g.items.map(t => (
										<ServiceRow key={t.id} template={t} onEdit={() => setEditing(t)} onToggle={() => flip(t)} toggling={toggle.isPending && toggle.variables?.id === t.id} />
									))}
								</div>
							)}
						</Panel>
					))}
				</div>
			</div>
		</AdminPage>
	)
}
