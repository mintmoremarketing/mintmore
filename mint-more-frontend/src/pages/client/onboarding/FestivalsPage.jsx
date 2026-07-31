import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function FestivalsPage() {
  const { form, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Festival & occasion strategy</h1>
        <p className="muted" style={{ marginTop: 8 }}>Tell us how to handle festivals and special occasions. We cover everything from Diwali to Father's Day to Jagannath Puja â€” automatically, every month.</p>
      </div>

      <div className="field">
        <label className="field-label">How should we plan your festival content?</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {[
            {
              value: 'autopilot',
              icon: 'zap',
              title: 'Smart Autopilot',
              badge: 'RECOMMENDED',
              desc: 'We automatically design & schedule posts for every cultural event and special day. Zero effort needed from you.',
            },
            {
              value: 'manual',
              icon: 'sliders',
              title: "I'll pick manually",
              badge: null,
              desc: 'Hand-pick the specific festivals you want us to cover from our list.',
            },
          ].map(opt => {
            const selected = form.festival_mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField('festival_mode', opt.value)}
                style={{
                  textAlign: 'left',
                  padding: '20px',
                  border: `2px solid ${selected ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
                  borderRadius: 16,
                  background: selected ? 'var(--paper-tint)' : 'var(--paper)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selected ? '0 4px 14px rgba(11, 15, 20, 0.06)' : 'none',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: selected ? 'var(--ink-950)' : 'var(--paper-tint)', color: selected ? '#fff' : 'var(--ink-450)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name={opt.icon} size={18} style={{ color: selected ? '#fff' : 'var(--ink-600)' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--ink-950)' : 'var(--ink-800)', marginBottom: 4 }}>
                  {opt.title}
                  {opt.badge && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, border: '1px solid var(--mint-300)', background: 'var(--mint-50)', color: 'var(--mint-700)', borderRadius: 6, padding: '3px 8px' }}>{opt.badge}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {form.festival_mode === 'autopilot' && (
        <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Icon name="checkCircle" size={20} style={{ color: 'var(--mint-500)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Autopilot active</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-650)', lineHeight: 1.6 }}>
              Mintbox will automatically design and schedule posts for <strong>every cultural festival, national holiday, and special occasion</strong> â€” from Diwali to Jagannath Puja, Father's Day to Yoga Day, every single month.
            </div>
          </div>
        </div>
      )}

      {form.festival_mode === 'manual' && (
        <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Icon name="calendar" size={20} style={{ color: 'var(--ink-500)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>You choose what to celebrate</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-650)', lineHeight: 1.6 }}>
              Mintbox won't schedule any festival posts automatically. You can always select and schedule specific occasions directly from your <strong>Calendar</strong> later.
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="field-label" style={{ marginBottom: 0 }}>Design lead time</label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { days: 3, label: '3 days' },
            { days: 7, label: '7 days' },
            { days: 11, label: '11 days' },
          ].map(opt => {
            const active = Number(form.festival_lead_days) === opt.days
            return (
              <div
                key={opt.days}
                onClick={() => updateField('festival_lead_days', String(opt.days))}
                style={{
                  padding: '12px 10px',
                  border: `1.5px solid ${active ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
                  borderRadius: 12,
                  background: active ? 'var(--paper-tint)' : 'var(--paper)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--ink-950)' : 'var(--ink-600)',
                }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>How many days before each festival Mintbox begins designing the post and sends you a preview.</p>
      </div>
    </div>
  )
}
