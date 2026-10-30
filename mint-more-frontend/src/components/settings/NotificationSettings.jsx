import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { disableBrowserPush, enableBrowserPush, needsHomeScreen, pushSupported } from '../../utils/browserPush'
import { useAuthStore } from '../../store/auth'
import Switch from '../ui/Switch'

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
  if (needsHomeScreen()) return 'On iPhone or iPad, add Creatyv to your Home Screen first (Share, then Add to Home Screen)'
  if (!pushSupported()) return 'This browser can\'t show them'
  if (Notification.permission === 'denied') return 'Your browser is blocking them; allow notifications for this site in its settings'
  const registration = await navigator.serviceWorker.getRegistration('/')
  return await registration?.pushManager.getSubscription() ? 'On for this device' : 'Not on for this device yet'
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
  // LAUNCH-HIDDEN: channels the server can't deliver on yet stay in the code but aren't offered, so
  // nobody turns on something that does nothing. Quiet hours only matter once push or WhatsApp is on offer.
  const caps = data.capabilities || {}
  const showQuiet = caps.push || caps.whatsapp
  return <section className="max-w-3xl rounded-2xl border border-ink-200 bg-white font-store">
    <ul className="divide-y divide-ink-100">
      <li className="flex items-start gap-4 px-5 py-4 md:px-6">
        <div className="min-w-0 flex-1"><p className="text-[15px] font-medium text-ink-900">In-app inbox</p><p className="mt-0.5 text-[14px] text-ink-600">Every update about your orders, messages and payments.</p></div>
        <span className="pt-0.5 text-[13px] font-medium text-ink-500">Always on</span>
      </li>
      {caps.push && <li className="px-5 py-4 md:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1"><label htmlFor="notify-push" className="text-[15px] font-medium text-ink-900">Browser notifications</label><p className="mt-0.5 text-[14px] text-ink-600">A pop-up on this device when something needs you. {device}.</p></div>
          <Switch id="notify-push" checked={draft.push} onChange={value => update('push', value)} label="Browser notifications" />
        </div>
        {draft.push && !needsHomeScreen() && pushSupported() && <div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || Notification.permission === 'denied'} className={button} onClick={() => deviceAction(() => enableBrowserPush(data.public_key))}>{busy ? 'Updating…' : 'Turn on for this device'}</button><button disabled={busy} className="px-3 py-2 text-[14px] font-medium text-ink-700 underline underline-offset-4" onClick={() => deviceAction(disableBrowserPush)}>Turn off for this device</button></div>}
      </li>}
      {caps.email && <li className="flex items-start gap-4 px-5 py-4 md:px-6">
        <div className="min-w-0 flex-1"><label htmlFor="notify-email" className="text-[15px] font-medium text-ink-900">Email</label><p className="mt-0.5 text-[14px] text-ink-600">Deliveries, payments and other important order updates.</p></div>
        <Switch id="notify-email" checked={draft.email} onChange={value => update('email', value)} label="Email" />
      </li>}
      {caps.whatsapp && <li className="px-5 py-4 md:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1"><label htmlFor="notify-whatsapp" className="text-[15px] font-medium text-ink-900">WhatsApp</label><p className="mt-0.5 text-[14px] text-ink-600">Key order updates and time-sensitive offers.</p></div>
          <Switch id="notify-whatsapp" checked={draft.whatsapp} onChange={value => update('whatsapp', value)} label="WhatsApp" />
        </div>
        {draft.whatsapp && <div className="mt-3">
          <label className="block text-[14px] font-medium text-ink-900" htmlFor="notification-phone">WhatsApp number</label><input id="notification-phone" type="tel" autoComplete="tel" className="input mt-1.5 max-w-sm" placeholder="+91" value={draft.whatsapp_phone || ''} onChange={e => update('whatsapp_phone', e.target.value)} />
          <label className="mt-3 flex max-w-xl items-start gap-3 text-[14px] text-ink-700"><input className="mt-1 h-4 w-4 accent-ink-900" type="checkbox" checked={draft.whatsapp_consent} onChange={e => update('whatsapp_consent', e.target.checked)} />I agree to receive Creatyv order and payment updates on this WhatsApp number. I can turn these off here anytime.</label>
        </div>}
      </li>}
      {showQuiet && <li className="px-5 py-4 md:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1"><label htmlFor="notify-quiet" className="text-[15px] font-medium text-ink-900">Quiet hours</label><p className="mt-0.5 text-[14px] text-ink-600">Pause pop-ups and WhatsApp overnight, in India time. Urgent order offers still come through.</p></div>
          <Switch id="notify-quiet" checked={draft.quiet_start !== null} onChange={on => setDraft(current => ({ ...current, quiet_start: on ? 22 : null, quiet_end: on ? 8 : null }))} label="Quiet hours" />
        </div>
        {draft.quiet_start !== null && <div className="mt-3 flex flex-wrap gap-4">{['quiet_start', 'quiet_end'].map((key, index) => <label key={key} className="text-[14px] text-ink-700">{index ? 'Until' : 'From'}<select className="input mt-1.5 block" value={draft[key]} onChange={e => update(key, Number(e.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>)}</div>}
      </li>}
    </ul>
    {(caps.push || caps.email || caps.whatsapp) && <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 px-5 py-4 md:px-6">
      <button disabled={save.isPending} onClick={() => save.mutate()} className={button}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
      {message && <p role="status" className="text-[14px] text-ink-700">{message}</p>}
    </div>}
  </section>
}
