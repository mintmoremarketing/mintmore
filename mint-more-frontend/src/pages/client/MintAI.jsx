import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const MODALITIES = [
  { value: 'image', label: 'Image', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'video' },
  { value: 'chat', label: 'Chat', icon: 'chat' },
  { value: 'audio', label: 'Audio', icon: 'microphone', disabled: true },
  { value: 'spaces', label: 'Spaces', icon: 'layers', disabled: true },
  { value: 'design', label: 'Design', icon: 'grid', disabled: true },
  { value: '3d', label: '3D', icon: 'layers', disabled: true },
  { value: 'flows', label: 'Flows', icon: 'radar', disabled: true },
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
  const tier = model?.cost_summary?.tiers?.[resolution]
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
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.target = '_blank'
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
      <div className="engine-utility-row">
        <button type="button" title="Open larger editor" onClick={() => setShowEditor(true)}><Icon name="edit" size={14} /></button>
        <button type="button" title="Upload media shortcut"><Icon name="upload" size={14} /></button>
        <button type="button" title="More prompt tools" onClick={() => alert('Tell me what this third utility should do, and I will wire it intentionally.')}><Icon name="sparkles" size={14} /></button>
      </div>
      <div className="engine-prompt-options">
        <label><Toggle checked={aiPrompt} onChange={setAiPrompt} /> AI prompt</label>
        <label><Toggle checked={fixedSeed} onChange={setFixedSeed} /> Fixed seed</label>
        <button type="button" className="engine-info" title="Enable this to get consistent results every time you use the same prompt.">i</button>
        {fixedSeed && (
          <input className="input" value={seed} onChange={event => setSeed(event.target.value)} placeholder="Seed" />
        )}
      </div>
      {showEditor && (
        <div className="modal-backdrop" onClick={() => setShowEditor(false)}>
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
  selectedModel,
  modelsLoading,
  balance,
  cost,
  unlimited,
  quickPrompts = [],
  generations = [],
  progressMap = {},
}) {
  const thread = useMemo(
    () => [...generations].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [generations]
  )

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    onSend()
  }

  return (
    <section className="engine-chat-shell">
      <div className="engine-chat-hero">
        <div>
          <p className="eyebrow">Mint AI chat</p>
          <h2>Ask, refine, and draft in one thread</h2>
          <p className="muted">Enter sends. Shift+Enter makes a new line.</p>
        </div>
        <div className="engine-chat-meta">
          <span className="engine-chat-model">{selectedModel?.name || 'Choose a model'}</span>
          <span className="engine-chat-credit">{unlimited ? '∞ Unlimited' : `Uses ${cost} MintCoins • ${Math.max(0, balance - cost)} remaining`}</span>
        </div>
      </div>

      <div className="chat-stream mint-ai-thread">
        {thread.length === 0 ? (
          <>
            <div className="bubble-row system">
              <div className="bubble">Ask Mint AI anything about your business, customers, offers, or content.</div>
            </div>
            <div className="bubble-row them">
              <div className="bubble">
                <div className="who">Mint AI</div>
                I can help write captions, ad copy, campaign ideas, product storytelling, and launch messages.
              </div>
            </div>
          </>
        ) : thread.map((generation) => {
          const progress = progressMap?.[generation.id]
          const status = progress?.status || generation.status
          const pending = ['queued', 'processing', 'pending'].includes(status)
          const failed = status === 'failed'
          const userText = promptFor(generation) || generation.raw_prompt || 'Message'
          const assistantText = generationResultText(generation, progress) || generation.prompt || 'Thinking...'
          return (
            <div key={generation.id} className="chat-generation-thread">
              <div className="bubble-row me">
                <div className="bubble">{userText}</div>
              </div>
              {pending ? (
                <div className="bubble-row them">
                  <div className="bubble">
                    <div className="who">Mint AI</div>
                    Working on it...
                  </div>
                </div>
              ) : failed ? (
                <div className="bubble-row them">
                  <div className="bubble">
                    <div className="who">Mint AI</div>
                    {progress?.error || generation.error_message || 'That request failed.'}
                  </div>
                </div>
              ) : (
                <div className="bubble-row them">
                  <div className="bubble">
                    <div className="who">Mint AI</div>
                    {assistantText}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {sending && (
          <div className="bubble-row them">
            <div className="bubble">Mint AI is thinking...</div>
          </div>
        )}
      </div>

      <div className="engine-chat-composer">
        <div className="engine-chat-chips">
          {quickPrompts.map(item => (
            <button key={item} type="button" onClick={() => setPrompt(item)}>{item}</button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mint AI anything about your business..."
          rows={5}
        />
        <div className="engine-chat-actions">
          <small>{modelsLoading ? 'Loading models...' : 'Chat mode uses text generation models and the same MintCoin balance.'}</small>
          <button
            type="button"
            className="engine-generate"
            disabled={!prompt.trim() || !selectedModel || modelsLoading || sending}
            onClick={onSend}
          >
            <Icon name="sparkles" size={16} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  )
}

function PublishPostModal({ generation, onClose, onPublish, publishing }) {
  const [caption, setCaption] = useState('')
  const [shareParams, setShareParams] = useState(false)
  const [tags, setTags] = useState('')
  const url = imageUrlFor(generation)
  const canPublish = isImageGeneration(generation)
  const isVideo = isVideoGeneration(generation)
  const isText = isTextGeneration(generation)
  const previewText = generationResultText(generation) || promptFor(generation)

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
              <h3>Create a draft post</h3>
            </div>
            <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          {!canPublish && (
            <p className="creation-note">
              Publishing is currently image-only. This modal is here so the video and chat tabs do not break the flow, but the actual post save is disabled for these modes.
            </p>
          )}
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
              })}
            >
              Publish Post
            </button>
          </div>
          <p className="creation-note">This saves a draft in <code>published_posts</code>. The public feed page is not built yet.</p>
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
    <div className="modal-backdrop" onClick={onClose}>
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
                  <button type="button" className="btn dark" onClick={() => onPublish(generation)}>{isImage ? 'Publish Image' : 'Publish as Post'}</button>
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
            className="btn dark sm"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen(v => !v)
            }}
          >
            Use
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
      pushToast?.({ type: 'success', title: 'Generation deleted' })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Delete failed' }),
  })

  const publishMutation = useMutation({
    mutationFn: ({ generation, payload }) => aiApi.publishGeneration(generation.id, payload),
    onSuccess: () => {
      setPublishTarget(null)
      pushToast?.({ type: 'success', title: 'Draft post saved' })
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

  return (
    <aside className={`creations-gallery ${gallerySizeClass}`}>
      <header className="creations-toolbar">
        <div className="creations-tabs">
          <button className="active">Creations</button>
          <button disabled>My templates</button>
          <button disabled>Academy</button>
        </div>
        <div className="creations-filter-icons">
          {['All', 'Image', 'Video', 'Audio', 'Design', '3D'].map(item => (
            <button
              key={item}
              className={typeFilter === item ? 'active' : ''}
              disabled={!['All', 'Image'].includes(item)}
              onClick={() => setTypeFilter(item)}
            >
              {item === 'All' ? <Icon name="grid" size={14} /> : <Icon name={item.toLowerCase() === '3d' ? 'layers' : item.toLowerCase()} size={14} />}
              <span>{item}</span>
            </button>
          ))}
          <button className={favoriteOnly ? 'active' : ''} onClick={() => setFavoriteOnly(v => !v)} title="Favorites">
            <Icon name="heart" size={14} />
          </button>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="Row">
            <Icon name="list" size={14} />
          </button>
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid">
            <Icon name="grid" size={14} />
          </button>
          <button onClick={() => setLayoutOpen(v => !v)} title="Layout Options">
            <Icon name="sliders" size={14} />
          </button>
        </div>
        <label className="creations-search">
          <Icon name="search" size={14} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search prompt..." />
        </label>
        {layoutOpen && (
          <div className="creations-layout-panel">
            <section>
              <span>Ratio</span>
              <div className="segmented compact">
                {['original', 'square'].map(item => (
                  <button key={item} className={ratioMode === item ? 'active' : ''} onClick={() => setRatioMode(item)}>
                    {item === 'original' ? 'Original' : 'Square'}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <span>Size</span>
              <div className="segmented compact">
                {['S', 'M', 'L', 'XL'].map(item => (
                  <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>
                ))}
              </div>
            </section>
            <section>
              <span>Edits</span>
              <div className="segmented compact">
                {['group', 'ungroup'].map(item => (
                  <button key={item} className={editsMode === item ? 'active' : ''} onClick={() => setEditsMode(item)}>
                    {item === 'group' ? 'Group' : 'Ungroup'}
                  </button>
                ))}
              </div>
              <small>{editsMode === 'group' ? 'Batch variations stay bundled when backend grouping data is available.' : 'Each variation can be shown separately in a future batch view.'}</small>
            </section>
          </div>
        )}
      </header>

      {selectedIds.length > 0 && (
        <div className="creations-bulk-bar">
          <span>{selectedIds.length} selected</span>
          <button className="btn ghost sm" onClick={() => selectedGenerations.forEach(item => downloadFile(imageUrlFor(item), generationDownloadName(item)))}>
            <Icon name="download" size={13} /> Download
          </button>
          <button className="btn ghost sm" onClick={() => deleteMutation.mutate(selectedIds)}>
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn ghost sm" onClick={() => setSelectedIds([])}>Clear</button>
        </div>
      )}

      <div className={`creations-feed ${viewMode} ${ratioMode}`}>
        {isLoading && <div className="creation-gallery-empty">Loading creations...</div>}
        {!isLoading && visibleGenerations.length === 0 && (
          <div className="creation-gallery-empty">
            <Icon name="image" size={26} />
            <strong>No creations yet</strong>
            <span>Generate an image and it will appear here instantly.</span>
          </div>
        )}
        {Object.entries(grouped).map(([month, items]) => (
          <section key={month} className="creation-month-group">
            <h3>{month}</h3>
            <div className={`creation-grid ${viewMode}`}>
              {items.map(generation => (
                <CreationCard
                  key={generation.id}
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
              ))}
            </div>
          </section>
        ))}
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
          publishing={publishMutation.isPending}
          onClose={() => setPublishTarget(null)}
          onPublish={(payload) => publishMutation.mutate({ generation: publishTarget, payload })}
        />
      )}
    </aside>
  )
}

export default function MintAI() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const aiProgress = useUIStore(s => s.aiProgress)
  const session = useMemo(() => sessionId(), [])
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
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('1K')
  const [thinking, setThinking] = useState('fast')
  const [googleSearch, setGoogleSearch] = useState(false)
  const [optimisticGenerations, setOptimisticGenerations] = useState([])
  const currentToolType = modeToolType(activeMode)

  const { data: modelData, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-engine-models', currentToolType],
    queryFn: () => aiApi.getEngineModels({ tool_type: currentToolType }).then(res => res.data.data),
  })
  const models = useMemo(() => modelData?.models || [], [modelData?.models])
  const balance = Number(modelData?.balance ?? 0)

  const { data: styleData } = useQuery({
    queryKey: ['ai-engine-styles'],
    queryFn: () => aiApi.getStylePresets().then(res => res.data.data),
  })
  const styles = useMemo(() => styleData?.styles || [], [styleData?.styles])

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
    const byId = new Map(chatGenerations.map(item => [item.id, item]))
    optimisticGenerations.forEach(item => {
      if (item?.tool_type && item.tool_type !== 'text') return
      if (!byId.has(item.id)) byId.set(item.id, item)
    })
    return Array.from(byId.values())
  }, [chatGenerations, optimisticGenerations])

  const { data: mintboxData } = useQuery({
    queryKey: ['mintbox-folders'],
    queryFn: () => mintboxApi.getFolders().then(res => res.data.data),
  })
  const folders = useMemo(
    () => mintboxData?.folders || mintboxData?.projects || mintboxData?.items || [],
    [mintboxData?.folders, mintboxData?.items, mintboxData?.projects]
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
      const generationId = data.generation_id || data.id
      if (generationId) {
        const queuedGeneration = {
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
          enhanced_prompt: data.enhanced_prompt || null,
          parameters: {
            aspect_ratio: aspectRatio,
            resolution_tier: resolution,
            batch_count: batchCount,
            seed: data.seed || seed,
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
          seed: data.seed || seed,
          batch_count: batchCount,
          is_favorite: false,
        }
        setOptimisticGenerations(current => [
          queuedGeneration,
          ...current.filter(item => item.id !== generationId),
        ])
      }
      pushToast?.({
        type: 'success',
        title: activeMode === 'chat' ? 'Message queued' : activeMode === 'video' ? 'Video generation queued' : 'Image generation queued',
      })
      queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history'] })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Generation failed' }),
  })

  const cost = tierCost(selectedModel, resolution)
  const totalCost = cost.unlimited ? 0 : cost.cost * batchCount
  const modeLabel = modeTitle(activeMode)
  const promptReferences = activeMode === 'chat' ? [] : references

  return (
    <div className="engine-workspace">
      <section className="engine-panel">
        <header className="engine-header">
          <div>
            <p className="eyebrow">Mint AI</p>
            <h1>{modeLabel}</h1>
          </div>
          <select value={projectId} onChange={event => setProjectId(event.target.value)}>
            <option value="">No project folder selected</option>
            {folders.map(folder => (
              <option key={folder.id || folder.job_id} value={folder.job_id || folder.id}>
                {folder.title || folder.name || folder.job_title || 'Untitled project'}
              </option>
            ))}
          </select>
        </header>

        <div className="engine-modality-tabs">
          {MODALITIES.map(tab => (
            <button
              key={tab.value}
              className={activeMode === tab.value ? 'active' : ''}
              disabled={Boolean(tab.disabled)}
              onClick={() => {
                if (tab.disabled) return
                setActiveMode(tab.value)
              }}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

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
          />
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

            <div className="engine-config-row">
              <div className="engine-stepper">
                <button onClick={() => setBatchCount(v => Math.max(1, v - 1))}>-</button>
                <span>{batchCount}</span>
                <button onClick={() => setBatchCount(v => Math.min(4, v + 1))}>+</button>
              </div>
              <select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}>
                {ASPECT_RATIOS.map(item => <option key={item.value} value={item.value}>{item.icon} • {item.label}</option>)}
              </select>
              <div className="segmented">
                {['1K', '2K', '4K'].map(tier => {
                  const tierMeta = tierCost(selectedModel, tier)
                  return (
                    <button key={tier} className={resolution === tier ? 'active' : ''} onClick={() => setResolution(tier)}>
                      {tier} <small>{tierMeta.unlimited ? '∞' : tierMeta.cost}</small>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              className="engine-generate"
              disabled={!prompt.trim() || !selectedModel || modelsLoading || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <Icon name="sparkles" size={16} />
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </button>
            <footer className="engine-status-footer">
              {cost.unlimited ? '∞ Unlimited generations' : `Uses ${totalCost} MintCoins • ${Math.max(0, balance - totalCost)} remaining`}
            </footer>
          </>
        )}
      </section>

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
        optimisticGenerations={optimisticGenerations}
        setOptimisticGenerations={setOptimisticGenerations}
      />
    </div>
  )
}
