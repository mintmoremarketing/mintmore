import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'

const PRIMARY_ROUTES = {
  client: ['/dashboard', '/calendar', '/jobs', '/mintbox', '/chat'],
  freelancer: ['/dashboard', '/jobs', '/chat', '/portfolio', '/wallet'],
  designer: ['/dashboard', '/notifications', '/chat', '/settings'],
  admin: ['/admin', '/admin/operations', '/admin/users', '/support', '/chat'],
}

export default function MobileNav({ role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: access } = useEntitlements()
  const isGuest = useAuthStore(s => s.isGuest)
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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-ink-200 flex items-center justify-around z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-safe">
      {items.map(item => {
        const isActive = location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
        return (
          <button
            key={item.route}
            className={`flex flex-col items-center justify-center h-full w-full gap-1 transition-colors ${
              isActive ? 'text-mint-500' : 'text-ink-400 hover:text-ink-700'
            }`}
            onClick={() => navigate(item.route)}
          >
            <Icon name={item.icon} size={20} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
