import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { mintboxApi } from '../../api/mintbox'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

const MODALITIES = ['Image', 'Video', 'Audio', 'Spaces', 'Design', '3D', 'Flows']

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

function PromptBox({ value, setValue, references, aiPrompt, setAiPrompt, fixedSeed, setFixedSeed, seed, setSeed }) {
  const [showRefs, setShowRefs] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    setShowRefs(value.endsWith('@') && references.length > 0)
  }, [value, references.length])

  const insertAlias = (alias) => {
    setValue(current => `${current.slice(0, -1)}@${alias} `)
    setShowRefs(false)
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
        placeholder="Describe your image—try @ to add references"
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

export default function MintAI() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const session = useMemo(sessionId, [])
  const [projectId, setProjectId] = useState('')
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

  const { data: modelData, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-engine-models'],
    queryFn: () => aiApi.getEngineModels({ tool_type: 'image' }).then(res => res.data.data),
  })
  const models = modelData?.models || []
  const balance = Number(modelData?.balance ?? 0)

  const { data: styleData } = useQuery({
    queryKey: ['ai-engine-styles'],
    queryFn: () => aiApi.getStylePresets().then(res => res.data.data),
  })
  const styles = styleData?.styles || []

  const { data: mintboxData } = useQuery({
    queryKey: ['mintbox-folders'],
    queryFn: () => mintboxApi.getFolders().then(res => res.data.data),
  })
  const folders = mintboxData?.folders || mintboxData?.projects || mintboxData?.items || []

  useEffect(() => {
    if (!selectedModel && models.length > 0) setSelectedModel(models[0])
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
    mutationFn: () => aiApi.generateEngineImage({
      model_id: selectedModel?.id,
      prompt,
      session_id: session,
      project_id: projectId || null,
      reference_aliases: extractAliases(prompt),
      style_preset_id: selectedStyle?.id || null,
      ai_prompt: aiPrompt,
      fixed_seed: fixedSeed,
      seed,
      batch_count: batchCount,
      aspect_ratio: aspectRatio,
      resolution_tier: resolution,
      thinking_level: thinking,
      google_search_enabled: googleSearch,
    }).then(res => res.data.data),
    onSuccess: () => {
      pushToast?.({ type: 'success', title: 'Image generation queued' })
      queryClient.invalidateQueries({ queryKey: ['ai-generations'] })
    },
    onError: (err) => pushToast?.({ type: 'error', title: err.response?.data?.message || 'Generation failed' }),
  })

  const cost = tierCost(selectedModel, resolution)
  const totalCost = cost.unlimited ? 0 : cost.cost * batchCount

  return (
    <div className="engine-workspace">
      <section className="engine-panel">
        <header className="engine-header">
          <div>
            <p className="eyebrow">Mint AI</p>
            <h1>Image engine</h1>
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
            <button key={tab} className={tab === 'Image' ? 'active' : ''} disabled={tab !== 'Image'}>
              {tab}
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
          references={references}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          fixedSeed={fixedSeed}
          setFixedSeed={setFixedSeed}
          seed={seed}
          setSeed={setSeed}
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
      </section>

      <aside className="engine-gallery-placeholder">
        <p className="eyebrow">Creations</p>
        <div>
          <Icon name="image" size={26} />
          <strong>Your generated images will appear here.</strong>
          <span>The live gallery is intentionally reserved for the next build.</span>
        </div>
      </aside>
    </div>
  )
}
