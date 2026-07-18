import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

const PASSES = [{ days: 7, price: 299 }, { days: 15, price: 499 }, { days: 30, price: 799 }]

export default function Membership() {
  const [billingCycle, setBillingCycle] = useState('monthly')
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
        image: window.location.origin + '/logo-light.png',
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
    <div className="flex flex-col gap-10 md:gap-14 p-4 md:p-8 max-w-[1400px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col gap-3 text-center md:text-left">
        <div className="text-xs font-bold text-mint-500 tracking-[0.25em] uppercase">Your Account</div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-ink-950 to-ink-600 m-0 pb-1">
          CREATYV membership
        </h1>
        <p className="text-ink-500 text-lg md:text-xl font-medium max-w-2xl">
          One unified workspace for creative execution, Mint AI generation, and social publishing.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Current Access Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-950 to-black p-8 md:p-10 shadow-2xl flex flex-col justify-between">
          {/* Decorative glowing orb */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-mint-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Current access</span>
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${access?.access_state === 'expired' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-mint-500/20 text-mint-300 border border-mint-500/30'}`}>
                {access?.access_state || 'Loading'}
              </span>
            </div>
            
            <div className="font-display font-bold text-5xl md:text-6xl text-white mb-2">
              {rupee(tiers?.find(t => t.id === access?.membership?.tier_id)?.price || 0)}
              <span className="text-lg md:text-xl text-white/40 font-medium tracking-normal ml-2">/ month <span className="text-sm">+ GST</span></span>
            </div>
            
            <div className="text-white/60 font-medium mb-6">
              {periodEnd ? `Access valid until ${new Date(periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Subscribe to unlock premium business tools.'}
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-4 mt-4">
            <button 
              className="bg-white hover:bg-ink-50 text-ink-950 px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 flex items-center gap-2" 
              onClick={() => checkout.mutate({ kind: 'membership' })} 
              disabled={checkout.isPending}
            >
              <Icon name="wallet" size={18} /> {checkout.isPending ? 'Loading...' : 'Subscribe or renew'}
            </button>
            {access?.membership?.status === 'active' && (
              <button 
                className="text-white/60 hover:text-white px-4 py-2 font-medium transition-colors" 
                onClick={() => pause.mutate()}
              >
                Pause renewal
              </button>
            )}
          </div>
          
          <div className="relative z-10 mt-6 pt-6 border-t border-white/10 text-white/40 text-xs leading-relaxed max-w-md">
            {access?.payment_checkout_mode === 'mock'
              ? 'Developer testing mode is active. Checkout activates access without collecting real money.'
              : 'Memberships are billed securely through Razorpay. Cash Wallet and MintCoins remain untouched.'}
          </div>
        </div>

        {/* Mint Coins Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-50 to-white border border-mint-100 p-8 md:p-10 shadow-lg flex flex-col justify-between">
          {/* Decorative graphic */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-mint-200/50 to-transparent rounded-bl-full pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-mint-100 flex items-center justify-center text-mint-600">
                <Icon name="coin" size={20} />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">Mint Coins</span>
            </div>
            
            <div className="font-mono text-5xl md:text-6xl font-bold text-ink-950 tracking-tight">
              {rupee(creditData?.balance || 0)}
            </div>
          </div>
          
          <p className="text-ink-600 font-medium mt-8 leading-relaxed max-w-sm">
            Promotional credits used to pay for CREATYV platform services. These credits never fund freelancer earnings and cannot be withdrawn.
          </p>
        </div>
      </div>

      {/* Tiers Section */}
      <div className="mt-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink-950 mb-3 tracking-tight">Choose your plan</h2>
          <p className="text-ink-500 font-medium text-lg mb-8">Flexible pricing for businesses of all sizes.</p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center p-1 bg-ink-100 rounded-2xl shadow-inner border border-ink-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${billingCycle === 'monthly' ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
            >
              Billed Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-mint-500 text-white shadow-md' : 'text-ink-500 hover:text-ink-700'}`}
            >
              Billed Annually
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${billingCycle === 'annual' ? 'bg-mint-600 text-white' : 'bg-mint-100 text-mint-600'}`}>Save 20%</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers?.map(tier => {
            const isActive = access?.membership?.tier_id === tier.id && access?.membership?.status === 'active';
            const isFree = tier.name === 'FREE';
            const isSocial = tier.name === 'SOCIAL';
            const isManaged = tier.name === 'MANAGED BY MMM';
            
            // Hardcoded content based on tier price/name
            let description = '';
            let featuresList = [];
            let ctaText = 'Subscribe Now';
            let extraText = null;
            let priceDisplay = null;

            if (isFree) {
              description = 'For individuals, SMEs and brands exploring Creatyv.';
              featuresList = [
                'Limited monthly AI generations',
                '1,000 Mint Coins included',
                'AI text generation',
                'AI image generation',
                'AI video generation',
                'Save content drafts',
                'Access your content workspace',
                'Standard account access'
              ];
              ctaText = 'Start for Free';
              extraText = 'No payment method required.';
              priceDisplay = (
                <div className="font-display font-bold text-4xl md:text-5xl text-ink-950 mb-6 flex items-end gap-1">
                  ₹0<span className="text-base text-ink-400 font-medium mb-1">/month</span>
                </div>
              );
            } else if (isSocial) {
              description = 'For creators, businesses and teams that want to create and publish regularly.';
              featuresList = [
                'Higher monthly AI generation limits',
                '10,000 Mint Coins recharged every month',
                'AI text generation',
                'AI image generation',
                'AI video generation',
                'Visual content calendar',
                'Instagram scheduling and publishing',
                'Facebook scheduling and publishing',
                'YouTube scheduling and publishing',
                'Post review and approval workflow',
                'Brand workspace',
                'Priority product access',
                'Insights access when launched'
              ];
              ctaText = 'Upgrade to Social';
              priceDisplay = (
                <div className="mb-6">
                  <div className="font-display font-bold text-4xl md:text-5xl text-ink-950 flex items-end gap-1 mb-2">
                    {billingCycle === 'annual' ? '₹1,699' : '₹1,999'}<span className="text-base text-ink-400 font-medium mb-1">/month</span>
                  </div>
                  <div className="text-sm font-medium text-ink-500 leading-snug">
                    {billingCycle === 'annual' ? 'when paid annually' : 'when paid monthly'}<br/>
                    {billingCycle === 'annual' ? 'Annual billing total: ₹20,388/year' : 'Switch to annual and save ₹3,600/year'}
                  </div>
                </div>
              );
            } else if (isManaged) {
              description = 'For businesses that want Creatyv’s technology with professional marketing support.';
              featuresList = [
                'Everything included in Social',
                'Custom monthly content plan',
                'Content strategy support',
                'Professional copy and creative assistance',
                'Review and approval dashboard',
                'Scheduling and publishing support',
                'Mint More Marketing execution',
                'Dedicated coordination',
                'Custom deliverables based on your requirements*',
                'Reporting and recommendations'
              ];
              ctaText = 'Subscribe to Managed';
              priceDisplay = (
                <div className="mb-6">
                  <div className="font-display font-bold text-4xl md:text-5xl text-ink-950 flex items-end gap-1 mb-2">
                    {billingCycle === 'annual' ? '₹7,999' : '₹9,999'}<span className="text-base text-ink-400 font-medium mb-1">/month</span>
                  </div>
                  <div className="text-sm font-medium text-ink-500 leading-snug">
                    {billingCycle === 'annual' ? 'when paid annually' : 'when paid monthly'}<br/>
                    {billingCycle === 'annual' ? 'Annual billing total: ₹95,988/year' : 'Switch to annual and save ₹24,000/year'}
                  </div>
                </div>
              );
            }
            
            return (
              <div 
                key={tier.id}
                className={`relative flex flex-col h-full bg-white rounded-3xl p-8 transition-all duration-300 ${
                  isActive || isSocial
                    ? 'ring-2 ring-mint-400 shadow-[0_8px_40px_rgba(34,197,94,0.15)] -translate-y-2' 
                    : 'border border-ink-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-ink-300'
                }`}
              >
                {isActive ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-mint-400 to-mint-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                    Active Plan
                  </div>
                ) : isSocial ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-ink-950 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                    Recommended
                  </div>
                ) : null}
                
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-ink-400 mb-2">
                  {tier.name}
                </div>
                
                {priceDisplay}
                
                <p className="text-sm text-ink-600 font-medium mb-6 leading-relaxed">
                  {description}
                </p>
                
                <button 
                  className={`w-full py-4 rounded-xl font-bold text-sm transition-all mb-8 ${
                    isActive 
                      ? 'bg-ink-50 text-ink-400 cursor-default' 
                      : isSocial
                        ? 'bg-ink-950 text-white hover:bg-black shadow-md hover:shadow-lg'
                        : isFree 
                          ? 'bg-ink-100 text-ink-700 hover:bg-ink-200' 
                          : 'border-2 border-ink-950 text-ink-950 hover:bg-ink-50'
                  }`}
                  disabled={checkout.isPending || isActive}
                  onClick={() => checkout.mutate({ kind: 'membership', tier_id: tier.id, billing_cycle: isFree ? 'monthly' : billingCycle })}
                >
                  {isActive ? 'Current Plan' : (checkout.isPending ? 'Processing...' : ctaText)}
                </button>
                
                <ul className="space-y-4 flex-grow mb-4">
                  {featuresList.map(feat => (
                    <li key={feat} className="flex items-start gap-3 text-ink-700 font-medium text-sm">
                      <div className="w-5 h-5 rounded-full bg-mint-100 text-mint-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="check" size={12} />
                      </div>
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
                
                {extraText && (
                  <div className="text-xs text-ink-400 font-medium text-center mt-auto pt-4 border-t border-ink-100">
                    {extraText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}
