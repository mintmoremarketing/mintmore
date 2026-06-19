import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const CONTROL_SCHEMAS = {
  'membership.monthly': {
    title: 'Membership and MintCoins',
    description: 'Set membership pricing, storage, and automatic MintCoin grants.',
    wide: true,
    fields: [
      ['price', 'Monthly membership price', 'currency'],
      ['welcome_credits', 'First membership MintCoins', 'MintCoins'],
      ['renewal_credits', 'Renewal MintCoins', 'MintCoins'],
      ['welcome_expiry_days', 'Welcome MintCoins expire after', 'days'],
      ['renewal_expiry_days', 'Renewal MintCoins expire after', 'days'],
      ['mintbox_gb', 'Included Mintbox storage', 'GB'],
      ['subscription_cycles', 'Subscription billing cycles', 'cycles'],
      ['auto_renew', 'Automatic renewal', 'toggle'],
    ],
  },
  'membership.trial': {
    title: 'First-time access',
    description: 'Let new businesses explore the real dashboard, AI tools, and restricted trial MintCoins.',
    fields: [
      ['duration_days', 'Access duration', 'days'],
      ['text_generations', 'Text generations', 'generations'],
      ['image_generations', 'Image generations', 'generations'],
      ['mint_credits', 'Trial MintCoins', 'MintCoins'],
      ['mint_credit_expiry_days', 'Trial MintCoins expire after', 'days'],
    ],
  },
  'ai.quotas': {
    title: 'Member AI allowance',
    description: 'Monthly standard AI usage included with membership.',
    fields: [
      ['text_generations', 'Text generations', 'generations'],
      ['image_generations', 'Image generations', 'generations'],
      ['video_generations', 'Video generations', 'generations'],
    ],
  },
  managed_margins: {
    title: 'Managed job margins',
    description: 'Margin added to the freelancer amount before the client sees the price.',
    fields: [
      ['budget_percent', 'Budget managed jobs', '%'],
      ['pro_percent', 'Pro managed jobs', '%'],
      ['marketplace_percent', 'Marketplace direct hire', '%'],
    ],
  },
  freelancer_commission: {
    title: 'Freelancer commission',
    description: 'Commission deducted from freelancer earnings after commission-free jobs.',
    fields: [
      ['free_completed_jobs', 'Commission-free completed jobs', 'jobs'],
      ['default_percent', 'Default commission', '%'],
      ['beginner_percent', 'Beginner commission', '%'],
      ['intermediate_percent', 'Intermediate commission', '%'],
      ['experienced_percent', 'Experienced commission', '%'],
    ],
  },
  matching: {
    title: 'Matching rules',
    description: 'Control candidate capacity and ranking preferences.',
    fields: [
      ['max_active_jobs', 'Maximum active jobs per freelancer', 'jobs'],
      ['top_candidates', 'Candidates selected per brief', 'freelancers'],
      ['new_freelancer_boost', 'New freelancer ranking boost', '%'],
      ['preferred_creator_boost', 'Preferred creator ranking boost', '%'],
    ],
  },
  revisions: {
    title: 'Revision policy',
    description: 'Define included feedback rounds and paid-revision pricing.',
    fields: [
      ['included_rounds', 'Included revision rounds', 'rounds'],
      ['paid_revision_price', 'Additional revision price', 'currency'],
      ['feedback_window_hours', 'Feedback window', 'hours'],
    ],
  },
  payouts: {
    title: 'Freelancer payouts',
    description: 'Set scheduled and instant payout fees.',
    fields: [
      ['scheduled_fee', 'Scheduled payout fee', 'currency'],
      ['weekly_fee', 'Weekly payout fee', 'currency'],
      ['instant_fee', 'Instant payout fee', 'currency'],
    ],
  },
  social_benchmarks: {
    title: 'Social benchmarks',
    description: 'Default benchmarks used in plain-language analytics.',
    fields: [
      ['engagement_rate_percent', 'Healthy engagement benchmark', '%'],
      ['summary_days', 'Summary period', 'days'],
    ],
  },
}

const FEATURE_FLAG_GROUPS = [
  {
    title: 'Phase 1 client modules',
    flags: [
      ['calendar_creatives', 'Calendar creatives', 'Show monthly creative calendar to clients.'],
      ['internal_ops', 'Internal ops', 'Route client work to CREATYV operations.'],
      ['custom_requests', 'Custom requests', 'Allow clients to request custom designs.'],
      ['mintbox', 'Mintbox', 'Show project storage and delivery folders.'],
      ['chat', 'Messages', 'Enable project chat and inbox routes.'],
      ['social_insights', 'Social insights', 'Show connected accounts, analytics, and publishing.'],
      ['mint_ai', 'Mint AI', 'Enable AI tools for clients.'],
    ],
  },
  {
    title: 'Hidden future marketplace modules',
    flags: [
      ['wallet_ui', 'Wallet UI', 'Show wallet and membership payment screens to clients.'],
      ['marketplace', 'Marketplace', 'Show public freelancer browsing to clients.'],
      ['freelancer_portal', 'Freelancer portal', 'Allow freelancer-facing product areas.'],
      ['freelancer_matching', 'Freelancer matching', 'Run freelancer matching instead of internal ops.'],
      ['negotiation', 'Negotiation', 'Enable client/freelancer negotiation flow.'],
    ],
  },
]

