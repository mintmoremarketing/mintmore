import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'

const LEVELS = ['basic', 'identity', 'address']

function FileField({ label, name, required = false, onChange }) {
  return (
    <label className="verification-file">
      <Icon name="upload" size={15} />
      <span><strong>{label}</strong><small>JPG, PNG or PDF, up to 5 MB</small></span>
      <input type="file" name={name} accept="image/*,.pdf" required={required} onChange={e => onChange(name, e.target.files?.[0] || null)} />
    </label>
  )
}

export default function VerificationPanel({ profile, kyc }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const submissions = kyc.submissions || []
  const latest = level => submissions.find(item => item.level === level)
  const submitted = level => Boolean(latest(level))
  const approved = level => latest(level)?.status === 'approved'
  const pending = level => latest(level)?.status === 'pending'
  const nextLevel = LEVELS.find(level => !approved(level)) || 'address'
  const [openLevel, setOpenLevel] = useState(nextLevel)
  const [basic, setBasic] = useState({ date_of_birth: '', gender: '', nationality: 'Indian' })
  const [identity, setIdentity] = useState({ document_type: 'aadhaar', document_number: '', document_front: null, document_back: null, selfie: null })
  const [address, setAddress] = useState({ address_line1: '', address_line2: '', city: profile.address_city || '', state: profile.address_state || '', pincode: '', country: 'India', address_proof: null })

  const submit = useMutation({
    mutationFn: ({ level, payload }) => {
      if (level === 'basic') return api.post('/kyc/basic', payload)
      const form = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== '') form.append(key, value)
      })
      return api.post(`/kyc/${level}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-status'] })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      pushToast(variables.level === 'address'
        ? { title: 'Verification application submitted', body: 'We will notify you after one complete review.', icon: 'check' }
        : { title: 'Section saved', body: 'Continue to the next section when ready.', icon: 'check' })
    },
    onError: error => pushToast({ title: 'Could not submit verification', body: error.response?.data?.message || error.message, tone: 'amber', icon: 'x' }),
  })

  const canOpen = level => level === 'basic' || (level === 'identity' && submitted('basic')) || (level === 'address' && submitted('identity'))
  const applicationUnderReview = pending('address')
  const statusLabel = level => approved(level)
    ? 'Approved'
    : latest(level)?.status === 'rejected'
      ? 'Needs resubmission'
      : pending(level)
        ? (level === 'address' ? 'Application under review' : 'Saved')
        : canOpen(level) ? 'Ready' : 'Complete previous section'
  const portfolioReady = Number(kyc.portfolio_count || 0) >= Number(kyc.required_portfolio_count || 3)

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="verification-intro">
        <div>
          <div className="h-eyebrow">Trust and safety</div>
          <h2>{profile.role === 'freelancer' ? 'Verify your identity and creative work' : 'Verify your business account'}</h2>
          <p>{profile.role === 'freelancer' ? 'Identity checks protect payouts. Your work samples help our team assign the right creator tier.' : 'Verification protects payments and is required before publishing your first paid brief.'}</p>
        </div>
        <div className="verification-progress"><strong>{LEVELS.filter(submitted).length} / 3</strong><span>{applicationUnderReview ? 'application under review' : 'sections completed'}</span></div>
      </div>

      {LEVELS.map((level, index) => (
        <section className={`verification-step ${openLevel === level ? 'open' : ''}`} key={level}>
          <button className="verification-step-head" disabled={!canOpen(level)} onClick={() => setOpenLevel(openLevel === level ? '' : level)}>
            <span className={`verification-step-number ${approved(level) ? 'done' : ''}`}>{approved(level) ? <Icon name="check" /> : index + 1}</span>
            <span><strong>{level === 'basic' ? 'Personal details' : level === 'identity' ? 'Government identity' : 'Address proof'}</strong><small>{level === 'basic' ? 'Date of birth, gender and nationality' : level === 'identity' ? 'Aadhaar, PAN, passport or driving licence' : 'Confirm your current residential or business address'}</small></span>
            <span className={`badge ${approved(level) ? 'mint' : level === 'address' && pending(level) ? 'amber' : 'neutral'}`}>{statusLabel(level)}</span>
            <Icon name="chevronDown" />
          </button>
          {openLevel === level && canOpen(level) && !pending(level) && !approved(level) && (
            <div className="verification-form">
              {level === 'basic' && <>
                <div className="grid-2">
                  <div className="field"><label className="field-label">Date of birth</label><input className="input" type="date" value={basic.date_of_birth} onChange={e => setBasic({ ...basic, date_of_birth: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Gender</label><select className="input" value={basic.gender} onChange={e => setBasic({ ...basic, gender: e.target.value })}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
                </div>
                <div className="field"><label className="field-label">Nationality</label><input className="input" value={basic.nationality} onChange={e => setBasic({ ...basic, nationality: e.target.value })} /></div>
                <button className="btn primary" disabled={submit.isPending || !basic.date_of_birth || !basic.gender} onClick={() => submit.mutate({ level, payload: basic })}>Submit personal details <Icon name="arrowRight" /></button>
              </>}
              {level === 'identity' && <>
                <div className="grid-2">
                  <div className="field"><label className="field-label">Document type</label><select className="input" value={identity.document_type} onChange={e => setIdentity({ ...identity, document_type: e.target.value })}><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="passport">Passport</option><option value="driving_license">Driving licence</option></select></div>
                  <div className="field"><label className="field-label">Document number</label><input className="input" value={identity.document_number} onChange={e => setIdentity({ ...identity, document_number: e.target.value.toUpperCase() })} /></div>
                </div>
                <div className="verification-files"><FileField label="Document front" name="document_front" required onChange={(key, file) => setIdentity({ ...identity, [key]: file })} /><FileField label="Document back" name="document_back" onChange={(key, file) => setIdentity({ ...identity, [key]: file })} /><FileField label="Clear selfie" name="selfie" required onChange={(key, file) => setIdentity({ ...identity, [key]: file })} /></div>
                <button className="btn primary" disabled={submit.isPending || !identity.document_number || !identity.document_front || !identity.selfie} onClick={() => submit.mutate({ level, payload: identity })}>Submit identity check <Icon name="arrowRight" /></button>
              </>}
              {level === 'address' && <>
                <div className="field"><label className="field-label">Address line 1</label><input className="input" value={address.address_line1} onChange={e => setAddress({ ...address, address_line1: e.target.value })} /></div>
                <div className="field"><label className="field-label">Address line 2</label><input className="input" value={address.address_line2} onChange={e => setAddress({ ...address, address_line2: e.target.value })} /></div>
                <div className="grid-3"><div className="field"><label className="field-label">City</label><input className="input" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} /></div><div className="field"><label className="field-label">State</label><input className="input" value={address.state} onChange={e => setAddress({ ...address, state: e.target.value })} /></div><div className="field"><label className="field-label">PIN code</label><input className="input" value={address.pincode} onChange={e => setAddress({ ...address, pincode: e.target.value })} /></div></div>
                <FileField label="Address proof" name="address_proof" required onChange={(key, file) => setAddress({ ...address, [key]: file })} />
                <button className="btn primary" disabled={submit.isPending || !address.address_line1 || !address.city || !address.state || !address.pincode || !address.address_proof} onClick={() => submit.mutate({ level, payload: address })}>Submit address proof <Icon name="arrowRight" /></button>
              </>}
            </div>
          )}
        </section>
      ))}

      {profile.role === 'freelancer' && (
        <section className="verification-portfolio">
          <div><span className={`verification-step-number ${portfolioReady ? 'done' : ''}`}>{portfolioReady ? <Icon name="check" /> : 4}</span></div>
          <div><strong>Creative work review</strong><p>Add at least three strong examples that represent the work you want to be matched for. Our team uses these to verify quality and assign your creator tier.</p><div className="verification-meter"><span style={{ width: `${Math.min(100, (Number(kyc.portfolio_count || 0) / 3) * 100)}%` }} /></div><small>{kyc.portfolio_count || 0} of 3 required samples added</small></div>
          <button className="btn ghost" onClick={() => navigate('/portfolio')}>Manage portfolio <Icon name="arrowRight" /></button>
        </section>
      )}
    </div>
  )
}
