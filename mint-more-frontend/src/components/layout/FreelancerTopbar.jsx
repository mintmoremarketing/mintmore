import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { useChatUnread } from '../../hooks/useChatUnread'
import Icon from '../ui/Icon'
import { COMPLETION_QUERY_KEY, OPEN_COMPLETION_EVENT, fetchCompletion, useFreelancerApproved } from '../freelancer/completionApi'

// Outline icons drawn at 16px, matching the weight of the tab labels.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const TAB_ICONS = {
	explore: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" /></svg>,
	upskill: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg>,
	assessments: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></svg>,
	work: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M2 13h20" /></svg>,
}
// Approved freelancers no longer need Assessments, so that slot becomes My Work.
const tabsFor = approved => [
	{ to: '/dashboard', label: 'Explore', icon: 'explore', end: true },
	{ to: '/upskill', label: 'Upskill', icon: 'upskill' },
	approved ? { to: '/work', label: 'My Work', icon: 'work' } : { to: '/assessments', label: 'Assessments', icon: 'assessments' },
]

const initialsOf = name => (name || '').match(/\p{L}+/gu)?.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'C'

function BookingToggle() {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const { data } = useQuery({ queryKey: COMPLETION_QUERY_KEY, queryFn: fetchCompletion, staleTime: 30_000 })
	const on = Boolean(data?.isAvailable)
	const locked = data && !data.isComplete && !on

	const toggle = useMutation({
		mutationFn: next => api.patch('/profile/me', { is_available: next }),
		onSuccess: (_, next) => {
			queryClient.setQueryData(COMPLETION_QUERY_KEY, old => old && { ...old, isAvailable: next })
			pushToast({ title: next ? 'Bookings on' : 'Bookings off', body: next ? 'New orders can be assigned to you.' : 'You will not get new orders until you turn bookings on.', icon: 'check' })
		},
		onError: err => pushToast({ title: 'Could not change bookings', body: err?.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	if (!data) return <span className="hidden h-8 w-[94px] animate-pulse rounded-full bg-ink-100 lg:block" />

	const label = locked ? 'Bookings off — complete your profile to turn them on' : on ? 'Bookings on — tap to pause new orders' : 'Bookings off — tap to turn on'
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={label}
			title={label}
			disabled={toggle.isPending}
			onClick={() => locked ? window.dispatchEvent(new Event(OPEN_COMPLETION_EVENT)) : toggle.mutate(!on)}
			className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${on ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}
		>
			<svg viewBox="0 0 24 24" width="13" height="13" {...stroke}><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
			Booking {on ? 'On' : 'Off'}
		</button>
	)
}

function AccountMenu() {
	const navigate = useNavigate()
	const { user, logout } = useAuthStore()
	const [open, setOpen] = useState(false)
	const ref = useRef(null)

	useEffect(() => {
		if (!open) return
		const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
		const esc = e => e.key === 'Escape' && setOpen(false)
		document.addEventListener('mousedown', close)
		document.addEventListener('keydown', esc)
		return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
	}, [open])

	const go = to => { setOpen(false); navigate(to) }
	const avatar = size => user?.avatar_url
		? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
		: <span className={size}>{initialsOf(user?.full_name)}</span>
	const items = [
		{ label: 'Dashboard', to: '/dashboard', icon: 'grid' },
		{ label: 'My Work', to: '/work', icon: 'briefcase' },
		{ label: 'My Services', to: '/my-services', icon: 'layers' },
		{ label: 'Account Settings', to: '/profile/edit', icon: 'settings' },
	]

	return (
		<div className="relative" ref={ref}>
			<button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-mint-500 text-sm font-semibold text-white">
				{avatar('')}
			</button>
			{open && (
				<div role="menu" className="account-menu absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
					<div className="flex items-center gap-3 bg-ink-900 px-4 py-4 text-white">
						<span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-mint-500 text-base font-semibold">{avatar('')}</span>
						<div className="min-w-0">
							<div className="truncate font-semibold">{user?.full_name}</div>
							<div className="truncate text-sm text-white/60">{user?.email}</div>
							<button type="button" onClick={() => go('/profile')} className="mt-0.5 inline-flex items-center gap-0.5 text-sm font-medium text-mint-300 hover:underline">
								View profile <Icon name="chevronRight" size={14} />
							</button>
						</div>
					</div>
					<div className="py-2">
						{items.map(item => (
							<button key={item.to} role="menuitem" type="button" onClick={() => go(item.to)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink-900 hover:bg-ink-50">
								<Icon name={item.icon} size={18} className="text-ink-600" /> {item.label}
							</button>
						))}
					</div>
					<div className="border-t border-ink-100 py-2">
						<button role="menuitem" type="button" onClick={() => { setOpen(false); logout() }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-rose-600 hover:bg-rose-50">
							<svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
							Sign Out
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Freelancer header: search, bookings switch, create post, messages, alerts, account.
 * Beside the desktop sidebar it drops the logo and tabs, which the sidebar carries.
 */
export default function FreelancerTopbar({ isMobile, unreadCount = 0, withSidebar = false }) {
	const navigate = useNavigate()
	const [q, setQ] = useState('')
	const tabs = tabsFor(useFreelancerApproved())
	const chatUnread = useChatUnread()
	const iconBtn = 'relative grid h-9 w-9 place-items-center rounded-full text-ink-700 transition-colors hover:bg-ink-100'

	return (
		<header className="flex h-16 items-center gap-3 px-4 font-store md:gap-4 md:px-6 xl:gap-5 xl:px-10">
			{!withSidebar && <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Creatyv home">
				<img src="/logo-dark.png" alt="" className="h-7 w-7 object-contain" />
				<span className="text-[19px] font-semibold tracking-tight text-ink-900">CREAT<span className="text-mint-500">YV</span></span>
			</Link>}

			{!isMobile && (
				<form
					role="search"
					onSubmit={e => { e.preventDefault(); navigate(q.trim() ? `/services?q=${encodeURIComponent(q.trim())}` : '/services') }}
					className={`hidden w-full items-center rounded-xl border border-ink-200 bg-white pl-3 pr-2 focus-within:border-ink-400 ${withSidebar ? 'max-w-[320px] md:flex' : 'max-w-[250px] xl:flex'}`}
				>
					<input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by service, category…" aria-label="Search services" className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
					<button type="submit" aria-label="Search" className="text-ink-400 hover:text-ink-700"><Icon name="search" size={16} /></button>
				</form>
			)}

			{!isMobile && !withSidebar && (
				<nav className="flex items-stretch gap-4 self-stretch xl:gap-5" aria-label="Freelancer">
					{tabs.map(tab => (
						<NavLink
							key={tab.to}
							to={tab.to}
							end={tab.end}
							className={({ isActive }) => `inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 text-sm transition-colors ${isActive ? 'border-mint-500 font-medium text-mint-600' : 'border-transparent text-ink-700 hover:text-ink-900'}`}
						>
							<span className="hidden lg:inline-flex">{TAB_ICONS[tab.icon]}</span> {tab.label}
						</NavLink>
					))}
				</nav>
			)}

			<div className="ml-auto flex shrink-0 items-center gap-2 md:gap-2.5 xl:gap-3">
				<BookingToggle />
				{!isMobile && (
					<>
						<span className="h-6 w-px bg-ink-200" aria-hidden="true" />
						<Link to="/my-services" className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-700 lg:inline-flex">My Services</Link>
						<Link to="/profile?new=1" aria-label="Create Post" title="Create Post" className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-medium text-ink-900 hover:text-ink-600">
							<Icon name="plus" size={16} /> <span className="hidden xl:inline">Create Post</span>
						</Link>
						<span className="h-6 w-px bg-ink-200" aria-hidden="true" />
					</>
				)}
				<Link to="/chat" className={iconBtn} aria-label={chatUnread ? `Messages, ${chatUnread} unread` : 'Messages'}>
					<Icon name="chat" size={19} />
					{chatUnread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mint-500" />}
				</Link>
				<Link to="/notifications" className={iconBtn} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
					<Icon name="bell" size={19} />
					{unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mint-500" />}
				</Link>
				<AccountMenu />
			</div>
		</header>
	)
}
