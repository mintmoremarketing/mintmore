import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import { useEntitlements } from '../../hooks/useEntitlements'
import { filterNavItems, navForRole } from './navigation'

export default function Sidebar({ role, collapsed = false, onCollapsedChange }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, isGuest, logout } = useAuthStore()
  const [hovered, setHovered] = useState(false)
  const unreadCount = useUIStore((s) => s.unreadCount)
  const { data: access } = useEntitlements()

  const allItems = navForRole(role)
  const items = filterNavItems({ role, isGuest, access, items: allItems })
  const homeRoute = role === 'admin' ? '/admin' : '/dashboard'

  const expanded = !collapsed || hovered

  return (
    <nav
      className={`fixed top-0 left-0 h-screen bg-ink-950 text-white flex flex-col border-r border-ink-800 transition-all duration-200 ease-out z-40 ${
        expanded ? 'w-56' : 'w-16'
      }`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="absolute -right-3 top-6 bg-ink-800 border border-ink-700 text-ink-300 hover:text-white rounded-full p-1 z-50 flex items-center justify-center transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => onCollapsedChange?.(!collapsed)}
      >
        <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
      </button>
      
      {/* Logo */}
      <div 
        className="flex items-center h-16 px-4 cursor-pointer mb-4 shrink-0 transition-opacity hover:opacity-80" 
        onClick={() => navigate(homeRoute)}
      >
        <img src="/logo-dark.png" alt="CREATYV" className="w-8 h-8 shrink-0 object-contain" />
        {expanded && (
          <span className="ml-3 font-display text-lg tracking-wide whitespace-nowrap overflow-hidden">
            CREAT<span className="text-mint-500 font-bold">YV</span>
          </span>
        )}
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 flex flex-col gap-1 custom-scrollbar">
        {items.map(item => {
          const isActive = (item.route === '/admin' || item.route === '/dashboard') 
            ? location.pathname === item.route 
            : (location.pathname === item.route || location.pathname.startsWith(`${item.route}/`))
          return (
            <button
              key={item.label}
              className={`flex items-center rounded-lg transition-colors px-3 h-10 w-full shrink-0 group ${
                isActive ? 'bg-mint-500/15 text-mint-400' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
              } ${expanded ? 'justify-start' : 'justify-center'}`}
              onClick={() => {
                if (item.event) {
                  window.dispatchEvent(new Event(item.event))
                } else {
                  navigate(item.route)
                }
              }}
              title={!expanded ? item.label : undefined}
            >
              <span className="shrink-0 flex items-center justify-center w-5">
                <Icon name={item.icon || 'briefcase'} size={18} />
              </span>
              {expanded && (
                <span className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              )}
              {expanded && item.showCount && unreadCount > 0 && (
                <span
                  className="ml-auto min-w-[20px] h-5 rounded-full bg-mint-500 text-white flex items-center justify-center text-[10px] font-bold px-1"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bottom: settings + user */}
      <div className="p-3 shrink-0 border-t border-ink-800 flex flex-col gap-1 relative">
        {role === 'client' && (
          <button
            className={`flex items-center rounded-lg transition-colors px-3 h-10 w-full shrink-0 group font-bold bg-mint-500 text-white shadow hover:bg-mint-400 ${
              expanded ? 'justify-start mb-2' : 'justify-center mb-2'
            }`}
            onClick={() => navigate('/membership')}
            title={!expanded ? 'Upgrade Plan' : undefined}
          >
            <span className="shrink-0 flex items-center justify-center w-5">
              <Icon name="star" size={18} />
            </span>
            {expanded && <span className="ml-3 text-sm whitespace-nowrap">Upgrade Plan</span>}
          </button>
        )}

        {!isGuest && (
          <button
            className={`flex items-center rounded-lg transition-colors px-3 h-10 w-full shrink-0 group ${
              location.pathname === '/settings' ? 'bg-mint-500/15 text-mint-400' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
            } ${expanded ? 'justify-start' : 'justify-center'}`}
            onClick={() => navigate('/settings')}
            title={!expanded ? 'Settings' : undefined}
          >
            <span className="shrink-0 flex items-center justify-center w-5">
              <Icon name="settings" size={18} />
            </span>
            {expanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">Settings</span>}
          </button>
        )}

        <button 
          className={`flex items-center rounded-lg transition-colors h-12 w-full mt-1 group ${
            expanded ? 'px-2 hover:bg-ink-800' : 'justify-center hover:bg-ink-800'
          }`}
          onClick={() => navigate('/settings?section=profile')}
          title={!expanded ? 'Profile' : undefined}
        >
          <div className="w-8 h-8 rounded-full bg-ink-700 text-ink-200 border border-ink-600 flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden transition-colors">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user?.full_name} className="w-full h-full object-cover" />
            ) : (
              (user?.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')
            )}
          </div>
          {expanded && (
            <div className="ml-3 flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-white truncate transition-colors">
                {user?.full_name}
              </div>
              <div className="text-xs text-ink-400 capitalize truncate transition-colors">
                {user?.role}
              </div>
            </div>
          )}
          {expanded && <Icon name="chevronRight" size={14} className="text-ink-500 shrink-0 transition-colors" />}
        </button>
      </div>
    </nav>
  )
}
