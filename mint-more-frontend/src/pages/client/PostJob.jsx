import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as tus from 'tus-js-client'
import { jobsApi } from '../../api/jobs'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'
import { useEntitlements } from '../../hooks/useEntitlements'
import { BRIEF_GUIDE_OPTIONS, CREATIVE_SKILLS } from '../../data/creativeOptions'

const getMarketRangeFromResponse = (res) =>
  res.data?.data?.range ?? res.data?.data?.data?.range ?? res.data?.range ?? null

const formatRange = (range) => {
  if (!range?.min || !range?.max) return 'Market range pending'
  return `${rupee(range.min)} - ${rupee(range.max)}`
}
const asChoices = (value) => Array.isArray(value) ? value : value ? [value] : []

const poolOptions = [
  {
    value: 'budget',
    icon: 'rupee',
    title: 'Budget creatives',
    subtitle: 'Beginner and intermediate freelancers quote first.',
    note: 'Good for clear, lighter briefs where speed and value matter.',
  },
  {
    value: 'expert',
    icon: 'sparkles',
    title: 'Pro creatives',
    subtitle: 'Experienced freelancers quote first.',
    note: 'Good for premium work, complex campaigns, and higher quality expectations.',
  },
]

function ChoiceField({ label, options, values, customValue, onChange, onCustomChange }) {
  const selected = Array.isArray(values) ? values : values ? [values] : []
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="row wrap" style={{ gap: 7 }}>
        {options.map(option => {
          const active = selected.includes(option)
          return (
            <button type="button" key={option} className={`badge ${active ? 'mint' : 'neutral'}`} style={{ cursor: 'pointer', padding: '7px 10px' }} onClick={() => onChange(active ? selected.filter(item => item !== option) : [...selected, option])}>
              {active && <Icon name="check" size={10} />} {option}
            </button>
          )
        })}
      </div>
      {selected.includes('Other') && <input className="input" value={customValue || ''} onChange={event => onCustomChange(event.target.value)} placeholder="Tell the creative what is different" style={{ marginTop: 8 }} />}
    </div>
  )
}

