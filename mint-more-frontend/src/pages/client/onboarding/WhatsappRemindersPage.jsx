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
        <input
          className="input"
          value={form.whatsapp_number}
          onChange={e => updateField('whatsapp_number', e.target.value)}
          placeholder="+91 XXXXX XXXXX"
        />
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
