import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function BrandVoicePage() {
  const { ageSegments, form, sampleCopyPreview, toggleTargetAge, tones, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Establish your brand voice</h1>
        <p className="muted" style={{ marginTop: 8 }}>Tone dictates all future AI-generated post copy.</p>
      </div>

      <div className="field">
        <label className="field-label">Select Tone of Voice</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tones.map(t => (
            <label
              key={t.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: 14,
                border: '1px solid var(--hairline)',
                borderRadius: 12,
                cursor: 'pointer',
                background: form.tone === t.id ? 'var(--mint-50)' : 'transparent',
                borderColor: form.tone === t.id ? 'var(--mint-400)' : 'var(--hairline-strong)',
                transition: '.1s',
              }}
            >
              <input
                type="radio"
                name="tone"
                checked={form.tone === t.id}
                onChange={() => updateField('tone', t.id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>{t.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Target Audience Segment</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ageSegments.map(seg => {
            const active = form.target_ages.includes(seg.id)
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => toggleTargetAge(seg.id)}
                className={`btn ${active ? 'primary' : 'ghost'}`}
                style={{ borderRadius: 20, padding: '6px 14px', fontSize: 12.5 }}
              >
                {seg.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 16, background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', marginBottom: 8 }}>
          <Icon name="sparkles" size={12} style={{ color: 'var(--mint-600)' }} /> Live Tone Preview
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.6 }}>
          "{sampleCopyPreview}"
        </p>
      </div>
    </div>
  )
}
