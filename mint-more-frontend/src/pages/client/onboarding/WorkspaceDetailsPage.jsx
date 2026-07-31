import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function WorkspaceDetailsPage() {
  const { form, handleImportFromWebsite, industries, languages, updateField } = useOnboardingContext()

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
          <button className="btn ghost shrink-0" type="button" onClick={handleImportFromWebsite}>
            <Icon name="sparkles" size={13} /> Import info
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="field">
          <label className="field-label">Business Name</label>
          <input
            className="input"
            value={form.business_name}
            onChange={e => updateField('business_name', e.target.value)}
            placeholder="e.g. Bhouter Bari Hotel"
          />
        </div>

        <div className="field">
          <label className="field-label">Industry Category</label>
          <select
            className="input"
            value={form.business_type}
            onChange={e => updateField('business_type', e.target.value)}
          >
            {industries.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
          </select>
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
          <input
            className="input"
            value={form.address_city}
            onChange={e => updateField('address_city', e.target.value)}
            placeholder="e.g. Mandarmoni"
          />
        </div>
      </div>
    </div>
  )
}
