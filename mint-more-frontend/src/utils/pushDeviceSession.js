export async function disconnectPushDevice(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
  await fetch(`${base}/notifications/push/subscribe`, { method: 'DELETE', keepalive: true,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
  await subscription.unsubscribe()
}
