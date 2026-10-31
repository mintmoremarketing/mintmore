import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Icon from '../ui/Icon'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { COMPLETION_QUERY_KEY, OPEN_COMPLETION_EVENT, fetchCompletion } from '../freelancer/completionApi'
import { useOrderOffers } from '../services/useOrderOffers'
import { useChatUnread } from '../../hooks/useChatUnread'

const PRIMARY_ROUTES = {
  client: ['/dashboard', '/services', '/orders', '/chat', '/notifications'],
  designer: ['/dashboard', '/notifications', '/chat', '/settings'],
  admin: ['/admin', '/admin/service-orders', '/admin/users', '/chat'],
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const svg = (children, active) => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke} fill={active ? 'currentColor' : 'none'}>{children}</svg>

// The four pages a freelancer uses most get a tab each; everything else is one tap away in Menu.
const FREELANCER_TABS = [
  { route: '/home', label: 'Home', icon: active => svg(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />, active) },
  { route: '/dashboard', label: 'Explore', icon: () => svg(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>) },
  { route: '/work', label: 'Work', icon: () => svg(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M2 13h20" /></>) },
  { route: '/chat', label: 'Chat', icon: () => svg(<><path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.1-4.6A9 9 0 1 1 21 12Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.6" /></>) },
]

// Everything the desktop sidebar has that isn't a tab.
const MENU_ITEMS = [
  { route: '/my-services', label: 'My services', icon: 'layers' },
  { route: '/settings/freelancer?tab=earnings', match: '/settings/freelancer', label: 'Earnings', icon: 'wallet' },
  { route: '/assessments', label: 'Assessments', icon: 'checkCircle' },
  { route: '/upskill', label: 'Upskill', icon: 'sparkles' },
  { route: '/notifications', label: 'Inbox', icon: 'inbox', count: true },
  { route: '/profile', label: 'Profile', icon: 'user' },
  { route: '/profile/edit', label: 'Edit profile', icon: 'edit' },
  { route: '/settings', label: 'Settings', icon: 'settings' },
  { route: '/disputes', label: 'Support', icon: 'support_tickets' },
]

/** Menu: a bottom sheet with every other page, the profile checklist and sign out. */
function FreelancerMenuSheet({ onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const unreadCount = useUIStore(s => s.unreadCount)
  const { data: completion } = useQuery({ queryKey: COMPLETION_QUERY_KEY, queryFn: fetchCompletion, staleTime: 30_000 })
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const go = route => { onClose(); navigate(route) }
  const openChecklist = () => { onClose(); window.dispatchEvent(new Event(OPEN_COMPLETION_EVENT)) }
  return (
    <>
      <div className="completion-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Menu" className="completion-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overscroll-contain rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] font-store">
        <div className="flex justify-center pb-1 pt-3"><span className="h-1.5 w-12 rounded-full bg-ink-300" /></div>
        <div className="flex items-center gap-3 px-5 pb-3 pt-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-mint-100 text-[15px] font-semibold text-ink-900">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : (user?.full_name || 'C').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink-900">{user?.full_name}</p>
            <p className="truncate text-[13px] text-ink-500">{user?.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full text-ink-500 active:bg-ink-100"><Icon name="x" size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {completion && !completion.isComplete && (
            <button type="button" onClick={openChecklist} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-left active:bg-ink-100">
              <span className="text-[15px] font-semibold tabular-nums text-ink-900">{completion.percent}%</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink-900">Finish your profile</span>
                <span className="block truncate text-[13px] text-ink-500">{completion.total - completion.completed} step{completion.total - completion.completed === 1 ? '' : 's'} left before you get orders</span>
              </span>
              <Icon name="chevronRight" size={18} className="text-ink-400" />
            </button>
          )}
          <ul>
            {MENU_ITEMS.map(item => {
              const active = pathname === (item.match || item.route) || pathname.startsWith(`${item.match || item.route}/`)
              const count = item.count ? unreadCount : 0
              return (
                <li key={item.route}>
                  <button type="button" onClick={() => go(item.route)} aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3 text-left text-[16px] transition-colors active:bg-ink-100 ${active ? 'bg-ink-50 font-semibold text-ink-900' : 'text-ink-800'}`}>
                    <Icon name={item.icon} size={20} className={active ? 'text-mint-500' : 'text-ink-500'} />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-mint-500 px-1.5 text-[12px] font-semibold tabular-nums text-white">{count > 9 ? '9+' : count}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={() => { onClose(); logout() }} className="mt-1 flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3 text-left text-[16px] text-rose-600 active:bg-rose-50">
            <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg> Sign out
          </button>
        </div>
      </div>
    </>
  )
}

/** Freelancer bottom bar: Home, Explore, Work, Chat, and Menu for every other page. */
function FreelancerMobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)
  const unreadCount = useUIStore(s => s.unreadCount)
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: offers = [] } = useOrderOffers(true)
  const chatUnread = useChatUnread()
  const badgeFor = route => (route === '/work' ? offers.length : route === '/chat' ? chatUnread : 0)
  const isOn = route => pathname === route || pathname.startsWith(`${route}/`)
  const menuOn = menuOpen || MENU_ITEMS.some(item => isOn(item.match || item.route))
  const initial = (user?.full_name || '').match(/\p{L}/u)?.[0]?.toUpperCase() || 'C'
  const tab = 'relative flex h-16 w-full flex-col items-center justify-center gap-1 transition-colors duration-150 active:scale-95'
  const badge = n => n > 0 && (
    <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-mint-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white" aria-label={`${n} new`}>{n > 9 ? '9+' : n}</span>
  )
  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-start justify-around border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] font-store" aria-label="Main">
        {FREELANCER_TABS.map(item => {
          const active = isOn(item.route)
          return (
            <button key={item.route} type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(item.route)} className={`${tab} ${active ? 'text-ink-900' : 'text-ink-500'}`}>
              <span className="relative">{item.icon(active)}{badge(badgeFor(item.route))}</span>
              <span className={`text-[11px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
            </button>
          )
        })}
        <button type="button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className={`${tab} ${menuOn ? 'text-ink-900' : 'text-ink-500'}`}>
          <span className="relative">
            <span className={`grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-mint-100 text-[11px] font-semibold text-ink-900 ${menuOn ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}>
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
            </span>
            {badge(unreadCount)}
          </span>
          <span className={`text-[11px] leading-none ${menuOn ? 'font-semibold' : 'font-medium'}`}>Menu</span>
        </button>
      </nav>
      {menuOpen && <FreelancerMenuSheet onClose={() => setMenuOpen(false)} />}
    </>
  )
}

export default function MobileNav({ role, onMore }) {
  if (role === 'freelancer') return <FreelancerMobileNav />
  return <RoleMobileNav role={role} onMore={onMore} />
}

function RoleMobileNav({ role, onMore }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: access } = useEntitlements()
  const isGuest = useAuthStore(s => s.isGuest)
  const unreadCount = useUIStore(s => s.unreadCount)
  const allItems = navForRole(role)
  const allowedItems = filterNavItems({ role, isGuest, access, items: allItems })
  const primaryRoutes = PRIMARY_ROUTES[role] || PRIMARY_ROUTES.client
  const primaryItems = primaryRoutes
    .map(route => allowedItems.find(item => item.route === route))
    .filter(Boolean)
  // Admins get four fixed tabs plus More (the grouped menu); other roles fill five slots.
  const items = role === 'admin'
    ? [...primaryItems, { route: '#more', icon: 'more', label: 'More' }]
    : [...primaryItems, ...allowedItems.filter(item => !primaryItems.includes(item))].slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-start justify-around border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map(item => {
        const isActive = item.route === '/admin'
          ? location.pathname === item.route
          : location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
        const count = item.showCount ? unreadCount : 0
        return (
          <button
            key={item.route}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex h-16 w-full flex-col items-center justify-center gap-1 transition-colors duration-150 ${
              isActive ? 'text-mint-500' : 'text-ink-400 hover:text-ink-700'
            }`}
            onClick={() => (item.route === '#more' ? onMore?.() : navigate(item.route))}
          >
            {/* Active marker: a short bar on the top edge, grown from the centre. */}
            <span
              className={`absolute top-0 h-[3px] w-8 rounded-b-full bg-mint-500 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                isActive ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0'
              }`}
            />
            <span className="relative transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-90">
              <Icon name={item.icon} size={20} />
              {count > 0 && (
                <span key={count} className="notif-badge mobile-nav-badge" aria-hidden="true">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>
            <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
              {item.label}
              {count > 0 && <span className="sr-only">, {count} unread</span>}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
