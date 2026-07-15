import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { socialApi } from '../../api/social'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const MODALITIES = [
  { value: 'image', label: 'Image', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'video' },
  { value: 'chat', label: 'Chat', icon: 'chat' },
]

const ASPECT_RATIOS = [
  { value: 'Auto', label: 'Auto', icon: 'Auto' },
  { value: '1:1', label: '1:1 Square', icon: 'Sq' },
  { value: '21:9', label: '21:9 Ultrawide', icon: 'Wide' },
  { value: '8:1', label: '8:1 Panoramic', icon: 'Pan' },
  { value: '4:1', label: '4:1 Banner', icon: 'Ban' },
  { value: '16:9', label: '16:9 Widescreen', icon: 'Wide' },
  { value: '9:16', label: '9:16 Social story', icon: 'Story' },
  { value: '1:4', label: '1:4 Vertical banner', icon: 'Vert' },
  { value: '1:8', label: '1:8 Vertical panoramic', icon: 'Pan' },
  { value: '4:3', label: '4:3 Classic', icon: 'Classic' },
  { value: '4:5', label: '4:5 Social post', icon: 'Post' },
]

const FEATURE_OPTIONS = ['Refs', 'New', 'Beta', 'Unlimited']
const BEST_FOR_OPTIONS = ['social', 'ads', 'product', 'brand', 'editorial']

const sessionId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const groupBy = (items, keyFn) => items.reduce((acc, item) => {
  const key = keyFn(item) || 'Other'
  acc[key] = acc[key] || []
  acc[key].push(item)
  return acc
}, {})

const tierCost = (model, resolution) => {
  const tiers = model?.cost_summary?.tiers;
  if (Array.isArray(tiers)) {
    const tier = tiers.find(t => t.tier === resolution);
    if (!tier) return { unlimited: false, cost: 0 };
    return { unlimited: Boolean(tier.unlimited), cost: Number(tier.cost || 0) };
  }
  const tier = tiers?.[resolution]
  if (!tier) return { unlimited: false, cost: 0 }
  return { unlimited: Boolean(tier.unlimited), cost: Number(tier.cost || 0) }
}

const extractAliases = (value) =>
  Array.from(new Set((value.match(/@img\d+/g) || []).map(alias => alias.replace('@', ''))))

const modeToolType = (mode) => {
  if (mode === 'chat') return 'text'
  return mode || 'image'
}

const modeTitle = (mode) => {
  if (mode === 'video') return 'Video engine'
  if (mode === 'chat') return 'Mint AI chat'
  return 'Image engine'
}

const modePromptPlaceholder = (mode) => {
  if (mode === 'video') return 'Describe your video—try @ to add references'
  if (mode === 'chat') return 'Ask Mint AI anything about your business...'
  return 'Describe your image—try @ to add references'
}

