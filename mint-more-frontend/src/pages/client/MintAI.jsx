import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { socialApi } from '../../api/social'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const TOOLS = [
  { value: 'text',         icon: 'type',       label: 'Write content',   desc: 'Blog posts, ad copy, emails' },
  { value: 'caption',      icon: 'chat',        label: 'Generate caption',desc: 'Social captions + hashtags' },
  { value: 'video_script', icon: 'video',       label: 'Video script',    desc: 'Reels, Shorts, ad scripts' },
  { value: 'repurpose',    icon: 'refresh',     label: 'Repurpose',       desc: 'One piece → 5 formats' },
  { value: 'image',        icon: 'image',       label: 'Generate image',  desc: 'Marketing graphics, thumbnails' },
  { value: 'video',        icon: 'radar',       label: 'Generate video',  desc: 'Text-to-video, image-to-video' },
]


const TRAFFIC_COLORS = {
  idle:     'var(--mint-500)',
  low:      'var(--mint-600)',
  moderate: '#F59E0B',
  busy:     '#F97316',
  high:     'var(--rose)',
}

const TIER_META = {
  free:     { label: 'FREE',     bg: 'rgba(247,127,0,0.1)',  color: 'var(--mint-700)' },
  standard: { label: 'Standard', bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
  premium:  { label: 'Premium',  bg: 'rgba(217,119,6,0.1)',   color: 'var(--amber)' },
}

function ModelPicker({ models, selected, onSelect, toolType }) {
  const [search, setSearch] = useState('')
  const compatible = models.filter(m =>
    m.supported_tools?.includes(toolType) &&
    (toolType !== 'video' || m.video_capabilities) &&
    m.is_active &&
    (search === '' || m.name.toLowerCase().includes(search.toLowerCase()) || m.provider_name?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Search models…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflow: 'auto' }}>
        {compatible.map(m => {
          const tier    = TIER_META[m.tier] || TIER_META.free
          const traffic = m.traffic_status || 'idle'
          const isSelected = selected?.id === m.id

          return (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '10px 12px', textAlign: 'left',
                background: isSelected ? 'var(--paper-tint)' : 'transparent',
                border: `1.5px solid ${isSelected ? 'var(--ink-950)' : 'var(--hairline)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: TRAFFIC_COLORS[traffic] || 'var(--ink-400)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-950)' }}>{m.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{m.provider_name}</div>
              </div>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: tier.bg, color: tier.color }}>
                  {tier.label}
                </span>
              </div>
            </button>
          )
        })}
        {compatible.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--ink-500)' }}>
            No models available for this tool type
          </div>
        )}
      </div>
    </div>
  )
}

function modelSubtitle(model) {
  if (!model) return 'Auto-selected for this request'
  if (model.tier === 'free') return 'Fast everyday help'
  if (model.tier === 'premium') return 'Highest quality output'
  return model.provider_name || 'All-round creative help'
}

function modelShortName(model) {
  if (!model) return 'Auto'
  return model.name
    ?.replace(/^openrouter\s*/i, '')
    ?.replace(/^google\s*/i, '')
    ?.replace(/^openai\s*/i, '')
    ?.split(/[/:]/)
    ?.pop()
    ?.replace(/-/g, ' ')
    ?.slice(0, 18) || 'Model'
}

function ToolMenu({ activeTool, onSelect }) {
  return (
    <div className="mint-ai-popover mint-ai-tool-menu">
      <div className="mint-ai-menu-label">Create with Mint AI</div>
      {TOOLS.map(tool => (
        <button
          key={tool.value}
          type="button"
          className={`mint-ai-menu-row ${activeTool === tool.value ? 'active' : ''}`}
          onClick={() => onSelect(tool.value)}
        >
          <span className="mint-ai-menu-icon"><Icon name={tool.icon} size={17} /></span>
          <span className="mint-ai-menu-copy">
            <span>{tool.label}</span>
            <small>{tool.desc}</small>
          </span>
          {activeTool === tool.value && <Icon name="check" size={16} />}
        </button>
      ))}
    </div>
  )
}

function ModelMenu({ models, selected, onSelect }) {
  return (
    <div className="mint-ai-popover mint-ai-model-menu">
      <div className="mint-ai-menu-label">Choose model</div>
      {models.map(model => {
        const tier = TIER_META[model.tier] || TIER_META.free
        const traffic = model.traffic_status || 'idle'
        const isSelected = selected?.id === model.id
        return (
          <button
            key={model.id}
            type="button"
            className={`mint-ai-menu-row ${isSelected ? 'active' : ''}`}
            onClick={() => onSelect(model)}
          >
            <span
              className="mint-ai-model-dot"
              style={{ background: TRAFFIC_COLORS[traffic] || 'var(--ink-400)' }}
            />
            <span className="mint-ai-menu-copy">
              <span>{model.name}</span>
              <small>{modelSubtitle(model)}</small>
            </span>
            <span className="mint-ai-tier-pill" style={{ background: tier.bg, color: tier.color }}>
              {tier.label}
            </span>
            {isSelected && <Icon name="check" size={16} />}
          </button>
        )
      })}
      {models.length === 0 && (
        <div className="mint-ai-empty-menu">No compatible models are active for this tool.</div>
      )}
      <div className="mint-ai-menu-divider" />
      <div className="mint-ai-thinking-row">
        <span>
          <strong>Thinking level</strong>
          <small>Standard</small>
        </span>
        <Icon name="chevronRight" size={16} />
      </div>
    </div>
  )
}

function resolveToolType(prompt, activeTool) {
  const value = prompt.toLowerCase()
  if (activeTool === 'text' && /\b(caption|captions|instagram caption|post caption|social caption)\b/.test(value)) {
    return 'caption'
  }
  if (activeTool === 'text' && /\b(script|reel script|video script|shorts script)\b/.test(value)) {
    return 'video_script'
  }
  return activeTool
}

function mediaKindFromMime(type = '') {
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

function stripAiText(text = '') {
  return text
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildMediaContext({ prompt, localFiles, mintboxFiles, mediaNote }) {
  const selected = [
    ...localFiles.map(file => ({
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      source: 'uploaded in this chat',
    })),
    ...mintboxFiles.map(file => ({
      name: file.original_name,
      type: file.mime_type || 'unknown',
      size: file.size_bytes,
      source: `Mintbox${file.job_title ? ` - ${file.job_title}` : ''}`,
      url: file.media_url,
    })),
  ]

  if (!selected.length && !mediaNote.trim()) return prompt

  const fileLines = selected.map((file, index) => {
    const size = file.size ? `, ${Math.round(Number(file.size) / 1024)} KB` : ''
    const url = file.url ? `, reference URL: ${file.url}` : ''
    return `${index + 1}. ${file.name} (${file.type}${size}) from ${file.source}${url}`
  })

  return `${prompt}

Media context for this request:
${fileLines.length ? fileLines.join('\n') : 'No files selected.'}
${mediaNote.trim() ? `User note about the media: ${mediaNote.trim()}` : ''}

Use the media context when writing. If the visual details are not clear from the file name or note, ask one short follow-up question instead of inventing details.`
}

function renderMarkdownInline(text, keyPrefix) {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const value = match[0]
    if (value.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{value.slice(2, -2)}</strong>)
    } else {
      const linkMatch = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      parts.push(
        <a key={`${keyPrefix}-link-${match.index}`} href={linkMatch?.[2]} target="_blank" rel="noreferrer">
          {linkMatch?.[1] || value}
        </a>,
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function MarkdownResult({ text }) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\s+\*\s+(?=(\*\*)?[A-Za-z0-9₹])/g, '\n* ')
    .replace(/\s+-\s+(?=(\*\*)?[A-Za-z0-9₹])/g, '\n- ')
    .trim()

  const blocks = []
  let listItems = []

  const flushList = key => {
    if (listItems.length) {
      blocks.push(
        <ul key={`list-${key}`}>
          {listItems.map((item, index) => (
            <li key={`item-${key}-${index}`}>{renderMarkdownInline(item, `item-${key}-${index}`)}</li>
          ))}
        </ul>,
      )
      listItems = []
    }
  }

  normalized.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      flushList(index)
      return
    }

    const bullet = line.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      listItems.push(bullet[1])
      return
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/)
    if (numbered) {
      listItems.push(numbered[1])
      return
    }

    flushList(index)
    blocks.push(<p key={`p-${index}`}>{renderMarkdownInline(line, `p-${index}`)}</p>)
  })

  flushList('end')

  return <div className="ai-markdown-result">{blocks}</div>
}

function GenerationResult({ generation, onCopy }) {
  if (!generation) return null
  const { status, result_text, result_url, error_message } = generation

  if (status === 'queued' || status === 'processing') {
    return (
      <div className="mint-ai-thinking">
        <div className="typing-dots">
          <span /><span /><span />
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-950)' }}>
          {status === 'queued' ? 'Queued…' : 'Generating…'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 6 }}>
          This may take a moment
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: 'var(--rose)', fontWeight: 500, marginBottom: 6 }}>Generation failed</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{error_message || 'No compatible provider completed this request.'}</div>
      </div>
    )
  }

  if (result_url) {
    const isVideo = result_url.match(/\.(mp4|webm|mov)/i)
    const isImage = result_url.match(/\.(jpg|jpeg|png|webp|gif)/i)
    return (
      <div>
        {isVideo ? (
          <video src={result_url} controls style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 400 }} />
        ) : isImage ? (
          <img src={result_url} alt="Generated" style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
        ) : (
          <a href={result_url} target="_blank" rel="noreferrer" className="btn ghost">
            <Icon name="download" /> Download result
          </a>
        )}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <a href={result_url} download className="btn primary">
            <Icon name="download" /> Download
          </a>
        </div>
      </div>
    )
  }

  if (result_text) {
    return (
      <div className="mint-ai-result">
        <div className="mint-ai-result-text" style={{
          padding: 18, background: 'var(--paper-tint)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
          fontSize: 14, lineHeight: 1.75, color: 'var(--ink-800)',
          maxHeight: 400, overflow: 'auto',
        }}>
          <MarkdownResult text={result_text} />
        </div>
        <button
          className="mint-ai-copy-button"
          onClick={() => { navigator.clipboard.writeText(result_text); onCopy() }}
        >
          <Icon name="copy" size={12} /> Copy
        </button>
      </div>
    )
  }

  return null
}

export default function MintAI() {
  const pushToast = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [activeTool,   setActiveTool]   = useState('text')
  const [selectedModelId,setSelectedModelId]= useState(null)
  const [prompt,       setPrompt]       = useState('')
  const [submittedPrompt,setSubmittedPrompt]= useState('')
  const [submittedTool, setSubmittedTool] = useState('text')
  const [localFiles, setLocalFiles] = useState([])
  const [mintboxFiles, setMintboxFiles] = useState([])
  const [mediaNote, setMediaNote] = useState('')
  const [showMintboxPicker, setShowMintboxPicker] = useState(false)
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [showModelMenu,setShowModelMenu]= useState(false)
  const [pollingId,    setPollingId]    = useState(null)
  const [result,       setResult]       = useState(null)
  const [videoDuration,setVideoDuration]= useState(null)
  const [videoAspect,  setVideoAspect]  = useState(null)
  const [videoResolution, setVideoResolution] = useState(null)

  const { data: modelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn:  () => aiApi.getModels().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)

useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth < 900)
  }

  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

  const { data: historyData } = useQuery({
    queryKey: ['ai-generations'],
    queryFn:  () => aiApi.getGenerations({ limit: 8 }).then(r => r.data.data),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
  })

  const { data: mediaLibraryData } = useQuery({
    queryKey: ['social-media-library'],
    queryFn: () => socialApi.getMediaLibrary().then(r => r.data.data),
  })

  const models   = useMemo(() => modelsData?.models || [], [modelsData?.models])
  const history  = useMemo(() => historyData?.generations || [], [historyData?.generations])
  const socialAccounts = useMemo(() => accountsData?.accounts || [], [accountsData?.accounts])
  const connectedAccounts = useMemo(() => socialAccounts.filter(account => account.is_active), [socialAccounts])
  const mintboxMediaLibrary = useMemo(() => mediaLibraryData?.media || [], [mediaLibraryData?.media])
  const allMedia = useMemo(() => [
    ...localFiles.map(file => ({ id: `local-${file.name}-${file.size}-${file.lastModified}`, name: file.name, type: file.type || 'unknown', source: 'Upload', kind: mediaKindFromMime(file.type), file })),
    ...mintboxFiles.map(file => ({ id: `mintbox-${file.id}`, name: file.original_name, type: file.mime_type || 'unknown', source: file.job_title || 'Mintbox', kind: file.media_type || mediaKindFromMime(file.mime_type), file })),
  ], [localFiles, mintboxFiles])
  const compatibleModels = useMemo(() => models.filter(m =>
    m.supported_tools?.includes(activeTool) &&
    m.is_active &&
    (activeTool !== 'video' || m.video_capabilities)
  ), [activeTool, models])
  const selectedModel = useMemo(() => (
    compatibleModels.find(model => model.id === selectedModelId) ||
    compatibleModels.find(model => model.tier === 'free') ||
    compatibleModels[0] ||
    null
  ), [compatibleModels, selectedModelId])
  const videoCapabilities = selectedModel?.video_capabilities || {}
  const effectiveVideoDuration = videoCapabilities.supported_durations?.includes(videoDuration)
    ? videoDuration
    : videoCapabilities.supported_durations?.[0] || null
  const effectiveVideoAspect = videoCapabilities.supported_aspect_ratios?.includes(videoAspect)
    ? videoAspect
    : videoCapabilities.supported_aspect_ratios?.[0] || null
  const effectiveVideoResolution = videoCapabilities.supported_resolutions?.includes(videoResolution)
    ? videoResolution
    : videoCapabilities.supported_resolutions?.[0] || null

  // Poll for generation result
  useEffect(() => {
    if (!pollingId) return
    const interval = setInterval(async () => {
      try {
        const res = await aiApi.getGeneration(pollingId)
        const gen = res.data.data.generation
        setResult(gen)
        if (['completed','failed'].includes(gen.status)) {
          clearInterval(interval)
          setPollingId(null)
          if (gen.status === 'completed') {
            pushToast({ title: 'Generation complete!', icon: 'check' })
          }
        }
      } catch { clearInterval(interval) }
    }, 2000)
    return () => clearInterval(interval)
  }, [pollingId, pushToast])

  const generateMutation = useMutation({
    mutationFn: ({ requestPrompt, requestTool, requestModel }) => aiApi.generate({
      model_id:   requestModel?.id,
      tool_type:  requestTool,
      prompt:     requestPrompt,
      parameters: requestTool === 'video'
        ? {
            duration: effectiveVideoDuration,
            aspect_ratio: effectiveVideoAspect,
            resolution: effectiveVideoResolution,
          }
        : {},
    }),
    onSuccess: (res) => {
      const gen = res.data.data
      setPollingId(gen.generation_id || gen.id)
      setResult({ status: 'queued' })
    },
    onError: err => {
      setResult({
        status: 'failed',
        error_message: err.response?.data?.message || 'Failed to start generation.',
      })
      pushToast({ title: 'Failed to start generation', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const caption = stripAiText(result?.result_text || '')
      const publishableMedia = allMedia.filter(item => ['image', 'video'].includes(item.kind))
      const firstMedia = publishableMedia[0]
      const contentType = firstMedia?.kind === 'video' ? 'video' : firstMedia?.kind === 'image' ? 'image' : 'text'
      const postRes = await socialApi.createPost({
        caption,
        hashtags: [],
        content_type: contentType,
        target_platforms: selectedPlatforms,
        publish_at: scheduleDate || undefined,
        metadata: {
          source: 'mint_ai',
          ai_generation_id: result?.id || result?.generation_id || null,
          media_note: mediaNote || null,
        },
      })
      const post = postRes.data.data.post

      for (const item of publishableMedia) {
        if (item.file instanceof File) {
          const fd = new FormData()
          fd.append('media', item.file)
          fd.append('media_type', item.kind === 'video' ? 'video' : 'image')
          await socialApi.addMedia(post.id, fd)
        } else if (item.file?.media_url) {
          await socialApi.addMedia(post.id, {
            media_items: [{
              media_url: item.file.media_url,
              media_type: item.file.media_type || item.kind,
              mime_type: item.file.mime_type,
              file_size_bytes: item.file.size_bytes,
            }],
          })
        }
      }

      await socialApi.publishPost(post.id)
      return post
    },
    onSuccess: () => {
      pushToast({ title: scheduleDate ? 'Post scheduled' : 'Post sent to publishing', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      setShowSchedulePanel(false)
      setScheduleDate('')
      setSelectedPlatforms([])
    },
    onError: err => pushToast({ title: 'Could not schedule post', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const requestTool = resolveToolType(prompt, activeTool)
  const requestModel = selectedModel?.supported_tools?.includes(requestTool)
    ? selectedModel
    : models.find(model =>
        model.supported_tools?.includes(requestTool) &&
        model.is_active &&
        (requestTool !== 'video' || model.video_capabilities)
      ) || selectedModel
  const currentTool = TOOLS.find(t => t.value === activeTool)
  const visibleTool = TOOLS.find(t => t.value === submittedTool) || currentTool
  const canGenerate = Boolean(
    !generateMutation.isPending &&
    requestModel &&
    requestModel.supported_tools?.includes(requestTool) &&
    (requestTool !== 'video' || requestModel.video_capabilities) &&
    prompt.trim() &&
    !pollingId
  )
  const canSchedule = Boolean(
    result?.status === 'completed' &&
    result?.result_text &&
    selectedPlatforms.length > 0 &&
    !scheduleMutation.isPending
  )

  const togglePlatform = platform => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(item => item !== platform) : [...prev, platform]
    )
  }

  const addLocalFiles = fileList => {
    const files = Array.from(fileList || [])
    const supported = files.filter(file =>
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type.startsWith('audio/') ||
      file.type === 'application/pdf' ||
      file.type.startsWith('text/')
    )
    if (supported.length !== files.length) {
      pushToast({ title: 'Some files were skipped', body: 'Use images, video, audio, PDF or text files as AI context.', tone: 'amber', icon: 'x' })
    }
    setLocalFiles(prev => [...prev, ...supported])
  }

  const toggleMintboxFile = file => {
    setMintboxFiles(prev =>
      prev.some(item => item.id === file.id)
        ? prev.filter(item => item.id !== file.id)
        : [...prev, file]
    )
  }

  const submitPrompt = () => {
    if (!canGenerate) return
    const cleanPrompt = prompt.trim()
    const promptWithContext = buildMediaContext({ prompt: cleanPrompt, localFiles, mintboxFiles, mediaNote })
    setSubmittedPrompt(cleanPrompt)
    setSubmittedTool(requestTool)
    setPrompt('')
    setResult({ status: 'queued' })
    setShowToolMenu(false)
    setShowModelMenu(false)
    setShowMintboxPicker(false)
    generateMutation.mutate({
      requestPrompt: promptWithContext,
      requestTool,
      requestModel,
    })
  }

  const handleSubmit = e => {
    e.preventDefault()
    submitPrompt()
  }

  return (
    <div className="mint-ai-shell">
      <section className="mint-ai-stage">
        <div className="mint-ai-thread">
          {result && (
            <>
              <div className="mint-ai-message user">
                <span>{submittedPrompt || 'Show this generation'}</span>
              </div>
              <div className="mint-ai-message assistant">
                <div className="mint-ai-message-head">
                  <span className="mint-ai-avatar"><Icon name="sparkles" size={15} /></span>
                  <div>
                    <strong>Mint AI</strong>
                    <small>{visibleTool?.label}</small>
                  </div>
                </div>
                <GenerationResult
                  generation={result}
                  onCopy={() => pushToast({ title: 'Copied to clipboard', icon: 'copy' })}
                />
                {result?.status === 'completed' && result?.result_text && (
                  <div className="mint-ai-post-actions">
                    <button
                      type="button"
                      className="mint-ai-copy-button"
                      onClick={() => setShowSchedulePanel(value => !value)}
                    >
                      <Icon name="calendar" size={13} /> Schedule as post
                    </button>
                    {showSchedulePanel && (
                      <div className="mint-ai-schedule-panel">
                        <div className="mint-ai-menu-label">Send to social</div>
                        <div className="mint-ai-platform-grid">
                          {connectedAccounts.map(account => (
                            <button
                              key={account.id}
                              type="button"
                              className={selectedPlatforms.includes(account.platform) ? 'active' : ''}
                              onClick={() => togglePlatform(account.platform)}
                            >
                              <span>{account.platform}</span>
                              <small>{account.account_name || account.external_username || 'Connected'}</small>
                            </button>
                          ))}
                          {connectedAccounts.length === 0 && (
                            <div className="mint-ai-empty-menu">Connect Facebook, Instagram, or YouTube from Insights first.</div>
                          )}
                        </div>
                        <label className="mint-ai-schedule-date">
                          <span>Schedule time</span>
                          <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={event => setScheduleDate(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="mint-ai-schedule-submit"
                          disabled={!canSchedule || connectedAccounts.length === 0}
                          onClick={() => scheduleMutation.mutate()}
                        >
                          <Icon name="send" size={14} />
                          {scheduleMutation.isPending ? 'Scheduling...' : scheduleDate ? 'Schedule post' : 'Publish now'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {!result && history.length > 0 && (
            <div className="mint-ai-history-strip">
              <div className="mint-ai-section-label">Recent generations</div>
              <div className="mint-ai-history-grid">
                {history.slice(0, isMobile ? 3 : 4).map(gen => (
                  <button
                    key={gen.id}
                    type="button"
                    onClick={() => {
                      setSubmittedPrompt(gen.prompt || '')
                      setSubmittedTool(gen.tool_type || 'text')
                      setResult(gen)
                    }}
                  >
                    <strong>{gen.tool_type?.replace('_', ' ')}</strong>
                    <span>{gen.prompt?.slice(0, 74)}{gen.prompt?.length > 74 ? '...' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <form className="mint-ai-composer-wrap" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.txt,.csv"
          style={{ display: 'none' }}
          onChange={event => {
            addLocalFiles(event.target.files)
            event.target.value = ''
          }}
        />

        {showToolMenu && (
          <ToolMenu
            activeTool={activeTool}
            onSelect={(tool) => {
              setActiveTool(tool)
              setResult(null)
              setPrompt('')
              setShowToolMenu(false)
            }}
          />
        )}

        {showModelMenu && (
          <ModelMenu
            models={compatibleModels}
            selected={selectedModel}
            onSelect={(model) => {
              setSelectedModelId(model.id)
              setShowModelMenu(false)
            }}
          />
        )}

        {showMintboxPicker && (
          <div className="mint-ai-popover mint-ai-mintbox-menu">
            <div className="mint-ai-menu-label">Use media from Mintbox</div>
            <div className="mint-ai-mintbox-list">
              {mintboxMediaLibrary.map(file => {
                const selected = mintboxFiles.some(item => item.id === file.id)
                return (
                  <button
                    key={file.id}
                    type="button"
                    className={selected ? 'active' : ''}
                    onClick={() => toggleMintboxFile(file)}
                  >
                    <span className="mint-ai-menu-icon"><Icon name={file.media_type === 'video' ? 'video' : 'image'} size={15} /></span>
                    <span className="mint-ai-menu-copy">
                      <span>{file.original_name}</span>
                      <small>{file.job_title || 'Mintbox'} - {file.mime_type}</small>
                    </span>
                    {selected && <Icon name="check" size={15} />}
                  </button>
                )
              })}
              {mintboxMediaLibrary.length === 0 && (
                <div className="mint-ai-empty-menu">No image or video files in Mintbox yet.</div>
              )}
            </div>
          </div>
        )}

        {activeTool === 'video' && selectedModel?.video_capabilities && (
          <div className="mint-ai-video-chips">
            {[
              ['Duration', selectedModel.video_capabilities.supported_durations, effectiveVideoDuration, setVideoDuration, value => `${value}s`],
              ['Aspect', selectedModel.video_capabilities.supported_aspect_ratios, effectiveVideoAspect, setVideoAspect, value => value],
              ['Quality', selectedModel.video_capabilities.supported_resolutions, effectiveVideoResolution, setVideoResolution, value => value],
            ].map(([label, options, selected, onSelect, format]) => options?.length > 0 && (
              <div key={label} className="mint-ai-chip-group">
                <span>{label}</span>
                {options.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={selected === option ? 'active' : ''}
                    onClick={() => onSelect(option)}
                  >
                    {format(option)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {(allMedia.length > 0 || mediaNote) && (
          <div className="mint-ai-context-tray">
            <div className="mint-ai-context-files">
              {allMedia.map(item => (
                <span key={item.id} className="mint-ai-context-chip">
                  <Icon name={item.kind === 'video' ? 'video' : item.kind === 'image' ? 'image' : 'paperclip'} size={12} />
                  {item.name}
                  <button
                    type="button"
                    onClick={() => {
                      if (item.file instanceof File) setLocalFiles(files => files.filter(file => `local-${file.name}-${file.size}-${file.lastModified}` !== item.id))
                      else setMintboxFiles(files => files.filter(file => `mintbox-${file.id}` !== item.id))
                    }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <textarea
          className="mint-ai-media-note"
          rows={1}
          value={mediaNote}
          onChange={event => setMediaNote(event.target.value)}
          placeholder="Optional: describe what is in the media so Mint AI has better context..."
        />

        <div className="mint-ai-composer">
          <button
            type="button"
            className="mint-ai-round-button"
            aria-label="Open AI tools"
            onClick={() => {
              setShowToolMenu(value => !value)
              setShowModelMenu(false)
              setShowMintboxPicker(false)
            }}
          >
            <Icon name={showToolMenu ? 'x' : 'plus'} size={22} />
          </button>

          <button
            type="button"
            className="mint-ai-round-button muted"
            aria-label="Upload media for context"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" size={19} />
          </button>

          <button
            type="button"
            className="mint-ai-round-button muted"
            aria-label="Pick media from Mintbox"
            onClick={() => {
              setShowMintboxPicker(value => !value)
              setShowToolMenu(false)
              setShowModelMenu(false)
            }}
          >
            <Icon name="layers" size={19} />
          </button>

          <textarea
            className="mint-ai-input"
            rows={1}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitPrompt()
              }
            }}
            placeholder={`Ask Mint AI to ${currentTool?.label?.toLowerCase() || 'help'}...`}
            onFocus={() => {
              setShowToolMenu(false)
              setShowModelMenu(false)
              setShowMintboxPicker(false)
            }}
          />

          <button
            type="button"
            className="mint-ai-model-pill"
            onClick={() => {
              setShowModelMenu(value => !value)
              setShowToolMenu(false)
              setShowMintboxPicker(false)
            }}
          >
            <span>{modelShortName(selectedModel)}</span>
            <Icon name="chevronDown" size={16} />
          </button>

          <button type="button" className="mint-ai-round-button muted" aria-label="Voice input coming soon">
            <Icon name="microphone" size={20} />
          </button>

          <button type="submit" className="mint-ai-send-button" disabled={!canGenerate} aria-label="Generate">
            <Icon name={pollingId ? 'sparkles' : 'send'} size={18} />
          </button>
        </div>
      </form>
    </div>
  )
}

