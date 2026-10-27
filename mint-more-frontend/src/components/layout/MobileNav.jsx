import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'

const PRIMARY_ROUTES = {
  client: ['/dashboard', '/services', '/orders', '/chat', '/notifications'],
  freelancer: ['/dashboard', '/upskill', '/assessments', '/work', '/profile'],
  designer: ['/dashboard', '/notifications', '/chat', '/settings'],
  admin: ['/admin', '/admin/operations', '/admin/users', '/support', '/chat'],
}

export default function MobileNav({ role }) {
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
  const items = [
    ...primaryItems,
    ...allowedItems.filter(item => !primaryItems.includes(item)),
  ].slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-ink-200 flex items-center justify-around z-40 pb-safe">
      {items.map(item => {
        const isActive = location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
        const count = item.showCount ? unreadCount : 0
        return (
          <button
            key={item.route}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex flex-col items-center justify-center h-full w-full gap-1 transition-colors duration-150 ${
              isActive ? 'text-mint-500' : 'text-ink-400 hover:text-ink-700'
            }`}
            onClick={() => navigate(item.route)}
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
