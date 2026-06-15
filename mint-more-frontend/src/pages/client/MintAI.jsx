import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { SkeletonCard } from '../../components/ui/Skeleton'

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
  free:     { label: 'FREE',     bg: 'rgba(16,185,129,0.1)',  color: 'var(--mint-700)' },
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
          whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto',
        }}>
          {result_text}
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
  const aiProgress = useUIStore(s => s.aiProgress)

  const [activeTool,   setActiveTool]   = useState('text')
  const [selectedModel,setSelectedModel]= useState(null)
  const [prompt,       setPrompt]       = useState('')
  const [showPicker,   setShowPicker]   = useState(false)
  const [lastGenId,    setLastGenId]    = useState(null)
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

  const { data: usageData } = useQuery({
    queryKey: ['ai-usage'],
    queryFn:  () => aiApi.getUsage().then(r => r.data.data),
  })

  const { data: historyData } = useQuery({
    queryKey: ['ai-generations'],
    queryFn:  () => aiApi.getGenerations({ limit: 8 }).then(r => r.data.data),
  })

  const models   = modelsData?.models || []
  const usage    = usageData?.usage || {}
  const history  = historyData?.generations || []
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

  // Auto-select first compatible model when tool changes
  useEffect(() => {
    const compatible = models.filter(m => m.supported_tools?.includes(activeTool) && m.is_active)
    if (compatible.length > 0 && !selectedModel) {
      const free = compatible.find(m => m.tier === 'free') || compatible[0]
      setSelectedModel(free)
    } else {
      setSelectedModel(null)
    }
  }, [activeTool, models.length])

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
  }, [pollingId])

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
      setLastGenId(gen.generation_id || gen.id)
      setPollingId(gen.generation_id || gen.id)
      setResult({ status: 'queued' })
    },
    onError: err => pushToast({ title: 'Failed to start generation', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const currentTool = TOOLS.find(t => t.value === activeTool)
  const rateMeta = usage.requests_remaining_this_hour ?? usage.rate_limit
  const rateLimitRaw =
    typeof rateMeta === 'object' && rateMeta !== null
      ? (rateMeta.remaining ?? rateMeta.limit ?? rateMeta.used ?? 0)
      : rateMeta
  const totalRateRaw =
    typeof usage.rate_limit === 'object' && usage.rate_limit !== null
      ? (usage.rate_limit.limit ?? usage.rate_limit.remaining ?? 20)
      : usage.rate_limit
  const rateLimit = Number.isFinite(Number(rateLimitRaw)) ? Number(rateLimitRaw) : 0
  const totalRate = Number.isFinite(Number(totalRateRaw)) ? Number(totalRateRaw) : 20

  return (
  <div className="stack-6">

    {/* Hero */}
    <div
      className="card reveal"
      style={{
        padding: isMobile ? 20 : 32,
      }}
    >
      <div className="h-eyebrow">Mint AI</div>

      <h1
        className="h-display h-1"
        style={{
          marginTop: 8,
          marginBottom: 8
        }}
      >
        Generate content
      </h1>

      <div style={{ color: 'var(--ink-500)' }}>
        Create text, captions, scripts, images and videos using AI.
      </div>
    </div>

    {/* Tools */}
    <div
      className="card reveal"
      style={{
        padding: 14
      }}
    >
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>
        Tool type
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          overflowX: isMobile ? 'auto' : 'visible',
          gap: 8
        }}
      >
        {TOOLS.map(tool => (
          <button
            key={tool.value}
            onClick={() => {
              setActiveTool(tool.value)
              setResult(null)
              setPrompt('')
            }}
            style={{
              minWidth: isMobile ? 180 : 'auto',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: '12px',
              textAlign: 'left',
              background:
                activeTool === tool.value
                  ? 'var(--ink-950)'
                  : 'transparent',
              color:
                activeTool === tool.value
                  ? 'white'
                  : 'var(--ink-700)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            <Icon name={tool.icon} size={14} />

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500
                }}
              >
                {tool.label}
              </div>

              <div
                style={{
                  fontSize: 11,
                  opacity: .7
                }}
              >
                {tool.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>

    {/* Main content */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          isMobile
            ? '1fr'
            : '1fr 280px',
        gap: 18
      }}
    >

      {/* Left */}
      <div className="stack" style={{ gap: 14 }}>

        {/* Model */}
        <div
          className="card"
          style={{ padding: 14 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 10
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink-500)'
                }}
              >
                Active model
              </div>

              <div
                style={{
                  fontWeight: 600
                }}
              >
                {selectedModel?.name || 'No model selected'}
              </div>
            </div>

            <button
              className="btn ghost"
              onClick={() => setShowPicker(!showPicker)}
            >
              Change model
            </button>
          </div>

          {showPicker && (
            <div style={{ marginTop: 14 }}>
              <ModelPicker
                models={models}
                selected={selectedModel}
                onSelect={(m) => {
                  setSelectedModel(m)
                  setShowPicker(false)
                }}
                toolType={activeTool}
              />
            </div>
          )}
        </div>

        {activeTool === 'video' && selectedModel?.video_capabilities && (
          <div className="card" style={{ padding: 16 }}>
            <div className="h-eyebrow" style={{ marginBottom: 14 }}>Video settings</div>
            {[
              ['Duration', selectedModel.video_capabilities.supported_durations, effectiveVideoDuration, setVideoDuration, value => `${value}s`],
              ['Aspect ratio', selectedModel.video_capabilities.supported_aspect_ratios, effectiveVideoAspect, setVideoAspect, value => value],
              ['Resolution', selectedModel.video_capabilities.supported_resolutions, effectiveVideoResolution, setVideoResolution, value => value],
            ].map(([label, options, selected, onSelect, format]) => options?.length > 0 && (
              <div key={label} style={{ marginBottom: 14 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>{label}</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {options.map(option => (
                    <button
                      key={option}
                      type="button"
                      className={`btn ${selected === option ? 'primary' : 'ghost'}`}
                      onClick={() => onSelect(option)}
                    >
                      {format(option)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prompt */}
        <div className="field">
          <label className="field-label">
            {currentTool?.label}
          </label>

          <textarea
            className="textarea"
            rows={isMobile ? 10 : 6}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your content..."
          />
        </div>

        {/* Generate */}
        <button
          className="btn primary block lg"
          onClick={() => generateMutation.mutate()}
          disabled={
            generateMutation.isPending ||
            !selectedModel ||
            !selectedModel.supported_tools?.includes(activeTool) ||
            (activeTool === 'video' && !selectedModel.video_capabilities) ||
            !prompt.trim() ||
            pollingId
          }
        >
          <Icon name="sparkles" />
          Generate
        </button>

        {/* Result */}
        {result && (
          <div
            className="card"
            style={{ padding: 20 }}
          >
            <div
              className="h-eyebrow"
              style={{ marginBottom: 14 }}
            >
              Result
            </div>

            <GenerationResult
              generation={result}
              onCopy={() =>
                pushToast({
                  title: 'Copied to clipboard',
                  icon: 'copy'
                })
              }
            />
          </div>
        )}
      </div>

      {/* Right */}
      <div>

        <div
          className="card"
          style={{ padding: 16 }}
        >
          <div
            className="h-eyebrow"
            style={{ marginBottom: 12 }}
          >
            Recent generations
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {history.map(gen => (
              <button
                key={gen.id}
                onClick={() => setResult(gen)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--hairline)',
                  background: 'var(--paper-tint)',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}
                >
                  {gen.tool_type?.replace('_', ' ')}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-500)',
                    marginTop: 4
                  }}
                >
                  {gen.prompt?.slice(0, 50)}...
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  </div>
)
}
