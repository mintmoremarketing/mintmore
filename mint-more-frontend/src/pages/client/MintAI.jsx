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
  const { status, result_text, result_url } = generation

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
        <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>Using failover model if available</div>
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

  const { data: modelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn:  () => aiApi.getModels().then(r => r.data.data),
    refetchInterval: 30_000,
  })

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
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Mint AI</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Generate content</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 18, alignItems: 'start' }}>

        {/* Left — tool selector */}
        <div className="card reveal" style={{ padding: 14 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Tool type</div>
          <div className="stack" style={{ gap: 4 }}>
            {TOOLS.map(tool => (
              <button
                key={tool.value}
                onClick={() => { setActiveTool(tool.value); setResult(null); setPrompt('') }}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '10px 12px', textAlign: 'left',
                  background: activeTool === tool.value ? 'var(--ink-950)' : 'transparent',
                  color:      activeTool === tool.value ? 'white' : 'var(--ink-700)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
              >
                <Icon name={tool.icon} size={14} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{tool.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Usage indicator */}
          <div style={{ marginTop: 20, padding: '10px 12px', background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>
              Requests this hour
            </div>
            <div style={{ height: 4, background: 'var(--hairline)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${(rateLimit / totalRate) * 100}%`,
                background: rateLimit < 5 ? 'var(--rose)' : 'var(--mint-500)',
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>
              {rateLimit}/{totalRate} remaining
            </div>
          </div>
        </div>

        {/* Centre — generate */}
        <div className="stack reveal" style={{ gap: 14 }}>

          {/* Model selector */}
          <div style={{
            padding: 14, background: 'var(--paper)',
            border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)',
          }}>
            <div className="row between" style={{ marginBottom: showPicker ? 14 : 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {selectedModel ? (
                  <>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: TRAFFIC_COLORS[selectedModel.traffic_status || 'idle'] }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedModel.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{selectedModel.provider_name}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Select an AI model</div>
                )}
              </div>
              <button
                className="btn ghost"
                style={{ fontSize: 12 }}
                onClick={() => setShowPicker(!showPicker)}
              >
                {showPicker ? 'Close' : 'Change model'} <Icon name={showPicker ? 'chevronDown' : 'chevronRight'} size={12} />
              </button>
            </div>
            {showPicker && (
              <ModelPicker
                models={models}
                selected={selectedModel}
                onSelect={(m) => { setSelectedModel(m); setShowPicker(false) }}
                toolType={activeTool}
              />
            )}
          </div>

          {/* Prompt */}
          <div className="field">
            <div className="row between" style={{ marginBottom: 6 }}>
              <label className="field-label">{currentTool?.label} prompt</label>
              <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{currentTool?.desc}</span>
            </div>
            <textarea
              className="textarea"
              rows={6}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                activeTool === 'text'         ? 'Write a 500-word blog post about sustainable fashion for Indian women aged 25-35…' :
                activeTool === 'caption'      ? 'Write an Instagram caption for a new collection of handloom sarees launching for Diwali…' :
                activeTool === 'video_script' ? 'Write a 60-second Reels script for a Diwali campaign for a handloom saree brand…' :
                activeTool === 'image'        ? 'A minimal product photo of a handwoven silk saree on a clean white background, studio lighting…' :
                activeTool === 'video'        ? 'A slow pan over a handloom weaving loom in Varanasi, golden morning light, cinematic…' :
                'Describe your content…'
              }
            />
          </div>

          {/* Generate button */}
          <button
            className="btn primary block lg"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !selectedModel || !prompt.trim() || pollingId}
          >
            {pollingId ? (
              <>
                <span className="typing-dots" style={{ marginLeft: -4 }}>
                  <span style={{ background: 'white' }} /><span style={{ background: 'white' }} /><span style={{ background: 'white' }} />
                </span>
                Generating…
              </>
            ) : (
              <><Icon name="sparkles" /> Generate with {selectedModel?.name || '—'}</>
            )}
          </button>

          {/* Result */}
          {result && (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div className="h-eyebrow" style={{ marginBottom: 14 }}>Result</div>
              <GenerationResult
                generation={result}
                onCopy={() => pushToast({ title: 'Copied to clipboard', icon: 'copy' })}
              />
            </div>
          )}
        </div>

        {/* Right — history */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="card reveal" style={{ padding: 16 }}>
            <div className="h-eyebrow" style={{ marginBottom: 12 }}>Recent generations</div>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-500)', textAlign: 'center', padding: '16px 0' }}>
                No generations yet
              </div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {history.map(gen => (
                  <button
                    key={gen.id}
                    onClick={() => setResult(gen)}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      padding: '10px 12px', textAlign: 'left',
                      background: 'var(--paper-tint)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      transition: 'all 0.1s',
                      width: '100%',
                    }}
                  >
                    <Icon
                      name={TOOLS.find(t => t.value === gen.tool_type)?.icon || 'sparkles'}
                      size={13}
                      style={{ color: 'var(--ink-500)', flexShrink: 0, marginTop: 1 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-800)', textTransform: 'capitalize' }}>
                        {gen.tool_type?.replace('_', ' ')}
                      </div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {gen.prompt?.slice(0, 40)}…
                      </div>
                    </div>
                    <span className={`badge ${gen.status === 'completed' ? 'mint' : gen.status === 'failed' ? 'rose' : 'neutral'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      <span className="bdot" />{gen.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}