const monthLabel = (value) => {
  const date = value ? new Date(value) : new Date()
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

const promptFor = (generation) =>
  generation?.enhanced_prompt || generation?.raw_prompt || generation?.prompt || ''

const parametersFor = (generation) => generation?.parameters || {}

const metadataFor = (generation) =>
  generation?.engine_metadata || parametersFor(generation).engine_metadata || generation?.result_metadata || {}

const imageUrlFor = (generation, progress) => progress?.result_url || generation?.result_url || ''

const generationResultText = (generation, progress) =>
  progress?.result_text || generation?.result_text || ''

const generationKind = (generation) => generation?.tool_type || 'image'

const isVideoGeneration = (generation) => generationKind(generation) === 'video'
const isTextGeneration = (generation) => generationKind(generation) === 'text'
const isImageGeneration = (generation) => generationKind(generation) === 'image'
const isPublishableGeneration = (generation) => isImageGeneration(generation) || isVideoGeneration(generation)

const generationDownloadName = (generation) => {
  const base = generation?.id || 'creatyv-generation'
  if (isVideoGeneration(generation)) return `${base}.mp4`
  if (isTextGeneration(generation)) return `${base}.txt`
  return `${base}.png`
}

const downloadGenerationAsset = (generation, progress) => {
  const url = imageUrlFor(generation, progress)
  if (url) {
    downloadFile(url, generationDownloadName(generation))
    return
  }

  const text = generationResultText(generation, progress) || promptFor(generation)
  if (!text) return

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = generationDownloadName(generation)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

const resolutionFor = (generation) =>
  generation?.resolution_tier || parametersFor(generation).resolution_tier || metadataFor(generation).resolution_tier || '1K'

const aspectFor = (generation) =>
  generation?.aspect_ratio || parametersFor(generation).aspect_ratio || metadataFor(generation).aspect_ratio || 'Auto'

const modelNameFor = (generation) =>
  generation?.model_name || generation?.name || generation?.provider_display_name || generation?.provider_name || 'Model'

const providerIconFor = (generation) =>
  generation?.icon_key?.slice(0, 2)?.toUpperCase() || generation?.provider_display_name?.slice(0, 2)?.toUpperCase() || 'AI'

const pixelSizeFor = (generation) => {
  if (isTextGeneration(generation)) return 'Text'
  const result = generation?.result_metadata || {}
  if (result.width && result.height) return `${result.width}x${result.height}`
  return aspectFor(generation)
}

const referencesFor = (generation) => {
  const metadata = metadataFor(generation)
  if (Array.isArray(metadata.references)) return metadata.references
  if (Array.isArray(generation?.reference_asset_ids)) {
    return generation.reference_asset_ids.map((id, index) => ({ id, alias: `img${index + 1}` }))
  }
  return []
}

const downloadFile = (url, name = 'creatyv-image') => {
  if (!url) return
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
  const proxyUrl = `${BASE}/public/proxy-download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  
  const link = document.createElement('a')
  link.href = proxyUrl
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`engine-toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span />
      {label && <b>{label}</b>}
    </button>
  )
}

function ModelRow({ model, selected, resolution, onSelect }) {
  const cost = tierCost(model, resolution)
  return (
    <button
      type="button"
      className={`engine-model-row${selected ? ' selected' : ''}`}
      onClick={() => onSelect(model)}
    >
      <span className="engine-provider-icon">{model.icon_key?.slice(0, 2)?.toUpperCase() || 'AI'}</span>
      <span className="engine-model-main">
        <strong>{model.name}</strong>
        <small>{model.provider_display_name || model.provider_name}</small>
      </span>
      <span className="engine-tags">
        {model.supports_refs && <em>Refs</em>}
        {model.is_beta && <em>Beta</em>}
        {model.tags?.includes?.('new') && <em>New</em>}
      </span>
      <span className="engine-latency">~{model.avg_latency_seconds || 8}s</span>
      <span className="engine-cost">{cost.unlimited ? '∞' : `${cost.cost || 0}`}</span>
    </button>
  )
}

function ModelSelector({ models, selected, onSelect, resolution, multiple, setMultiple, thinking, setThinking, googleSearch, setGoogleSearch }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('All')
  const [feature, setFeature] = useState('All')
  const [bestFor, setBestFor] = useState('All')
  const providers = useMemo(() => ['All', ...Object.keys(groupBy(models, m => m.provider_display_name || m.provider_name))], [models])

  const filtered = models.filter(model => {
    const text = `${model.name} ${model.provider_display_name || model.provider_name}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false
    if (provider !== 'All' && (model.provider_display_name || model.provider_name) !== provider) return false
    if (feature === 'Refs' && !model.supports_refs) return false
    if (feature === 'Beta' && !model.is_beta) return false
    if (feature === 'New' && !model.tags?.includes?.('new')) return false
    if (feature === 'Unlimited' && !tierCost(model, resolution).unlimited) return false
    if (bestFor !== 'All' && !model.best_for?.includes?.(bestFor)) return false
    return true
  })
  const grouped = groupBy(filtered, m => m.provider_display_name || m.provider_name)
  const featured = filtered.filter(model => model.is_trending || model.is_beta).slice(0, 4)
  const recent = filtered.slice(0, 3)

  return (
    <div className="engine-model-selector">
      <div
        className="engine-model-card"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setOpen(v => !v)
        }}
      >
        <span className="engine-provider-icon">{selected?.icon_key?.slice(0, 2)?.toUpperCase() || 'AI'}</span>
        <span>
          <small>Selected model</small>
          <strong>{selected?.name || 'Choose model'}</strong>
        </span>
        {selected?.supports_thinking_level && (
          <button
            type="button"
            className="icon-btn sm"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(open ? false : true)
            }}
          >
            <Icon name="settings" size={14} />
          </button>
        )}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} />
      </div>

      {open && (
        <div className="engine-model-dropdown">
          <div className="engine-search">
            <Icon name="search" size={14} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search models..." />
          </div>
          <div className="engine-filter-row">
            <select value={provider} onChange={event => setProvider(event.target.value)}>
              {providers.map(item => <option key={item}>{item}</option>)}
            </select>
            <select value={feature} onChange={event => setFeature(event.target.value)}>
              {['All', ...FEATURE_OPTIONS].map(item => <option key={item}>{item}</option>)}
            </select>
            <select value={bestFor} onChange={event => setBestFor(event.target.value)}>
              {['All', ...BEST_FOR_OPTIONS].map(item => <option key={item}>{item}</option>)}
            </select>
            <label className="engine-multiple">
              <Toggle checked={multiple} onChange={setMultiple} />
              Multiple
            </label>
          </div>

          {selected?.supports_thinking_level && (
            <div className="engine-thinking-panel">
              <span>Thinking level</span>
              <div className="segmented compact">
                {['Fast', 'High'].map(item => (
                  <button key={item} className={thinking === item.toLowerCase() ? 'active' : ''} onClick={() => setThinking(item.toLowerCase())}>{item}</button>
                ))}
              </div>
              {selected?.supports_google_search && (
                <label className="engine-multiple">
                  <Toggle checked={googleSearch} onChange={setGoogleSearch} />
                  Use Google Search
                </label>
              )}
            </div>
          )}

          <section>
            <h4>Featured</h4>
            {featured.length ? featured.map(model => (
              <ModelRow key={`featured-${model.id}`} model={model} selected={selected?.id === model.id} resolution={resolution} onSelect={(m) => { onSelect(m); setOpen(false) }} />
            )) : <p className="muted">No featured models match these filters.</p>}
          </section>
          <section>
            <h4>Recent</h4>
            {recent.map(model => (
              <ModelRow key={`recent-${model.id}`} model={model} selected={selected?.id === model.id} resolution={resolution} onSelect={(m) => { onSelect(m); setOpen(false) }} />
            ))}
          </section>
          <section>
            <h4>All Models</h4>
            {Object.entries(grouped).map(([name, list]) => (
              <details key={name} open>
                <summary>{name}<span>{list.length}</span></summary>
                {list.map(model => (
                  <ModelRow key={model.id} model={model} selected={selected?.id === model.id} resolution={resolution} onSelect={(m) => { onSelect(m); setOpen(false) }} />
                ))}
              </details>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function ReferencesBlock({ styles, selectedStyle, setSelectedStyle, references, uploadReference, uploading }) {
  const [styleOpen, setStyleOpen] = useState(false)
  const fileRef = useRef(null)

  return (
    <section className="engine-block">
      <div className="engine-label">References</div>
      <div className="engine-reference-row">
        <button type="button" className={`engine-ref-button${selectedStyle ? ' selected' : ''}`} onClick={() => setStyleOpen(v => !v)}>
          <Icon name="star" size={14} />
          {selectedStyle?.name || 'Style'}
        </button>
        <button
          type="button"
          className="engine-ref-button"
          disabled={uploading || references.length >= 4}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="plus" size={14} />
          Add
        </button>
        {references.map(ref => (
          <span key={ref.id} className="engine-ref-chip">
            <img src={ref.preview_url} alt="" />
            {ref.alias}
          </span>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) uploadReference(file)
            event.target.value = ''
          }}
        />
      </div>
      {styleOpen && (
        <div className="engine-style-popover">
          {styles.map(style => (
            <button
              key={style.id}
              type="button"
              className={selectedStyle?.id === style.id ? 'selected' : ''}
              onClick={() => {
                setSelectedStyle(style)
                setStyleOpen(false)
              }}
            >
              <img src={style.thumbnail_url} alt="" />
              <span>{style.name}</span>
              {selectedStyle?.id === style.id && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function PromptBox({
  value,
  setValue,
  references,
  aiPrompt,
  setAiPrompt,
  fixedSeed,
  setFixedSeed,
  seed,
  setSeed,
  mode = 'image',
}) {
  const [showEditor, setShowEditor] = useState(false)
  const showRefs = value.endsWith('@') && references.length > 0

  const insertAlias = (alias) => {
    setValue(current => `${current.slice(0, -1)}@${alias} `)
  }

  return (
    <section className="engine-prompt-wrap">
      <div className="engine-token-layer">
        {extractAliases(value).map(alias => {
          const ref = references.find(item => item.alias === alias)
          if (!ref) return null
          return (
            <span key={alias} className="engine-inline-token">
              <img src={ref.preview_url} alt="" />
              {alias}
              <Icon name="chevronDown" size={10} />
            </span>
          )
        })}
      </div>
      <textarea
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={modePromptPlaceholder(mode)}
        rows={7}
      />
      {showRefs && (
        <div className="engine-ref-autocomplete">
          {references.map(ref => (
            <button key={ref.id} type="button" onClick={() => insertAlias(ref.alias)}>

              <img src={ref.preview_url} alt="" />
              <span>{ref.alias}</span>
            </button>
          ))}
        </div>
      )}
      <div className="engine-prompt-options">
        <div className="engine-prompt-option">
          <Toggle checked={aiPrompt} onChange={setAiPrompt} />
          <span>AI prompt</span>
        </div>
      </div>
      {showEditor && (
        <div className="modal-backdrop creation-modal-backdrop" onClick={() => setShowEditor(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="row between">
              <h3>Prompt editor</h3>
              <button className="icon-btn" onClick={() => setShowEditor(false)}><Icon name="x" size={14} /></button>
            </div>
            <textarea className="textarea" rows={12} value={value} onChange={event => setValue(event.target.value)} />
          </div>
        </div>
      )}
    </section>
  )
}

function ChatWorkspace({
  prompt,
  setPrompt,
  onSend,
  sending,
  models,
  selectedModel,
  setSelectedModel,
  modelsLoading,
  balance,
  cost,
  unlimited,
  quickPrompts = [],
  generations = [],
  progressMap = {},
  activeMode,
  setActiveMode,
}) {
  const thread = useMemo(
    () => [...generations].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [generations]
  )

  const chatEndRef = useRef(null)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [thread, sending])

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (!prompt.trim() || !selectedModel || modelsLoading || sending) return
    onSend()
  }

  return (
    <section className="engine-chat-shell h-full flex flex-col max-h-full">
      <div className="flex items-center justify-between shrink-0 mb-4 px-2">
        <h2 className="text-lg md:text-xl font-bold m-0 flex items-center gap-2">
          Mint AI chat
        </h2>
        <div className="engine-chat-meta">
          <span className="engine-chat-credit">{unlimited ? '∞ Unlimited' : `Uses ${cost} MintCoins • ${Math.max(0, balance - cost)} remaining`}</span>
        </div>
      </div>

      <div className="chat-stream flex-1 overflow-y-auto custom-scrollbar px-2">
        {thread.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 fade-in">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-mint-400 to-mint-600 flex items-center justify-center shadow-lg mb-6 text-white">
              <Icon name="mint_ai" size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink-950 mb-2 tracking-tight">How can Mint AI help today?</h2>
            <p className="text-ink-500 mb-10 max-w-md">I can write captions, brainstorm ideas, draft ad copy, or generate stunning visuals.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {quickPrompts.map(item => (
                <button 
                  key={item} 
                  type="button" 
                  onClick={() => setPrompt(item)}
                  className="p-4 text-left border border-ink-200 rounded-2xl hover:border-mint-300 hover:bg-mint-50/50 transition-colors text-sm font-medium text-ink-700 bg-white shadow-sm"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : thread.map((generation) => {
          const progress = progressMap?.[generation.id]
          const status = progress?.status || generation.status
          const pending = ['queued', 'processing', 'pending'].includes(status)
          const failed = status === 'failed'
          const userText = generation.raw_prompt || generation.prompt || 'Message'
          const assistantText = generationResultText(generation, progress) || 'Thinking...'
          return (
            <div key={generation.id} className="flex flex-col mb-2 fade-in">
              {/* User Bubble */}
              <div className="flex justify-end mb-6">
                <div className="bg-ink-100 text-ink-900 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[70%] text-[15px] leading-relaxed">
                  {userText}
                </div>
              </div>
              
              {/* AI Document Style Response */}
              {pending ? (
                <div className="flex gap-4 mb-8">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-mint-400 to-mint-600 flex items-center justify-center shadow-sm text-white mt-1">
                    <Icon name="mint_ai" size={16} />
                  </div>
                  <div className="flex-1 text-ink-500 text-[15px] leading-relaxed pt-1 animate-pulse">
                    Working on it...
                  </div>
                </div>
              ) : failed ? (
                <div className="flex gap-4 mb-8">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-sm text-white mt-1">
                    <Icon name="x" size={16} />
                  </div>
                  <div className="flex-1 text-amber-600 font-medium text-[15px] leading-relaxed pt-1">
                    {progress?.error || generation.error_message || 'That request failed.'}
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 mb-8 group">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-mint-400 to-mint-600 flex items-center justify-center shadow-sm text-white mt-1">
                    <Icon name="mint_ai" size={16} />
                  </div>
                  <div className="flex-1 text-ink-900 text-[15px] leading-[1.7] pt-1">
                    {generation.result_url ? (
                      <img src={generation.result_url} alt="Generated" className="max-w-full rounded-lg shadow-sm border border-ink-100" />
                    ) : (
                      assistantText
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {sending && (
          <div className="flex gap-4 mb-8">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-mint-400 to-mint-600 flex items-center justify-center shadow-sm text-white mt-1 animate-pulse">
              <Icon name="mint_ai" size={16} />
            </div>
            <div className="flex-1 text-ink-500 text-[15px] leading-relaxed pt-1 animate-pulse">
              Mint AI is thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex flex-col gap-2 shrink-0 max-w-4xl mx-auto w-full mt-2 relative">
        <div className="flex justify-center gap-2 mb-1">
          <button 
            type="button" 
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeMode === 'chat' ? 'bg-mint-50 text-mint-700' : 'bg-transparent text-ink-500 hover:bg-ink-100'}`}
            onClick={() => setActiveMode('chat')}
          >
            <Icon name="messageSquare" size={14} /> Text
          </button>
          <button 
            type="button" 
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeMode === 'image' ? 'bg-mint-50 text-mint-700' : 'bg-transparent text-ink-500 hover:bg-ink-100'}`}
            onClick={() => setActiveMode('image')}
          >
            <Icon name="image" size={14} /> Photo
          </button>
          <button 
            type="button" 
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeMode === 'video' ? 'bg-mint-50 text-mint-700' : 'bg-transparent text-ink-500 hover:bg-ink-100'}`}
            onClick={() => setActiveMode('video')}
          >
            <Icon name="video" size={14} /> Video
          </button>
        </div>
        
        <div className="flex items-end gap-2 bg-white rounded-3xl p-2 pl-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-ink-200 focus-within:border-mint-300 focus-within:ring-4 focus-within:ring-mint-100/50 transition-all">
          <button type="button" className="p-2 mb-0.5 text-ink-400 hover:text-ink-600 transition-colors shrink-0" title="Attach media">
            <Icon name="paperclip" size={20} />
          </button>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Mint AI anything about your business..."
            rows={Math.min(6, Math.max(1, prompt.split('\n').length))}
            className="flex-1 resize-none bg-transparent outline-none py-3 px-2 text-ink-900 custom-scrollbar text-[15px] max-h-[200px]"
          />
          <button
            type="button"
            className={`w-10 h-10 mb-0.5 shrink-0 rounded-full transition-colors flex items-center justify-center ${!prompt.trim() || !selectedModel || modelsLoading || sending ? 'bg-ink-100 text-ink-400' : 'bg-ink-950 text-white hover:bg-black shadow-md'}`}
            disabled={!prompt.trim() || !selectedModel || modelsLoading || sending}
            onClick={onSend}
            title="Send message"
          >
            <Icon name="send" size={18} className="ml-0.5" />
          </button>
        </div>
        <div className="text-center text-xs text-ink-400 font-medium mt-1">
          {sending ? 'Generating response...' : 'Mint AI can make mistakes. Check important info.'}
        </div>
      </div>
    </section>
  )
}

