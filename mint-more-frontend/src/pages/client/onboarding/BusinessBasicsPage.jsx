import { useOnboardingContext } from './useOnboardingContext'

import Icon from '../../../components/ui/Icon'

export default function BusinessBasicsPage() {
  const { form, updateField, isExtractingWebsite } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Tell us about your business</h1>
        <p className="muted" style={{ marginTop: 8 }}>Describe your products so the AI doesn't invent incorrect claims.</p>
      </div>

      <div className="field">
        <label className="field-label flex items-center gap-2">
          Business Description {isExtractingWebsite && <Icon name="loader-2" className="spin muted" size={12} />}
        </label>
        <textarea
          className="textarea"
          rows={4}
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Describe your business, offerings, and unique value proposition..."
        />
      </div>

      <div className="field">
        <label className="field-label flex items-center gap-2">
          Key Products / Services {isExtractingWebsite && <Icon name="loader-2" className="spin muted" size={12} />}
        </label>
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
