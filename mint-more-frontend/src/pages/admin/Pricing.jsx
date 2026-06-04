import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

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

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/admin/categories').then(r => r.data.data),
  })

  const { data: rangesData, isLoading } = useQuery({
    queryKey: ['admin-price-ranges'],
    queryFn: () => api.get('/admin/price-ranges').then(r => r.data.data),
  })

  const categories = categoriesData?.categories || []
  const ranges = rangesData?.ranges || []
  const selectedRange = ranges.find(r => r.category_id === selectedCategoryId)

  useEffect(() => {
    if (!selectedCategoryId && categories[0]?.id) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories, selectedCategoryId])

  useEffect(() => {
    if (selectedCategoryId) {
      setForm(rangeToForm(ranges.find(r => r.category_id === selectedCategoryId)))
    }
  }, [ranges, selectedCategoryId])

  const saveRange = useMutation({
    mutationFn: () => api.put(`/admin/price-ranges/${selectedCategoryId}`, formToPayload(form)),
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

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const canSave = selectedCategoryId &&
    form.beginner_min && form.beginner_max &&
    form.intermediate_min && form.intermediate_max &&
    form.experienced_min && form.experienced_max

  const bands = [
    { key: 'beginner', label: 'Beginner', min: 'beginner_min', max: 'beginner_max' },
    { key: 'intermediate', label: 'Intermediate', min: 'intermediate_min', max: 'intermediate_max' },
    { key: 'experienced', label: 'Expert', min: 'experienced_min', max: 'experienced_max' },
  ]

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <div className="row between" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div>
            <h1 className="h-display h-1" style={{ margin: 0 }}>Market price ranges</h1>
            <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
              Control freelancer offer limits by category and level.
            </p>
          </div>
          <button className="btn primary" onClick={() => saveRange.mutate()} disabled={!canSave || saveRange.isPending}>
            <Icon name="check" size={13} />
            {saveRange.isPending ? 'Saving...' : selectedRange ? 'Save range' : 'Create range'}
          </button>
        </div>
      </div>

      <div className="card reveal" style={{ padding: 20 }}>
        <div className="grid-2" style={{ gap: 14, alignItems: 'end', marginBottom: 14 }}>
          <div className="field">
            <label className="field-label">Category</label>
            <select
              className="input"
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              disabled={isLoading}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Admin note</label>
            <input
              className="input"
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Optional internal note"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {bands.map(band => (
            <div key={band.key} style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <div className="h-eyebrow" style={{ marginBottom: 12 }}>{band.label}</div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div className="field">
                  <label className="field-label">Min</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form[band.min]}
                    onChange={e => updateField(band.min, e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Max</label>
                  <input
                    className="input"
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
    </div>
  )
}
