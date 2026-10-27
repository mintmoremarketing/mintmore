import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import { filterNavItems, navForRole } from './navigation'
import { useEntitlements } from '../../hooks/useEntitlements'
import { AdminNavItem } from './AdminSidebar'
import { isAdminRouteActive, useAdminNav } from './useAdminNav'

const SHOW_UPGRADE_PLAN = false

/** Admin menu on phones: the same grouped sections as the desktop sidebar. */
function AdminDrawer({ onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const sections = useAdminNav()
  const go = route => { navigate(route); onClose() }
  return (
    <div className="mobile-drawer-backdrop" onClick={onClose}>
      <div className="mobile-drawer flex-col bg-white" onClick={e => e.stopPropagation()} role="dialog" aria-label="Admin menu">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-100 px-4 pt-safe">
          <img src="/logo-dark.png" alt="" className="h-7 w-7 rounded-md bg-ink-950 object-contain p-1" />
          <span className="text-[15px] font-semibold text-ink-950">Creatyv <span className="font-medium text-ink-400">Admin</span></span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="ml-auto grid h-9 w-9 place-items-center rounded-md text-ink-500 hover:bg-ink-50">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sections.map((section, index) => (
            <div key={section.label || 'top'} className={index ? 'mt-4' : ''}>
              {section.label && <div className="mb-1 px-2.5 text-xs font-medium text-ink-400">{section.label}</div>}
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => (
                  <AdminNavItem key={item.route} item={item} active={isAdminRouteActive(item.route, pathname)} onSelect={go} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2.5 border-t border-ink-100 p-3 pb-safe">
          <Avatar name={user?.full_name} src={user?.avatar_url} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ink-900">{user?.full_name}</div>
            <div className="truncate text-xs text-ink-500">{user?.email}</div>
          </div>
          <button type="button" onClick={() => { logout(); onClose() }} className="h-9 rounded-md px-3 text-[13px] font-medium text-ink-600 hover:bg-ink-50">Sign out</button>
        </div>
      </div>
    </div>
  )
}

export default function MobileDrawer({ role, onClose }) {
  if (role === 'admin') return <AdminDrawer onClose={onClose} />
  return <RoleDrawer role={role} onClose={onClose} />
}

function RoleDrawer({ role, onClose }) {
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

          {/* LAUNCH-HIDDEN: membership upsell, hidden for the services launch (matches Sidebar). */}
          {SHOW_UPGRADE_PLAN && role === 'client' && (
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
            <Avatar name={user?.full_name} src={user?.avatar_url} size="sm" />
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
              aria-label="Sign out"
            >
              <Icon name="arrowRight" size={13} />
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}
