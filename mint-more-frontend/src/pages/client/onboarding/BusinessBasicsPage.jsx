import { useOnboardingContext } from './useOnboardingContext'

import Icon from '../../../components/ui/Icon'

export default function BusinessBasicsPage() {
  const { form, updateField, isExtractingWebsite, hasImportedWebsite } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Tell us about your business</h1>
        <p className="muted" style={{ marginTop: 8 }}>Describe your products so the AI doesn't invent incorrect claims.</p>
      </div>

      <div className="field">
        <label className="field-label">Business Description</label>
        <div className="relative">
          <textarea
            className={`textarea ${isExtractingWebsite || hasImportedWebsite ? 'pl-9' : ''}`}
            rows={4}
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Describe your business, offerings, and unique value proposition..."
          />
          {isExtractingWebsite && (
            <div className="absolute left-3 top-3 text-mint-500">
              <Icon name="loader-2" className="spin" size={14} />
            </div>
          )}
          {!isExtractingWebsite && hasImportedWebsite && (
            <div className="absolute left-3 top-3 text-mint-500">
              <Icon name="check" size={14} />
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Key Products / Services</label>
        <div className="relative">
          <input
            className={`input ${isExtractingWebsite || hasImportedWebsite ? 'pl-9' : ''}`}
            value={form.products_services}
            onChange={e => updateField('products_services', e.target.value)}
            placeholder="e.g. Tandoori Chicken, Ocean View Rooms, Spa Treatment"
          />
          {isExtractingWebsite && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mint-500">
              <Icon name="loader-2" className="spin" size={14} />
            </div>
          )}
          {!isExtractingWebsite && hasImportedWebsite && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mint-500">
              <Icon name="check" size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
