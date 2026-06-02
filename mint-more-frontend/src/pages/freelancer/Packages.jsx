import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { packagesApi } from '../../api/packages'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

const PACKAGE_TYPES = ['basic', 'standard', 'premium']

const EMPTY_PKG = {
  name: '', description: '', price: '',
  delivery_days: '', revisions: 'Unlimited',
  inclusions: {},
}

function PackageEditor({ type, pkg, onSave, onDelete, isPending }) {
  const [form, setForm] = useState({ ...EMPTY_PKG })
  const [inclKey, setInclKey] = useState('')
  const [inclVal, setInclVal] = useState('')

  // Populate from fetched package
  useEffect(() => {
    if (pkg) {
      setForm({
        name:          pkg.name          || '',
        description:   pkg.description   || '',
        price:         pkg.price         || '',
        delivery_days: pkg.delivery_days || '',
        revisions:     pkg.revisions     || 'Unlimited',
        inclusions:    pkg.inclusions    || {},
      })
    } else {
      setForm({ ...EMPTY_PKG, inclusions: {} })
    }
  }, [pkg?.id])

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function addInclusion() {
    if (!inclKey.trim()) return
    setForm(f => ({ ...f, inclusions: { ...f.inclusions, [inclKey.trim()]: inclVal.trim() || true } }))
    setInclKey('')
    setInclVal('')
  }

  function removeInclusion(key) {
    setForm(f => {
      const next = { ...f.inclusions }
      delete next[key]
      return { ...f, inclusions: next }
    })
  }

  const TIER_COLORS = { basic: 'var(--ink-400)', standard: 'var(--mint-600)', premium: '#8B5CF6' }
  const TIER_BG    = { basic: 'var(--paper-tint)', standard: 'rgba(16,185,129,0.08)', premium: 'rgba(139,92,246,0.08)' }

  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius-lg)', padding: 22,
      borderTop: `3px solid ${TIER_COLORS[type]}`,
    }}>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 18 }}>
        <div>
          <span style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: 0.06, color: TIER_COLORS[type],
          }}>
            {type}
          </span>
          {pkg && (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2 }}>
              {rupee(pkg.price)} · {pkg.delivery_days} days
            </div>
          )}
        </div>
        {pkg && (
          <button className="btn ghost" style={{ fontSize: 12, color: 'var(--rose)' }} onClick={() => onDelete(type)}>
            <Icon name="trash" size={12} /> Remove
          </button>
        )}
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label className="field-label">Package name</label>
          <input
            className="input"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} package`}
          />
        </div>

        <div className="field">
          <label className="field-label">Description</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="What's included in this package?"
          />
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label className="field-label">Price (₹)</label>
            <input
              className="input"
              type="number"
              value={form.price}
              onChange={e => update('price', e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div className="field">
            <label className="field-label">Delivery (days)</label>
            <input
              className="input"
              type="number"
              value={form.delivery_days}
              onChange={e => update('delivery_days', e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Revisions</label>
          <select className="select" value={form.revisions} onChange={e => update('revisions', e.target.value)}>
            <option value="Unlimited">Unlimited</option>
            {[1,2,3,5].map(n => <option key={n} value={String(n)}>{n} revision{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>

        {/* Inclusions */}
        <div>
          <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>
            What's included
          </label>
          {Object.keys(form.inclusions).length > 0 && (
            <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
              {Object.entries(form.inclusions).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                  padding: '7px 10px', background: 'var(--paper-tint)',
                  border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)',
                }}>
                  <Icon name="check" size={12} style={{ color: 'var(--mint-600)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-800)' }}>
                    <strong>{k}</strong>
                    {typeof v !== 'boolean' && v ? `: ${v}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeInclusion(k)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--ink-400)' }}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ flex: 2 }}
              placeholder="e.g. Source file"
              value={inclKey}
              onChange={e => setInclKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInclusion()}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Value (optional)"
              value={inclVal}
              onChange={e => setInclVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInclusion()}
            />
            <button type="button" className="btn ghost" onClick={addInclusion} style={{ flexShrink: 0 }}>
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>
      </div>

      <button
        className="btn primary block"
        style={{ marginTop: 18 }}
        onClick={() => onSave(type, form)}
        disabled={isPending || !form.name || !form.price || !form.delivery_days}
      >
        {isPending ? 'Saving…' : pkg ? 'Update package' : `Add ${type} package`}
      </button>
    </div>
  )
}

export default function Packages() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  const { data, isLoading } = useQuery({
    queryKey: ['my-packages'],
    queryFn:  () => packagesApi.getMyPackages().then(r => r.data.data.packages || []),
  })

  const packages = data || []

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (formData) => packagesApi.upsert(formData),
    onSuccess: () => {
      pushToast({ title: 'Package saved!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-packages'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (type) => packagesApi.remove(type),
    onSuccess: () => {
      pushToast({ title: 'Package removed', icon: 'trash' })
      queryClient.invalidateQueries({ queryKey: ['my-packages'] })
    },
  })

  function handleSave(type, form) {
    save({
      package_type:  type,
      name:          form.name,
      description:   form.description,
      price:         parseFloat(form.price),
      delivery_days: parseInt(form.delivery_days, 10),
      revisions:     form.revisions,
      inclusions:    form.inclusions,
    })
  }

  if (isLoading) return (
    <div className="stack-6">
      <div className="skeleton" style={{ width: 200, height: 20, borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 380, borderRadius: 12 }} />)}
      </div>
    </div>
  )

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Packages</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
          Set up Basic, Standard, and Premium packages. Clients see these on your profile.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}
        className="reveal">
        {PACKAGE_TYPES.map(type => {
          const existing = packages.find(p => p.package_type === type)
          return (
            <PackageEditor
              key={type}
              type={type}
              pkg={existing}
              onSave={handleSave}
              onDelete={remove}
              isPending={saving}
            />
          )
        })}
      </div>
    </div>
  )
}