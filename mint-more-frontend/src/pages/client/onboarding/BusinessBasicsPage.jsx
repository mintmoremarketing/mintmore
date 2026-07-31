import { useOnboardingContext } from './useOnboardingContext'

export default function BusinessBasicsPage() {
  const { form, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Tell us about your business</h1>
        <p className="muted" style={{ marginTop: 8 }}>Describe your products so the AI doesn't invent incorrect claims.</p>
      </div>

      <div className="field">
        <label className="field-label">Business Description</label>
        <textarea
          className="textarea"
          rows={4}
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Describe your business, offerings, and unique value proposition..."
        />
      </div>

      <div className="field">
        <label className="field-label">Key Products / Services</label>
        <input
          className="input"
          value={form.products_services}
          onChange={e => updateField('products_services', e.target.value)}
          placeholder="e.g. Tandoori Chicken, Ocean View Rooms, Spa Treatment"
        />
      </div>
    </div>
  )
}
