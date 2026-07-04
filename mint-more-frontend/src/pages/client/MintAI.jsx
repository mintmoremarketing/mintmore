import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
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
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div className="typing-dots" style={{ justifyContent: 'center', marginBottom: 14 }}>
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
      <div style={{ position: 'relative' }}>
        <div style={{
          padding: 18, background: 'var(--paper-tint)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
          fontSize: 14, lineHeight: 1.75, color: 'var(--ink-800)',
          maxHeight: 400, overflow: 'auto',
        }}>
          <MarkdownResult text={result_text} />
        </div>
        <button
          className="btn ghost"
          style={{ position: 'absolute', top: 10, right: 10, fontSize: 12 }}
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

  const [activeTool,   setActiveTool]   = useState('text')
  const [selectedModelId,setSelectedModelId]= useState(null)
  const [prompt,       setPrompt]       = useState('')
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

  const models   = useMemo(() => modelsData?.models || [], [modelsData?.models])
  const history  = useMemo(() => historyData?.generations || [], [historyData?.generations])
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
    mutationFn: () => aiApi.generate({
      model_id:   selectedModel?.id,
      tool_type:  activeTool,
      prompt,
      parameters: activeTool === 'video'
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
    onError: err => pushToast({ title: 'Failed to start generation', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const currentTool = TOOLS.find(t => t.value === activeTool)
  const canGenerate =
    !generateMutation.isPending &&
    selectedModel &&
    selectedModel.supported_tools?.includes(activeTool) &&
    (activeTool !== 'video' || selectedModel.video_capabilities) &&
    prompt.trim() &&
    !pollingId

  const handleSubmit = e => {
    e.preventDefault()
    if (!canGenerate) return
    setShowToolMenu(false)
    setShowModelMenu(false)
    generateMutation.mutate()
  }

  return (
    <div className="mint-ai-shell">
      <section className="mint-ai-stage">
        <div className="mint-ai-hero">
          <div className="mint-ai-orb"><Icon name="sparkles" size={22} /></div>
          <div className="h-eyebrow">Mint AI</div>
          <h1>What should we make today?</h1>
          <p>
            Draft captions, scripts, campaign ideas, visuals, and videos for your CREATYV workspace.
          </p>
        </div>

        <div className="mint-ai-thread">
          {result && (
            <>
              <div className="mint-ai-message user">
                <span>{prompt || 'Show this generation'}</span>
              </div>
              <div className="mint-ai-message assistant">
                <div className="mint-ai-message-head">
                  <span className="mint-ai-avatar"><Icon name="sparkles" size={15} /></span>
                  <div>
                    <strong>Mint AI</strong>
                    <small>{currentTool?.label}</small>
                  </div>
                </div>
                <GenerationResult
                  generation={result}
                  onCopy={() => pushToast({ title: 'Copied to clipboard', icon: 'copy' })}
                />
              </div>
            </>
          )}

          {!result && history.length > 0 && (
            <div className="mint-ai-history-strip">
              <div className="mint-ai-section-label">Recent generations</div>
              <div className="mint-ai-history-grid">
                {history.slice(0, isMobile ? 3 : 4).map(gen => (
                  <button key={gen.id} type="button" onClick={() => setResult(gen)}>
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

        <div className="mint-ai-composer">
          <button
            type="button"
            className="mint-ai-round-button"
            aria-label="Open AI tools"
            onClick={() => {
              setShowToolMenu(value => !value)
              setShowModelMenu(false)
            }}
          >
            <Icon name={showToolMenu ? 'x' : 'plus'} size={22} />
          </button>

          <textarea
            className="mint-ai-input"
            rows={1}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`Ask Mint AI to ${currentTool?.label?.toLowerCase() || 'help'}...`}
            onFocus={() => setShowToolMenu(false)}
          />

          <button
            type="button"
            className="mint-ai-model-pill"
            onClick={() => {
              setShowModelMenu(value => !value)
              setShowToolMenu(false)
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
