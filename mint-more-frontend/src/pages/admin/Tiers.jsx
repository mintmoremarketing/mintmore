import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const AVAILABLE_FEATURES = [
  { id: 'mint_ai', label: 'Mint AI' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'social_insights', label: 'Social Insights' },
  { id: 'posting', label: 'Social Posting' },
  { id: 'custom_requests', label: 'Custom Requests' },
  { id: 'internal_ops', label: 'Internal Ops' },
  { id: 'calendar_creatives', label: 'Calendar Creatives' },
  { id: 'mintbox', label: 'Mintbox' },
]

export default function Tiers() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [editingTier, setEditingTier] = useState(null)

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: () => commerceApi.getTiers().then(res => res.data.data),
  })

  const updateMutation = useMutation({
    mutationFn: (tier) => commerceApi.updateTier(tier.id, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] })
      addToast('Tier updated successfully', 'success')
      setEditingTier(null)
    },
    onError: (err) => addToast(err.response?.data?.message || err.message, 'error')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => commerceApi.deleteTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] })
      addToast('Tier deleted successfully', 'success')
    },
    onError: (err) => addToast(err.response?.data?.message || err.message, 'error')
  })

  if (isLoading) return <div className="p-8">Loading tiers...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="h-display h-4">Subscription Tiers</h1>
      </div>

      <div className="grid-1 gap-6">
        {tiers?.map(tier => (
          <div key={tier.id} className="surface border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-display h-5">{tier.name}</h2>
              <div className="flex items-center gap-2">
                <span className="h-display h-5 mr-2">₹{tier.price}</span>
                <button className="btn outline sm" onClick={() => setEditingTier(tier)}>
                  <Icon name="edit" size={16} /> Edit
                </button>
                <button 
                  className="btn outline sm" 
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this tier?')) {
                      deleteMutation.mutate(tier.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  title="Delete Tier"
                >
                  Delete
                </button>
              </div>
            </div>

            {editingTier?.id === tier.id ? (
              <EditTierForm 
                tier={editingTier} 
                onSave={(data) => updateMutation.mutate({ ...editingTier, ...data })}
                onCancel={() => setEditingTier(null)}
                isSaving={updateMutation.isPending}
              />
            ) : (
              <div className="flex flex-wrap gap-2 mt-4">
                {tier.features?.map(feat => (
                  <span key={feat} className="badge bg-mint text-mint">
                    {AVAILABLE_FEATURES.find(f => f.id === feat)?.label || feat}
                  </span>
                ))}
                {(!tier.features || tier.features.length === 0) && (
                  <span className="text-muted text-sm">No features enabled</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EditTierForm({ tier, onSave, onCancel, isSaving }) {
  const [name, setName] = useState(tier.name)
  const [price, setPrice] = useState(tier.price)
  const [features, setFeatures] = useState(tier.features || [])
  const [planId, setPlanId] = useState(tier.razorpay_plan_id || '')

  const toggleFeature = (featId) => {
    if (features.includes(featId)) {
      setFeatures(features.filter(f => f !== featId))
    } else {
      setFeatures([...features, featId])
    }
  }

  return (
    <div className="mt-6 pt-6 border-t grid-1 gap-4">
      <div className="grid-2">
        <div className="field">
          <label className="field-label">Tier Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Price (₹)</label>
          <input className="input" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
        </div>
        <div className="field">
          <label className="field-label">Razorpay Plan ID</label>
          <input className="input" value={planId} onChange={e => setPlanId(e.target.value)} placeholder="plan_xyz123" />
        </div>
      </div>
      
      <div className="field mt-4">
        <label className="field-label mb-2">Enabled Features</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {AVAILABLE_FEATURES.map(feat => (
            <label key={feat.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-black/5 p-2 rounded transition-colors">
              <input 
                type="checkbox" 
                checked={features.includes(feat.id)}
                onChange={() => toggleFeature(feat.id)}
                className="accent-mint"
              />
              {feat.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button className="btn outline" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button className="btn primary" disabled={isSaving} onClick={() => onSave({ name, price, features, razorpay_plan_id: planId })}>
          {isSaving ? 'Saving...' : 'Save Tier'}
        </button>
      </div>
    </div>
  )
}
