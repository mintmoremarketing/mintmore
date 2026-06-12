import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

function SettingEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [value, setValue] = useState(JSON.stringify(setting.value, null, 2))
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, JSON.parse(value)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: 'Commercial rule saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save', body: err.message, tone: 'amber', icon: 'x' }),
  })
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row between" style={{ gap: 12 }}>
        <div>
          <strong>{setting.key}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{setting.description}</div>
        </div>
        <button className="btn ghost sm" onClick={() => save.mutate()} disabled={save.isPending}><Icon name="check" size={12} /> Save</button>
      </div>
      <textarea className="textarea mono" rows={8} value={value} onChange={e => setValue(e.target.value)} style={{ marginTop: 12, fontSize: 12 }} />
    </div>
  )
}

function MintCoinRulesEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [rules, setRules] = useState(setting.value)

  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, rules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: 'MintCoin rules saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save MintCoin rules', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' }),
  })

  const numberField = (key, label, suffix = 'MintCoins') => (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input mono"
          type="number"
          min="0"
          value={rules[key] ?? 0}
          onChange={e => setRules(prev => ({ ...prev, [key]: Number(e.target.value) }))}
          style={{ paddingRight: 82 }}
        />
        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-500)' }}>{suffix}</span>
      </div>
    </div>
  )

  return (
    <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
      <div className="row between" style={{ gap: 12, marginBottom: 16 }}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <span className="mintcoin-mark"><Icon name="coin" size={13} /></span>
            <strong>MintCoin membership rules</strong>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            Controls automatic grants and expiration. MintCoins cannot fund escrow or freelancer payouts.
          </div>
        </div>
        <button className="btn primary" onClick={() => save.mutate()} disabled={save.isPending}>
          <Icon name="check" size={12} /> Save MintCoin rules
        </button>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        {numberField('welcome_credits', 'First membership grant')}
        {numberField('renewal_credits', 'Renewal grant')}
        {numberField('welcome_expiry_days', 'Welcome grant expires after', 'days')}
        {numberField('renewal_expiry_days', 'Renewal grant expires after', 'days')}
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
        <p className="muted">Membership, credits, margins, commissions, revisions, passes, and payout rules.</p>
      </div>
      {isLoading ? <div className="muted">Loading controls...</div> : (
        <div className="grid-2" style={{ gap: 12 }}>
          {(data?.settings || []).map(setting => (
            setting.key === 'membership.monthly'
              ? <MintCoinRulesEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
              : <SettingEditor key={`${setting.key}:${setting.updated_at}`} setting={setting} />
          ))}
        </div>
      )}
    </div>
  )
}
