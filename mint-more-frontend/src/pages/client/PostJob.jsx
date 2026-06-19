import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as tus from 'tus-js-client'
import { jobsApi } from '../../api/jobs'
import { creativeApi } from '../../api/creative'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import DateBadge from '../../components/ui/DateBadge'
import { rupee } from '../../utils/format'
import { BRIEF_GUIDE_OPTIONS, CREATIVE_SKILLS } from '../../data/creativeOptions'

const TOTAL_STEPS = 13
const asChoices = value => Array.isArray(value) ? value : value ? [value] : []
const getMarketRange = res => res.data?.data?.range ?? res.data?.data?.data?.range ?? res.data?.range ?? null
const formatRange = range => range?.min && range?.max ? `${rupee(range.min)} - ${rupee(range.max)}` : 'Market range pending'

const poolOptions = [
  { value: 'budget', icon: 'rupee', title: 'Budget creatives', subtitle: 'Great value for clear, lighter briefs.', note: 'CREATYV ops will review and queue this internally.' },
  { value: 'expert', icon: 'sparkles', title: 'Pro creatives', subtitle: 'Premium support for complex or high-impact work.', note: 'CREATYV ops will review scope and priority.' },
]

function Question({ eyebrow, title, subtitle, children }) {
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <div className="h-eyebrow" style={{ color: 'var(--mint-700)', marginBottom: 8 }}>{eyebrow}</div>
        <h2 className="h-display h-2" style={{ margin: 0, maxWidth: 760 }}>{title}</h2>
        {subtitle && <p className="muted" style={{ margin: '8px 0 0', maxWidth: 680, lineHeight: 1.55 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function ChoiceTiles({ options, selected = [], onToggle, renderOption }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {options.map(option => {
        const value = typeof option === 'string' ? option : option.value
        const active = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            style={{
              position: 'relative', minHeight: 104, padding: 18, textAlign: 'left',
              border: `1.5px solid ${active ? 'var(--mint-500)' : 'var(--hairline)'}`,
              background: active ? 'var(--mint-50)' : 'var(--paper)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              boxShadow: active ? '0 0 0 3px rgba(247,127,0,.08)' : 'none',
            }}
          >
            <span style={{
              position: 'absolute', top: 14, right: 14, width: 20, height: 20, borderRadius: '50%',
              border: `1.5px solid ${active ? 'var(--mint-500)' : 'var(--ink-300)'}`,
              background: active ? 'var(--mint-500)' : 'transparent',
              display: 'grid', placeItems: 'center', color: 'white',
            }}>{active && <Icon name="check" size={11} strokeWidth={3} />}</span>
            {renderOption ? renderOption(option, active) : <strong style={{ display: 'block', paddingRight: 24, fontSize: 14 }}>{value}</strong>}
          </button>
        )
      })}
    </div>
  )
}

export default function PostJob() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const pushToast = useUIStore(state => state.pushToast)
  const [step, setStep] = useState(1)
  const [draftId, setDraftId] = useState(id || null)
  const [saveState, setSaveState] = useState('idle')
  const [briefFiles, setBriefFiles] = useState([])
  const [briefContext, setBriefContext] = useState({
    deliverables: [], deliverables_other: '',
    promotion_or_goal: [], promotion_or_goal_other: '',
    customer_profile: [], customer_profile_other: '',
    style_references: [], style_references_other: '',
    avoid: [], avoid_other: '',
  })
  const [data, setData] = useState({
    title: '', category_id: '', description: '', pricing_mode: '',
    budget_type: 'fixed', budget_amount: null, deadline: '',
    required_skills: [], required_level: null,
  })
  const [minimumDeadline] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const briefFileRef = useRef(null)
  const draftIdRef = useRef(id || null)
  const draftCreatePromiseRef = useRef(null)
  const saveQueueRef = useRef(Promise.resolve())
  const hydratedRef = useRef(!isEditMode)
  const uploadedFileKeysRef = useRef(new Set())

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => jobsApi.categories().then(res => res.data.data) })
  const categories = catData?.categories || []
  const { data: budgetRange } = useQuery({
    queryKey: ['market-range', data.category_id, 'budget'],
    queryFn: async () => getMarketRange(await jobsApi.marketRange(data.category_id, 'budget')),
    enabled: Boolean(data.category_id),
  })
  const { data: expertRange } = useQuery({
    queryKey: ['market-range', data.category_id, 'expert'],
    queryFn: async () => getMarketRange(await jobsApi.marketRange(data.category_id, 'expert')),
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
    const builder = existingJob.metadata?.brief_builder || null
    /* eslint-disable react-hooks/set-state-in-effect */
    setData({
      title: existingJob.title === 'Untitled brief' ? '' : existingJob.title || '',
      category_id: existingJob.category_id || '',
      description: typeof builder?.description === 'string'
        ? builder.description
        : existingJob.description === 'Brief in progress' ? '' : existingJob.description || '',
      pricing_mode: typeof builder?.pricing_mode === 'string'
        ? builder.pricing_mode
        : existingJob.pricing_mode === 'expert' ? 'expert' : 'budget',
      budget_type: 'fixed', budget_amount: null,
      deadline: existingJob.deadline?.slice(0, 10) || '',
      required_skills: existingJob.required_skills || [],
      required_level: existingJob.pricing_mode === 'expert' ? 'experienced' : null,
    })
    const context = existingJob.metadata?.brief_context || {}
    setBriefContext({
      deliverables: asChoices(context.deliverables), deliverables_other: context.deliverables_other || '',
      promotion_or_goal: asChoices(context.promotion_or_goal), promotion_or_goal_other: context.promotion_or_goal_other || '',
      customer_profile: asChoices(context.customer_profile), customer_profile_other: context.customer_profile_other || '',
      style_references: asChoices(context.style_references), style_references_other: context.style_references_other || '',
      avoid: asChoices(context.avoid), avoid_other: context.avoid_other || '',
    })
    setStep(Math.min(TOTAL_STEPS, Math.max(1, Number(existingJob.metadata?.brief_builder?.step || 1))))
    setDraftId(existingJob.id)
    draftIdRef.current = existingJob.id
    hydratedRef.current = true
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [existingJob])

  const selectedRange = data.pricing_mode === 'expert' ? expertRange : budgetRange
  const selectedPool = poolOptions.find(option => option.value === data.pricing_mode)
  const briefDescription = data.description.trim() || [
    briefContext.deliverables.filter(item => item !== 'Other').join(', '),
    briefContext.deliverables_other,
  ].filter(Boolean).join('. ')
  const payload = useMemo(() => ({
    ...data,
    description: briefDescription,
    budget_type: 'fixed',
    budget_amount: null,
    required_level: data.pricing_mode === 'expert' ? 'experienced' : null,
    metadata: {
      ...(existingJob?.metadata || {}),
      talent_pool: data.pricing_mode === 'expert' ? 'pro' : 'budget',
      brief_context: briefContext,
      market_average: selectedRange ? { min: selectedRange.min, max: selectedRange.max, label: selectedRange.label } : null,
      brief_builder: {
        step,
        total_steps: TOTAL_STEPS,
        description: data.description,
        pricing_mode: data.pricing_mode,
      },
    },
  }), [briefContext, briefDescription, data, existingJob?.metadata, selectedRange, step])

  const draftPayload = useMemo(() => ({
    ...payload,
    category_id: data.category_id || null,
    title: data.title.trim() || 'Untitled brief',
    description: briefDescription || 'Brief in progress',
  }), [briefDescription, data.category_id, data.title, payload])

  const hasMeaningfulDraft = Boolean(
    data.title.trim() ||
    data.category_id ||
    data.description.trim() ||
    data.pricing_mode ||
    data.deadline ||
    data.required_skills.length ||
    briefFiles.length ||
    Object.values(briefContext).some(value => Array.isArray(value) ? value.length : String(value || '').trim())
  )

  const uploadBriefFiles = useCallback(async (jobId, files) => {
    for (const file of files) {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`
      if (uploadedFileKeysRef.current.has(fileKey)) continue
      const prepared = await mintboxApi.prepareUpload(jobId, { name: file.name, size: file.size, type: file.type || 'application/octet-stream', purpose: 'brief' })
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
      uploadedFileKeysRef.current.add(fileKey)
    }
  }, [])

  const persistDraft = useCallback(async ({ includeFiles = true } = {}) => {
    if (!hydratedRef.current || !hasMeaningfulDraft) return draftIdRef.current
    setSaveState('saving')
    try {
      let targetId = draftIdRef.current
      if (!targetId) {
        if (!draftCreatePromiseRef.current) {
          draftCreatePromiseRef.current = jobsApi.draft(draftPayload)
            .then(response => {
              const created = response.data?.data
              draftIdRef.current = created.id
              setDraftId(created.id)
              window.history.replaceState(window.history.state, '', `/jobs/${created.id}/edit`)
              return created.id
            })
            .finally(() => { draftCreatePromiseRef.current = null })
        }
        targetId = await draftCreatePromiseRef.current
      } else {
        await jobsApi.update(targetId, draftPayload)
      }
      if (includeFiles && briefFiles.length) await uploadBriefFiles(targetId, briefFiles)
      setSaveState('saved')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      return targetId
    } catch (error) {
      setSaveState('error')
      throw error
    }
  }, [briefFiles, draftPayload, hasMeaningfulDraft, queryClient, uploadBriefFiles])

  const saveDraftNow = useCallback((options = {}) => {
    const queuedSave = saveQueueRef.current.then(() => persistDraft(options))
    saveQueueRef.current = queuedSave.catch(() => {})
    return queuedSave
  }, [persistDraft])

  useEffect(() => {
    if (!hydratedRef.current || !hasMeaningfulDraft) return undefined
    const timer = window.setTimeout(() => {
      saveDraftNow().catch(() => {})
    }, 600)
    return () => window.clearTimeout(timer)
  }, [hasMeaningfulDraft, saveDraftNow])

  useEffect(() => {
    const warnBeforeUnsavedExit = event => {
      if (!hasMeaningfulDraft || saveState === 'saved') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnsavedExit)
    return () => window.removeEventListener('beforeunload', warnBeforeUnsavedExit)
  }, [hasMeaningfulDraft, saveState])

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const targetId = await saveDraftNow()
      await jobsApi.update(targetId, {
        ...payload,
        metadata: {
          ...(payload.metadata || {}),
          fulfillment_provider: 'mintmore_internal',
          matching_disabled: true,
        },
      })
      return creativeApi.createRequest({
        job_id: targetId,
        title: data.title,
        request_type: briefContext.deliverables?.[0] || 'other',
        description: briefDescription,
        deadline: data.deadline || null,
        category_id: data.category_id || null,
        brief_context: briefContext,
        metadata: {
          ...(payload.metadata || {}),
          fulfillment_provider: 'mintmore_internal',
          matching_disabled: true,
        },
      })
    },
    onSuccess: () => {
      pushToast({ title: 'Request sent to CREATYV', body: 'The ops team will review the scope and MintCoin cost before production.' })
      navigate('/jobs')
    },
    onError: error => pushToast({ title: isEditMode ? 'Failed to update' : 'Failed to post', body: error.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const update = (key, value) => {
    setSaveState('saving')
    setData(current => ({ ...current, [key]: value }))
  }
  const updateContext = (key, value) => {
    setSaveState('saving')
    setBriefContext(current => ({ ...current, [key]: value }))
  }
  const toggleContext = (key, value) => updateContext(key, briefContext[key].includes(value) ? briefContext[key].filter(item => item !== value) : [...briefContext[key], value])
  const selectAndAdvance = (key, value) => {
    update(key, value)
    window.setTimeout(() => setStep(current => Math.min(TOTAL_STEPS, current + 1)), 180)
  }
  const addBriefFiles = fileList => {
    const incoming = Array.from(fileList || [])
    if (incoming.length) setSaveState('saving')
    setBriefFiles(current => {
      const known = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`))
      return [...current, ...incoming.filter(file => !known.has(`${file.name}-${file.size}-${file.lastModified}`))]
    })
  }

  const validationMessage = () => {
    if (step === 1 && data.title.trim().length < 5) return 'Add a title with at least 5 characters.'
    if (step === 2 && !data.category_id) return 'Choose a category.'
    if (step === 3 && !briefContext.deliverables.length) return 'Choose at least one deliverable.'
    if (step === 3 && briefContext.deliverables.includes('Other') && briefContext.deliverables_other.trim().length < 3) return 'Tell us what you need under Other.'
    if (step === 4 && !briefContext.promotion_or_goal.length) return 'Choose the main goal.'
    if (step === 5 && !briefContext.customer_profile.length) return 'Choose who this should speak to.'
    if (step === 11 && !data.pricing_mode) return 'Choose Budget or Pro creatives.'
    if (step === 12 && !data.deadline) return 'Choose a deadline.'
    if (step === 12 && new Date(`${data.deadline}T23:59:59`) <= new Date()) return 'Choose a future deadline.'
    return ''
  }

  const finalValidation = () => {
    if (data.title.trim().length < 5) return { step: 1, message: 'Add a title with at least 5 characters.' }
    if (!data.category_id) return { step: 2, message: 'Choose a category.' }
    if (!briefContext.deliverables.length) return { step: 3, message: 'Choose at least one deliverable.' }
    if (briefContext.deliverables.includes('Other') && briefContext.deliverables_other.trim().length < 3) return { step: 3, message: 'Tell us what you need under Other.' }
    if (!briefContext.promotion_or_goal.length) return { step: 4, message: 'Choose the main goal.' }
    if (!briefContext.customer_profile.length) return { step: 5, message: 'Choose who this should speak to.' }
    if (!data.pricing_mode) return { step: 11, message: 'Choose Budget or Pro creatives.' }
    if (!data.deadline || new Date(`${data.deadline}T23:59:59`) <= new Date()) return { step: 12, message: 'Choose a future deadline.' }
    return null
  }

  const handlePrimaryAction = async () => {
    if (isPending) return
    const error = validationMessage()
    if (error) return pushToast({ title: 'Complete this step', body: error, tone: 'amber' })
    if (step < TOTAL_STEPS) {
      setSaveState('saving')
      return setStep(current => current + 1)
    }
    const finalError = finalValidation()
    if (finalError) {
      setStep(finalError.step)
      return pushToast({ title: 'Finish your brief', body: finalError.message, tone: 'amber' })
    }
    mutate()
  }

  const leaveToJobs = async () => {
    if (!hasMeaningfulDraft) return navigate('/jobs')
    try {
      await saveDraftNow()
      navigate('/jobs')
    } catch {
      pushToast({ title: 'Draft could not be saved', body: 'Please try again before leaving this page.', tone: 'amber' })
    }
  }

  const otherInput = (key, placeholder) => briefContext[key].includes('Other') && (
    <input className="input" value={briefContext[`${key}_other`]} onChange={event => updateContext(`${key}_other`, event.target.value)} placeholder={placeholder} autoFocus style={{ marginTop: 14 }} />
  )
  const optionalStepIsEmpty = (
    (step === 6 && briefContext.style_references.length === 0) ||
    (step === 7 && briefContext.avoid.length === 0) ||
    (step === 8 && !data.description.trim()) ||
    (step === 9 && data.required_skills.length === 0) ||
    (step === 10 && briefFiles.length === 0)
  )

  if (isEditMode && isJobLoading) return <div className="card" style={{ padding: 28 }}><div className="skeleton" style={{ height: 180 }} /></div>

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <button className="btn link sm" onClick={leaveToJobs} style={{ padding: 0, color: 'var(--ink-500)' }}><Icon name="arrowLeft" size={12} /> All requests</button>
        <div className="row" style={{ gap: 12 }}>
          {draftId && (
            <span style={{ fontSize: 12, color: saveState === 'error' ? 'var(--amber-700)' : 'var(--ink-500)' }}>
              {saveState === 'saving' ? 'Saving draft...' : saveState === 'error' ? 'Draft not saved' : 'Draft saved'}
            </span>
          )}
          <span className="muted" style={{ fontSize: 12 }}>Step {step} of {TOTAL_STEPS}</span>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--paper-deep)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, background: 'var(--mint-500)', borderRadius: 8, transition: 'width .25s ease' }} />
      </div>

      <div className="card" style={{ padding: 'clamp(22px, 5vw, 46px)', minHeight: 440 }}>
        {step === 1 && <Question eyebrow="Let’s start simple" title="What should we call this project?" subtitle="A short working title helps everyone stay oriented."><input className="input" value={data.title} onChange={event => update('title', event.target.value)} placeholder="Diwali campaign hero video" autoFocus style={{ fontSize: 17, minHeight: 54 }} /></Question>}

        {step === 2 && <Question eyebrow="Project category" title="Which creative area is this closest to?" subtitle="Choose the closest match. We use this to find the right specialists."><ChoiceTiles options={categories.map(category => ({ value: category.id, ...category }))} selected={[data.category_id]} onToggle={value => selectAndAdvance('category_id', value)} renderOption={category => <><strong style={{ display: 'block', paddingRight: 25, fontSize: 15 }}>{category.name}</strong>{category.description && <span className="muted" style={{ display: 'block', marginTop: 5, fontSize: 12.5 }}>{category.description}</span>}</>} /></Question>}

        {step === 3 && <Question eyebrow="Deliverables" title="What would you like the creative to make?" subtitle="Choose everything that belongs in this project."><ChoiceTiles options={BRIEF_GUIDE_OPTIONS.deliverables} selected={briefContext.deliverables} onToggle={value => toggleContext('deliverables', value)} />{otherInput('deliverables', 'Describe the deliverable you need')}</Question>}

        {step === 4 && <Question eyebrow="The outcome" title="What is the main goal?" subtitle="This helps the creative make decisions that support your business."><ChoiceTiles options={BRIEF_GUIDE_OPTIONS.goals} selected={briefContext.promotion_or_goal} onToggle={value => toggleContext('promotion_or_goal', value)} />{otherInput('promotion_or_goal', 'Tell us the goal')}</Question>}

        {step === 5 && <Question eyebrow="Your audience" title="Who should this speak to?" subtitle="Choose the people you most want to reach."><ChoiceTiles options={BRIEF_GUIDE_OPTIONS.customers} selected={briefContext.customer_profile} onToggle={value => toggleContext('customer_profile', value)} />{otherInput('customer_profile', 'Describe your audience')}</Question>}

        {step === 6 && <Question eyebrow="Creative direction" title="Which styles feel right?" subtitle="Pick a few. You can also leave this blank and let the creative recommend a direction."><ChoiceTiles options={BRIEF_GUIDE_OPTIONS.styles} selected={briefContext.style_references} onToggle={value => toggleContext('style_references', value)} />{otherInput('style_references', 'Describe the style you have in mind')}</Question>}

        {step === 7 && <Question eyebrow="Guardrails" title="Anything the creative should avoid?" subtitle="Optional, but useful when your brand has clear boundaries."><ChoiceTiles options={BRIEF_GUIDE_OPTIONS.avoid} selected={briefContext.avoid} onToggle={value => toggleContext('avoid', value)} />{otherInput('avoid', 'Tell the creative what to avoid')}</Question>}

        {step === 8 && <Question eyebrow="A little more context" title="Anything else the creative should know?" subtitle="Add required wording, a reference link, important details, or leave this blank."><textarea className="textarea" rows={7} value={data.description} onChange={event => update('description', event.target.value)} placeholder="For example: the launch is on 24 October, the logo must stay visible, and the tone should feel warm rather than sales-heavy." autoFocus /></Question>}

        {step === 9 && <Question eyebrow="Creative signals" title="Which skills seem relevant?" subtitle="Choose what feels right. CREATYV uses this to route the request internally."><ChoiceTiles options={CREATIVE_SKILLS} selected={data.required_skills} onToggle={value => update('required_skills', data.required_skills.includes(value) ? data.required_skills.filter(item => item !== value) : [...data.required_skills, value])} /></Question>}

        {step === 10 && <Question eyebrow="References" title="Do you have anything useful to share?" subtitle="Optional. Drop everything in one place and Mintbox will organise it automatically.">
          <>
            <input ref={briefFileRef} type="file" multiple style={{ display: 'none' }} onChange={event => { addBriefFiles(event.target.files); event.target.value = '' }} />
            <div onClick={() => briefFileRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addBriefFiles(event.dataTransfer.files) }} style={{ minHeight: 190, border: '1.5px dashed var(--mint-500)', background: 'var(--mint-50)', borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center', padding: 24 }}>
              <div><Icon name="upload" size={24} /><strong style={{ display: 'block', marginTop: 10 }}>Drop files here or choose files</strong><span className="muted" style={{ display: 'block', marginTop: 5, fontSize: 12.5 }}>Images, videos, audio, documents and packages</span></div>
            </div>
            {isEditMode && <div className="card-mint">Previously uploaded references remain attached. You can add more here.</div>}
            {briefFiles.length > 0 && <div className="stack" style={{ gap: 7 }}>{briefFiles.map(file => <div key={`${file.name}-${file.size}-${file.lastModified}`} className="row between" style={{ padding: 10, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)' }}><span><Icon name="paperclip" size={11} /> {file.name}</span><button type="button" className="icon-btn" onClick={() => setBriefFiles(files => files.filter(item => item !== file))}><Icon name="x" size={11} /></button></div>)}</div>}
          </>
        </Question>}

        {step === 11 && <Question eyebrow="CREATYV production" title="What level of support fits this request?" subtitle="This helps CREATYV review scope and choose the right internal creative direction."><ChoiceTiles options={poolOptions} selected={[data.pricing_mode]} onToggle={value => selectAndAdvance('pricing_mode', value)} renderOption={option => { const range = option.value === 'expert' ? expertRange : budgetRange; return <><Icon name={option.icon} size={18} /><strong style={{ display: 'block', marginTop: 10, fontSize: 15 }}>{option.title}</strong><span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 12.5 }}>{option.subtitle}</span><span style={{ display: 'block', marginTop: 10, fontSize: 12.5, fontWeight: 600 }}>Typical effort range: {formatRange(range)}</span></> }} /></Question>}

        {step === 12 && <Question eyebrow="Timeline" title="When do you need the work?" subtitle="Choose a realistic final delivery date. CREATYV ops will confirm timing after review."><input className="input" type="date" min={minimumDeadline} value={data.deadline} onChange={event => update('deadline', event.target.value)} autoFocus style={{ maxWidth: 380, minHeight: 58, fontSize: 16 }} /></Question>}

        {step === 13 && <Question eyebrow="Ready for CREATYV review" title={data.title} subtitle="Review the essentials. You can go back to change anything before sending this request.">
          <div className="grid-2" style={{ gap: 12 }}>
            <div style={{ padding: 16, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}><div className="h-eyebrow">What you need</div><p style={{ lineHeight: 1.55 }}>{briefDescription}</p><div className="row wrap" style={{ gap: 6 }}>{data.required_skills.map(skill => <span key={skill} className="badge neutral">{skill}</span>)}</div></div>
            <div style={{ padding: 16, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}><div className="h-eyebrow">At a glance</div><div className="stack" style={{ gap: 10, marginTop: 12 }}><div className="row between"><span className="muted">Creative pool</span><strong>{selectedPool?.title}</strong></div><div className="row between"><span className="muted">Typical range</span><strong>{formatRange(selectedRange)}</strong></div><div className="row between"><span className="muted">Deadline</span><DateBadge value={data.deadline} /></div><div className="row between"><span className="muted">References</span><strong>{briefFiles.length}</strong></div></div></div>
          </div>
        </Question>}
      </div>

      <div className="row between" style={{ marginTop: 18, paddingBottom: 28 }}>
        <button className="btn ghost" onClick={() => {
          if (step > 1) {
            setSaveState('saving')
            setStep(current => current - 1)
          } else {
            leaveToJobs()
          }
        }}><Icon name="arrowLeft" /> {step > 1 ? 'Back' : 'Cancel'}</button>
        <button className="btn primary lg" onClick={handlePrimaryAction} disabled={isPending}>
          {isPending ? 'Sending...' : step === TOTAL_STEPS ? <>Send request <Icon name="arrowRight" /></> : <>{optionalStepIsEmpty ? 'Skip' : 'Continue'} <Icon name="arrowRight" /></>}
        </button>
      </div>
    </div>
  )
}
