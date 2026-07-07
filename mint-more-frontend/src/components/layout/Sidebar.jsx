import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { useEntitlements } from '../../hooks/useEntitlements'
import { filterNavItems, navForRole } from './navigation'
import ProfilePopover from './ProfilePopover'

export default function Sidebar({ role, collapsed = false, onCollapsedChange }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, isGuest } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const unreadCount = useUIStore((s) => s.unreadCount)
  const { data: access } = useEntitlements()

  const allItems = navForRole(role)
  const items = filterNavItems({ role, isGuest, access, items: allItems })
  const homeRoute = role === 'admin' ? '/admin' : '/dashboard'

  const expanded = !collapsed || hovered

  return (
    <nav
      className={`sidebar${collapsed ? ' collapsed' : ''}${hovered ? ' hover-expanded' : ''}`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setProfileOpen(false)
      }}
    >
      <button
        type="button"
        className="sidebar-collapse-toggle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => onCollapsedChange?.(!collapsed)}
      >
        <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
      </button>
      {/* Logo */}
      <div className="sidebar-logo" onClick={() => navigate(homeRoute)}>
        <span className="sidebar-logo-mark">C</span>
        {expanded && (
          <span className="sidebar-logo-word">
            CREAT<span style={{ color: 'var(--mint-500)', fontWeight: 650 }}>YV</span>
          </span>
        )}
      </div>

      {/* Main nav */}
      <div className="sidebar-nav" style={{ flex: 1 }}>
        {items.map(item => (
          <button
            key={item.route}
            className={`nav-item ${location.pathname === item.route || location.pathname.startsWith(`${item.route}/`) ? 'active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            <Icon name={item.icon || 'briefcase'} size={15} />
            {expanded && <span>{item.label}</span>}
            {expanded && item.showCount && unreadCount > 0 && (
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
          {expanded && <span>Settings</span>}
        </button>}

        <button className="sidebar-user sidebar-user-button" onClick={() => setProfileOpen(open => !open)}>
          <div className="avatar sm">
            {(user?.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')}
          </div>
          {expanded && <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 500, color: 'var(--ink-950)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>}
          {expanded && <Icon name="chevronRight" size={13} />}
        </button>
        {profileOpen && <ProfilePopover onClose={() => setProfileOpen(false)} />}
      </div>
    </nav>
  )
}
