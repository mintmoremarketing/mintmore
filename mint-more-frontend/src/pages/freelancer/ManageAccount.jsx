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

function Field({ label, required, hint, error, fromCv, children }) {
	return (
		<label className={`block ${fromCv ? 'cv-filled' : ''}`}>
			<span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink-700">
				<span>{label}{required && <span className="text-rose-600"> *</span>}</span>
				{fromCv && <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[11px] font-semibold text-mint-700">From CV</span>}
			</span>
			{children}
			{error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
		</label>
	)
}

const CV_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const CV_MAX_MB = 5

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Matches the CV's place names to the country, state and city pickers. */
const matchLocation = ({ city, state, country, location_text: hint }) => {
	const text = [city, state, country, hint].filter(Boolean).join(', ').toLowerCase()
	if (!text) return {}
	const has = name => new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`).test(text)
	let foundState = Object.keys(INDIA_STATES).find(has) || null
	let foundCity = foundState ? INDIA_STATES[foundState].find(has) : null
	if (!foundState) {
		for (const [name, cities] of Object.entries(INDIA_STATES)) {
			const match = cities.find(has)
			if (match) { foundState = name; foundCity = match; break }
		}
	}
	if (!foundCity && foundState && city) foundCity = city
	const foundCountry = foundState ? 'India' : COUNTRIES.find(c => c !== 'Other' && has(c)) || null
	return { country: foundCountry, state: foundState, city: foundCity }
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
	const cvRef = useRef(null)
	const welcome = params.get('welcome') === '1'
	// Fields the CV filled in, and the tools/skills it found, until the next save.
	const [cv, setCv] = useState({ filled: [], tools: [], skills: [], source: null })
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
			setCv(c => ({ ...c, filled: [], skills: [] }))
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

	const readCv = useMutation({
		mutationFn: file => {
			const fd = new FormData()
			fd.append('cv', file)
			return api.post('/profile/me/cv/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90_000 }).then(r => r.data.data)
		},
		onSuccess: ({ suggestions: found, source }) => {
			const location = matchLocation(found)
			const next = { ...form }
			const filled = []
			const fill = (key, value) => { if (value && !String(form[key] || '').trim()) { next[key] = value; filled.push(key) } }
			fill('first', found.first_name)
			fill('last', found.last_name)
			fill('bio', found.bio?.slice(0, BIO_MAX))
			// State and city depend on the country, so only fill them when it agrees.
			if (location.country && !form.state && (!form.country || form.country === location.country)) {
				fill('country', location.country)
				fill('state', location.state)
				fill('city', location.city)
			}
			setForm(next)
			const known = new Set((profile?.tools || []).map(t => t.toLowerCase()))
			const knownSkills = new Set((profile?.skills || []).map(t => t.toLowerCase()))
			setCv({
				filled,
				tools: (found.tools || []).filter(t => !known.has(t.toLowerCase())),
				skills: (found.skills || []).filter(t => !knownSkills.has(t.toLowerCase())),
				source,
			})
			setErrors({})
		},
		onError: err => pushToast({ title: "Couldn't read your CV", body: apiError(err), tone: 'amber', icon: 'x' }),
	})
	const pickCv = file => {
		if (!file) return
		if (!/\.(pdf|docx)$/i.test(file.name)) return pushToast({ title: 'Upload a PDF or .docx', body: 'Your CV must be a PDF or Word (.docx) file.', tone: 'amber', icon: 'x' })
		if (file.size > CV_MAX_MB * 1024 * 1024) return pushToast({ title: 'CV is too large', body: `Keep it under ${CV_MAX_MB} MB.`, tone: 'amber', icon: 'x' })
		readCv.mutate(file)
	}

	const tools = useMutation({
		mutationFn: list => api.patch('/profile/me', { tools: list }).then(r => r.data.data.profile),
		onSuccess: updated => {
			afterSave(updated)
			setToolsOpen(false)
			setCv(c => ({ ...c, tools: [] }))
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
		setCv(c => (c.filled.includes(key) ? { ...c, filled: c.filled.filter(k => k !== key) } : c))
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
			...(cv.skills.length ? { skills: [...(profile.skills || []), ...cv.skills].slice(0, 30) } : {}),
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
						<h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{welcome ? 'Welcome to Creatyv' : 'Manage your account'}</h1>
						<p className="mt-0.5 text-sm text-ink-500">{welcome ? 'Set up your profile so clients can book you. Your CV can do most of it.' : 'This is what clients see when they book you.'}</p>
					</div>
				</div>
				<button type="button" onClick={submit} disabled={save.isPending} className="h-10 shrink-0 rounded-xl bg-mint-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-mint-600 disabled:opacity-60">
					{save.isPending ? 'Saving…' : 'Save'}
				</button>
			</div>

			<section className={`mt-6 rounded-2xl border p-4 md:p-5 ${welcome && !cv.source ? 'border-mint-300 bg-mint-50/60' : 'border-ink-200 bg-white'}`}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-mint-600 ring-1 ring-ink-200"><Icon name="file" size={20} /></span>
					<div className="min-w-0 flex-1">
						<h2 className="text-[15px] font-semibold text-ink-900">Fill from your CV</h2>
						<p className="mt-0.5 text-sm text-ink-500">Upload a PDF or Word file. We fill in what's empty and you check it before saving. The file isn't stored.</p>
					</div>
					<button type="button" onClick={() => cvRef.current?.click()} disabled={readCv.isPending}
						className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-70">
						{readCv.isPending
							? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Reading your CV…</>
							: <><Icon name="upload" size={15} /> {cv.source ? 'Upload another' : 'Upload CV'}</>}
					</button>
					<input ref={cvRef} type="file" accept={CV_ACCEPT} className="sr-only" onChange={e => { pickCv(e.target.files?.[0]); e.target.value = '' }} />
				</div>
				{cv.source && (
					<div role="status" className="mt-4 rounded-xl bg-ink-50 px-3.5 py-3 text-sm text-ink-700">
						{cv.filled.length
							? <p><span className="font-semibold text-ink-900">We filled {cv.filled.length} field{cv.filled.length === 1 ? '' : 's'} from your CV</span> — check them and press Save.</p>
							: <p>Your profile already had these details, so nothing was overwritten.</p>}
						{cv.skills.length > 0 && (
							<div className="mt-2.5">
								<span className="text-xs font-medium text-ink-500">Skills found (saved with your profile)</span>
								<div className="mt-1.5 flex flex-wrap gap-1.5">{cv.skills.map(skill => <span key={skill} className="rounded-full bg-white px-2.5 py-0.5 text-[13px] text-ink-800 ring-1 ring-ink-200">{skill}</span>)}</div>
							</div>
						)}
					</div>
				)}
			</section>

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
					<Field label="First Name" required error={errors.first} fromCv={cv.filled.includes('first')}><input className={inputClass} value={form.first} onChange={set('first')} autoComplete="given-name" /></Field>
					<Field label="Last Name" required error={errors.last} fromCv={cv.filled.includes('last')}><input className={inputClass} value={form.last} onChange={set('last')} autoComplete="family-name" /></Field>
					<Field label="Username" required error={errors.username} hint="Your public handle on Creatyv.">
						<div className="relative">
							<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-400">@</span>
							<input className={`${inputClass} pl-8`} value={form.username} onChange={set('username')} placeholder="username" autoCapitalize="none" spellCheck={false} />
						</div>
					</Field>
					<Field label="Email" required><input className={inputClass} value={profile.email || ''} disabled /></Field>
				</div>

				<Field label="Bio" required error={errors.bio} fromCv={cv.filled.includes('bio')}>
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
				{cv.tools.length > 0 && (
					<div className="rounded-xl border border-dashed border-mint-300 bg-mint-50/50 p-3.5">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-ink-900">From your CV</span>
							<button type="button" disabled={tools.isPending} onClick={() => tools.mutate([...(profile.tools || []), ...cv.tools].slice(0, 30))}
								className="h-8 rounded-lg bg-mint-500 px-3 text-xs font-semibold text-white hover:bg-mint-600 disabled:opacity-60">
								{tools.isPending ? 'Adding…' : cv.tools.length === 1 ? 'Add it' : `Add these ${cv.tools.length}`}
							</button>
						</div>
						<div className="mt-2 flex flex-wrap gap-1.5">{cv.tools.map(tool => <span key={tool} className="rounded-full bg-white px-3 py-1 text-[13px] text-ink-900 ring-1 ring-mint-200">{tool}</span>)}</div>
					</div>
				)}
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
				<Field label="Country" fromCv={cv.filled.includes('country')}>
					<select className={inputClass} value={form.country} onChange={set('country')}>
						<option value="">Select country…</option>
						{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
					</select>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="State / Province" fromCv={cv.filled.includes('state')}>
						{isIndia || !form.country ? (
							<select className={inputClass} value={form.state} onChange={set('state')} disabled={!form.country}>
								<option value="">{form.country ? 'Select state…' : 'Select country first'}</option>
								{Object.keys(INDIA_STATES).map(s => <option key={s} value={s}>{s}</option>)}
							</select>
						) : <input className={inputClass} value={form.state} onChange={set('state')} placeholder="State or province" />}
					</Field>
					<Field label="City" fromCv={cv.filled.includes('city')}>
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
