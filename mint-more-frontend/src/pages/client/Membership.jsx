import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

const PASSES = [{ days: 7, price: 299 }, { days: 15, price: 499 }, { days: 30, price: 799 }]

export default function Membership() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const { data: access } = useQuery({
    queryKey: ['entitlements'],
    queryFn: () => commerceApi.entitlements().then(res => res.data.data),
  })
  const { data: creditData } = useQuery({
    queryKey: ['mint-credits'],
    queryFn: () => commerceApi.credits().then(res => res.data.data),
  })

  const checkout = useMutation({
    mutationFn: payload => commerceApi.checkout(payload),
    onSuccess: async (res, payload) => {
      const checkoutData = res.data.data
      if (checkoutData.checkout_mode === 'mock') {
        await refreshMembershipState()
        pushToast({
          title: payload.kind === 'access_pass' ? 'Test access pass activated' : 'Test membership activated',
          body: 'No payment was collected in test checkout mode.',
          icon: 'check',
        })
        return
      }
      openRazorpay(checkoutData, payload)
    },
    onError: err => pushToast({ title: 'Checkout failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
  })

  const refreshMembershipState = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['entitlements'] }),
    queryClient.invalidateQueries({ queryKey: ['mint-credits'] }),
    queryClient.invalidateQueries({ queryKey: ['membership'] }),
  ])

  function openRazorpay(order, payload) {
    const launch = () => {
      const checkoutOptions = {
        key: order.key_id,
        currency: order.currency,
        name: 'CREATYV',
        description: payload.kind === 'access_pass' ? `${payload.days}-day access pass` : 'Business membership',
        theme: { color: '#f77f00' },
        handler: async response => {
          try {
            await commerceApi.verify(response)
            await refreshMembershipState()
            pushToast({ title: payload.kind === 'access_pass' ? 'Access pass activated' : 'Membership activated', icon: 'check' })
          } catch (error) {
            pushToast({ title: 'Payment verification failed', body: error.response?.data?.message || 'Contact support', tone: 'amber', icon: 'x' })
          }
        },
      }
      if (order.checkout_mode === 'subscription') {
        checkoutOptions.subscription_id = order.subscription_id
      } else {
        checkoutOptions.order_id = order.order_id
        checkoutOptions.amount = order.amount_paise
      }
      const rzp = new window.Razorpay(checkoutOptions)
      rzp.open()
    }
    if (window.Razorpay) return launch()
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = launch
    document.body.appendChild(script)
  }
  const pause = useMutation({
    mutationFn: () => commerceApi.pause(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entitlements'] })
      pushToast({ title: 'Renewal paused', body: 'Your current access continues until the period ends.', icon: 'check' })
    },
  })

  const periodEnd = access?.membership?.current_period_end
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">Membership</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>CREATYV membership</h1>
        <p className="muted">One membership for creative work, Mint AI, social publishing, and your brand library.</p>
      </div>

      <div className="grid-2" style={{ gap: 14 }}>
        <div className="card-ink" style={{ padding: 24 }}>
          <div className="row between">
            <span className="h-eyebrow" style={{ color: 'rgba(255,255,255,.6)' }}>Current access</span>
            <span className={`badge ${access?.access_state === 'expired' ? 'amber' : 'mint'}`}>{access?.access_state || 'Loading'}</span>
          </div>
          <div style={{ marginTop: 18, fontFamily: 'var(--font-display)', fontSize: 38 }}>{rupee(999)}<span style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}> / month + GST</span></div>
          <div style={{ marginTop: 12, color: 'rgba(255,255,255,.7)', fontSize: 13 }}>
            {periodEnd ? `Access valid until ${new Date(periodEnd).toLocaleDateString('en-IN')}` : 'Subscribe to unlock business tools.'}
          </div>
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,.58)', fontSize: 11.5, lineHeight: 1.45 }}>
            {access?.payment_checkout_mode === 'mock'
              ? 'Testing mode is active. Checkout activates access without collecting money.'
              : 'Memberships and access passes are paid securely through Razorpay. Cash Wallet and MintCoins remain untouched.'}
          </div>
          <div className="row" style={{ marginTop: 20, gap: 8 }}>
            <button className="btn mint" onClick={() => checkout.mutate({ kind: 'membership' })} disabled={checkout.isPending}>
              <Icon name="wallet" size={13} /> Subscribe or renew
            </button>
            {access?.membership?.status === 'active' && <button className="btn link" style={{ color: 'white' }} onClick={() => pause.mutate()}>Pause renewal</button>}
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="h-eyebrow">Mint Credits</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 600, marginTop: 12 }}>{rupee(creditData?.balance || 0)}</div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Promotional credits pay CREATYV platform services. They never fund freelancer earnings and cannot be withdrawn.
          </p>
        </div>
      </div>

      <div>
        <h2 className="h-display h-3">Returning-member access passes</h2>
        <div className="grid-3" style={{ gap: 10 }}>
          {PASSES.map(pass => (
            <div className="card" style={{ padding: 18 }} key={pass.days}>
              <div className="h-eyebrow">{pass.days} days</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, margin: '9px 0' }}>{rupee(pass.price)}</div>
              <p className="muted" style={{ fontSize: 12 }}>Access only. No Mint Credits included.</p>
              <button className="btn ghost" disabled={checkout.isPending} onClick={() => checkout.mutate({ kind: 'access_pass', days: pass.days })}>
                {checkout.isPending ? 'Opening checkout...' : 'Buy pass'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
