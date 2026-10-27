import { useAuthStore } from '../../store/auth'
import { useEntitlements } from '../../hooks/useEntitlements'
import { ADMIN_NAV, ADMIN_NAV_GROUPS, filterNavItems } from './navigation'

export const isAdminRouteActive = (route, pathname) => (
  route === '/admin' ? pathname === route : pathname === route || pathname.startsWith(`${route}/`)
)

/** Groups the permitted admin items: ungrouped ones first, then Work / People / Money / Support / System. */
export function useAdminNav() {
  const isGuest = useAuthStore(s => s.isGuest)
  const { data: access } = useEntitlements()
  const items = filterNavItems({ role: 'admin', isGuest, access, items: ADMIN_NAV })
  return [
    { label: null, items: items.filter(item => !item.group) },
    ...ADMIN_NAV_GROUPS.map(label => ({ label, items: items.filter(item => item.group === label) })),
  ].filter(section => section.items.length)
}