function Field({ field, value, onChange }) {
  const [key, label, unit] = field
  if (unit === 'toggle') {
    return (
      <label className="commerce-toggle">
        <span>
          <strong>{label}</strong>
          <small>Charge the saved payment method when membership renews.</small>
        </span>
        <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(key, event.target.checked)} />
      </label>
    )
  }
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="commerce-input-wrap">
        {unit === 'currency' && <span className="commerce-prefix">₹</span>}
        <input
          className="input mono"
          type="number"
          min="0"
          value={value ?? 0}
          onChange={event => onChange(key, Number(event.target.value))}
          style={{ paddingLeft: unit === 'currency' ? 32 : undefined, paddingRight: unit !== 'currency' ? 92 : undefined }}
        />
        {unit !== 'currency' && <span className="commerce-suffix">{unit}</span>}
      </div>
    </div>
  )
}

function AccessPassEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [passes, setPasses] = useState(Array.isArray(setting.value) ? setting.value : [])
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, passes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: 'Access passes saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' }),
  })
  const update = (index, key, value) => setPasses(current => current.map((pass, i) => i === index ? { ...pass, [key]: Number(value) } : pass))
  return (
    <div className="card commerce-card">
      <div className="commerce-card-head">
        <div><strong>Returning-member access passes</strong><div className="muted">Short access periods without MintCoins.</div></div>
        <button className="btn ghost sm" onClick={() => save.mutate()} disabled={save.isPending}><Icon name="check" size={12} /> Save</button>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {passes.map((pass, index) => (
          <div className="commerce-pass-row" key={`${index}-${pass.days}`}>
            <div className="field"><label className="field-label">Duration</label><input className="input mono" type="number" min="1" value={pass.days} onChange={e => update(index, 'days', e.target.value)} /></div>
            <div className="field"><label className="field-label">Price</label><input className="input mono" type="number" min="0" value={pass.price} onChange={e => update(index, 'price', e.target.value)} /></div>
            <button className="icon-btn" title="Remove pass" onClick={() => setPasses(current => current.filter((_, i) => i !== index))}><Icon name="trash" /></button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setPasses(current => [...current, { days: 7, price: 299 }])}><Icon name="plus" /> Add access pass</button>
      </div>
    </div>
  )
}

function SettingEditor({ setting }) {
  const schema = CONTROL_SCHEMAS[setting.key]
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [value, setValue] = useState(setting.value || {})
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: `${schema.title} saved`, icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' }),
  })
  return (
    <div className={`card commerce-card${schema.wide ? ' commerce-card-wide' : ''}`}>
      <div className="commerce-card-head">
        <div><strong>{schema.title}</strong><div className="muted">{schema.description}</div></div>
        <button className="btn ghost sm" onClick={() => save.mutate()} disabled={save.isPending}><Icon name="check" size={12} /> Save</button>
      </div>
      <div className="commerce-fields">
        {schema.fields.filter(([key]) => Object.hasOwn(value, key) || key !== 'weekly_fee').map(field => (
          <Field key={field[0]} field={field} value={value[field[0]]} onChange={(key, next) => setValue(current => ({ ...current, [key]: next }))} />
        ))}
      </div>
    </div>
  )
}

function FeatureFlagsEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [value, setValue] = useState(setting.value || {})
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      queryClient.invalidateQueries({ queryKey: ['entitlements'] })
      pushToast({ title: 'Feature flags saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save flags', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' }),
  })
  const setFlag = (key, next) => setValue(current => ({ ...current, [key]: next }))

  return (
    <div className="card commerce-card commerce-card-wide">
      <div className="commerce-card-head">
        <div>
          <strong>Feature flags</strong>
          <div className="muted">Turn product modules on or off without changing code.</div>
        </div>
        <button className="btn primary sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Icon name="check" size={12} /> Save flags
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {FEATURE_FLAG_GROUPS.map(group => (
          <div key={group.title} style={{ border: '1px solid var(--hairline)', borderRadius: 14, padding: 14, background: 'var(--paper-tint)' }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>{group.title}</div>
            <div className="stack" style={{ gap: 8 }}>
              {group.flags.map(([key, label, description]) => (
                <label
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: 12,
                    border: '1px solid var(--hairline)',
                    borderRadius: 10,
                    background: value[key] ? 'var(--mint-50)' : 'var(--paper)',
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    <strong style={{ display: 'block', fontSize: 13.5 }}>{label}</strong>
                    <small className="muted">{description}</small>
                    <code style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--ink-500)' }}>{key}</code>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(value[key])}
                    onChange={event => setFlag(key, event.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminCommerce() {
  const { data, isLoading } = useQuery({
    queryKey: ['commerce-settings'],
    queryFn: () => commerceApi.adminSettings().then(res => res.data.data),
  })
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">Admin</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Commercial controls</h1>
        <p className="muted">Manage pricing and platform rules without touching application code.</p>
      </div>
      {isLoading ? <div className="muted">Loading controls...</div> : (
        <div className="commerce-grid">
          {(data?.settings || []).map(setting => setting.key === 'access_passes'
            ? <AccessPassEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
            : setting.key === 'feature_flags'
              ? <FeatureFlagsEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
            : CONTROL_SCHEMAS[setting.key] && <SettingEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
          )}
        </div>
      )}
    </div>
  )
}
