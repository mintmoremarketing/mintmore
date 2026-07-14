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

  const TIER_COLORS = { basic: 'bg-ink-900', standard: 'bg-mint-600', premium: 'bg-violet-600' }
  const TIER_TEXT = { basic: 'text-ink-900', standard: 'text-mint-600', premium: 'text-violet-600' }
  const TIER_BG    = { basic: 'bg-ink-50/50', standard: 'bg-mint-50/50', premium: 'bg-violet-50/50' }

  return (
    <div className={`flex flex-col bg-white border border-ink-200/60 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-6 md:p-8 transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${TIER_COLORS[type]}`} />
      
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pt-2">
        <div>
          <span className={`text-xs font-bold uppercase tracking-widest ${TIER_TEXT[type]}`}>
            {type}
          </span>
          {pkg && (
            <div className="text-sm font-medium text-ink-500 mt-1">
              {rupee(pkg.price)} · {pkg.delivery_days} days
            </div>
          )}
        </div>
        {pkg && (
          <button className="text-xs font-medium text-rose-500 hover:text-rose-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors" onClick={() => onDelete(type)}>
            <Icon name="trash" size={14} /> Remove
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 flex-1">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Package name</label>
          <input
            className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} package`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Description</label>
          <textarea
            className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all resize-none"
            rows={3}
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="What's included in this package?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink-900">Price (₹)</label>
            <input
              className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all"
              type="number"
              value={form.price}
              onChange={e => update('price', e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink-900">Delivery</label>
            <div className="relative">
              <input
                className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 pr-12 text-sm transition-all"
                type="number"
                value={form.delivery_days}
                onChange={e => update('delivery_days', e.target.value)}
                placeholder="e.g. 3"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-400 pointer-events-none">days</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Revisions</label>
          <select 
            className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" 
            value={form.revisions} 
            onChange={e => update('revisions', e.target.value)}
          >
            <option value="Unlimited">Unlimited</option>
            {[1,2,3,5].map(n => <option key={n} value={String(n)}>{n} revision{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>

        {/* Inclusions */}
        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm font-semibold text-ink-900">
            What's included
          </label>
          {Object.keys(form.inclusions).length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {Object.entries(form.inclusions).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg">
                  <Icon name="check" size={14} className="text-mint-600 shrink-0" />
                  <span className="flex-1 text-sm text-ink-800 truncate">
                    <strong className="font-semibold">{k}</strong>
                    {typeof v !== 'boolean' && v ? `: ${v}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeInclusion(k)}
                    className="text-ink-400 hover:text-ink-600 transition-colors p-1 rounded-md hover:bg-white"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-[2] min-w-0 bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-3 py-2 text-sm transition-all"
              placeholder="e.g. Source file"
              value={inclKey}
              onChange={e => setInclKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInclusion()}
            />
            <input
              className="flex-[1] min-w-0 bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-3 py-2 text-sm transition-all"
              placeholder="Value"
              value={inclVal}
              onChange={e => setInclVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInclusion()}
            />
            <button 
              type="button" 
              className="shrink-0 w-10 h-[38px] bg-ink-100 hover:bg-ink-200 text-ink-700 rounded-xl flex items-center justify-center transition-colors" 
              onClick={addInclusion}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      </div>

      <button
        className={`w-full mt-8 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center ${
          isPending || !form.name || !form.price || !form.delivery_days 
            ? 'bg-ink-100 text-ink-400 cursor-not-allowed' 
            : 'bg-ink-950 text-white hover:bg-ink-900 shadow-md hover:shadow-lg hover:-translate-y-0.5'
        }`}
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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      <div className="animate-pulse w-48 h-6 bg-ink-200 rounded-md" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="animate-pulse bg-ink-100 h-[600px] rounded-3xl" />)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide uppercase">Marketplace</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">Packages</h1>
        <p className="text-ink-600 mt-2 text-sm md:text-base">
          Set up Basic, Standard, and Premium packages. Clients see these on your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
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