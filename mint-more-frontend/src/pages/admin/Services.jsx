import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { deliveryText, inr, variantLabel } from '../../components/services/serviceUtils'

const blankVariant = () => ({ option_label: 'Standard', pack_size: 1, price: '', mrp: '', freelancer_payout: '', delivery_days: 2, is_default: false, is_active: true })

const toForm = (t) => ({
	id: t?.id || null,
	title: t?.title || '',
	slug: t?.slug || '',
	category_id: t?.category_id || '',
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
})

const Field = ({ label, children, hint }) => (
	<label className="block">
		<span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
		{children}
		{hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
	</label>
)
const inputCls = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-mint-400 focus:outline-none'

function Editor({ template, categories, onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [form, setForm] = useState(() => toForm(template))
	const [errors, setErrors] = useState([])
	const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
	const setVariant = (index, key, value) => setForm(f => ({ ...f, variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)) }))

	const save = useMutation({
		mutationFn: () => (form.id ? servicesApi.adminUpdateTemplate(form.id, toPayload(form)) : servicesApi.adminCreateTemplate(toPayload(form))),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-service-templates'] })
			pushToast({ title: 'Service saved', icon: 'check' })
			onClose()
		},
		onError: (err) => setErrors(err.response?.data?.errors || [err.response?.data?.message || 'Could not save']),
	})

	return (
		<div className="rounded-2xl border border-ink-200 bg-white p-5">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-bold text-ink-900">{form.id ? `Edit: ${template.title}` : 'New service'}</h2>
				<button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14} /> Close</button>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Field label="Title"><input className={inputCls} value={form.title} onChange={set('title')} /></Field>
				<Field label="Slug" hint="Used in the URL: /services/slug"><input className={inputCls} value={form.slug} onChange={set('slug')} /></Field>
				<Field label="Category">
					<select className={inputCls} value={form.category_id} onChange={set('category_id')}>
						<option value="">—</option>
						{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
					</select>
				</Field>
				<Field label="Revisions included"><input type="number" min="0" className={inputCls} value={form.revisions} onChange={set('revisions')} /></Field>
				<Field label="Option label" hint='e.g. "Reel length"'><input className={inputCls} value={form.option_group_label} onChange={set('option_group_label')} /></Field>
				<Field label="Unit" hint='e.g. "reel", "design"'><input className={inputCls} value={form.unit_label} onChange={set('unit_label')} /></Field>
				<div className="md:col-span-2"><Field label="Summary"><input className={inputCls} value={form.summary} onChange={set('summary')} /></Field></div>
				<div className="md:col-span-2"><Field label="Description"><textarea rows={3} className={inputCls} value={form.description} onChange={set('description')} /></Field></div>
				<Field label="Includes" hint="One per line"><textarea rows={4} className={inputCls} value={form.includes} onChange={set('includes')} /></Field>
				<Field label="Excludes" hint="One per line"><textarea rows={4} className={inputCls} value={form.excludes} onChange={set('excludes')} /></Field>
				<Field label="Tools" hint="Comma separated"><input className={inputCls} value={form.tools} onChange={set('tools')} /></Field>
				<Field label="What to send" hint="Shown to the client at checkout"><input className={inputCls} value={form.requirements_hint} onChange={set('requirements_hint')} /></Field>
				<div className="md:col-span-2"><Field label="FAQs" hint="One per line: Question :: Answer"><textarea rows={3} className={inputCls} value={form.faqs} onChange={set('faqs')} /></Field></div>
				<Field label="Cover image URL"><input className={inputCls} value={form.cover_url} onChange={set('cover_url')} /></Field>
				<div className="flex items-end gap-4">
					<Field label="Sort order"><input type="number" className={inputCls} value={form.sort_order} onChange={set('sort_order')} /></Field>
					<label className="mb-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Live in catalogue</label>
				</div>
			</div>

			<h3 className="mb-2 mt-6 text-sm font-bold text-ink-900">Price options</h3>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[760px] text-sm">
					<thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-500">
						<th className="py-1 pr-2">Option</th><th className="pr-2">Pack</th><th className="pr-2">Price ₹</th><th className="pr-2">MRP ₹</th><th className="pr-2">Payout ₹</th><th className="pr-2">Days</th><th className="pr-2">Default</th><th className="pr-2">Active</th><th />
					</tr></thead>
					<tbody>
						{form.variants.map((v, i) => (
							<tr key={v.id || i}>
								<td className="py-1 pr-2"><input className={inputCls} value={v.option_label} onChange={e => setVariant(i, 'option_label', e.target.value)} /></td>
								<td className="pr-2"><input type="number" min="1" className={`${inputCls} w-16`} value={v.pack_size} onChange={e => setVariant(i, 'pack_size', e.target.value)} /></td>
								<td className="pr-2"><input type="number" min="1" className={`${inputCls} w-24`} value={v.price} onChange={e => setVariant(i, 'price', e.target.value)} /></td>
								<td className="pr-2"><input type="number" className={`${inputCls} w-24`} value={v.mrp} onChange={e => setVariant(i, 'mrp', e.target.value)} /></td>
								<td className="pr-2"><input type="number" min="0" className={`${inputCls} w-24`} value={v.freelancer_payout} onChange={e => setVariant(i, 'freelancer_payout', e.target.value)} /></td>
								<td className="pr-2"><input type="number" min="1" className={`${inputCls} w-16`} value={v.delivery_days} onChange={e => setVariant(i, 'delivery_days', e.target.value)} /></td>
								<td className="pr-2 text-center"><input type="radio" name="default-variant" checked={!!v.is_default} onChange={() => setForm(f => ({ ...f, variants: f.variants.map((x, j) => ({ ...x, is_default: j === i })) }))} /></td>
								<td className="pr-2 text-center"><input type="checkbox" checked={v.is_active !== false} onChange={e => setVariant(i, 'is_active', e.target.checked)} /></td>
								<td>{!v.id && <button className="btn ghost sm" onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))}><Icon name="trash" size={13} /></button>}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<button className="btn ghost sm mt-2" onClick={() => setForm(f => ({ ...f, variants: [...f.variants, blankVariant()] }))}><Icon name="plus" size={13} /> Add option</button>
			<p className="mt-2 text-[11px] text-ink-400">Prices exclude GST. Options used by past orders can't be deleted — untick Active to retire them.</p>

			{errors.length > 0 && (
				<ul className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errors.map(e => <li key={e}>{e}</li>)}</ul>
			)}
			<div className="mt-5 flex justify-end gap-2">
				<button className="btn ghost" onClick={onClose}>Cancel</button>
				<button className="btn primary" disabled={save.isPending} onClick={() => { setErrors([]); save.mutate() }}>{save.isPending ? 'Saving…' : 'Save service'}</button>
			</div>
		</div>
	)
}

