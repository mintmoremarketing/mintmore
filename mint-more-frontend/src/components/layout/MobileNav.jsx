import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { ADMIN_NAV, CLIENT_NAV, FREELANCER_NAV, DESIGNER_NAV } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'

const PRIMARY_ROUTES = {
  client: ['/dashboard', '/calendar', '/jobs', '/mintbox', '/chat'],
  freelancer: ['/dashboard', '/jobs', '/chat', '/portfolio', '/wallet'],
  designer: ['/dashboard', '/notifications', '/chat', '/settings'],
  admin: ['/admin', '/admin/users', '/support', '/disputes', '/chat'],
}

const DEFAULT_FLAGS = { wallet_ui: false, marketplace: false, freelancer_portal: false, freelancer_matching: false, negotiation: false }

export default function MobileNav({ role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: access } = useEntitlements()
  const isGuest = useAuthStore(s => s.isGuest)
  const allItems = role === 'admin'
    ? ADMIN_NAV
    : role === 'designer'
    ? DESIGNER_NAV
    : role === 'freelancer'
    ? FREELANCER_NAV
    : CLIENT_NAV
  const permissions = access?.admin_permissions || []
  const flags = { ...DEFAULT_FLAGS, ...(access?.feature_flags || {}) }
  const allowedItems = isGuest
    ? allItems.filter(item => item.route === '/dashboard')
    : role === 'admin'
    ? allItems.filter(item => !item.permission || access?.is_super_admin || permissions.includes('*') || permissions.includes(item.permission))
    : allItems.filter(item => !item.flag || flags[item.flag] !== false)
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
