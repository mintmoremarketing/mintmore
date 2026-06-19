import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const languages = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['bn', 'Bengali'],
  ['hinglish', 'Hinglish'],
]

export default function Onboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [form, setForm] = useState({
    business_name: '',
    business_type: '',
    address_city: '',
    preferred_language: 'en',
    customer_profile: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(res => res.data.data),
  })
  const profile = useMemo(() => data?.profile || data || {}, [data])

  useEffect(() => {
    if (!profile.id) return
    setForm({
      business_name: profile.business_name || '',
      business_type: profile.business_type || '',
      address_city: profile.address_city || '',
      preferred_language: profile.preferred_language || 'en',
      customer_profile: profile.customer_profile || '',
    })
  }, [
    profile.id,
    profile.business_name,
    profile.business_type,
    profile.address_city,
    profile.preferred_language,
    profile.customer_profile,
  ])

  const checklist = useMemo(() => ({
    profile: Boolean(form.business_name && form.business_type && form.address_city && form.customer_profile),
    language: Boolean(form.preferred_language),
    social: Boolean(profile.onboarding_checklist?.social),
    kyc: profile.kyc_status === 'verified',
  }), [form, profile])

  const save = useMutation({
    mutationFn: () => api.patch('/profile/me', { ...form, onboarding_checklist: checklist }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      pushToast({ title: 'Onboarding details saved', icon: 'check' })
      navigate('/dashboard')
    },
    onError: err => pushToast({
      title: 'Could not save',
      body: err.response?.data?.message || 'Try again',
      tone: 'amber',
      icon: 'x',
    }),
  })

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))

  if (isLoading) return <div className="muted">Loading onboarding...</div>

  return (
    <div className="stack-6" style={{ maxWidth: 860 }}>
      <div>
        <div className="h-eyebrow">Getting started</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Tell CREATYV about your business</h1>
        <p className="muted">This context improves briefs, AI output, matching, and onboarding support. You can update it later.</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="grid-2" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label">Business name</label>
            <input className="input" value={form.business_name} onChange={e => update('business_name', e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Business type</label>
            <input className="input" value={form.business_type} onChange={e => update('business_type', e.target.value)} placeholder="Fashion, restaurant, agency..." />
          </div>
          <div className="field">
            <label className="field-label">Location</label>
            <input className="input" value={form.address_city} onChange={e => update('address_city', e.target.value)} placeholder="City" />
          </div>
          <div className="field">
            <label className="field-label">Preferred language</label>
            <select className="input" value={form.preferred_language} onChange={e => update('preferred_language', e.target.value)}>
              {languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label className="field-label">Who are your customers?</label>
          <textarea
            className="textarea"
            rows={4}
            value={form.customer_profile}
            onChange={e => update('customer_profile', e.target.value)}
            placeholder="Describe the people you sell to, what they care about, and where you reach them."
          />
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="h-eyebrow" style={{ marginBottom: 12 }}>Next steps</div>
        <div className="grid-2" style={{ gap: 10 }}>
          {[
            ['profile', 'Business profile', 'Used for briefs and AI'],
            ['language', 'Language preference', 'Used across assisted workflows'],
            ['social', 'Connect social accounts', 'Optional and skippable'],
            ['kyc', 'Complete KYC', 'Required before a paid brief'],
          ].map(([key, label, description]) => (
            <div key={key} className="row" style={{ gap: 10, padding: 12, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
              <Icon name={checklist[key] ? 'check' : 'circle'} size={14} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => navigate('/dashboard')}>Skip for now</button>
        <button className="btn primary" onClick={() => save.mutate()} disabled={save.isPending}>
          <Icon name="check" size={13} /> {save.isPending ? 'Saving...' : 'Save and continue'}
        </button>
      </div>
    </div>
  )
}
