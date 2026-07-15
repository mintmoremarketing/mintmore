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
  const { data: tiers } = useQuery({
    queryKey: ['public-tiers'],
    queryFn: () => commerceApi.getTiers().then(res => res.data.data),
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
      <div className="flex flex-col gap-2">
        <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Membership</div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">CREATYV membership</h1>
        <p className="text-ink-500 font-medium mt-1">One membership for creative work, Mint AI, social publishing, and your brand library.</p>
      </div>

      <div className="grid-2" style={{ gap: 14 }}>
        <div className="card-ink" style={{ padding: 24 }}>
          <div className="row between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Current access</span>
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

        <div className="card flex flex-col" style={{ padding: 24 }}>
          <div className="text-xs font-bold uppercase tracking-widest text-ink-500">Mint Credits</div>
          <div className="font-mono text-3xl font-semibold mt-3 text-ink-900">{rupee(creditData?.balance || 0)}</div>
          <p className="text-sm text-ink-500 mt-4 leading-relaxed">
            Promotional credits pay CREATYV platform services. They never fund freelancer earnings and cannot be withdrawn.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-display font-bold text-ink-950 mb-6">Select a Membership Tier</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers?.map(tier => (
            <div className={`card flex flex-col ${access?.membership?.tier_id === tier.id && access?.membership?.status === 'active' ? 'border-mint border-2' : ''}`} style={{ padding: 24 }} key={tier.id}>
              <div className="text-xs font-bold uppercase tracking-widest text-ink-500">{tier.name}</div>
              <div className="font-mono text-3xl font-semibold my-3 text-ink-900">{tier.price === 0 ? 'Free' : rupee(tier.price)}</div>
              
              <ul className="mb-6 space-y-2 mt-4 text-sm text-ink-600 flex-grow">
                {tier.features?.map(feat => (
                  <li key={feat} className="flex items-center gap-2">
                    <Icon name="check" size={14} className="text-mint shrink-0" />
                    <span>{feat.replace('_', ' ')}</span>
                  </li>
                ))}
                {(!tier.features || tier.features.length === 0) && <li>No features included</li>}
              </ul>

              <button 
                className={`btn ${tier.price > 0 ? 'mint' : 'outline'} w-full mt-auto`} 
                disabled={checkout.isPending || (access?.membership?.tier_id === tier.id && access?.membership?.status === 'active')} 
                onClick={() => checkout.mutate({ kind: 'membership', tier_id: tier.id })}
              >
                {access?.membership?.tier_id === tier.id && access?.membership?.status === 'active' ? 'Current Tier' : (checkout.isPending ? 'Processing...' : 'Subscribe')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
