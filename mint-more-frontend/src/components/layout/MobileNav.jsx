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
    <nav className="mobile-bottom-nav">
      {items.map(item => (
        <button
          key={item.route}
          className={`mobile-nav-item ${location.pathname === item.route || location.pathname.startsWith(`${item.route}/`) ? 'active' : ''}`}
          onClick={() => navigate(item.route)}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
