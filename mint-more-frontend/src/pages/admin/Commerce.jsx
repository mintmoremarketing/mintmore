import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { api } from '../../api/client'
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
    title: 'New account starter',
    description: 'Configure the one-time starter window and the 5-image trial that new clients receive.',
    fields: [
      ['duration_days', 'Access duration', 'days'],
      ['text_generations', 'Text/chat generations (legacy)', 'generations'],
      ['image_generations', 'Starter image generations', 'generations'],
      ['mint_credits', 'Starter MintCoins (legacy)', 'MintCoins'],
      ['mint_credit_expiry_days', 'Trial MintCoins expire after', 'days'],
    ],
  },
  'ai.quotas': {
    title: 'AI pricing notes',
    description: 'Legacy quota settings for reference; runtime AI billing is now coin-priced per model.',
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

const COMMERCE_TABS = [
  {
    id: 'membership',
    label: 'Membership',
    description: 'Subscriptions, starter access, MintCoins, and access passes.',
    keys: ['membership.monthly', 'membership.trial', 'access_passes'],
  },
  {
    id: 'work',
    label: 'Work pricing',
    description: 'Managed-work margins, freelancer commission, matching, and revision rules.',
    keys: ['managed_margins', 'freelancer_commission', 'matching', 'revisions'],
  },
  {
    id: 'payouts',
    label: 'Payouts',
    description: 'Freelancer payout and transfer fee controls.',
    keys: ['payouts'],
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Legacy AI settings, pricing notes, and public Mint AI knowledge.',
    keys: ['ai.quotas', 'public_qna'],
  },
  {
    id: 'social',
    label: 'Social',
    description: 'Social benchmark defaults and analytics controls.',
    keys: ['social_benchmarks'],
  },
  {
    id: 'features',
    label: 'Feature flags',
    description: 'Turn visible product modules on or off safely.',
    keys: ['feature_flags'],
  },
  {
    id: 'danger',
    label: 'Danger zone',
    description: 'Clean operational/demo data before a fresh launch. Admin users and platform settings are preserved.',
    keys: [],
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

function PublicQnaEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [value, setValue] = useState(setting.value || {})
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: 'Public Mint AI brief saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save Q&A brief', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' }),
  })
  const update = (key, next) => setValue(current => ({ ...current, [key]: next }))

  return (
    <div className="card commerce-card commerce-card-wide">
      <div className="commerce-card-head">
        <div>
          <strong>Public Mint AI Q&A</strong>
          <div className="muted">Control what the landing-page assistant can say to visitors.</div>
        </div>
        <button className="btn primary sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Icon name="check" size={12} /> Save Q&A
        </button>
      </div>
      <div className="commerce-fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="field">
          <label className="field-label">Contact email</label>
          <input className="input" value={value.contact_email || ''} onChange={event => update('contact_email', event.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Contact phone</label>
          <input className="input" value={value.contact_phone || ''} onChange={event => update('contact_phone', event.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Public assistant brief</label>
          <textarea
            className="input"
            rows={7}
            value={value.public_brief || ''}
            onChange={event => update('public_brief', event.target.value)}
            style={{ minHeight: 150, resize: 'vertical', lineHeight: 1.5 }}
          />
          <small className="muted">Only write client-safe facts. Do not include internal architecture, feature flag details, keys, or private operations notes.</small>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Guardrails</label>
          <textarea
            className="input"
            rows={6}
            value={value.guardrails || ''}
            onChange={event => update('guardrails', event.target.value)}
            style={{ minHeight: 130, resize: 'vertical', lineHeight: 1.5 }}
          />
          <small className="muted">These rules tell Mint AI what to avoid and when to send people to the team.</small>
        </div>
      </div>
    </div>
  )
}

function DangerZone() {
  const pushToast = useUIStore(s => s.pushToast)
  const [phrase, setPhrase] = useState('')
  const reset = useMutation({
    mutationFn: () => api.post('/admin/system/reset', { confirm_phrase: phrase }),
    onSuccess: (res) => {
      pushToast({
        title: 'Clean start complete',
        body: `${res.data?.data?.deleted_users || 0} non-admin users removed. Operational tables were cleared.`,
        icon: 'check',
      })
      setPhrase('')
    },
    onError: err => pushToast({ title: 'Reset failed', body: err.response?.data?.message || err.message, tone: 'danger', icon: 'x' }),
  })
  return (
    <div className="card commerce-card commerce-card-wide" style={{ borderColor: 'rgba(239,68,68,.35)', background: 'rgba(254,242,242,.75)' }}>
      <div className="commerce-card-head">
        <div>
          <strong>Clean start reset</strong>
          <div className="muted">Deletes operational data, demo clients, designers, creatives, chats, Mintbox rows, social posts, wallets, notifications, and support tickets. Admin users and saved platform settings remain.</div>
        </div>
        <span className="badge danger">Danger</span>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label">Type RESET CREATYV to enable</label>
          <input className="input mono" value={phrase} onChange={event => setPhrase(event.target.value)} placeholder="RESET CREATYV" />
        </div>
        <button
          className="btn"
          style={{ background: 'var(--rose)', color: '#fff', width: 'fit-content' }}
          disabled={phrase !== 'RESET CREATYV' || reset.isPending}
          onClick={() => {
            if (window.confirm('This will permanently remove operational/demo data. Continue?')) reset.mutate()
          }}
        >
          <Icon name="trash" size={13} /> Reset operational data
        </button>
      </div>
    </div>
  )
}

function renderCommerceSetting(setting) {
  if (!setting) return null
  if (setting.key === 'access_passes') {
    return <AccessPassEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
  }
  if (setting.key === 'feature_flags') {
    return <FeatureFlagsEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
  }
  if (setting.key === 'public_qna') {
    return <PublicQnaEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
  }
  if (CONTROL_SCHEMAS[setting.key]) {
    return <SettingEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
  }
  return null
}

export default function AdminCommerce() {
  const [activeTab, setActiveTab] = useState(COMMERCE_TABS[0].id)
  const { data, isLoading } = useQuery({
    queryKey: ['commerce-settings'],
    queryFn: () => commerceApi.adminSettings().then(res => res.data.data),
  })
  const settings = data?.settings || []
  const settingsByKey = Object.fromEntries(settings.map(setting => [setting.key, setting]))
  const currentTab = COMMERCE_TABS.find(tab => tab.id === activeTab) || COMMERCE_TABS[0]
  const tabSettings = (currentTab.keys || []).map(key => settingsByKey[key]).filter(Boolean)

  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Commercial controls</h1>
        <p className="text-ink-600 font-medium">Manage pricing and platform rules without touching application code.</p>
      </div>
      
      <div className="flex flex-wrap gap-2 pb-2">
        {COMMERCE_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              activeTab === tab.id 
                ? 'bg-ink-950 text-white shadow-md' 
                : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50 hover:text-ink-900'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="bg-ink-50/50 border border-ink-200/60 rounded-2xl p-6">
        <div className="text-sm font-bold tracking-[0.1em] uppercase text-ink-950 mb-1">{currentTab.label}</div>
        <p className="text-ink-600 font-medium m-0">{currentTab.description}</p>
      </div>
      
      {isLoading ? <div className="text-ink-500 font-medium px-4">Loading controls...</div> : (
        <div className="commerce-grid">
          {activeTab === 'danger'
            ? <DangerZone />
            : tabSettings.length
            ? tabSettings.map(renderCommerceSetting)
            : <div className="bg-white border border-ink-200/60 rounded-[2rem] p-8 text-center"><p className="text-ink-500 font-medium m-0">No controls found for this section yet.</p></div>}
        </div>
      )}
    </div>
  )
}
