import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'

const CLIENT_NAV = [
  { route: '/dashboard',   icon: 'home',      label: 'Dashboard' },
  { route: '/notifications', icon: 'bell',     label: 'Inbox', showCount: true },
  { route: '/jobs',        icon: 'briefcase', label: 'Jobs' },
  { route: '/mintbox',     icon: 'layers',    label: 'Mintbox' },
  { route: '/wallet',      icon: 'wallet',    label: 'Wallet' },
  { route: '/freelancers', icon: 'user',      label: 'Marketplace' },
  { route: '/social',      icon: 'layers',    label: 'Social' },
  { route: '/ai',          icon: 'sparkles',  label: 'Mint AI' },
  { route: '/chat',        icon: 'chat',      label: 'Messages' },
]

const FREELANCER_NAV = [
  { route: '/dashboard',    icon: 'home',      label: 'Workspace' },
  { route: '/notifications', icon: 'bell',      label: 'Inbox', showCount: true },
  { route: '/jobs',         icon: 'briefcase', label: 'Briefs' },
  { route: '/wallet',       icon: 'wallet',    label: 'Earnings' },
  { route: '/profile-edit', icon: 'user',      label: 'My Profile' },
  { route: '/packages',     icon: 'layers',    label: 'Packages' },
  { route: '/portfolio',    icon: 'image',     label: 'Portfolio' },
  { route: '/inquiries',    icon: 'chat',      label: 'Inquiries' },
]

const ADMIN_NAV = [
  { route: '/admin',           icon: 'home',     label: 'Overview' },
  { route: '/notifications',    icon: 'bell',     label: 'Inbox', showCount: true },
  { route: '/admin/users',     icon: 'user',     label: 'Users' },
  { route: '/admin/approvals', icon: 'zap',      label: 'Approvals' },
  { route: '/admin/pricing',   icon: 'rupee',    label: 'Pricing' },
  { route: '/admin/wallet',    icon: 'wallet',   label: 'Platform wallet' },
  { route: '/admin/ai',        icon: 'sparkles', label: 'Mint AI' },
]

export default function Sidebar({ role }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()
  const unreadCount = useUIStore((s) => s.unreadCount)

  const items = role === 'admin'
    ? ADMIN_NAV
    : role === 'freelancer'
    ? FREELANCER_NAV
    : CLIENT_NAV

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
        <button
          className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <Icon name="settings" size={15} />
          <span>Settings</span>
        </button>

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
          <button className="icon-btn" onClick={logout} title="Sign out">
            <Icon name="arrowRight" size={13} />
          </button>
        </div>
      </div>
    </nav>
  )
}
