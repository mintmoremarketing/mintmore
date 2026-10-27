import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import ToolsModal from '../../components/freelancer/ToolsModal'
import { announceProfileUpdated } from '../../components/freelancer/completionApi'
import { COUNTRIES, INDIA_STATES } from '../../components/freelancer/locations'

const BIO_MAX = 2000
const inputClass = 'h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-ink-900 focus:outline-none disabled:bg-ink-50 disabled:text-ink-500'

function Section({ title, children }) {
	return (
		<section className="mt-8">
			<h2 className="border-b border-ink-100 pb-3 text-base font-semibold text-ink-900">{title}</h2>
			<div className="mt-5 space-y-4">{children}</div>
		</section>
	)
}

function Field({ label, required, hint, error, children }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm font-medium text-ink-700">{label}{required && <span className="text-rose-600"> *</span>}</span>
			{children}
			{error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
		</label>
	)
}

const splitName = (full = '') => {
	const [first = '', ...rest] = full.trim().split(/\s+/)
	return { first, last: rest.join(' ') }
}

/** Freelancer "Manage your account": profile info, contact info, address and tools. */
export default function ManageAccount() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const auth = useAuthStore()
	const [params, setParams] = useSearchParams()
	const fileRef = useRef(null)
	const [form, setForm] = useState(null)
	const [errors, setErrors] = useState({})
	const [toolsOpen, setToolsOpen] = useState(params.get('tools') === '1')

	const { data: profile, isLoading } = useQuery({
		queryKey: ['my-profile'],
		queryFn: () => api.get('/profile/me').then(r => r.data.data.profile),
	})

	useEffect(() => {
		if (!profile || form) return
		const { first, last } = splitName(profile.full_name)
		setForm({
			first, last,
			username: profile.username || '',
			bio: profile.bio || '',
			phone: profile.phone || '',
			country: profile.country || '',
			state: profile.address_state || '',
			city: profile.address_city || '',
		})
	}, [profile, form])

	const syncAuthUser = updated => {
		if (!updated || !auth.user) return
		auth.setAuth({ ...auth.user, full_name: updated.full_name, avatar_url: updated.avatar_url }, auth.accessToken, auth.refreshToken)
	}
	const afterSave = updated => {
		queryClient.setQueryData(['my-profile'], old => ({ ...old, ...updated }))
		syncAuthUser(updated)
		announceProfileUpdated()
	}
	const apiError = err => err?.response?.data?.errors?.join(' ') || err?.response?.data?.message || 'Something went wrong. Please try again.'

	const save = useMutation({
		mutationFn: payload => api.patch('/profile/me', payload).then(r => r.data.data.profile),
		onSuccess: updated => {
			afterSave(updated)
			pushToast({ title: 'Profile saved', icon: 'check' })
		},
		onError: err => {
			const message = apiError(err)
			if (/username/i.test(message)) setErrors(e => ({ ...e, username: message }))
			else pushToast({ title: 'Could not save', body: message, tone: 'amber', icon: 'x' })
		},
	})

	const avatar = useMutation({
		mutationFn: file => {
			if (!file) return api.delete('/profile/me/avatar').then(r => r.data.data.profile)
			const fd = new FormData()
			fd.append('avatar', file)
			return api.patch('/profile/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data.profile)
		},
		onSuccess: afterSave,
		onError: err => pushToast({ title: 'Photo not updated', body: apiError(err), tone: 'amber', icon: 'x' }),
	})

	const tools = useMutation({
		mutationFn: list => api.patch('/profile/me', { tools: list }).then(r => r.data.data.profile),
		onSuccess: updated => {
			afterSave(updated)
			setToolsOpen(false)
			if (params.get('tools')) setParams({}, { replace: true })
			pushToast({ title: 'Tools saved', icon: 'check' })
		},
		onError: err => pushToast({ title: 'Could not save tools', body: apiError(err), tone: 'amber', icon: 'x' }),
	})

	if (isLoading || !form) {
		return (
			<div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-0">
				<div className="h-7 w-64 animate-pulse rounded-lg bg-ink-100" />
				<div className="mt-8 space-y-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-11 animate-pulse rounded-xl bg-ink-100" />)}</div>
			</div>
		)
	}

	const set = key => e => {
		const value = e.target.value
		setErrors(err => ({ ...err, [key]: undefined }))
		setForm(f => {
			if (key === 'country') return { ...f, country: value, state: '', city: '' }
			if (key === 'state') return { ...f, state: value, city: '' }
			if (key === 'username') return { ...f, username: value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 32) }
			return { ...f, [key]: value }
		})
	}

	const submit = () => {
		const next = {}
		if (!form.first.trim()) next.first = 'First name is required'
		if (!form.last.trim()) next.last = 'Last name is required'
		if (form.username && !/^[a-z0-9_.]{3,32}$/.test(form.username)) next.username = 'Use 3-32 lowercase letters, numbers, dots or underscores'
		if (!form.bio.trim()) next.bio = 'Write a short bio'
		if (!profile.phone && form.phone && !/^[6-9]\d{9}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number'
		setErrors(next)
		if (Object.keys(next).length) return
		save.mutate({
			full_name: `${form.first.trim()} ${form.last.trim()}`,
			username: form.username || null,
			bio: form.bio.trim(),
			country: form.country || null,
			address_state: form.state || null,
			address_city: form.city || null,
			...(!profile.phone && form.phone ? { phone: form.phone } : {}),
		})
	}

	const isIndia = form.country === 'India'
	const cities = isIndia ? INDIA_STATES[form.state] || [] : []
	const initials = `${form.first} ${form.last}`.match(/\p{L}+/gu)?.slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'C'

	return (
		<div className="mx-auto w-full max-w-[720px] px-4 py-6 font-store md:px-0 md:py-8">
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-2">
					<button type="button" onClick={() => navigate(-1)} aria-label="Back" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-700 hover:bg-ink-100">
						<Icon name="arrowLeft" size={20} />
					</button>
					<div className="min-w-0 pt-1">
						<h1 className="text-[22px] font-semibold tracking-tight text-ink-900">Manage your account</h1>
						<p className="mt-0.5 text-sm text-ink-500">This is what clients see when they book you.</p>
					</div>
				</div>
				<button type="button" onClick={submit} disabled={save.isPending} className="h-10 shrink-0 rounded-xl bg-mint-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-mint-600 disabled:opacity-60">
					{save.isPending ? 'Saving…' : 'Save'}
				</button>
			</div>

			<Section title="Profile Info">
				<div className="flex items-center gap-4">
					<div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink-100 text-lg font-semibold text-ink-600">
						{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
					</div>
					<div>
						<div className="flex items-center gap-4 text-sm font-medium">
							<button type="button" onClick={() => fileRef.current?.click()} disabled={avatar.isPending} className="text-mint-600 hover:underline disabled:opacity-60">
								{avatar.isPending ? 'Uploading…' : 'Upload photo'}<span className="text-rose-600"> *</span>
							</button>
							{profile.avatar_url && <button type="button" onClick={() => avatar.mutate(null)} className="text-rose-600 hover:underline">Remove</button>}
						</div>
						<p className="mt-0.5 text-xs text-ink-500">A clear headshot. JPG, PNG or WebP.</p>
					</div>
					<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) avatar.mutate(f); e.target.value = '' }} />
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="First Name" required error={errors.first}><input className={inputClass} value={form.first} onChange={set('first')} autoComplete="given-name" /></Field>
					<Field label="Last Name" required error={errors.last}><input className={inputClass} value={form.last} onChange={set('last')} autoComplete="family-name" /></Field>
					<Field label="Username" required error={errors.username} hint="Your public handle on Creatyv.">
						<div className="relative">
							<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-400">@</span>
							<input className={`${inputClass} pl-8`} value={form.username} onChange={set('username')} placeholder="username" autoCapitalize="none" spellCheck={false} />
						</div>
					</Field>
					<Field label="Email" required><input className={inputClass} value={profile.email || ''} disabled /></Field>
				</div>

				<Field label="Bio" required error={errors.bio}>
					<textarea className={`${inputClass} h-auto min-h-[120px] resize-y py-3`} value={form.bio} onChange={set('bio')} maxLength={BIO_MAX} placeholder="Write a short bio here…" />
					<span className="mt-1 block text-right text-xs tabular-nums text-ink-500">{form.bio.length}/{BIO_MAX} characters</span>
				</Field>
			</Section>

			<Section title="Tools">
				<div className="flex flex-wrap items-center gap-2">
					{(profile.tools || []).map(tool => <span key={tool} className="rounded-full bg-ink-100 px-3 py-1 text-[13px] text-ink-900">{tool}</span>)}
					{!profile.tools?.length && <span className="text-sm text-ink-500">No tools added yet.</span>}
				</div>
				<button type="button" onClick={() => setToolsOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 px-3 text-sm font-medium text-ink-900 hover:bg-ink-50">
					<Icon name="plus" size={14} /> {profile.tools?.length ? 'Edit tools' : 'Add Tools'}
				</button>
			</Section>

			<Section title="Contact Info">
				<Field label="Phone Number" error={errors.phone} hint={profile.phone ? 'Set during signup — contact support to change.' : 'Clients and our team use this to reach you.'}>
					<div className="flex gap-2">
						<span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl border border-ink-200 bg-ink-50 text-[15px] text-ink-700">+91</span>
						<input className={inputClass} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} disabled={Boolean(profile.phone)} inputMode="numeric" />
					</div>
				</Field>
			</Section>

			<Section title="Address Info">
				<Field label="Country">
					<select className={inputClass} value={form.country} onChange={set('country')}>
						<option value="">Select country…</option>
						{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
					</select>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="State / Province">
						{isIndia || !form.country ? (
							<select className={inputClass} value={form.state} onChange={set('state')} disabled={!form.country}>
								<option value="">{form.country ? 'Select state…' : 'Select country first'}</option>
								{Object.keys(INDIA_STATES).map(s => <option key={s} value={s}>{s}</option>)}
							</select>
						) : <input className={inputClass} value={form.state} onChange={set('state')} placeholder="State or province" />}
					</Field>
					<Field label="City">
						{isIndia || !form.country ? (
							<>
								<input className={inputClass} list="city-options" value={form.city} onChange={set('city')} disabled={!form.state} placeholder={form.state ? 'Select or type a city' : 'Select state first'} />
								<datalist id="city-options">{cities.map(c => <option key={c} value={c} />)}</datalist>
							</>
						) : <input className={inputClass} value={form.city} onChange={set('city')} placeholder="City" />}
					</Field>
				</div>
			</Section>

			<div className="mt-10 flex justify-end">
				<button type="button" onClick={submit} disabled={save.isPending} className="h-11 rounded-xl bg-mint-500 px-8 text-sm font-semibold text-white transition-colors hover:bg-mint-600 disabled:opacity-60">
					{save.isPending ? 'Saving…' : 'Save'}
				</button>
			</div>

			<ToolsModal
				open={toolsOpen}
				initial={profile.tools || []}
				saving={tools.isPending}
				onClose={() => { setToolsOpen(false); if (params.get('tools')) setParams({}, { replace: true }) }}
				onSave={list => tools.mutate(list)}
			/>
		</div>
	)
}
