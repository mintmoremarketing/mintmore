import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { useFreelancerApproved } from '../freelancer/completionApi'
import { useOrderOffers } from '../services/useOrderOffers'
import { useChatUnread } from '../../hooks/useChatUnread'

const PRIMARY_ROUTES = {
  client: ['/dashboard', '/services', '/orders', '/chat', '/notifications'],
  freelancer: ['/dashboard', '/upskill', '/assessments', '/work', '/profile'],
  designer: ['/dashboard', '/notifications', '/chat', '/settings'],
  admin: ['/admin', '/admin/service-orders', '/admin/users', '/chat'],
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const FREELANCER_TABS = [
  { route: '/dashboard', label: 'Home', icon: active => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke} fill={active ? 'currentColor' : 'none'}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg> },
  { route: '/chat', label: 'Chat', icon: () => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke}><path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.1-4.6A9 9 0 1 1 21 12Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.6" /></svg> },
  { route: '/assessments', label: 'Assessments', icon: () => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /><path d="M8 13h6M8 17h4" /><circle cx="18" cy="6" r="3.5" /><path d="m16.6 6 1 1 1.8-1.9" /></svg> },
  { route: '/upskill', label: 'Upskill', icon: () => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke}><path d="M2 5a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H3a1 1 0 0 1-1-1z" /><path d="M22 5a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h6a1 1 0 0 0 1-1z" /></svg> },
]
// Once approved, the Assessments slot becomes My Work.
const WORK_TAB = { route: '/work', label: 'My Work', icon: () => <svg viewBox="0 0 24 24" width="24" height="24" {...stroke}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M2 13h20" /></svg> }

/** Freelancer bottom bar, same order as the reference: Home, Chat, Assessments, Upskill, Profile (avatar). */
function FreelancerMobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)
  const approved = useFreelancerApproved()
  const { data: offers = [] } = useOrderOffers(approved)
  const chatUnread = useChatUnread()
  const badgeFor = route => (route === '/work' ? offers.length : route === '/chat' ? chatUnread : 0)
  const tabs = FREELANCER_TABS.map(item => (approved && item.route === '/assessments' ? WORK_TAB : item))
  const isOn = route => (route === '/dashboard' ? pathname === route : pathname === route || pathname.startsWith(`${route}/`))
  const profileOn = isOn('/profile')
  const initial = (user?.full_name || '').match(/\p{L}/u)?.[0]?.toUpperCase() || 'C'
  const tab = 'relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors duration-150'
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-ink-100 bg-white pb-safe font-store" aria-label="Main">
      {tabs.map(item => {
        const active = isOn(item.route)
        return (
          <button key={item.route} type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(item.route)} className={`${tab} ${active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}>
            <span className="relative">
              {item.icon(active)}
              {badgeFor(item.route) > 0 && (
                <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-mint-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white" aria-label={`${badgeFor(item.route)} new`}>
                  {badgeFor(item.route) > 9 ? '9+' : badgeFor(item.route)}
                </span>
              )}
            </span>
            <span className={`text-[11px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
          </button>
        )
      })}
      <button type="button" aria-current={profileOn ? 'page' : undefined} onClick={() => navigate('/profile')} className={`${tab} ${profileOn ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}>
        <span className={`grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-mint-100 text-[11px] font-semibold text-ink-900 ${profileOn ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}>
          {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
        </span>
        <span className={`text-[11px] leading-none ${profileOn ? 'font-semibold' : 'font-medium'}`}>Profile</span>
      </button>
    </nav>
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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-ink-200 flex items-center justify-around z-40 pb-safe">
      {items.map(item => {
        const isActive = item.route === '/admin'
          ? location.pathname === item.route
          : location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
        const count = item.showCount ? unreadCount : 0
        return (
          <button
            key={item.route}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex flex-col items-center justify-center h-full w-full gap-1 transition-colors duration-150 ${
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
