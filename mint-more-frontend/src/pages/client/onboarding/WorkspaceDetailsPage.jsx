import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function WorkspaceDetailsPage() {
  const { form, handleImportFromWebsite, industries, languages, updateField, isExtractingWebsite, hasImportedWebsite } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Let's create your workspace</h1>
        <p className="muted" style={{ marginTop: 8 }}>Provide your basic business info to lock down your brand details.</p>
      </div>

      <div className="field">
        <label className="field-label">Website URL (Optional)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input"
            value={form.website}
            onChange={e => updateField('website', e.target.value)}
            placeholder="https://mybusiness.com"
            style={{ flex: 1 }}
          />
          <button className="btn ghost shrink-0" type="button" onClick={handleImportFromWebsite} disabled={isExtractingWebsite}>
            {isExtractingWebsite ? <Icon name="loader-2" className="spin" size={13} /> : <Icon name="sparkles" size={13} />} 
            {isExtractingWebsite ? 'Importing...' : 'Import info'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="field">
          <label className="field-label">Business Name</label>
          <div className="relative">
            <input
              className={`input ${isExtractingWebsite || hasImportedWebsite ? 'pl-9' : ''}`}
              value={form.business_name}
              onChange={e => updateField('business_name', e.target.value)}
              placeholder="e.g. Bhouter Bari Hotel"
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

        <div className="field">
          <label className="field-label">Industry Category</label>
          <div className="relative">
            <select
              className={`input ${isExtractingWebsite || hasImportedWebsite ? 'pl-9' : ''}`}
              value={form.business_type}
              onChange={e => updateField('business_type', e.target.value)}
            >
              {industries.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
            </select>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="field">
          <label className="field-label">Primary Language</label>
          <select
            className="input"
            value={form.preferred_language}
            onChange={e => updateField('preferred_language', e.target.value)}
          >
            {languages.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="field-label">Location (City)</label>
          <div className="relative">
            <input
              className={`input ${isExtractingWebsite || hasImportedWebsite ? 'pl-9' : ''}`}
              value={form.address_city}
              onChange={e => updateField('address_city', e.target.value)}
              placeholder="e.g. Mandarmoni"
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
    </div>
  )
}
