import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { portfolioApi } from '../../api/portfolio'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { PortfolioItemModal } from './Portfolio'
import { inr } from '../../components/services/serviceUtils'

const TABS = [
	{ key: 'posts', label: 'Posts' },
	{ key: 'reviews', label: 'Reviews' },
	{ key: 'services', label: 'Services' },
	{ key: 'about', label: 'About' },
]

const initialsOf = name => (name || '').match(/\p{L}+/gu)?.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'C'

function Empty({ icon, text, action }) {
	return (
		<div className="flex flex-col items-center py-20 text-center">
			<Icon name={icon} size={36} className="text-ink-300" />
			<p className="mt-3 text-[15px] text-ink-500">{text}</p>
			{action}
		</div>
	)
}

function Posts({ onAdd, onEdit }) {
	const { data: items = [], isLoading } = useQuery({
		queryKey: ['my-portfolio'],
		queryFn: () => portfolioApi.getMyPortfolio().then(r => r.data.data.items || []),
	})
	if (isLoading) return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-ink-100" />)}</div>
	if (!items.length) {
		return (
			<Empty icon="edit" text="No posts yet" action={
				<button type="button" onClick={onAdd} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-900 hover:bg-ink-50">
					<Icon name="plus" size={14} /> Add Post
				</button>
			} />
		)
	}
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
			<button type="button" onClick={onAdd} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 text-sm font-medium text-ink-600 transition-colors hover:border-ink-500 hover:text-ink-900">
				<Icon name="plus" size={20} /> Add Post
			</button>
			{items.map(item => (
				<button key={item.id} type="button" onClick={() => onEdit(item)} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-100 text-left">
					{item.cover_image_url && <img src={item.cover_image_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" />}
					<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-sm font-medium text-white">{item.title}</span>
					{item.is_visible === false && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-ink-700">Hidden</span>}
				</button>
			))}
		</div>
	)
}

function Reviews({ userId }) {
	const { data, isLoading } = useQuery({
		queryKey: ['my-reviews', userId],
		queryFn: () => api.get(`/reviews/freelancer/${userId}`).then(r => r.data.data),
		enabled: Boolean(userId),
	})
	const reviews = data?.reviews || []
	if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
	if (!reviews.length) return <Empty icon="star" text="No reviews yet. Clients can rate you after they approve an order." />
	return (
		<ul className="divide-y divide-ink-100">
			{reviews.map(review => (
				<li key={review.id} className="py-5">
					<div className="flex items-center justify-between gap-3">
						<span className="font-medium text-ink-900">{review.client_name}</span>
						<span className="inline-flex items-center gap-1 text-sm font-medium text-ink-900"><Icon name="star" size={14} className="text-amber-500" /> {Number(review.rating_overall).toFixed(1)}</span>
					</div>
					{review.review_text && <p className="mt-1.5 text-[15px] text-ink-600">{review.review_text}</p>}
					<p className="mt-1 text-xs text-ink-500">{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
				</li>
			))}
		</ul>
	)
}

function Services() {
	const { data: templates = [], isLoading } = useQuery({
		queryKey: ['freelancer-templates', 'profile'],
		queryFn: () => servicesApi.templates().then(r => r.data.data.templates || []),
	})
	const mine = templates.filter(t => t.opted_in)
	if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
	if (!mine.length) {
		return <Empty icon="layers" text="You haven't picked any services yet." action={<Link to="/my-services" className="mt-4 text-sm font-medium text-mint-600 hover:underline">Choose services you deliver</Link>} />
	}
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{mine.map(t => (
				<Link key={t.id} to={`/services/${t.slug}`} className="rounded-2xl border border-ink-200 p-4 transition-colors hover:border-ink-300">
					<div className="font-medium text-ink-900">{t.title}</div>
					<div className="mt-0.5 text-sm text-ink-500">{t.category_name}</div>
				</Link>
			))}
		</div>
	)
}

function About({ profile }) {
	const rows = [
		['Tools', profile.tools],
		['Skills', profile.skills],
		['Languages', profile.languages],
	]
	return (
		<div className="grid gap-8 md:grid-cols-[1fr_320px]">
			<section>
				<h2 className="text-base font-semibold text-ink-900">About</h2>
				{profile.bio
					? <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{profile.bio}</p>
					: <p className="mt-2 text-[15px] text-ink-500">Tell people about your work and what you do. <Link to="/profile/edit" className="font-medium text-mint-600 hover:underline">Add About</Link></p>}
				{(profile.address_city || profile.country) && (
					<p className="mt-4 text-sm text-ink-500">{[profile.address_city, profile.address_state, profile.country].filter(Boolean).join(', ')}</p>
				)}
			</section>
			<aside className="space-y-4">
				{rows.map(([label, list]) => (
					<div key={label} className="rounded-2xl border border-ink-200 p-4">
						<h3 className="text-sm font-semibold text-ink-900">{label}</h3>
						{list?.length
							? <div className="mt-2 flex flex-wrap gap-1.5">{list.map(item => <span key={item} className="rounded-full bg-ink-100 px-2.5 py-1 text-[13px] text-ink-800">{item}</span>)}</div>
							: <p className="mt-1 text-sm text-ink-500">No {label.toLowerCase()} added yet.</p>}
						{label === 'Tools' && (
							<Link to="/profile/edit?tools=1" className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 px-2.5 text-xs font-medium text-ink-900 hover:bg-ink-50">
								<Icon name="plus" size={12} /> {list?.length ? 'Edit Tools' : 'Add Tools'}
							</Link>
						)}
					</div>
				))}
			</aside>
		</div>
	)
}

/** Freelancer profile: header with stats, then Posts / Reviews / Services / About. */
export default function Profile() {
	const pushToast = useUIStore(s => s.pushToast)
	const [params, setParams] = useSearchParams()
	const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'posts'
	const [editing, setEditing] = useState(params.get('new') === '1' ? 'new' : null)

	const { data: profile } = useQuery({
		queryKey: ['my-profile'],
		queryFn: () => api.get('/profile/me').then(r => r.data.data.profile),
	})
	const { data: stats } = useQuery({
		queryKey: ['my-profile-stats'],
		queryFn: () => api.get('/profile/me/stats').then(r => r.data.data.stats),
	})

	const setTab = key => setParams(key === 'posts' ? {} : { tab: key }, { replace: true })
	const closeEditor = () => {
		setEditing(null)
		if (params.get('new')) setParams(tab === 'posts' ? {} : { tab }, { replace: true })
	}
	const share = async () => {
		const url = `${window.location.origin}/freelancers/${profile?.id}`
		try { await navigator.clipboard.writeText(url); pushToast({ title: 'Profile link copied', icon: 'copy' }) } catch { pushToast({ title: 'Copy failed', body: url, tone: 'amber' }) }
	}

	const statItems = [
		{ label: 'Earned', value: inr(stats?.earned || 0) },
		{ label: 'Hired', value: `${stats?.hired || 0}x` },
		{ label: 'Rating', value: (stats?.rating || 0).toFixed(1) },
		{ label: 'Reviews', value: stats?.reviews || 0 },
	]

	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-5">
					<div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-100 text-2xl font-semibold text-ink-500 md:h-24 md:w-24">
						{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initialsOf(profile?.full_name)}
					</div>
					<div className="min-w-0">
						<h1 className="truncate text-2xl font-semibold tracking-tight text-ink-900">{profile?.full_name || ' '}</h1>
						{profile?.username && <p className="text-sm text-ink-500">@{profile.username}</p>}
						<Link to="/profile/edit" className="mt-2 inline-flex h-8 items-center rounded-lg border border-ink-200 px-3 text-sm text-ink-700 hover:bg-ink-50">Edit Profile</Link>
					</div>
				</div>
				<dl className="grid grid-cols-4 rounded-2xl border border-ink-100 px-2 py-3">
					{statItems.map(item => (
						<div key={item.label} className="px-4 text-center">
							<dd className="text-xl font-semibold tabular-nums text-ink-900">{item.value}</dd>
							<dt className="text-xs text-ink-500">{item.label}</dt>
						</div>
					))}
				</dl>
			</header>

			<div className="mt-8 flex items-center justify-between border-b border-ink-100">
				<div role="tablist" className="-mb-px flex gap-6">
					{TABS.map(t => (
						<button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
							className={`border-b-2 pb-3 text-[15px] transition-colors ${tab === t.key ? 'border-ink-900 font-medium text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>
							{t.label}
						</button>
					))}
				</div>
				<button type="button" onClick={share} className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
					<Icon name="arrowUpRight" size={15} /> Share
				</button>
			</div>

			<div className="mt-6">
				{tab === 'posts' && <Posts onAdd={() => setEditing('new')} onEdit={item => setEditing(item)} />}
				{tab === 'reviews' && <Reviews userId={profile?.id} />}
				{tab === 'services' && <Services />}
				{tab === 'about' && profile && <About profile={profile} />}
			</div>

			{editing && <PortfolioItemModal item={editing === 'new' ? null : editing} onClose={closeEditor} onSaved={() => {}} />}
		</div>
	)
}
