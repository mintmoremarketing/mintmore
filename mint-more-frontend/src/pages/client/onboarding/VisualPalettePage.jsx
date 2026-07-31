import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function VisualPalettePage() {
  const { form, handleSuggestPalette, presetPalettes, setPaletteCustomized, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Establish your visual palette</h1>
        <p className="muted" style={{ marginTop: 8 }}>These colors will be used as coordinates for brand templates.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>Brand Color Palette</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-550)', marginRight: 2 }}>Colors:</span>
            {[2, 3, 4].map(num => {
              const active = form.palette.length === num
              return (
                <button
                  key={num}
                  type="button"
                  className={`btn ${active ? 'primary' : 'ghost'}`}
                  style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11 }}
                  onClick={() => {
                    let nextPalette = [...form.palette]
                    if (nextPalette.length > num) {
                      nextPalette = nextPalette.slice(0, num)
                    } else if (nextPalette.length < num) {
                      const suggestion = presetPalettes[form.business_type || 'restaurant']?.[0] || presetPalettes.other[0]
                      while (nextPalette.length < num) {
                        nextPalette.push(suggestion[nextPalette.length] || '#111111')
                      }
                    }
                    updateField('palette', nextPalette)
                  }}
                >
                  {num}
                </button>
              )
            })}
          </div>
          <button className="btn ghost" type="button" onClick={handleSuggestPalette} style={{ padding: '4px 10px', fontSize: 11.5 }}>
            <Icon name="sparkles" size={13} /> Suggest palette
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {form.palette.map((color, idx) => (
          <label key={idx} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
            <input
              type="color"
              value={color}
              onChange={e => {
                setPaletteCustomized(true)
                const newPalette = [...form.palette]
                newPalette[idx] = e.target.value
                updateField('palette', newPalette)
              }}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                left: 0,
                top: 0,
                cursor: 'pointer',
              }}
            />
            <div
              style={{
                aspectRatio: '1',
                borderRadius: 12,
                background: color,
                border: '2px solid var(--hairline-strong)',
                marginBottom: 8,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            />
            <code style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{color}</code>
          </label>
        ))}
      </div>
    </div>
  )
}
