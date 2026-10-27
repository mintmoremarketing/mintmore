import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import { isAdminRouteActive, useAdminNav } from './useAdminNav'

export function AdminNavItem({ item, active, expanded = true, onSelect }) {
  const unreadCount = useUIStore(s => s.unreadCount)
  const count = item.showCount ? unreadCount : 0
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      title={!expanded ? item.label : undefined}
      onClick={() => onSelect(item.route)}
      className={`group flex h-9 w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors duration-150 ${
        expanded ? '' : 'justify-center'
      } ${active ? 'bg-mint-50 font-semibold text-mint-700' : 'font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
    >
      <Icon name={item.icon || 'briefcase'} size={17} className={active ? 'text-mint-600' : 'text-ink-400 group-hover:text-ink-700'} />
      {expanded && <span className="truncate">{item.label}</span>}
      {expanded && count > 0 && (
        <span className="ml-auto min-w-[20px] rounded-full bg-mint-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

export default function AdminSidebar({ collapsed = false, onCollapsedChange }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const [hovered, setHovered] = useState(false)
  const sections = useAdminNav()
  const expanded = !collapsed || hovered

  return (
    <nav
      aria-label="Admin"
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-ink-100 bg-white transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${expanded ? 'w-56' : 'w-16'}`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <button type="button" onClick={() => navigate('/admin')} className="flex min-w-0 items-center gap-2.5" aria-label="Creatyv admin home">
          <img src="/logo-dark.png" alt="" className="h-8 w-8 shrink-0 rounded-md bg-ink-950 object-contain p-1" />
          {expanded && (
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-950">
              Creatyv <span className="font-medium text-ink-400">Admin</span>
            </span>
          )}
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-800"
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} />
          </button>
        )}
      </div>

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3">
        {sections.map((section, index) => (
          <div key={section.label || 'top'} className={index ? 'mt-4' : ''}>
            {section.label && (expanded
              ? <div className="mb-1 px-2.5 text-xs font-medium text-ink-400">{section.label}</div>
              : <div className="mx-2 mb-2 border-t border-ink-100" />)}
            <div className="flex flex-col gap-0.5">
              {section.items.map(item => (
                <AdminNavItem key={item.route} item={item} expanded={expanded} active={isAdminRouteActive(item.route, pathname)} onSelect={navigate} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-ink-100 p-3">
        <button type="button" onClick={() => navigate('/settings?section=profile')} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-ink-50" title={!expanded ? 'Profile' : undefined}>
          <Avatar name={user?.full_name} src={user?.avatar_url} size="sm" />
          {expanded && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink-900">{user?.full_name}</span>
              <span className="block truncate text-xs text-ink-500">{user?.email}</span>
            </span>
          )}
        </button>
        {expanded && (
          <button type="button" onClick={logout} aria-label="Sign out" title="Sign out" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-800">
            <Icon name="arrowRight" size={16} />
          </button>
        )}
      </div>
    </nav>
  )
}
