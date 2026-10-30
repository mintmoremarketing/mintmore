import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { servicesApi } from '../../api/services'
import { useAuthStore } from '../../store/auth'
import { enableBrowserPush, needsHomeScreen, pushSupported, syncPushDevice } from '../../utils/browserPush'

export default function PushNotificationPrompt() {
  const user = useAuthStore(state => state.user)
  const impersonating = Boolean(sessionStorage.getItem('mm_admin_auth'))
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(`push-prompt:${user?.id}`) === 'dismissed')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: preferences } = useQuery({ queryKey: ['notification-preferences', user?.id], queryFn: () => api.get('/notifications/preferences').then(r => r.data.data), enabled: Boolean(user) })
  const { data: eligible = false } = useQuery({
    queryKey: ['push-prompt-eligible', user?.id], enabled: Boolean(user) && !dismissed && Boolean(preferences?.capabilities?.push),
    queryFn: async () => {
      if (user.role === 'client') return (await servicesApi.bookings()).data.data.length > 0
      const result = await api.get('/notifications', { params: { limit: 30 } })
      return result.data.data.notifications.some(n => ['service_offer', 'assignment_created'].includes(n.type))
    },
  })
  useEffect(() => { if (user && !impersonating) syncPushDevice().catch(() => {}) }, [user, impersonating]) // Permission is requested only from the button below.
  if (!user || impersonating || dismissed || !eligible || !preferences?.push || !preferences?.capabilities?.push) return null
  const homeScreen = needsHomeScreen()
  if (!homeScreen && (!pushSupported() || Notification.permission !== 'default')) return null
  return <div className="flex flex-wrap items-center gap-3 bg-ink-50 px-4 py-3 text-[14px] text-ink-900 md:px-8">
    <p className="min-w-0 flex-1">{homeScreen ? 'Add Creatyv to your Home Screen to get order notifications.' : 'Get notified when a delivery, message or new order needs you.'}{error && <span className="mt-1 block text-rose-700">{error}</span>}</p>
    {homeScreen ? <Link className="font-medium underline underline-offset-4" to="/settings?section=notifications">How to enable</Link> : <button disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 font-medium text-white transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-60" onClick={async () => {
      setBusy(true); setError('')
      try { await enableBrowserPush(preferences.public_key); setDismissed(true) } catch (err) { setError(err.message) } finally { setBusy(false) }
    }}>{busy ? 'Enabling…' : 'Enable notifications'}</button>}
    <button className="px-2 py-2 text-ink-600 underline underline-offset-4" onClick={() => { localStorage.setItem(`push-prompt:${user.id}`, 'dismissed'); setDismissed(true) }}>Later</button>
  </div>
}