export default function PostJob() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const pushToast = useUIStore((s) => s.pushToast)
  const [step, setStep] = useState(1)
  const [briefFiles, setBriefFiles] = useState([])
  const [briefContext, setBriefContext] = useState({
    deliverables: [],
    deliverables_other: '',
    promotion_or_goal: [],
    promotion_or_goal_other: '',
    customer_profile: [],
    customer_profile_other: '',
    style_references: [],
    style_references_other: '',
    avoid: [],
    avoid_other: '',
  })
  const briefFileRef = useRef(null)
  const [data, setData] = useState({
    title: '',
    category_id: '',
    description: '',
    pricing_mode: 'budget',
    budget_type: 'quote',
    budget_amount: null,
    deadline: '',
    required_skills: [],
    required_level: null,
  })
  const { data: access } = useEntitlements()

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => jobsApi.categories().then((r) => r.data.data),
  })
  const categories = catData?.categories || []

  const { data: budgetRange } = useQuery({
    queryKey: ['market-range', data.category_id, 'budget'],
    queryFn: async () => getMarketRangeFromResponse(await jobsApi.marketRange(data.category_id, 'budget')),
    enabled: Boolean(data.category_id),
  })

  const { data: expertRange } = useQuery({
    queryKey: ['market-range', data.category_id, 'expert'],
    queryFn: async () => getMarketRangeFromResponse(await jobsApi.marketRange(data.category_id, 'expert')),
    enabled: Boolean(data.category_id),
  })

  const { data: existingJob, isLoading: isJobLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await jobsApi.get(id)
      return res.data?.data?.job ?? res.data?.data ?? null
    },
    enabled: isEditMode,
  })

  useEffect(() => {
    if (!existingJob) return

    setData({
      title: existingJob.title || '',
      category_id: existingJob.category_id || '',
      description: existingJob.description || '',
      pricing_mode: existingJob.pricing_mode === 'expert' ? 'expert' : 'budget',
      budget_type: 'quote',
      budget_amount: null,
      deadline: existingJob.deadline ? existingJob.deadline.slice(0, 10) : '',
      required_skills: existingJob.required_skills || [],
      required_level: existingJob.pricing_mode === 'expert' ? 'experienced' : null,
    })
    setBriefContext({
      deliverables: asChoices(existingJob.metadata?.brief_context?.deliverables),
      deliverables_other: existingJob.metadata?.brief_context?.deliverables_other || '',
      promotion_or_goal: asChoices(existingJob.metadata?.brief_context?.promotion_or_goal),
      promotion_or_goal_other: existingJob.metadata?.brief_context?.promotion_or_goal_other || '',
      customer_profile: asChoices(existingJob.metadata?.brief_context?.customer_profile),
      customer_profile_other: existingJob.metadata?.brief_context?.customer_profile_other || '',
      style_references: asChoices(existingJob.metadata?.brief_context?.style_references),
      style_references_other: existingJob.metadata?.brief_context?.style_references_other || '',
      avoid: asChoices(existingJob.metadata?.brief_context?.avoid),
      avoid_other: existingJob.metadata?.brief_context?.avoid_other || '',
    })
  }, [existingJob])

  const selectedRange = data.pricing_mode === 'expert' ? expertRange : budgetRange
  const selectedPool = poolOptions.find((p) => p.value === data.pricing_mode)
  const briefDescription = data.description.trim() || [
    briefContext.deliverables.filter(item => item !== 'Other').join(', '),
    briefContext.deliverables_other,
  ].filter(Boolean).join('. ')

  const payload = {
    ...data,
    description: briefDescription,
    budget_type: 'quote',
    budget_amount: null,
    required_level: data.pricing_mode === 'expert' ? 'experienced' : null,
    metadata: {
      ...(existingJob?.metadata || {}),
      talent_pool: data.pricing_mode === 'expert' ? 'pro' : 'budget',
      brief_context: briefContext,
      market_average: selectedRange
        ? { min: selectedRange.min, max: selectedRange.max, label: selectedRange.label }
        : null,
    },
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!isEditMode) {
        const draft = await jobsApi.draft(payload)
        const job = draft.data?.data
        for (const file of briefFiles) {
          const prepared = await mintboxApi.prepareUpload(job.id, {
            name: file.name, size: file.size, type: file.type || 'application/octet-stream', purpose: 'brief',
          })
          const config = prepared.data?.data?.upload
          await new Promise((resolve, reject) => {
            const upload = new tus.Upload(file, {
              endpoint: config.endpoint,
              chunkSize: config.policy?.chunk_size_bytes || 6 * 1024 * 1024,
              retryDelays: [0, 1000, 3000, 5000, 10000],
              uploadDataDuringCreation: true,
              headers: { 'x-signature': String(config.token || '').trim() },
              metadata: { bucketName: config.bucket, objectName: config.storage_path, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
              onError: reject,
              onSuccess: async () => {
                try { await mintboxApi.completeUpload(config.upload_id); resolve() } catch (error) { reject(error) }
              },
            })
            upload.start()
          })
        }
        return jobsApi.publish(job.id)
      }

      await jobsApi.update(id, payload)
      return jobsApi.publish(id)
    },
    onSuccess: () => {
      pushToast({
        title: isEditMode ? 'Brief updated!' : 'Brief posted!',
        body: 'Matching creatives now - ~6 min',
      })
      navigate(isEditMode ? `/jobs/${id}` : '/jobs')
    },
    onError: (err) => {
      pushToast({
        title: isEditMode ? 'Failed to update' : 'Failed to post',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
      })
    },
  })

  function update(k, v) {
    setData((d) => ({ ...d, [k]: v }))
  }

  function updateContext(k, v) {
    setBriefContext((current) => ({ ...current, [k]: v }))
  }

  function addBriefFiles(fileList) {
    const incoming = Array.from(fileList || [])
    setBriefFiles(current => {
      const known = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`))
      return [...current, ...incoming.filter(file => !known.has(`${file.name}-${file.size}-${file.lastModified}`))]
    })
  }

  function canContinue() {
    return !validationMessage()
  }

  function validationMessage() {
    if (step === 1) {
      if (data.title.trim().length < 5) return 'Add a brief title with at least 5 characters.'
      if (!data.category_id) return 'Choose a category.'
      if (!briefContext.deliverables.length) return 'Choose at least one thing you need.'
    }
    if (step === 2) {
      if (!data.pricing_mode) return 'Choose Budget creatives or Pro creatives.'
      if (!data.deadline) return 'Choose a deadline.'
      if (new Date(`${data.deadline}T23:59:59`) <= new Date()) return 'Choose a future deadline.'
    }
    return ''
  }

  function handlePrimaryAction() {
    if (isPending) return
    const error = validationMessage()
    if (error) {
      pushToast({ title: 'Complete this step', body: error, tone: 'amber' })
      return
    }
    if (step < 3) {
      setStep(step + 1)
      return
    }
    if (access && !access.can_create_job) {
      if (access.needs_kyc_for_paid_order) {
        pushToast({ title: 'Complete verification to post', body: 'Your brief is ready. Verify your account to publish it.', tone: 'amber' })
        navigate('/settings?section=verification')
      } else {
        pushToast({ title: 'Membership required to post', body: 'Your brief is ready. Activate access to publish it.', tone: 'amber' })
        navigate('/membership')
      }
      return
    }
    mutate()
  }

  if (isEditMode && isJobLoading) {
    return (
      <div className="stack-6">
        <div className="card" style={{ padding: 28 }}>
          <div className="skeleton" style={{ width: '45%', height: 18, borderRadius: 6, marginBottom: 18 }} />
          <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="stack-6">
      <div className="reveal">
        <button className="btn link sm" onClick={() => navigate('/jobs')} style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12 }}>
          <Icon name="arrowLeft" size={12} /> All jobs
        </button>
        <h1 className="h-display h-1" style={{ margin: '6px 0 0' }}>{isEditMode ? 'Edit brief' : 'Post a brief'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Pick the creative pool and deadline. Freelancers quote first, then you can negotiate.
        </p>
      </div>

      <div className="stepper">
        {['Basics', 'Creative pool', 'Review'].map((s, i) => (
          <Fragment key={s}>
            <div className={`step ${step >= i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
              <span className="step-num">
                {step > i + 1 ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span>{s}</span>
            </div>
            {i < 2 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} style={{ background: step > i + 1 ? 'var(--ink-950)' : 'var(--hairline)' }} />}
          </Fragment>
        ))}
      </div>

      <div className="card" style={{ padding: 28 }}>
        {step === 1 && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="field">
              <label className="field-label">What do you want to create?</label>
              <input className="input" value={data.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Diwali campaign hero video" />
              <span className={data.title.length > 0 && data.title.trim().length < 5 ? 'field-error' : 'field-hint'}>Minimum 5 characters</span>
            </div>
            <div className="field">
              <label className="field-label">Category</label>
              <select className="select" value={data.category_id} onChange={(e) => update('category_id', e.target.value)}>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <ChoiceField label="What do you need?" options={BRIEF_GUIDE_OPTIONS.deliverables} values={briefContext.deliverables} customValue={briefContext.deliverables_other} onChange={value => updateContext('deliverables', value)} onCustomChange={value => updateContext('deliverables_other', value)} />
            <div className="grid-2" style={{ gap: 18 }}>
              <ChoiceField label="What is the main goal?" options={BRIEF_GUIDE_OPTIONS.goals} values={briefContext.promotion_or_goal} customValue={briefContext.promotion_or_goal_other} onChange={value => updateContext('promotion_or_goal', value)} onCustomChange={value => updateContext('promotion_or_goal_other', value)} />
              <ChoiceField label="Who should this speak to?" options={BRIEF_GUIDE_OPTIONS.customers} values={briefContext.customer_profile} customValue={briefContext.customer_profile_other} onChange={value => updateContext('customer_profile', value)} onCustomChange={value => updateContext('customer_profile_other', value)} />
              <ChoiceField label="Which styles feel right?" options={BRIEF_GUIDE_OPTIONS.styles} values={briefContext.style_references} customValue={briefContext.style_references_other} onChange={value => updateContext('style_references', value)} onCustomChange={value => updateContext('style_references_other', value)} />
              <ChoiceField label="What should the creative avoid?" options={BRIEF_GUIDE_OPTIONS.avoid} values={briefContext.avoid} customValue={briefContext.avoid_other} onChange={value => updateContext('avoid', value)} onCustomChange={value => updateContext('avoid_other', value)} />
            </div>
            <div className="field">
              <label className="field-label">Anything else the creative should know? <span className="muted">(optional)</span></label>
              <textarea className="textarea" value={data.description} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="A useful detail, required wording, or reference link." />
            </div>
            <div className="field">
              <label className="field-label">Skills that fit this brief</label>
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {CREATIVE_SKILLS.map(skill => {
                  const active = data.required_skills.includes(skill)
                  return <button type="button" key={skill} className={`badge ${active ? 'mint' : 'neutral'}`} style={{ cursor: 'pointer', padding: '7px 10px' }} onClick={() => update('required_skills', active ? data.required_skills.filter(item => item !== skill) : [...data.required_skills, skill])}>{active && <Icon name="check" size={10} />} {skill}</button>
                })}
              </div>
            </div>
            {!isEditMode && (
              <div className="field">
                <label className="field-label">Reference attachments</label>
                <input
                  ref={briefFileRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    addBriefFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <div
                  onClick={() => briefFileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    addBriefFiles(e.dataTransfer.files)
                  }}
                  style={{ border: '1px dashed var(--ink-300)', padding: 16, cursor: 'pointer', background: 'var(--paper-tint)' }}
                >
                  <div className="row between" style={{ gap: 12 }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>Drop all reference files here</strong>
                      <div className="field-hint">Mintbox organises images, video, audio, documents and packages automatically.</div>
                    </div>
                    <button type="button" className="btn ghost sm" onClick={e => { e.stopPropagation(); briefFileRef.current?.click() }}>
                      <Icon name="upload" size={12} /> Choose files
                    </button>
                  </div>
                </div>
                {briefFiles.length > 0 && (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {briefFiles.map(file => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="row between" style={{ padding: '7px 9px', border: '1px solid var(--hairline)', background: 'var(--paper-tint)', gap: 10 }}>
                        <span style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Icon name="paperclip" size={11} /> {file.name}</span>
                        <button type="button" className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => setBriefFiles(files => files.filter(item => item !== file))}><Icon name="x" size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="stack" style={{ gap: 22 }}>
            <div>
              <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Choose creative pool</label>
              <div className="grid-2" style={{ gap: 12 }}>
                {poolOptions.map((option) => {
                  const range = option.value === 'expert' ? expertRange : budgetRange
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`role-card ${data.pricing_mode === option.value ? 'on' : ''}`}
                      onClick={() => update('pricing_mode', option.value)}
                      style={{ alignItems: 'flex-start', textAlign: 'left' }}
                    >
                      <Icon name={option.icon} />
                      <span className="role-title">{option.title}</span>
                      <span className="role-sub">{option.subtitle}</span>
                      <span style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-700)', fontWeight: 500 }}>
                        Market average: {formatRange(range)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.45 }}>{option.note}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field" style={{ maxWidth: 360 }}>
              <label className="field-label">Deadline</label>
              <input
                className="input"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                value={data.deadline}
                onChange={e => update('deadline', e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack" style={{ gap: 18 }}>
            <div>
              <span className="h-eyebrow" style={{ color: 'var(--mint-700)' }}>Ready to post</span>
              <h2 className="h-display h-2" style={{ margin: '6px 0 8px' }}>{data.title}</h2>
            </div>
            <div className="divider" />
            {(data.required_skills.length > 0 || briefFiles.length > 0) && (
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 8 }}>References</div>
                <div className="row wrap" style={{ gap: 6 }}>{data.required_skills.map(tag => <span key={tag} className="badge neutral">{tag}</span>)}</div>
                {briefFiles.map(file => <div key={`${file.name}-${file.size}`} style={{ fontSize: 12.5, marginTop: 8 }}><Icon name="paperclip" size={12} /> {file.name}</div>)}
              </div>
            )}
            <div className="grid-2" style={{ gap: 18 }}>
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>Brief</div>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-700)', margin: 0 }}>{briefDescription}</p>
              </div>
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>At a glance</div>
                <div className="stack" style={{ gap: 8, fontSize: 13 }}>
                  <div className="row between"><span className="muted">Pool</span><span>{selectedPool?.title}</span></div>
                  <div className="row between"><span className="muted">Market average</span><span className="mono">{formatRange(selectedRange)}</span></div>
                  {data.deadline && (
                    <div className="row between">
                      <span className="muted">Deadline</span>
                      <span>{new Date(data.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="row between"><span className="muted">Client budget</span><span>Freelancers quote first</span></div>
                </div>
              </div>
            </div>
            {Object.values(briefContext).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value)) && (
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 8 }}>Brief context</div>
                <div className="grid-2" style={{ gap: 10 }}>
                  {[
                    ['Goal', briefContext.promotion_or_goal],
                    ['Customers', briefContext.customer_profile],
                    ['Style references', briefContext.style_references],
                    ['Avoid', briefContext.avoid],
                  ].filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value)).map(([label, value]) => (
                    <div key={label} style={{ padding: 12, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
                      <div className="h-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{Array.isArray(value) ? value.join(', ') : value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row between">
        <button className="btn ghost" onClick={() => step > 1 ? setStep(step - 1) : navigate('/jobs')}>
          <Icon name="arrowLeft" /> {step > 1 ? 'Back' : 'Cancel'}
        </button>
        <button className="btn primary" onClick={handlePrimaryAction} disabled={isPending}>
          {isPending
            ? (isEditMode ? 'Saving...' : 'Posting...')
            : step < 3
            ? <>Continue <Icon name="arrowRight" /></>
            : <>{isEditMode ? 'Save & restart matching' : 'Post brief'} <Icon name="arrowRight" /></>}
        </button>
      </div>
    </div>
  )
}