export default function AdminServices() {
	const [editing, setEditing] = useState(null) // template object, 'new', or null
	const { data: templates = [], isLoading } = useQuery({
		queryKey: ['admin-service-templates'],
		queryFn: () => servicesApi.adminTemplates().then(res => res.data.data),
	})
	const { data: categories = [] } = useQuery({
		queryKey: ['service-categories'],
		queryFn: () => servicesApi.categories().then(res => res.data.data),
	})

	return (
		<div className="page">
			<div className="mb-6 flex items-end justify-between gap-3">
				<div>
					<div className="text-[11px] font-bold uppercase tracking-wider text-mint-500">Admin</div>
					<h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-900">Service catalogue</h1>
					<p className="mt-1 text-sm text-ink-500">Fixed-price services clients can book. Payout is what the freelancer earns per order.</p>
				</div>
				{!editing && <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> New service</button>}
			</div>

			{editing ? (
				<Editor key={editing === 'new' ? 'new' : editing.id} template={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} />
			) : isLoading ? (
				<div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
			) : (
				<div className="space-y-3">
					{templates.map(t => {
						const active = t.variants.filter(v => v.is_active)
						const from = Math.min(...active.map(v => Number(v.price)))
						return (
							<div key={t.id} className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-4 md:flex-row md:items-center">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-bold text-ink-900">{t.title}</span>
										<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{t.is_active ? 'Live' : 'Hidden'}</span>
									</div>
									<div className="text-xs text-ink-500">{t.category_name} · {t.revisions} revisions · {t.freelancer_count} freelancers · {t.order_count} orders</div>
									<div className="mt-2 flex flex-wrap gap-1.5">
										{active.slice(0, 6).map(v => (
											<span key={v.id} className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] text-ink-700">{variantLabel(v)} · {inr(v.price)} → {inr(v.freelancer_payout)} · {deliveryText(v.delivery_days)}</span>
										))}
										{active.length > 6 && <span className="text-[11px] text-ink-400">+{active.length - 6} more</span>}
									</div>
								</div>
								<div className="flex items-center gap-3">
									{active.length > 0 && <span className="text-sm text-ink-500">from <strong className="text-ink-900">{inr(from)}</strong></span>}
									<button className="btn ghost sm" onClick={() => setEditing(t)}><Icon name="edit" size={13} /> Edit</button>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