function PublishPostModal({ generation, accounts = [], onClose, onPublish, publishing }) {
  const [caption, setCaption] = useState('')
  const [shareParams, setShareParams] = useState(false)
  const [tags, setTags] = useState('')
  const [destinationPlatforms, setDestinationPlatforms] = useState([])
  const url = imageUrlFor(generation)
  const canPublishGallery = isPublishableGeneration(generation)
  const canPublishSocial = destinationPlatforms.length > 0
  const canPublish = canPublishGallery || canPublishSocial
  const isVideo = isVideoGeneration(generation)
  const isText = isTextGeneration(generation)
  const previewText = generationResultText(generation) || promptFor(generation)
  const connectedPlatforms = useMemo(() => {
    const seen = new Set()
    return (accounts || [])
      .filter(account => account.is_active)
      .filter((account) => {
        if (seen.has(account.platform)) return false
        seen.add(account.platform)
        return true
      })
  }, [accounts])

  useEffect(() => {
    if (!connectedPlatforms.length) {
      setDestinationPlatforms([])
      return
    }
    setDestinationPlatforms((current) => current.filter(platform => connectedPlatforms.some(account => account.platform === platform)))
  }, [connectedPlatforms])

  const toggleDestination = (platform) => {
    setDestinationPlatforms((current) =>
      current.includes(platform)
        ? current.filter(item => item !== platform)
        : [...current, platform]
    )
  }

  return (
    <div className="modal-backdrop creation-modal-backdrop" onClick={onClose}>
      <div className="creation-publish-modal" onClick={event => event.stopPropagation()}>
        <div className="creation-publish-preview">
          {isVideo ? (
            url ? <video src={url} controls playsInline className="creation-video-preview" /> : <div className="creation-empty-preview"><Icon name="video" size={28} /></div>
          ) : isText ? (
            <div className="creation-text-preview">
              <Icon name="chat" size={26} />
              <p>{previewText || 'Text generations can be published once the publishing flow supports them.'}</p>
            </div>
          ) : url ? <img src={url} alt="" /> : <div className="creation-empty-preview"><Icon name="image" size={28} /></div>}
        </div>
        <div className="creation-publish-form">
          <div className="row between">
            <div>
              <p className="eyebrow">Publish as post</p>
              <h3>Publish this {isVideo ? 'video' : isText ? 'post' : 'image'}</h3>
            </div>
            <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          {!canPublishGallery && isText && !canPublishSocial && (
            <p className="creation-note">
              Text generations need at least one social destination selected. Choose Facebook, Instagram, or YouTube below to publish the response.
            </p>
          )}
          <div className="creation-destination-block">
            <div className="row between" style={{ marginBottom: 10 }}>
              <strong>Where should we publish?</strong>
              <small className="muted">Leave all channels off to save only to Mint AI Published.</small>
            </div>
            {connectedPlatforms.length === 0 ? (
              <div className="creation-note">No connected Facebook, Instagram, or YouTube accounts were found.</div>
            ) : (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {connectedPlatforms.map((account) => {
                  const meta = {
                    facebook: { label: 'Facebook', icon: 'facebook', color: '#1877F2' },
                    instagram: { label: 'Instagram', icon: 'instagram', color: '#E1306C' },
                    youtube: { label: 'YouTube', icon: 'youtube', color: '#FF0000' },
                  }[account.platform] || {}
                  const selected = destinationPlatforms.includes(account.platform)
                  return (
                    <button
                      key={account.platform}
                      type="button"
                      className={`badge ${selected ? 'mint' : 'neutral'}`}
                      style={{ padding: '8px 12px', cursor: 'pointer', border: 'none' }}
                      onClick={() => toggleDestination(account.platform)}
                    >
                      <Icon name={meta.icon} size={12} style={{ color: meta.color }} />
                      {account.page_name || account.platform_name || meta.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <label>
            Caption
            <textarea rows={6} value={caption} onChange={event => setCaption(event.target.value)} placeholder="Write a caption..." />
          </label>
          <label className="creation-inline-setting">
            <span>
              <strong>Share generation parameters?</strong>
              <small>When on, this draft keeps a public reference to prompt, model, and settings.</small>
            </span>
            <Toggle checked={shareParams} onChange={setShareParams} />
          </label>
          <label>
            Tags
            <input value={tags} onChange={event => setTags(event.target.value)} placeholder="launch, festival, product" />
          </label>
          <div className="row end gap">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn dark"
              disabled={publishing || !canPublish}
              onClick={() => onPublish({
                caption,
                share_generation_parameters: shareParams,
                tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
                destination_platforms: destinationPlatforms,
              })}
            >
              Publish {destinationPlatforms.length ? 'and share' : 'Post'}
            </button>
          </div>
            <p className="creation-note">
              This saves the generation to Mint AI Published, and shares it to the selected channels if you chose any.
            </p>
        </div>
      </div>
    </div>
  )
}

function CreationInspector({ generation, progress, onClose, onFavorite, onDelete, onPublish, onReuse, onEditImage }) {
  const [tab, setTab] = useState('details')
  const [zoom, setZoom] = useState(100)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = imageUrlFor(generation, progress)
  const textResult = generationResultText(generation, progress)
  const isVideo = isVideoGeneration(generation)
  const isText = isTextGeneration(generation)
  const isImage = isImageGeneration(generation)
  const prompt = promptFor(generation)
  const references = referencesFor(generation)

  const copyPrompt = async () => {
    await navigator.clipboard?.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="modal-backdrop creation-modal-backdrop" onClick={onClose}>
      <div className="creation-inspector" onClick={event => event.stopPropagation()}>
        <header className="creation-inspector-tabs">
          <div className="segmented compact">
            {['details', 'comments'].map(item => (
              <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
                {item === 'details' ? 'Details' : 'Comments'}
              </button>
            ))}
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={14} /></button>
        </header>
        <div className="creation-inspector-body">
          <section className="creation-preview-pane">
            {isVideo ? (
              url ? <video src={url} controls playsInline className="creation-video-preview" /> : <div className="creation-empty-preview"><Icon name="video" size={30} /></div>
            ) : isText ? (
              <div className="creation-text-preview">
                <Icon name="chat" size={28} />
                <p>{textResult || prompt || 'Text generation result will appear here.'}</p>
              </div>
            ) : url ? (
              <img src={url} alt="" style={{ transform: `scale(${zoom / 100})` }} />
            ) : (
              <div className="creation-empty-preview"><Icon name="image" size={30} /></div>
            )}
            {!isVideo && !isText && (
              <label className="creation-zoom">
                <span>{zoom}%</span>
                <input type="range" min="50" max="200" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
              </label>
            )}
          </section>
          <aside className="creation-details-pane">
            <div className="creation-action-row">
              <button className="icon-btn" type="button" onClick={() => onDelete(generation.id)}><Icon name="trash" size={15} /></button>
              <button className={`icon-btn${generation.is_favorite ? ' active' : ''}`} type="button" onClick={() => onFavorite(generation)}><Icon name="heart" size={15} /></button>
              <button className="icon-btn" type="button" title="Save to collection coming soon"><Icon name="bookmark" size={15} /></button>
              <div className="creation-download-menu">
                <button className="btn ghost" type="button" onClick={() => setDownloadOpen(v => !v)}>{isVideo ? 'MP4' : isText ? 'TXT' : 'PNG'} <Icon name="chevronDown" size={12} /></button>
                {downloadOpen && (
                  <div>
                    {isText ? (
                      <>
                        <button type="button" onClick={() => downloadGenerationAsset(generation, progress)}>TXT</button>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(textResult || prompt || '')}>Copy text</button>
                      </>
                    ) : isVideo ? (
                      <>
                        <button type="button" onClick={() => downloadGenerationAsset(generation, progress)}>MP4</button>
                        <button type="button" disabled>GIF</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => downloadGenerationAsset(generation, progress)}>PNG</button>
                        <button type="button" onClick={() => downloadGenerationAsset(generation, progress)}>JPG</button>
                        <button type="button" disabled>SVG</button>
                        <button type="button" onClick={() => alert('Upscale is coming soon.')}>Upscale</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {tab === 'comments' ? (
              <div className="creation-comments-placeholder">Comments are coming soon.</div>
            ) : (
              <>
                <button type="button" className="creation-prompt-block" onClick={copyPrompt}>
                  <span>{generation.enhanced_prompt ? 'AI-enhanced prompt' : 'Raw prompt'}</span>
                  <p>{prompt || 'No prompt stored.'}</p>
                  <small>{copied ? 'Copied' : 'Click to copy'}</small>
                </button>
                <div className="creation-settings-tags">
                  <span>{isVideo ? 'Video' : isText ? 'Chat' : 'Image'}</span>
                  <span>{aspectFor(generation)}</span>
                  <span>{modelNameFor(generation)}</span>
                  {generation.thinking_level && <span>{generation.thinking_level}</span>}
                  <span>{pixelSizeFor(generation)}</span>
                </div>
                <div className="creation-reference-row">
                  <strong>References</strong>
                  {references.length ? references.map((ref, index) => (
                    <span key={ref.id || ref.alias || index} className="creation-reference-thumb">
                      {ref.preview_url ? <img src={ref.preview_url} alt="" /> : <Icon name="image" size={14} />}
                      <small>{ref.alias || `img${index + 1}`}</small>
                      {ref.preview_url && <button type="button" onClick={() => downloadFile(ref.preview_url, ref.alias || 'reference')}><Icon name="download" size={12} /></button>}
                    </span>
                  )) : <small>No references used.</small>}
                </div>
                <div className="creation-inspector-actions">
                  <button type="button" className="btn dark" onClick={() => onPublish(generation)}>{isImage ? 'Publish Image' : isVideo ? 'Publish Video' : 'Publish Post'}</button>
                  <button type="button" className="btn ghost" disabled={!isImage} onClick={() => onEditImage(generation)}>{isImage ? 'Edit Image' : 'Image only'}</button>
                  <button type="button" className="btn ghost" onClick={() => alert(isVideo ? 'Video editing is coming soon.' : 'Create Video is coming soon.')}>Create Video</button>
                  <button type="button" className="btn ghost" onClick={() => alert('Save as Template is coming soon.')}>Save as Template</button>
                  <button type="button" className="btn ghost" onClick={() => alert('Share is coming soon.')}>Share</button>
                  <button type="button" className="btn ghost" onClick={() => onReuse(generation)}>Reuse Configuration</button>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function CreationCard({
  generation,
  progress,
  selected,
  onSelect,
  onOpen,
  onFavorite,
  onDelete,
  onDownload,
  onReuse,
  onPublish,
  viewMode,
  ratioMode,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = progress?.status || generation.status
  const url = imageUrlFor(generation, progress)
  const textResult = generationResultText(generation, progress)
  const isVideo = isVideoGeneration(generation)
  const isText = isTextGeneration(generation)
  const loading = ['queued', 'processing', 'pending'].includes(status)
  const failed = status === 'failed'
  const error = progress?.error || generation.error_message

  return (
    <article
      className={`creation-card ${viewMode} ${ratioMode === 'square' ? 'square' : ''} ${loading ? 'loading' : ''} ${failed ? 'failed' : ''}`}
      onClick={() => onOpen(generation)}
    >
      <button
        type="button"
        className={`creation-select${selected ? ' selected' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(generation.id)
        }}
        aria-label="Select generation"
      >
        {selected && <Icon name="check" size={12} />}
      </button>
      {loading ? (
        <div className="creation-skeleton">
          <Icon name="sparkles" size={18} />
          <span>{status === 'processing' ? 'Generating...' : 'Queued...'}</span>
        </div>
      ) : failed ? (
        <div className="creation-failed">
          <Icon name="x" size={16} />
          <strong>Generation failed</strong>
          <small>{error || 'No error reason was returned.'}</small>
        </div>
      ) : isText ? (
        <div className="creation-text-card">
          <Icon name="chat" size={20} />
          <strong>{promptFor(generation) || 'Chat response'}</strong>
          <p>{textResult || 'Text response will appear here.'}</p>
        </div>
      ) : isVideo ? url ? (
        <video src={url} controls playsInline />
      ) : (
        <div className="creation-empty-preview"><Icon name="video" size={22} /></div>
      ) : url ? (
        <img src={url} alt={promptFor(generation) || 'Generated image'} />
      ) : (
        <div className="creation-empty-preview"><Icon name="image" size={22} /></div>
      )}

      <div className="creation-card-overlay">
        <div className="creation-bottom-left">
          <span>{isVideo ? 'Video' : isText ? 'Chat' : 'Image'}</span>
          <span>{resolutionFor(generation)}</span>
          <span>{providerIconFor(generation)}</span>
        </div>
        <div className="creation-bottom-right">
          <button
            type="button"
            className="bg-white text-ink-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-ink-50 transition-colors flex items-center gap-1.5"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen(v => !v)
            }}
          >
            <Icon name="more-horizontal" size={14} />
            Options
          </button>
          {menuOpen && (
            <div className="creation-use-menu" onClick={event => event.stopPropagation()}>
              <button type="button" onClick={() => { onReuse(generation); setMenuOpen(false) }}>Reuse Configuration</button>
              <button type="button" onClick={() => { onPublish(generation); setMenuOpen(false) }}>Publish as Post</button>
            </div>
          )}
        </div>
      </div>
      {viewMode === 'list' && (
        <div className="creation-list-meta">
          <strong>{isText ? textResult || promptFor(generation) || 'Untitled response' : promptFor(generation) || 'Untitled generation'}</strong>
          <small>{modelNameFor(generation)} - {aspectFor(generation)}</small>
          <div className="row gap">
            <button type="button" onClick={(event) => { event.stopPropagation(); onFavorite(generation) }}><Icon name="heart" size={13} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDownload(generation) }}><Icon name="download" size={13} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(generation.id) }}><Icon name="trash" size={13} /></button>
          </div>
        </div>
      )}
    </article>
  )
}

function CreationsGallery({
  projectId,
  mode,
  toolType,
  models,
  setMode,
  setSelectedModel,
  setPrompt,
  setAspectRatio,
  setResolution,
  setSeed,
  setFixedSeed,
  setReferences,
  accounts = [],
  optimisticGenerations,
  setOptimisticGenerations,
}) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const aiProgress = useUIStore(s => s.aiProgress)
  const [search, setSearch] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState('All')
  const [viewMode, setViewMode] = useState('grid')
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [ratioMode, setRatioMode] = useState('original')
  const [size, setSize] = useState('M')
  const [editsMode, setEditsMode] = useState('group')
  const [galleryTab, setGalleryTab] = useState('creations')
  const [selectedIds, setSelectedIds] = useState([])
  const [inspector, setInspector] = useState(null)
  const [publishTarget, setPublishTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ai-generations', toolType, projectId, search, favoriteOnly],
    queryFn: () => aiApi.getGenerations({
      tool_type: toolType,
      project_id: projectId || undefined,
      favorite: favoriteOnly || undefined,
      search: search || undefined,
      limit: 80,
    }).then(res => res.data.data),
  })

  const { data: publishedData, isLoading: publishedLoading } = useQuery({
    queryKey: ['ai-published-posts', search],
    enabled: galleryTab === 'published',
    queryFn: () => aiApi.getPublishedPosts({
      search: search || undefined,
      limit: 80,
    }).then(res => res.data.data),
  })

  useEffect(() => {
    const statuses = Object.values(aiProgress || {}).map(item => item?.status)
    if (statuses.some(status => ['completed', 'failed'].includes(status))) {
      queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
    }
  }, [aiProgress, queryClient])

  const serverGenerations = useMemo(() => data?.generations || [], [data?.generations])
  const generations = useMemo(() => {
    const byId = new Map(serverGenerations.map(item => [item.id, item]))
    optimisticGenerations.forEach(item => {
      if (item?.tool_type && item.tool_type !== toolType) return
      if (!byId.has(item.id)) byId.set(item.id, item)
    })
    return Array.from(byId.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [serverGenerations, optimisticGenerations, toolType])

  useEffect(() => {
    if (!serverGenerations.length) return
    setOptimisticGenerations(current => current.filter(item => !serverGenerations.some(server => server.id === item.id)))
  }, [serverGenerations, setOptimisticGenerations])

  useEffect(() => {
    setTypeFilter('All')
    setSelectedIds([])
    setInspector(null)
    setPublishTarget(null)
  }, [mode])

  const visibleGenerations = generations.filter(item => {
    if (typeFilter === 'Image' && item.tool_type !== 'image') return false
    if (typeFilter === 'Video' && item.tool_type !== 'video') return false
    if (typeFilter === 'All' && mode === 'chat' && item.tool_type !== 'text') return false
    if (favoriteOnly && !item.is_favorite) return false
    return true
  })
  const grouped = groupBy(visibleGenerations, item => monthLabel(item.created_at))
  const publishedPosts = useMemo(() => publishedData?.posts || [], [publishedData?.posts])
  const groupedPublished = groupBy(publishedPosts, item => monthLabel(item.created_at))

  const favoriteMutation = useMutation({
    mutationFn: (generation) => aiApi.favoriteGeneration(generation.id, !generation.is_favorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-generations'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids) => Array.isArray(ids) ? aiApi.deleteGenerations(ids) : aiApi.deleteGeneration(ids),
    onSuccess: () => {
      setSelectedIds([])
      setInspector(null)
      queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history'] })
      pushToast?.({ type: 'success', title: 'Generation deleted' })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Delete failed' }),
  })

  const deletePublishedMutation = useMutation({
    mutationFn: (id) => aiApi.deletePublishedPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-published-posts'] })
      pushToast?.({ type: 'success', title: 'Published post deleted' })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Delete failed' }),
  })

  const publishMutation = useMutation({
    mutationFn: async ({ generation, payload }) => {
      const destinationPlatforms = Array.isArray(payload?.destination_platforms) ? payload.destination_platforms : []
      const { destination_platforms: _destination_platforms, ...galleryPayload } = payload || {}
      const canSaveToGallery = isPublishableGeneration(generation)
      const publishedPost = canSaveToGallery
        ? (await aiApi.publishGeneration(generation.id, galleryPayload)).data.data.post
        : null

      if (!canSaveToGallery && !destinationPlatforms.length) {
        throw new Error('Choose at least one social channel for text-only publishes.')
      }

      if (destinationPlatforms.length > 0) {
        try {
          const mediaUrl = imageUrlFor(generation)
          const isVideo = isVideoGeneration(generation)
          const contentType = isVideo
            ? (destinationPlatforms.includes('instagram') ? 'reel' : 'video')
            : 'image'

          const socialPostRes = await socialApi.createPost({
            caption: galleryPayload.caption || generation.caption || promptFor(generation) || '',
            hashtags: Array.isArray(galleryPayload.tags) ? galleryPayload.tags : [],
            content_type: contentType,
            target_platforms: destinationPlatforms,
            metadata: {
              source: 'mint_ai',
              generation_id: generation.id,
              published_post_id: publishedPost?.id || null,
            },
          })

          const socialPost = socialPostRes.data.data.post
          if (mediaUrl) {
            await socialApi.addMedia(socialPost.id, {
              media_items: [{
                media_url: mediaUrl,
                media_type: isVideo ? 'video' : 'image',
                mime_type: isVideo ? 'video/mp4' : 'image/png',
              }],
            })
          }
          await socialApi.publishPost(socialPost.id)
          return {
            publishedPost,
            sharedToSocial: true,
          }
        } catch (socialErr) {
          if (!publishedPost) {
            throw socialErr
          }
          return {
            publishedPost,
            sharedToSocial: false,
            socialError: socialErr.response?.data?.message || socialErr.message || 'Please try again.',
          }
        }
      }

      return {
        publishedPost,
        sharedToSocial: false,
      }
    },
    onSuccess: (result) => {
      setPublishTarget(null)
      queryClient.invalidateQueries({ queryKey: ['ai-published-posts'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      if (result?.publishedPost && result.sharedToSocial) {
        pushToast?.({ title: 'Published and shared', body: 'Your creation is now in Mint AI Published and on the selected social channel(s).', icon: 'check' })
        return
      }
      if (result?.publishedPost && !result.sharedToSocial) {
        pushToast?.({ title: 'Saved to Mint AI', body: result.socialError ? `Social sharing failed: ${result.socialError}` : 'Your creation was saved to the Published tab.', icon: 'check' })
        return
      }
      pushToast?.({ title: 'Shared to social', body: 'Your post was published to the selected channel(s).', icon: 'check' })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Publish failed' }),
  })

  const toggleSelect = (id) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const reuseGeneration = (generation) => {
    const model = models.find(item => item.id === generation.ai_model_id)
    if (model) setSelectedModel(model)
    if (generation.tool_type === 'video') setMode?.('video')
    else if (generation.tool_type === 'text') setMode?.('chat')
    else setMode?.('image')
    setPrompt(generation.raw_prompt || generation.prompt || '')
    setAspectRatio(aspectFor(generation))
    setResolution(resolutionFor(generation))
    if (generation.seed) {
      setFixedSeed(true)
      setSeed(String(generation.seed))
    }
    pushToast?.({ type: 'success', title: 'Configuration copied to the engine' })
  }

  const editImage = (generation) => {
    if (!isImageGeneration(generation)) {
      pushToast?.({ type: 'error', title: 'Only image generations can be reused as references right now.' })
      return
    }
    const url = imageUrlFor(generation)
    if (!url) return
    setReferences(current => [
      ...current,
      {

        id: `generated-${generation.id}`,
        alias: `img${current.length + 1}`,
        preview_url: url,
      },
    ].slice(0, 4))
    pushToast?.({ type: 'success', title: 'Image added as a reference' })
  }
  const selectedGenerations = generations.filter(item => selectedIds.includes(item.id))
  const gallerySizeClass = `size-${size.toLowerCase()}`

  const gridCols = size === 'S' ? 'columns-1 sm:columns-2 lg:columns-3 2xl:columns-4' 
                 : size === 'M' ? 'columns-1 sm:columns-2 xl:columns-3' 
                 : size === 'L' ? 'columns-1 xl:columns-2'
                 : 'columns-1'

  return (
    <div className="flex flex-col h-full w-full bg-ink-50 relative">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-ink-100 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap relative">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <button className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${galleryTab === 'creations' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`} onClick={() => setGalleryTab('creations')}>Creations</button>
            <button className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${galleryTab === 'published' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`} onClick={() => setGalleryTab('published')}>Published</button>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {['All', 'Image', 'Video'].map(item => (
              <button
                key={item}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === item ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-900'}`}
                disabled={!['All', 'Image', 'Video'].includes(item)}
                onClick={() => setTypeFilter(item)}
              >
                {item === 'All' ? <Icon name="grid" size={14} /> : <Icon name={item.toLowerCase() === '3d' ? 'layers' : item.toLowerCase()} size={14} />}
                <span>{item}</span>
              </button>
            ))}
            <div className="w-px h-4 bg-ink-200 mx-1" />
            <button className={`p-1.5 rounded-md transition-colors ${favoriteOnly ? 'text-mint-500 bg-mint-50' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-100'}`} onClick={() => setFavoriteOnly(v => !v)} title="Favorites">
              <Icon name="heart" size={16} />
            </button>
            <div className="w-px h-4 bg-ink-200 mx-1" />
            <button className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-100'}`} onClick={() => viewMode === 'list' ? setViewMode('grid') : setViewMode('list')} title="Toggle View">
              <Icon name={viewMode === 'list' ? 'grid' : 'list'} size={16} />
            </button>
            <button className={`p-1.5 rounded-md transition-colors ${layoutOpen ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-100'}`} onClick={() => setLayoutOpen(v => !v)} title="Layout Options">
              <Icon name="sliders" size={16} />
            </button>
          </div>
        {layoutOpen && (
          <div className="absolute top-full right-0 mt-2 z-20 w-[300px] bg-white border border-ink-200 rounded-xl shadow-xl p-4 flex flex-col gap-4">
            <section>
              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Ratio</span>
              <div className="flex bg-ink-50 rounded-lg p-1">
                {['original', 'square'].map(item => (
                  <button 
                    key={item} 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${ratioMode === item ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                    onClick={() => { setRatioMode(item); setLayoutOpen(false); }}
                  >
                    {item === 'original' ? 'Original' : 'Square'}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Size</span>
              <div className="flex bg-ink-50 rounded-lg p-1">
                {['S', 'M', 'L', 'XL'].map(item => (
                  <button 
                    key={item} 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${size === item ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                    onClick={() => { setSize(item); setLayoutOpen(false); }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block mb-2">Edits</span>
              <div className="flex bg-ink-50 rounded-lg p-1 mb-2">
                {['group', 'ungroup'].map(item => (
                  <button 
                    key={item} 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${editsMode === item ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                    onClick={() => { setEditsMode(item); setLayoutOpen(false); }}
                  >
                    {item === 'group' ? 'Group' : 'Ungroup'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                {editsMode === 'group' ? 'Batch variations stay bundled when backend grouping data is available.' : 'Each variation can be shown separately in a future batch view.'}
              </p>
            </section>
          </div>
        )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-ink-100/50 border border-ink-100 rounded-lg">
          <Icon name="search" size={14} className="text-ink-400" />
          <input 
            value={search} 
            onChange={event => setSearch(event.target.value)} 
            placeholder="Search prompt..." 
            className="flex-1 bg-transparent border-none outline-none text-sm text-ink-900 placeholder:text-ink-400"
          />
        </div>
      </header>

      {galleryTab === 'creations' && selectedIds.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-mint-50 border border-mint-200 rounded-xl flex items-center gap-3 flex-wrap shadow-sm">
          <span className="font-bold text-mint-900 text-sm mr-auto">{selectedIds.length} selected</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-100 transition-colors" onClick={() => selectedGenerations.forEach(item => downloadFile(imageUrlFor(item), generationDownloadName(item)))}>
            <Icon name="download" size={14} /> Download
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors" onClick={() => deleteMutation.mutate(selectedIds)}>
            <Icon name="trash" size={14} /> Delete
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent text-ink-600 text-sm font-medium rounded-lg hover:bg-black/5 transition-colors" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        {galleryTab === 'creations' ? (
          <>
            {isLoading && <div className="text-center py-20 text-ink-500 font-medium">Loading creations...</div>}
            {!isLoading && visibleGenerations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center max-w-sm mx-auto">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-ink-100 flex items-center justify-center mb-6 text-ink-400">
                  <Icon name="image" size={32} />
                </div>
                <strong className="text-xl font-bold text-ink-900 mb-2">No creations yet</strong>
                <p className="text-ink-500">Generate an image using the panel on the left and it will appear here instantly.</p>
              </div>
            )}
            {viewMode === 'grid' ? (
              <div className={`gap-4 ${gridCols}`}>
                {visibleGenerations.map(generation => (
                  <div key={generation.id} className="mb-4 break-inside-avoid">
                    <CreationCard
                      generation={generation}
                      progress={aiProgress?.[generation.id]}
                      selected={selectedIds.includes(generation.id)}
                      onSelect={toggleSelect}
                      onOpen={setInspector}
                      onFavorite={(item) => favoriteMutation.mutate(item)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onDownload={(item) => downloadFile(imageUrlFor(item), generationDownloadName(item))}
                      onReuse={reuseGeneration}
                      onPublish={setPublishTarget}
                      viewMode={viewMode}
                      ratioMode={ratioMode}
                    />
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(grouped).map(([month, items]) => (
                <section key={month} className="mb-10">
                  <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-4">{month}</h3>
                  <div className="flex flex-col gap-4">
                    {items.map(generation => (
                      <div key={generation.id} className="mb-4 break-inside-avoid">
                        <CreationCard
                          generation={generation}
                          progress={aiProgress?.[generation.id]}
                          selected={selectedIds.includes(generation.id)}
                          onSelect={toggleSelect}
                          onOpen={setInspector}
                          onFavorite={(item) => favoriteMutation.mutate(item)}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onDownload={(item) => downloadFile(imageUrlFor(item), generationDownloadName(item))}
                          onReuse={reuseGeneration}
                          onPublish={setPublishTarget}
                          viewMode={viewMode}
                          ratioMode={ratioMode}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        ) : (
          <>
            {publishedLoading && <div className="text-center py-20 text-ink-500 font-medium">Loading published posts...</div>}
            {!publishedLoading && publishedPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center max-w-sm mx-auto">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-ink-100 flex items-center justify-center mb-6 text-ink-400">
                  <Icon name="send" size={32} />
                </div>
                <strong className="text-xl font-bold text-ink-900 mb-2">No published posts yet</strong>
                <p className="text-ink-500">Publish a creation and it will appear here instantly.</p>
              </div>
            )}
            {viewMode === 'grid' ? (
              <div className={`gap-4 ${gridCols}`}>
                {publishedPosts.map(post => (
                  <div key={post.id} className="mb-4 break-inside-avoid">
                    <PublishedCard
                      post={post}
                      onDelete={(id) => deletePublishedMutation.mutate(id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(groupedPublished).map(([month, items]) => (
                <section key={month} className="mb-10">
                  <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-4">{month}</h3>
                  <div className="flex flex-col gap-4">
                    {items.map(post => (
                      <div key={post.id} className="mb-4 break-inside-avoid">
                        <PublishedCard
                          post={post}
                          onDelete={(id) => deletePublishedMutation.mutate(id)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {inspector && (
        <CreationInspector
          generation={inspector}
          progress={aiProgress?.[inspector.id]}
          onClose={() => setInspector(null)}
          onFavorite={(item) => favoriteMutation.mutate(item)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onPublish={setPublishTarget}
          onReuse={reuseGeneration}
          onEditImage={editImage}
        />
      )}
      {publishTarget && (
        <PublishPostModal
          generation={publishTarget}
          accounts={accounts}
          publishing={publishMutation.isPending}
          onClose={() => setPublishTarget(null)}
          onPublish={(payload) => publishMutation.mutate({ generation: publishTarget, payload })}
        />
      )}
    </div>
  )
}

export default function MintAI() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const aiProgress = useUIStore(s => s.aiProgress)
  const [session, setSession] = useState(() => sessionId())
  const [projectId, setProjectId] = useState('')
  const [activeMode, setActiveMode] = useState('image')
  const [selectedModel, setSelectedModel] = useState(null)
  const [modelMulti, setModelMulti] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState(null)
  const [references, setReferences] = useState([])
  const [prompt, setPrompt] = useState('')
  const [aiPrompt, setAiPrompt] = useState(true)
  const [fixedSeed, setFixedSeed] = useState(false)
  const [seed, setSeed] = useState('123456789')
  const [batchCount, setBatchCount] = useState(1)
  const [aspectRatio, setAspectRatio] = useState('Auto')
  const [resolution, setResolution] = useState('1K')
  const [thinking, setThinking] = useState('fast')
  const [googleSearch, setGoogleSearch] = useState(false)
  const [optimisticGenerations, setOptimisticGenerations] = useState([])
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const currentToolType = modeToolType(activeMode)

  const { data: modelData, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-engine-models', currentToolType],
    queryFn: () => aiApi.getEngineModels({ tool_type: currentToolType }).then(res => res.data.data),
  })
  const models = useMemo(() => {
    const raw = modelData?.models || []
    return raw.filter(m => !m.tool_type || m.tool_type === currentToolType)
  }, [modelData?.models, currentToolType])
  const balance = Number(modelData?.balance ?? 0)

  const { data: styleData } = useQuery({
    queryKey: ['ai-engine-styles'],
    queryFn: () => aiApi.getStylePresets().then(res => res.data.data),
  })
  const styles = useMemo(() => styleData?.styles || [], [styleData?.styles])

  useEffect(() => {
    if (models.length > 0) {
      if (!selectedModel || !models.some(m => m.id === selectedModel.id)) {
        setSelectedModel(models[0])
      }
    }
  }, [models, selectedModel])

  const { data: chatHistoryData } = useQuery({
    queryKey: ['ai-chat-history', projectId],
    enabled: activeMode === 'chat',
    queryFn: () => aiApi.getGenerations({
      tool_type: 'text',
      project_id: projectId || undefined,
      limit: 20,
    }).then(res => res.data.data),
  })
  const chatGenerations = useMemo(
    () => chatHistoryData?.generations || [],
    [chatHistoryData?.generations]
  )
  const chatFeedGenerations = useMemo(() => {
    // Only show chats for the current session in the thread view
    const sessionChats = chatGenerations.filter(c => (c.parameters?.session_id || c.id) === session)
    const byId = new Map(sessionChats.map(item => [item.id, item]))
    optimisticGenerations.forEach(item => {
      if (item?.tool_type && item.tool_type !== 'text') return
      if (!byId.has(item.id)) byId.set(item.id, item)
    })
    return Array.from(byId.values())
  }, [chatGenerations, optimisticGenerations, session])

  const chatSessions = useMemo(() => {
    const sessions = new Map()
    const reversed = [...chatGenerations].reverse() // Oldest first
    reversed.forEach(chat => {
      const sid = chat.parameters?.session_id || chat.id
      if (!sessions.has(sid)) {
        sessions.set(sid, chat)
      }
    })
    
    const grouped = []
    const seen = new Set()
    chatGenerations.forEach(chat => {
      const sid = chat.parameters?.session_id || chat.id
      if (!seen.has(sid)) {
        seen.add(sid)
        grouped.push(sessions.get(sid)) // Keep the oldest prompt as the title, but ordered by most recent activity
      }
    })
    return grouped
  }, [chatGenerations])

  const { data: mintboxData } = useQuery({
    queryKey: ['mintbox-folders'],
    queryFn: () => mintboxApi.getFolders().then(res => res.data.data),
  })
  const folders = useMemo(
    () => mintboxData?.folders || mintboxData?.projects || mintboxData?.items || [],
    [mintboxData?.folders, mintboxData?.items, mintboxData?.projects]
  )

  const { data: socialAccountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(res => res.data.data),
  })
  const socialAccounts = useMemo(
    () => socialAccountsData?.accounts || [],
    [socialAccountsData?.accounts]
  )

  useEffect(() => {
    if (!models.length) return undefined
    const selectedStillAvailable = selectedModel && models.some(item => item.id === selectedModel.id)
    if (!selectedModel || !selectedStillAvailable) {
      const frame = requestAnimationFrame(() => setSelectedModel(models[0]))
      return () => cancelAnimationFrame(frame)
    }
    return undefined
  }, [models, selectedModel])

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Only JPG, PNG, and WEBP references are supported.')
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Reference image is too large. Maximum size is 5MB.')
      }
      const form = new FormData()
      form.append('file', file)
      form.append('session_id', session)
      if (projectId) form.append('project_id', projectId)
      return aiApi.uploadReference(form).then(res => res.data.data.asset)
    },
    onSuccess: (asset) => setReferences(current => [...current, asset]),
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || err.message || 'Reference upload failed' }),
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      const promptValue = prompt.trim()
      const sharedParameters = {
        ai_prompt: activeMode === 'chat' ? false : aiPrompt,
        fixed_seed: activeMode === 'chat' ? false : fixedSeed,
        seed: activeMode === 'chat' ? null : seed,
        batch_count: activeMode === 'image' ? batchCount : 1,
        aspect_ratio: activeMode === 'chat' ? null : aspectRatio,
        resolution_tier: activeMode === 'chat' ? null : resolution,
        thinking_level: thinking,
        google_search_enabled: googleSearch,
        reference_aliases: activeMode === 'chat' ? [] : extractAliases(promptValue),
        reference_asset_ids: activeMode === 'chat' ? [] : references.map(ref => ref.id),
        style_preset_id: activeMode === 'image' ? selectedStyle?.id || null : null,
        session_id: activeMode === 'chat' ? session : null,
      }

      if (activeMode === 'image') {
        return aiApi.generateEngineImage({
          model_id: selectedModel?.id,
          prompt: promptValue,
          session_id: session,
          project_id: projectId || null,
          ...sharedParameters,
        }).then(res => res.data.data)
      }

      return aiApi.generate({
        tool_type: currentToolType,
        model_id: selectedModel?.id,
        prompt: promptValue,
        parameters: sharedParameters,
        source_job_id: projectId || null,
      }).then(res => res.data.data)
    },
    onSuccess: (data) => {
      const generationsData = Array.isArray(data) ? data : [data]
      const newGenerations = []

      generationsData.forEach(gen => {
        const generationId = gen.generation_id || gen.id
        if (generationId) {
          newGenerations.push({
            id: generationId,
            user_id: 'me',
            ai_model_id: selectedModel?.id,
            model_name: selectedModel?.name,
            provider_name: selectedModel?.provider_name,
            provider_display_name: selectedModel?.provider_display_name,
            icon_key: selectedModel?.icon_key,
            tool_type: currentToolType,
            prompt,
            raw_prompt: prompt,
            enhanced_prompt: gen.enhanced_prompt || null,
            parameters: {
              session_id: activeMode === 'chat' ? session : null,
              aspect_ratio: aspectRatio,
              resolution_tier: resolution,
              batch_count: 1, // Store as 1 in the feed since they are split
              seed: gen.seed || seed,
              reference_aliases: activeMode === 'chat' ? [] : extractAliases(prompt),
            },
            engine_metadata: {
              references: (activeMode === 'chat' ? [] : references).map(ref => ({
                id: ref.id,
                alias: ref.alias,
                preview_url: ref.preview_url,
              })),
            },
            status: 'queued',
            result_url: null,
            created_at: new Date().toISOString(),
            source_job_id: projectId || null,
            aspect_ratio: aspectRatio,
            resolution_tier: resolution,
            seed: gen.seed || seed,
            batch_count: 1,
            is_favorite: false,
          })
        }
      })

      if (newGenerations.length > 0) {
        setOptimisticGenerations(current => {
          const ids = new Set(newGenerations.map(g => g.id))
          return [...newGenerations, ...current.filter(item => !ids.has(item.id))]
        })
      }
      pushToast?.({
        type: 'success',
        title: activeMode === 'chat' ? 'Message queued' : activeMode === 'video' ? 'Video generation queued' : 'Image generation queued',
      })
      if (activeMode === 'chat') {
        setPrompt('')
      }
      queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Generation failed'
      if (msg.includes('INSUFFICIENT_MINTCOINS')) {
        window.dispatchEvent(new Event('open-mintcoin-modal'))
        pushToast?.({ type: 'error', title: 'Insufficient Mintcoins', body: msg.replace('INSUFFICIENT_MINTCOINS: ', '') })
      } else {
        pushToast?.({ type: 'error', title: msg })
      }
    },
  })

  const cost = tierCost(selectedModel, resolution, activeMode)
  const totalCost = cost.unlimited ? 0 : (activeMode === 'image' || activeMode === 'video' ? cost.mintcoin * batchCount : cost.cost * batchCount)
  const modeLabel = modeTitle(activeMode)
  const promptReferences = activeMode === 'chat' ? [] : references

  return (
    <div className="flex flex-col lg:flex-row h-full max-h-[100dvh] lg:max-h-[calc(100vh-64px)] overflow-hidden bg-ink-50 relative">
      
      {/* Mobile Sidebar Overlay */}
      {mobilePanelOpen && (
        <div 
          className="fixed inset-0 bg-ink-950/20 z-40 lg:hidden backdrop-blur-sm" 
          onClick={() => setMobilePanelOpen(false)} 
        />
      )}

      {/* Sidebar Panel */}
      <section className={`
        fixed inset-y-0 left-0 z-50 lg:z-0 w-[85vw] max-w-[360px] bg-white border-r border-ink-200 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none lg:static lg:w-[340px] lg:flex-shrink-0 lg:translate-x-0 overflow-y-auto
        ${mobilePanelOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="lg:hidden absolute top-4 right-4 z-10">
           <button onClick={() => setMobilePanelOpen(false)} className="p-2 bg-ink-100 rounded-full text-ink-600">
             <Icon name="x" size={16} />
           </button>
        </div>

        <div className="flex gap-1 p-3 overflow-x-auto hide-scrollbar border-b border-ink-100 shrink-0">
          {MODALITIES.map(tab => (
            <button
              key={tab.value}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeMode === tab.value 
                  ? 'bg-ink-900 text-white' 
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={Boolean(tab.disabled)}
              onClick={() => {
                if (tab.disabled) return
                setActiveMode(tab.value)
              }}
            >
              <Icon name={tab.icon} size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        <header className="px-6 py-4 border-b border-ink-100 shrink-0">
          <div>
            <p className="text-[10px] font-bold text-mint-500 uppercase tracking-wider mb-1">Mint AI</p>
            <h1 className="text-xl font-bold text-ink-900 tracking-tight">{modeLabel}</h1>
          </div>
          {activeMode !== 'chat' && (
            <select 
              value={projectId} 
              onChange={event => setProjectId(event.target.value)}
              className="mt-3 w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-700 outline-none focus:border-mint-500 focus:ring-1 focus:ring-mint-500 transition-shadow appearance-none"
            >
              <option value="">No project folder selected</option>
              {folders.map(folder => (
                <option key={folder.id || folder.job_id} value={folder.job_id || folder.id}>
                  {folder.title || folder.name || folder.job_title || 'Untitled project'}
                </option>
              ))}
            </select>
          )}
        </header>

        <div className="p-4 border-b border-ink-100 shrink-0">
          <ModelSelector
            models={models}
            selected={selectedModel}
            onSelect={setSelectedModel}
            resolution={resolution}
            multiple={modelMulti}
            setMultiple={setModelMulti}
            thinking={thinking}
            setThinking={setThinking}
            googleSearch={googleSearch}
            setGoogleSearch={setGoogleSearch}
          />
        </div>

        <div className="flex-1 p-4 flex flex-col gap-6 shrink-0">
          {activeMode === 'chat' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">Chat History</h3>
                <button 
                  type="button" 
                  onClick={() => setSession(sessionId())}
                  className="text-xs text-mint-600 hover:text-mint-700 font-medium"
                >
                  + New
                </button>
              </div>
              {chatSessions.length === 0 ? (
                <p className="text-sm text-ink-400">No previous chats found.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {chatSessions.map(chat => {
                    const sid = chat.parameters?.session_id || chat.id
                    return (
                      <div key={sid} className={`flex items-center group ${session === sid ? 'bg-mint-50' : ''} rounded-lg`}>
                        <button 
                          className={`flex-1 text-left text-sm hover:bg-ink-100 p-2 rounded-lg truncate transition-colors ${session === sid ? 'text-mint-700 font-medium' : 'text-ink-700'}`}
                          onClick={() => setSession(sid)}
                        >
                          {chat.raw_prompt || chat.prompt}
                        </button>
                        <button
                          type="button"
                          className="p-2 text-ink-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm('Delete this chat session?')) {
                              const idsToDelete = chatGenerations
                                .filter(c => (c.parameters?.session_id || c.id) === sid)
                                .map(c => c.id)
                              deleteMutation.mutate(idsToDelete)
                            }
                          }}
                          title="Delete chat"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <ReferencesBlock
                styles={styles}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}
                references={references}
                uploading={uploadMutation.isPending}
                uploadReference={(file) => uploadMutation.mutate(file)}
              />

              <PromptBox
                value={prompt}
                setValue={setPrompt}
                references={promptReferences}
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                fixedSeed={fixedSeed}
                setFixedSeed={setFixedSeed}
                seed={seed}
                setSeed={setSeed}
                mode={activeMode}
              />

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-ink-100 rounded-lg">
                    <button className="px-3 py-1 text-ink-600 hover:text-ink-900" onClick={() => setBatchCount(v => Math.max(1, v - 1))}>-</button>
                    <span className="text-sm font-medium w-4 text-center">{batchCount}</span>
                    <button className="px-3 py-1 text-ink-600 hover:text-ink-900" onClick={() => setBatchCount(v => Math.min(4, v + 1))}>+</button>
                  </div>
                  <select 
                    value={aspectRatio} 
                    onChange={event => setAspectRatio(event.target.value)}
                    className="flex-1 bg-ink-100 border-none rounded-lg text-sm px-3 py-1.5 outline-none appearance-none font-medium"
                  >
                    {ASPECT_RATIOS.map(item => <option key={item.value} value={item.value}>{item.icon} • {item.label}</option>)}
                  </select>
                </div>
                
                <div className="flex gap-1 p-1 bg-ink-100 rounded-lg">
                  {['1K', '2K', '4K'].map(tier => {
                    const tierMeta = tierCost(selectedModel, tier)
                    return (
                      <button 
                        key={tier} 
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex flex-col items-center ${resolution === tier ? 'bg-ink-900 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'}`} 
                        onClick={() => setResolution(tier)}
                      >
                        <span>{tier}</span>
                        <small className="opacity-60 text-[10px]">{tierMeta.unlimited ? '∞' : tierMeta.cost}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {activeMode !== 'chat' && (
          <div className="p-4 border-t border-ink-100 bg-ink-50/50 flex flex-col gap-3 shrink-0">
            <button
              className="w-full py-3 px-4 bg-ink-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-800 transition-colors"
              disabled={!prompt.trim() || !selectedModel || modelsLoading || generateMutation.isPending}
              onClick={() => {
                generateMutation.mutate();
                if (window.innerWidth < 1024) setMobilePanelOpen(false);
              }}
            >
              <Icon name="sparkles" size={16} />
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </button>
            <footer className="text-center text-xs text-ink-500">
              {cost.unlimited ? '∞ Unlimited generations' : `Uses ${totalCost} MintCoins • ${Math.max(0, balance - totalCost)} remaining`}
            </footer>
          </div>
        )}
      </section>

      {/* Main Gallery Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-ink-50 relative pb-20 lg:pb-0">
        {activeMode === 'chat' ? (
          <ChatWorkspace
            prompt={prompt}
            setPrompt={setPrompt}
            onSend={() => generateMutation.mutate()}
            sending={generateMutation.isPending}
            selectedModel={selectedModel}
            modelsLoading={modelsLoading}
            balance={balance}
            cost={totalCost}
            unlimited={cost.unlimited}
            quickPrompts={[
              'Write a caption for my new launch',
              'Turn this idea into an ad',
              'Give me a cleaner version',
              'What should I post next week?',
            ]}
            generations={chatFeedGenerations}
            progressMap={aiProgress}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
          />
        ) : (
          <CreationsGallery
            projectId={projectId}
            mode={activeMode}
            toolType={currentToolType}
            models={models}
            setMode={setActiveMode}
            setSelectedModel={setSelectedModel}
            setPrompt={setPrompt}
            setAspectRatio={setAspectRatio}
            setResolution={setResolution}
            setSeed={setSeed}
            setFixedSeed={setFixedSeed}
            setReferences={setReferences}
            accounts={socialAccounts}
            optimisticGenerations={optimisticGenerations}
            setOptimisticGenerations={setOptimisticGenerations}
          />
        )}
        
        {/* Mobile floating generate button */}
        {activeMode !== 'chat' && !mobilePanelOpen && (
          <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] shadow-2xl">
            <button 
              className="bg-ink-950 hover:bg-black text-white shadow-xl shadow-ink-950/30 px-6 py-3.5 rounded-full font-bold flex items-center gap-2 transition-transform active:scale-95"
              onClick={() => setMobilePanelOpen(true)}
            >
              <Icon name="sparkles" size={18} />
              Generate
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function PublishedCard({ post, onDelete }) {
  const url = post.media_url
  const isVideo = post.content_type === 'video'
  const platforms = Array.isArray(post.destination_platforms) ? post.destination_platforms : []

  return (
    <article className="creation-card grid">
      {url ? (
        isVideo ? (
          <video src={url} controls playsInline />
        ) : (
          <img src={url} alt={post.caption || 'Published creation'} />
        )
      ) : (
        <div className="creation-empty-preview"><Icon name="image" size={22} /></div>
      )}
      <div className="creation-card-overlay">
        <div className="creation-bottom-left">
          <span>{isVideo ? 'Video' : 'Image'}</span>
          <span>{platforms.length ? platforms.join(' • ') : 'Gallery'}</span>
        </div>
        <div className="creation-bottom-right">
          <button
            type="button"
            className="btn dark sm"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(post.id)
            }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
      <div className="creation-list-meta">
        <strong>{post.caption || 'Published creation'}</strong>
        <small>{Array.isArray(post.tags) && post.tags.length ? post.tags.join(', ') : 'No tags yet'}</small>
      </div>
    </article>
  )
}
