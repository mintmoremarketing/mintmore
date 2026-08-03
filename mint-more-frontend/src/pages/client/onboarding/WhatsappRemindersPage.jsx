import { useOnboardingContext } from './useOnboardingContext'

export default function WhatsappRemindersPage() {
  const { form, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Opt-in for WhatsApp approvals</h1>
        <p className="muted" style={{ marginTop: 8 }}>Receive instant notifications to preview and approve scheduled drafts.</p>
      </div>

      <div className="field">
        <label className="field-label">WhatsApp Phone Number</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="input"
            style={{ width: '120px', flexShrink: 0 }}
            value={form.whatsapp_country_code || '+91'}
            onChange={e => updateField('whatsapp_country_code', e.target.value)}
          >
            <option value="+91">+91 (IN)</option>
            <option value="+1">+1 (US/CA)</option>
            <option value="+44">+44 (UK)</option>
            <option value="+61">+61 (AU)</option>
            <option value="+971">+971 (UAE)</option>
            <option value="+65">+65 (SG)</option>
          </select>
          <input
            className="input"
            style={{ flex: 1 }}
            value={form.whatsapp_number || ''}
            onChange={e => updateField('whatsapp_number', e.target.value)}
            placeholder="XXXXX XXXXX"
            type="tel"
          />
        </div>
      </div>

      <label style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.whatsapp_consent}
          onChange={e => updateField('whatsapp_consent', e.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5 }}>
          Yes, I consent to receive automated notifications and interactive buttons to approve my draft posts.
        </span>
      </label>

      <div className="field">
        <label className="field-label">Quiet Hours (Do Not Disturb)</label>
        <input
          className="input"
          value={form.quiet_hours}
          onChange={e => updateField('quiet_hours', e.target.value)}
          placeholder="e.g. 22:00-08:00"
        />
      </div>
    </div>
  )
}
