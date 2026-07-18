import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'

export default function MobileDrawer({ role, onClose }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout, isGuest } = useAuthStore()
  const { data: access } = useEntitlements()

  const allItems = navForRole(role)
  const items = filterNavItems({ role, isGuest, access, items: allItems })
  const homeRoute = role === 'admin' ? '/admin' : '/dashboard'

  function go(route) {
    navigate(route)
    onClose()
  }

  return (
    <div className="mobile-drawer-backdrop" onClick={onClose}>
      <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
        <nav className="sidebar">
          {/* Logo */}
          <div className="sidebar-logo" onClick={() => go(homeRoute)} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo-dark.png" alt="CREATYV" className="w-8 h-8 object-contain rounded" />
            <span>CREAT<span style={{ color: 'var(--mint-500)', fontWeight: 650 }}>YV</span></span>
          </div>

          {/* Nav items */}
          <div className="sidebar-nav" style={{ flex: 1 }}>
            {items.map(item => (
              <button
                key={item.route}
                className={`nav-item ${location.pathname === item.route || location.pathname.startsWith(`${item.route}/`) ? 'active' : ''}`}
                onClick={() => go(item.route)}
              >
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {role === 'client' && (
            <button
              className="nav-item"
              style={{ color: 'var(--mint-500)', fontWeight: 600 }}
              onClick={() => go('/membership')}
            >
              <Icon name="star" size={15} />
              <span>Upgrade Plan</span>
            </button>
          )}

          {!isGuest && <button
            className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
            onClick={() => go('/settings')}
          >
            <Icon name="settings" size={15} />
            <span>Settings</span>
          </button>}

          {/* User footer */}
          <div className="sidebar-user">
            <div className="avatar sm">
              {(user?.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 500, color: 'var(--ink-950)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={() => { logout(); onClose() }}
              title="Sign out"
            >
              <Icon name="arrowRight" size={13} />
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}
