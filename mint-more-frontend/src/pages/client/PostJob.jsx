import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as tus from 'tus-js-client'
import { jobsApi } from '../../api/jobs'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

const getMarketRangeFromResponse = (res) =>
  res.data?.data?.range ?? res.data?.data?.data?.range ?? res.data?.range ?? null

const formatRange = (range) => {
  if (!range?.min || !range?.max) return 'Market range pending'
  return `${rupee(range.min)} - ${rupee(range.max)}`
}

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

const attachmentTypes = [
  { icon: 'image', label: 'Images & design', hint: 'JPG, PNG, PSD, AI' },
  { icon: 'video', label: 'Video & audio', hint: 'MP4, MOV, MP3, WAV' },
  { icon: 'file', label: 'Documents', hint: 'PDF and Office files' },
  { icon: 'layers', label: 'Packages', hint: 'ZIP, RAR and 7Z' },
]

export default function PostJob() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const pushToast = useUIStore((s) => s.pushToast)
  const [step, setStep] = useState(1)
  const [tagInput, setTagInput] = useState('')
  const [briefFiles, setBriefFiles] = useState([])
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
  }, [existingJob])

  const selectedRange = data.pricing_mode === 'expert' ? expertRange : budgetRange
  const selectedPool = poolOptions.find((p) => p.value === data.pricing_mode)

  const payload = {
    ...data,
    budget_type: 'quote',
    budget_amount: null,
    required_level: data.pricing_mode === 'expert' ? 'experienced' : null,
    metadata: {
      talent_pool: data.pricing_mode === 'expert' ? 'pro' : 'budget',
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
      if (data.description.trim().length < 5) return 'Add a brief description with at least 5 characters.'
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
              <label className="field-label">Brief title</label>
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
            <div className="field">
              <label className="field-label">Brief description</label>
              <textarea className="textarea" value={data.description} onChange={(e) => update('description', e.target.value)} rows={6} placeholder="Describe what you need, tone, references, audience..." />
              <span className={data.description.length > 0 && data.description.trim().length < 5 ? 'field-error' : 'field-hint'}>{data.description.trim().length}/5 minimum characters</span>
            </div>
            <div className="field">
              <label className="field-label">Brief tags</label>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="e.g. Cinematic video" />
                <button type="button" className="btn ghost" onClick={() => {
                  const tag = tagInput.trim()
                  if (tag && !data.required_skills.includes(tag)) update('required_skills', [...data.required_skills, tag])
                  setTagInput('')
                }}><Icon name="plus" /> Add</button>
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {data.required_skills.map(tag => <button type="button" key={tag} className="badge neutral" onClick={() => update('required_skills', data.required_skills.filter(item => item !== tag))}>{tag} ×</button>)}
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
                  <div className="row between" style={{ gap: 12, marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>Drop reference files here</strong>
                      <div className="field-hint">Stored privately in the project Mintbox for the matched creative.</div>
                    </div>
                    <button type="button" className="btn ghost sm" onClick={e => { e.stopPropagation(); briefFileRef.current?.click() }}>
                      <Icon name="upload" size={12} /> Choose files
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 8 }}>
                    {attachmentTypes.map(type => (
                      <div key={type.label} style={{ minHeight: 68, border: '1px solid var(--hairline)', background: 'var(--paper)', padding: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <Icon name={type.icon} size={14} />
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{type.label}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginTop: 3 }}>{type.hint}</div>
                        </div>
                      </div>
                    ))}
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
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-700)', margin: 0 }}>{data.description}</p>
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
