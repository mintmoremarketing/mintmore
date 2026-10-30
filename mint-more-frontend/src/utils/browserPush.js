import { api } from '../api/client'

export const needsHomeScreen = () => (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone
export const pushSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushRegistration = () => navigator.serviceWorker.register('/sw.js', { scope: '/' })

const applicationKey = value => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}
export async function enableBrowserPush(publicKey) {
  if (sessionStorage.getItem('mm_admin_auth')) throw new Error('Return to your own account before enabling device notifications.')
  if (needsHomeScreen()) throw new Error('Add Creatyv to your Home Screen, then open it from there to enable notifications.')
  if (!pushSupported()) throw new Error('This browser does not support notifications.')
  if (!publicKey) throw new Error('Browser notifications are not available yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Allow notifications in your browser settings to enable this device.')
  await pushRegistration()
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) })
  await api.post('/notifications/push/subscribe', subscription.toJSON())
  return subscription
}
export async function disableBrowserPush() {
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await api.delete('/notifications/push/subscribe', { data: { endpoint: subscription.endpoint } })
    await subscription.unsubscribe()
  }
}
export async function syncPushDevice() {
  if (sessionStorage.getItem('mm_admin_auth')) return
  if (!pushSupported() || Notification.permission !== 'granted') return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await api.post('/notifications/push/subscribe', subscription.toJSON())
}
