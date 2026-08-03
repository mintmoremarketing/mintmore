import { useOnboardingContext } from './useOnboardingContext'

export default function ContentCadencePage() {
  const { form, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Set content frequency</h1>
        <p className="muted" style={{ marginTop: 8 }}>Determine how often Autopilot schedules and drafts content.</p>
      </div>

      <div className="field">
        <label className="field-label" style={{ marginBottom: 12 }}>Posting Frequency</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { value: '4', label: '4 Posts / mo', desc: 'A light presence' },
            { value: '8', label: '8 Posts / mo', desc: 'Balanced growth' },
            { value: '12', label: '12 Posts / mo', desc: 'Aggressive reach' },
            { value: '15', label: '15 Posts / mo', desc: 'Maximum visibility' },
          ].map(opt => {
            const active = form.posting_frequency === opt.value
            return (
              <div
                key={opt.value}
                onClick={() => updateField('posting_frequency', opt.value)}
                style={{
                  padding: '20px 16px',
                  border: `2px solid ${active ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
                  borderRadius: 16,
                  background: active ? 'var(--paper-tint)' : 'var(--paper)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: active ? '0 4px 14px rgba(11, 15, 20, 0.06)' : 'none',
                  position: 'relative',
                }}
              >
                {opt.value === '8' && (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--primary)', color: 'white', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                    Recommended
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 700, color: active ? 'var(--ink-950)' : 'var(--ink-700)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                  {opt.desc}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
