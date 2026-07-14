import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { addonsApi } from '../../api/addons'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

const emptyRangeForm = {
  beginner_min: '',
  beginner_max: '',
  intermediate_min: '',
  intermediate_max: '',
  experienced_min: '',
  experienced_max: '',
  notes: '',
}

const rangeToForm = (range) => ({
  beginner_min: range?.beginner_min ?? '',
  beginner_max: range?.beginner_max ?? '',
  intermediate_min: range?.intermediate_min ?? '',
  intermediate_max: range?.intermediate_max ?? '',
  experienced_min: range?.experienced_min ?? '',
  experienced_max: range?.experienced_max ?? '',
  notes: range?.notes ?? '',
})

const formToPayload = (form) => ({
  beginner_min: Number(form.beginner_min),
  beginner_max: Number(form.beginner_max),
  intermediate_min: Number(form.intermediate_min),
  intermediate_max: Number(form.intermediate_max),
  experienced_min: Number(form.experienced_min),
  experienced_max: Number(form.experienced_max),
  currency: 'INR',
  notes: form.notes || undefined,
})

export default function AdminPricing() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [form, setForm] = useState(emptyRangeForm)
  const [storageForm, setStorageForm] = useState({
    name: 'Mintbox +10 GB',
    description: 'Adds more project storage to Mintbox.',
    price: '',
    duration_days: 30,
    storage_gb: 10,
    is_featured: false,
    is_active: true,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/admin/categories').then(r => r.data.data),
  })

  const { data: rangesData, isLoading } = useQuery({
    queryKey: ['admin-price-ranges'],
    queryFn: () => api.get('/admin/price-ranges').then(r => r.data.data),
  })

  const { data: addonPlansData } = useQuery({
    queryKey: ['admin-addon-plans'],
    queryFn: () => addonsApi.adminPlans({ include_inactive: true }).then(r => r.data.data),
  })

  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData?.categories])
  const ranges = useMemo(() => rangesData?.ranges || [], [rangesData?.ranges])
  const effectiveCategoryId = selectedCategoryId || categories[0]?.id || ''
  const selectedRange = ranges.find(r => r.category_id === effectiveCategoryId)
  const storagePlans = useMemo(() => (addonPlansData?.plans || []).filter(plan =>
    Number(plan.storage_gb || 0) > 0 || plan.features?.includes('mintbox_storage')
  ), [addonPlansData?.plans])

  useEffect(() => {
    if (effectiveCategoryId) {
      setForm(rangeToForm(ranges.find(r => r.category_id === effectiveCategoryId)))
    }
  }, [ranges, effectiveCategoryId])

  const saveRange = useMutation({
    mutationFn: () => api.put(`/admin/price-ranges/${effectiveCategoryId}`, formToPayload(form)),
    onSuccess: () => {
      pushToast({ title: 'Price range saved', body: 'Freelancer offer limits updated', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-price-ranges'] })
      queryClient.invalidateQueries({ queryKey: ['market-range'] })
    },
    onError: err => pushToast({
      title: 'Failed',
      body: err.response?.data?.message || 'Check the min/max values',
      tone: 'amber',
      icon: 'x',
    }),
  })

  const saveStoragePlan = useMutation({
    mutationFn: () => {
      const payload = {
        ...storageForm,
        price: Number(storageForm.price),
        duration_days: Number(storageForm.duration_days),
        storage_gb: Number(storageForm.storage_gb),
        features: ['mintbox_storage'],
        sort_order: 20 + Number(storageForm.storage_gb || 0),
      }
      return storageForm.id
        ? addonsApi.adminUpdatePlan(storageForm.id, payload)
        : addonsApi.adminCreatePlan(payload)
    },
    onSuccess: () => {
      pushToast({ title: 'Storage add-on saved', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-addon-plans'] })
      queryClient.invalidateQueries({ queryKey: ['addon-plans'] })
      setStorageForm({
        name: 'Mintbox +10 GB',
        description: 'Adds more project storage to Mintbox.',
        price: '',
        duration_days: 30,
        storage_gb: 10,
        is_featured: false,
        is_active: true,
      })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Could not save add-on', tone: 'amber', icon: 'x' }),
  })

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const updateStorageField = (field, value) => setStorageForm(prev => ({ ...prev, [field]: value }))
  const canSave = effectiveCategoryId &&
    form.beginner_min && form.beginner_max &&
    form.intermediate_min && form.intermediate_max &&
    form.experienced_min && form.experienced_max

  const bands = [
    { key: 'beginner', label: 'Beginner', min: 'beginner_min', max: 'beginner_max' },
    { key: 'intermediate', label: 'Intermediate', min: 'intermediate_min', max: 'intermediate_max' },
    { key: 'experienced', label: 'Expert', min: 'experienced_min', max: 'experienced_max' },
  ]

  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Market price ranges</h1>
          <p className="text-ink-600 font-medium">Control freelancer offer limits by category and level.</p>
        </div>
        <button
          className="px-6 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          onClick={() => saveRange.mutate()}
          disabled={!canSave || saveRange.isPending}
        >
          <Icon name="check" size={16} />
          {saveRange.isPending ? 'Saving...' : selectedRange ? 'Save range' : 'Create range'}
        </button>
      </div>

      <div className="bg-white border border-ink-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-ink-200/50 pb-8">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Category</label>
            <select
              className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-medium"
              value={effectiveCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              disabled={isLoading}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Admin note</label>
            <input
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all"
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Optional internal note"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {bands.map(band => (
            <div key={band.key} className="bg-ink-50/50 border border-ink-200/60 rounded-2xl p-6">
              <div className="text-sm font-bold tracking-[0.1em] uppercase text-ink-950 mb-6">{band.label}</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-ink-500 uppercase tracking-widest">Min</label>
                  <input
                    className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-mono"
                    type="number"
                    min="0"
                    value={form[band.min]}
                    onChange={e => updateField(band.min, e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-ink-500 uppercase tracking-widest">Max</label>
                  <input
                    className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-mono"
                    type="number"
                    min="0"
                    value={form[band.max]}
                    onChange={e => updateField(band.max, e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-xl font-display font-bold text-ink-950 m-0 mb-1">Mintbox storage add-ons</h2>
            <p className="text-ink-600 font-medium">Control how much extra storage clients can buy and what each plan costs.</p>
          </div>
          <button
            className="px-6 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            onClick={() => saveStoragePlan.mutate()}
            disabled={!storageForm.name || !storageForm.price || !storageForm.storage_gb || saveStoragePlan.isPending}
          >
            <Icon name="check" size={16} />
            {saveStoragePlan.isPending ? 'Saving...' : storageForm.id ? 'Update add-on' : 'Create add-on'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 border-b border-ink-200/50 pb-8">
          <div className="flex flex-col gap-2 lg:col-span-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Name</label>
            <input className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all" value={storageForm.name} onChange={e => updateStorageField('name', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Price (₹)</label>
            <input className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-mono" type="number" min="0" value={storageForm.price} onChange={e => updateStorageField('price', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Extra GB</label>
            <input className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-mono" type="number" min="1" value={storageForm.storage_gb} onChange={e => updateStorageField('storage_gb', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Duration (days)</label>
            <input className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all font-mono" type="number" min="1" value={storageForm.duration_days} onChange={e => updateStorageField('duration_days', e.target.value)} />
          </div>
          
          <div className="flex flex-col gap-2 lg:col-span-3">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Description</label>
            <input className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 transition-all" value={storageForm.description} onChange={e => updateStorageField('description', e.target.value)} />
          </div>
          
          <div className="flex items-center gap-6 lg:col-span-2 pt-4">
            <label className="flex items-center gap-3 text-sm font-bold text-ink-950 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-ink-300 text-ink-950 focus:ring-ink-950" checked={storageForm.is_featured} onChange={e => updateStorageField('is_featured', e.target.checked)} />
              Featured add-on
            </label>
            <label className="flex items-center gap-3 text-sm font-bold text-ink-950 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-ink-300 text-ink-950 focus:ring-ink-950" checked={storageForm.is_active} onChange={e => updateStorageField('is_active', e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {storagePlans.map(plan => (
            <button
              key={plan.id}
              onClick={() => setStorageForm({
                id: plan.id,
                name: plan.name || '',
                description: plan.description || '',
                price: plan.price || '',
                duration_days: plan.duration_days || 30,
                storage_gb: plan.storage_gb || 0,
                is_featured: Boolean(plan.is_featured),
                is_active: Boolean(plan.is_active),
              })}
              className="group text-left bg-ink-50/50 hover:bg-white border border-ink-200/60 hover:border-ink-400 rounded-2xl p-6 transition-all hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-4">
                <strong className="font-bold text-ink-950 text-lg group-hover:text-mint-600 transition-colors">{plan.name}</strong>
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${plan.is_active ? 'bg-mint-100 text-mint-700' : 'bg-ink-200 text-ink-600'}`}>
                  {plan.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
              <div className="font-mono font-bold text-2xl text-ink-950 mb-2">{rupee(plan.price)}</div>
              <div className="text-sm text-ink-500 font-medium">
                {plan.storage_gb} GB · {plan.duration_days} days · <span className="text-ink-800">{plan.active_subscribers || 0} active</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
