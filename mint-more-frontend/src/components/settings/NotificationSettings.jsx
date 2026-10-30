import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { disableBrowserPush, enableBrowserPush, needsHomeScreen, pushSupported } from '../../utils/browserPush'
import { useAuthStore } from '../../store/auth'

const button = 'rounded-xl bg-ink-900 px-5 py-3 text-[14px] font-medium text-white transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-60'
const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`

export function NotificationDeliveryLog() {
  const [message, setMessage] = useState('')
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['notification-deliveries'], queryFn: () => api.get('/notifications/admin/deliveries').then(r => r.data.data), refetchInterval: 15000 })
  const test = useMutation({ mutationFn: () => api.post('/notifications/admin/test'), onSuccess: () => { setMessage('Test queued for your enabled channels.'); refetch() }, onError: err => setMessage(err.response?.data?.message || 'Could not queue the test.') })
  return <section className="rounded-2xl border border-ink-200 bg-white p-5 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-medium text-ink-900">Notification deliveries</h2><button className={button} disabled={test.isPending} onClick={() => test.mutate()}>Send test to me</button></div>
    <p className="mt-2 text-[14px] text-ink-600">Recent delivery attempts across devices, email and WhatsApp. Sent means the provider accepted the message.</p>
    {message && <p role="status" className="mt-3 text-[14px] text-ink-800">{message}</p>}
    {isLoading ? <p className="mt-6 text-[14px] text-ink-600">Loading deliveries…</p> : isError ? <p role="alert" className="mt-6 text-[14px] text-rose-700">Could not load deliveries.</p> : !data.length ? <p className="mt-6 text-[14px] text-ink-600">No external notifications have been queued yet.</p> : <ul className="mt-5 divide-y divide-ink-100">{data.map(row => <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-[14px]"><div className="min-w-0 flex-1"><p className="font-medium text-ink-900">{row.title}</p><p className="mt-1 text-ink-600">{row.channel} · {row.status} · {row.attempts} attempts</p>{row.error && <p className="mt-1 text-rose-700">{row.error}</p>}</div><time className="text-ink-500">{new Date(row.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</time></li>)}</ul>}
  </section>
}

export default function NotificationSettings() {
  const userId = useAuthStore(state => state.user?.id)
  const { data, isLoading, isError } = useQuery({ queryKey: ['notification-preferences', userId], queryFn: () => api.get('/notifications/preferences').then(r => r.data.data), refetchOnWindowFocus: false })
  if (isLoading) return <p className="text-ink-600">Loading notification settings…</p>
  if (isError || !data) return <p role="alert" className="text-rose-700">Could not load notification settings. Refresh to try again.</p>
  return <NotificationPreferencesForm key={userId} data={data} userId={userId} />
}

async function deviceState() {
  if (needsHomeScreen()) return 'On iPhone or iPad, use Share → Add to Home Screen, then open Creatyv from its icon.'
  if (!pushSupported()) return 'This browser does not support push notifications.'
  if (Notification.permission === 'denied') return 'Blocked in your browser. Allow notifications for this site in browser settings.'
  const registration = await navigator.serviceWorker.getRegistration('/')
  return await registration?.pushManager.getSubscription() ? 'Enabled on this device' : 'Not enabled on this device'
}

function NotificationPreferencesForm({ data, userId }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => ({ ...data, whatsapp_consent: Boolean(data.whatsapp_opt_in_at) }))
  const [device, setDevice] = useState('Checking this device…')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    const refresh = () => deviceState().then(value => { if (active) setDevice(value) }).catch(() => { if (active) setDevice('Could not check this device.') })
    refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [])
  const save = useMutation({ mutationFn: () => api.patch('/notifications/preferences', {
    push: draft.push, email: draft.email, whatsapp: draft.whatsapp, whatsapp_phone: draft.whatsapp_phone,
    whatsapp_consent: draft.whatsapp_consent, quiet_start: draft.quiet_start, quiet_end: draft.quiet_end,
  }), onSuccess: result => { queryClient.setQueryData(['notification-preferences', userId], result.data.data); setMessage('Notification settings saved.') }, onError: err => setMessage(err.response?.data?.message || 'Could not save notification settings.') })
  const update = (key, value) => { setDraft(current => ({ ...current, [key]: value, ...(key === 'whatsapp_phone' ? { whatsapp_consent: false } : {}) })); setMessage('') }
  const deviceAction = async action => {
    setBusy(true); setMessage('')
    try { await action(); setDevice(await deviceState()) } catch (err) { setMessage(err.response?.data?.message || err.message) } finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-ink-200 bg-white p-5 md:p-8">
    <h2 className="text-xl font-medium text-ink-900">Where you hear from Creatyv</h2>
    <p className="mt-2 max-w-2xl text-[14px] text-ink-600">Get updates about your orders, messages and payments. Your in-app inbox stays available.</p>
    <div className="mt-6 space-y-6">
      <div><label className="flex items-center gap-3 font-medium text-ink-900"><input className="h-4 w-4 accent-ink-900" type="checkbox" checked={draft.push} onChange={e => update('push', e.target.checked)} />Browser notifications</label><p className="mt-2 text-[14px] text-ink-600">{device}</p>
        {!data.capabilities.push ? <p className="mt-2 text-[14px] text-ink-600">Browser notifications are not available yet.</p> : !needsHomeScreen() && pushSupported() && <div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || Notification.permission === 'denied'} className={button} onClick={() => deviceAction(() => enableBrowserPush(data.public_key))}>{busy ? 'Updating…' : 'Enable this device'}</button><button disabled={busy} className="px-3 py-2 text-[14px] font-medium text-ink-700 underline underline-offset-4" onClick={() => deviceAction(disableBrowserPush)}>Disable this device</button></div>}
      </div>
      <div><label className="flex items-center gap-3 font-medium text-ink-900"><input className="h-4 w-4 accent-ink-900" type="checkbox" checked={draft.email} onChange={e => update('email', e.target.checked)} />Email</label><p className="mt-2 text-[14px] text-ink-600">Delivery, payment and other important order updates.{!data.capabilities.email && ' Email delivery is not available yet.'}</p></div>
      <div><label className="flex items-center gap-3 font-medium text-ink-900"><input className="h-4 w-4 accent-ink-900" type="checkbox" checked={draft.whatsapp} onChange={e => update('whatsapp', e.target.checked)} />WhatsApp</label><p className="mt-2 text-[14px] text-ink-600">Key order updates and time-sensitive offers.{!data.capabilities.whatsapp && ' WhatsApp delivery is not available yet.'}</p>
        <label className="mt-4 block text-[14px] font-medium text-ink-900" htmlFor="notification-phone">WhatsApp number</label><input id="notification-phone" type="tel" autoComplete="tel" className="input mt-2 max-w-sm" placeholder="+91" value={draft.whatsapp_phone || ''} onChange={e => update('whatsapp_phone', e.target.value)} />
        {draft.whatsapp && <label className="mt-3 flex max-w-xl items-start gap-3 text-[14px] text-ink-700"><input className="mt-1 h-4 w-4 accent-ink-900" type="checkbox" checked={draft.whatsapp_consent} onChange={e => update('whatsapp_consent', e.target.checked)} />I agree to receive Creatyv order and payment updates on this WhatsApp number. I can turn these off here anytime.</label>}
      </div>
      <div><label className="flex items-center gap-3 font-medium text-ink-900"><input className="h-4 w-4 accent-ink-900" type="checkbox" checked={draft.quiet_start !== null} onChange={e => setDraft(current => ({ ...current, quiet_start: e.target.checked ? 22 : null, quiet_end: e.target.checked ? 8 : null }))} />Quiet hours</label><p className="mt-2 text-[14px] text-ink-600">Pause push and WhatsApp updates during these hours in India Standard Time. Urgent order offers still come through.</p>
        {draft.quiet_start !== null && <div className="mt-3 flex flex-wrap gap-4">{['quiet_start', 'quiet_end'].map((key, index) => <label key={key} className="text-[14px] text-ink-700">{index ? 'Until' : 'From'}<select className="input mt-2 block" value={draft[key]} onChange={e => update(key, Number(e.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>)}</div>}
      </div>
    </div>
    {message && <p role="status" className="mt-5 text-[14px] text-ink-800">{message}</p>}
    <button disabled={save.isPending} onClick={() => save.mutate()} className={`${button} mt-6`}>{save.isPending ? 'Saving…' : 'Save preferences'}</button>
  </section>
}
