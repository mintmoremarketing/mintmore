import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { useEntitlements } from '../../hooks/useEntitlements'
import { ADMIN_NAV, CLIENT_NAV, FREELANCER_NAV, DESIGNER_NAV } from './navigation'
import ProfilePopover from './ProfilePopover'

const DEFAULT_FLAGS = { wallet_ui: false, marketplace: false, freelancer_portal: false, freelancer_matching: false, negotiation: false }

export default function Sidebar({ role }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, isGuest } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const unreadCount = useUIStore((s) => s.unreadCount)
  const { data: access } = useEntitlements()

  const allItems = role === 'admin'
    ? ADMIN_NAV
    : role === 'designer'
    ? DESIGNER_NAV
    : role === 'freelancer'
    ? FREELANCER_NAV
    : CLIENT_NAV
  const permissions = access?.admin_permissions || []
  const flags = { ...DEFAULT_FLAGS, ...(access?.feature_flags || {}) }
  const items = isGuest
    ? allItems.filter(item => item.route === '/dashboard')
    : role === 'admin'
    ? allItems.filter(item => !item.permission || access?.is_super_admin || permissions.includes('*') || permissions.includes(item.permission))
    : allItems.filter(item => !item.flag || flags[item.flag] !== false)

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo" onClick={() => navigate('/dashboard')}>
        Mint<span style={{ color: 'var(--mint-500)', fontStyle: 'italic', fontWeight: 500 }}>more</span>
      </div>

      {/* Main nav */}
      <div className="sidebar-nav" style={{ flex: 1 }}>
        {items.map(item => (
          <button
            key={item.route}
            className={`nav-item ${location.pathname === item.route || location.pathname.startsWith(`${item.route}/`) ? 'active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
            {item.showCount && unreadCount > 0 && (
              <span
                className="mono"
                style={{
                  marginLeft: 'auto',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: 'var(--mint-100)',
                  color: 'var(--mint-700)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom: settings + user */}
      <div>
        {!isGuest && <button
          className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <Icon name="settings" size={15} />
          <span>Settings</span>
        </button>}

        <button className="sidebar-user sidebar-user-button" onClick={() => setProfileOpen(open => !open)}>
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
          <Icon name="chevronRight" size={13} />
        </button>
        {profileOpen && <ProfilePopover onClose={() => setProfileOpen(false)} />}
      </div>
    </nav>
  )
}
