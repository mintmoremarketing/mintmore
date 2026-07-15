import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'

const LEVELS = ['basic', 'identity', 'business']

function FileField({ label, name, required = false, onChange, selectedFile }) {
  return (
    <label className="verification-file" style={{ borderColor: selectedFile ? 'var(--mint-500)' : 'var(--ink-300)', background: selectedFile ? 'var(--mint-50)' : 'var(--paper)' }}>
      {selectedFile ? <Icon name="check" size={15} style={{ color: 'var(--mint-600)' }} /> : <Icon name="upload" size={15} />}
      <span>
        <strong style={{ color: selectedFile ? 'var(--mint-700)' : 'inherit' }}>{selectedFile ? 'File attached' : label}</strong>
        <small>{selectedFile ? selectedFile.name : 'JPG, PNG or PDF, up to 5 MB'}</small>
      </span>
      <input type="file" name={name} accept="image/*,.pdf" required={required} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} onChange={e => onChange(name, e.target.files?.[0] || null)} />
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
  const [business, setBusiness] = useState({ company_name: profile.business_name || '', company_type: profile.business_type || '', website: '', gst_number: '' })

  const submit = useMutation({
    mutationFn: ({ level, payload }) => {
      if (level === 'business') {
        return api.patch('/profile', {
          business_name: payload.company_name,
          business_type: payload.company_type,
        })
      }
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
      pushToast(variables.level === 'identity'
        ? { title: 'Verification application submitted', body: 'We will notify you after one complete review.', icon: 'check' }
        : { title: 'Section saved', body: 'Your information has been updated.', icon: 'check' })
    },
    onError: error => pushToast({ title: 'Could not submit verification', body: error.response?.data?.message || error.message, tone: 'amber', icon: 'x' }),
  })

  const canOpen = level => true
  const applicationUnderReview = pending('identity')
  const statusLabel = level => {
    if (level === 'business') return profile.business_name ? 'Saved' : 'Optional'
    return approved(level)
      ? 'Approved'
      : latest(level)?.status === 'rejected'
        ? 'Needs resubmission'
        : pending(level)
          ? 'Application under review'
          : 'Ready'
  }
  const portfolioReady = Number(kyc.portfolio_count || 0) >= Number(kyc.required_portfolio_count || 3)

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="verification-intro">
        <div>
          <div className="h-eyebrow">Trust and safety</div>
          <h2>{profile.role === 'freelancer' ? 'Verify your identity and creative work' : 'Verify your business account'}</h2>
          <p>{profile.role === 'freelancer' ? 'Identity checks protect payouts. Your work samples help our team assign the right creator tier.' : 'Verification protects payments and is required before publishing your first paid brief.'}</p>
        </div>
        <div className="verification-progress"><strong>{LEVELS.filter(l => l === 'business' ? profile.business_name : submitted(l)).length} / 3</strong><span>{applicationUnderReview ? 'application under review' : 'sections completed'}</span></div>
      </div>

      {LEVELS.map((level, index) => (
        <section className={`verification-step ${openLevel === level ? 'open' : ''}`} key={level}>
          <button className="verification-step-head" disabled={!canOpen(level)} onClick={() => setOpenLevel(openLevel === level ? '' : level)}>
            <span className={`verification-step-number ${(level === 'business' && profile.business_name) || approved(level) ? 'done' : ''}`}>{(level === 'business' && profile.business_name) || approved(level) ? <Icon name="check" /> : index + 1}</span>
            <span><strong>{level === 'basic' ? 'Personal details' : level === 'identity' ? 'Government identity' : 'Business details'}</strong><small>{level === 'basic' ? 'Date of birth, gender and nationality' : level === 'identity' ? 'Aadhaar, PAN, passport or driving licence' : 'Optional business information'}</small></span>
            <span className={`badge ${approved(level) || (level === 'business' && profile.business_name) ? 'mint' : pending(level) ? 'amber' : 'neutral'}`}>{statusLabel(level)}</span>
            <Icon name="chevronDown" />
          </button>
          {openLevel === level && canOpen(level) && (
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
                <div className="verification-files grid-1">
                  <FileField label="Upload Document" name="document_front" required selectedFile={identity.document_front} onChange={(key, file) => setIdentity({ ...identity, [key]: file })} />
                </div>
                <button className="btn primary mt-4" disabled={submit.isPending || !identity.document_number || !identity.document_front} onClick={() => submit.mutate({ level, payload: identity })}>Submit identity check <Icon name="arrowRight" /></button>
              </>}
              {level === 'business' && <>
                <div className="grid-2">
                  <div className="field"><label className="field-label">Company Name</label><input className="input" placeholder="Optional" value={business.company_name} onChange={e => setBusiness({ ...business, company_name: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Company Type</label><select className="input" value={business.company_type} onChange={e => setBusiness({ ...business, company_type: e.target.value })}><option value="">Select (Optional)</option><option value="sole_proprietor">Sole Proprietor</option><option value="llc">LLC / Pvt Ltd</option><option value="corporation">Corporation</option></select></div>
                </div>
                <div className="grid-2">
                  <div className="field"><label className="field-label">Website</label><input className="input" placeholder="https://" value={business.website} onChange={e => setBusiness({ ...business, website: e.target.value })} /></div>
                  <div className="field"><label className="field-label">GST Number / Tax ID</label><input className="input" placeholder="Optional" value={business.gst_number} onChange={e => setBusiness({ ...business, gst_number: e.target.value })} /></div>
                </div>
                <button className="btn primary" disabled={submit.isPending} onClick={() => submit.mutate({ level, payload: business })}>Save business details <Icon name="arrowRight" /></button>
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
