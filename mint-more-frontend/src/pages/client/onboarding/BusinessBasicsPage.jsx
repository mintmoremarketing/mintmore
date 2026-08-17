import { useOnboardingContext } from './useOnboardingContext'

import Icon from '../../../components/ui/Icon'

export default function BusinessBasicsPage() {
  const { form, updateField, isExtractingWebsite, hasImportedWebsite } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <style>{`
        @keyframes popIn {
          0% { transform: translateY(-50%) scale(0); opacity: 0; }
          70% { transform: translateY(-50%) scale(1.2); opacity: 1; }
          100% { transform: translateY(-50%) scale(1); opacity: 1; }
        }
        @keyframes popInTextarea {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pop-in { animation: popIn 0.35s ease-out forwards; }
        .pop-in-textarea { animation: popInTextarea 0.35s ease-out forwards; }
      `}</style>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Tell us about your business</h1>
        <p className="muted" style={{ marginTop: 8 }}>Describe your products so the AI doesn't invent incorrect claims.</p>
      </div>

      <div className="field">
        <label className="field-label">Business Description</label>
        {isExtractingWebsite ? (
          <div className="textarea flex items-center justify-center" style={{ color: '#9ca3af', minHeight: 110 }}>
            <Icon name="loader-2" className="spin" size={20} />
          </div>
        ) : (
          <div className="relative">
            <textarea
              className="textarea"
              style={hasImportedWebsite ? { paddingLeft: 36 } : {}}
              rows={4}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Describe your business, offerings, and unique value proposition..."
            />
            {hasImportedWebsite && (
              <div className="absolute left-3 top-3 pop-in-textarea" style={{ color: '#10b981' }}>
                <Icon name="check" size={16} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label">Key Products / Services</label>
        {isExtractingWebsite ? (
          <div className="input flex items-center justify-center" style={{ color: '#9ca3af' }}>
            <Icon name="loader-2" className="spin" size={18} />
          </div>
        ) : (
          <div className="relative">
            <input
              className="input"
              style={hasImportedWebsite ? { paddingLeft: 36 } : {}}
              value={form.products_services}
              onChange={e => updateField('products_services', e.target.value)}
              placeholder="e.g. Tandoori Chicken, Ocean View Rooms, Spa Treatment"
            />
            {hasImportedWebsite && (
              <div className="absolute left-3 top-1/2 pop-in" style={{ color: '#10b981', transform: 'translateY(-50%)' }}>
                <Icon name="check" size={16} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
