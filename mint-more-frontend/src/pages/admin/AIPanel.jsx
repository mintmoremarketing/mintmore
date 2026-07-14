import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '../../api/ai'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import Modal from '../../components/ui/Modal'
import { SkeletonCard } from '../../components/ui/Skeleton'

const TRAFFIC_META = {
  idle:     { color: 'var(--mint-500)', label: 'Idle' },
  low:      { color: 'var(--mint-600)', label: 'Low' },
  moderate: { color: '#F59E0B',         label: 'Moderate' },
  busy:     { color: '#F97316',         label: 'Busy' },
  high:     { color: 'var(--rose)',     label: 'High load' },
}

const TIER_COLORS = {
  free:     { bg: 'rgba(247,127,0,0.1)',  color: 'var(--mint-700)' },
  standard: { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
  premium:  { bg: 'rgba(217,119,6,0.1)',   color: 'var(--amber)' },
}

const TOOL_TYPES = ['text', 'image', 'video', 'video_script', 'caption', 'repurpose']

function normalizeTools(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    return value.split(',').map(t => t.trim()).filter(Boolean)
  }
  return []
}

// ── Add / Edit Model Modal ─────────────────────────────────────────────────────

function ModelModal({ model, models, onClose }) {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const isEdit      = !!model

  const [openrouterId, setOpenrouterId] = useState(model?.openrouter_id || '')
  const [name,         setName]         = useState(model?.name || '')
  const [provider,     setProvider]     = useState(model?.provider_name || '')
  const [tier,         setTier]         = useState(model?.tier || 'free')
  const [tools,        setTools]        = useState(normalizeTools(model?.supported_tools))
  const [providerCost, setProviderCost] = useState(model?.provider_cost_per_1k_tokens || '')
  const [userPrice,    setUserPrice]    = useState(model?.user_price_per_1k_tokens ?? model?.cost_per_1k_tokens ?? '')
  const [marginAlert,  setMarginAlert]  = useState(model?.margin_alert_below_pct ?? 20)
  const [failoverId,   setFailoverId]   = useState(model?.failover_model_id || '')
  const [resolutions,  setResolutions]  = useState((model?.resolution_labels || []).join(', '))
  const [description,  setDescription]  = useState(model?.description || '')
  const [isTrending,   setIsTrending]   = useState(model?.is_trending || false)

  const toggleTool = (tool) => {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => isEdit
      ? aiApi.updateModel(model.id, {
          name, provider_name: provider, tier,
          supported_tools: tools,
          provider_cost_per_1k_tokens: providerCost ? parseFloat(providerCost) : 0,
          user_price_per_1k_tokens: userPrice ? parseFloat(userPrice) : 0,
          failover_model_id: failoverId || null,
          resolution_labels: resolutions.split(',').map(value => value.trim()).filter(Boolean),
          margin_alert_below_pct: Number(marginAlert || 0),
          description, is_trending: isTrending,
        })
      : aiApi.addModel({
          openrouter_id: openrouterId, name, provider_name: provider,
          tier, supported_tools: tools,
          provider_cost_per_1k_tokens: providerCost ? parseFloat(providerCost) : 0,
          user_price_per_1k_tokens: userPrice ? parseFloat(userPrice) : 0,
          failover_model_id: failoverId || null,
          resolution_labels: resolutions.split(',').map(value => value.trim()).filter(Boolean),
          margin_alert_below_pct: Number(marginAlert || 0),
          description, is_trending: isTrending,
        }),
    onSuccess: () => {
      pushToast({ title: isEdit ? 'Model updated!' : 'Model added!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['ai-models'] })
      onClose()
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  return (
    <Modal
      title={isEdit ? `Edit: ${model.name}` : 'Add model'}
      subtitle={isEdit ? model.openrouter_id : 'Add a model from OpenRouter'}
      onClose={onClose}
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => mutate()}
            disabled={isPending || !name || (!isEdit && !openrouterId) || tools.length === 0}
          >
            {isPending ? 'Saving…' : isEdit ? 'Update model' : 'Add to platform'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {!isEdit && (
          <div className="field">
            <label className="field-label">OpenRouter model ID</label>
            <input className="input" value={openrouterId} onChange={e => setOpenrouterId(e.target.value)}
              placeholder="e.g. google/gemini-pro, openai/gpt-4o" />
            <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
              Copy from openrouter.ai/models
            </div>
          </div>
        )}

        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label className="field-label">Display name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GPT-4o" />
          </div>
          <div className="field">
            <label className="field-label">Provider</label>
            <input className="input" value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. OpenAI" />
          </div>
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label className="field-label">Tier</label>
            <select className="select" value={tier} onChange={e => setTier(e.target.value)}>
              <option value="free">Free</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">User price per 1K tokens (INR)</label>
            <input className="input" type="number" min="0" step="0.001" value={userPrice}
              onChange={e => setUserPrice(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="grid-3" style={{ gap: 10 }}>
          <div className="field">
            <label className="field-label">Provider cost / 1K</label>
            <input className="input" type="number" min="0" step="0.001" value={providerCost}
              onChange={e => setProviderCost(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field">
            <label className="field-label">Margin alert below (%)</label>
            <input className="input" type="number" min="0" max="100" value={marginAlert}
              onChange={e => setMarginAlert(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Failover model</label>
            <select className="select" value={failoverId} onChange={e => setFailoverId(e.target.value)}>
              <option value="">Automatic best available</option>
              {(models || []).filter(candidate => candidate.id !== model?.id).map(candidate => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </div>
        </div>

        {Number(userPrice) > 0 && (
          <div style={{
            padding: 10, border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)',
            color: ((Number(userPrice) - Number(providerCost || 0)) / Number(userPrice)) * 100 < Number(marginAlert)
              ? 'var(--rose)' : 'var(--mint-700)',
            fontSize: 12.5,
          }}>
            Gross margin: {Math.round(((Number(userPrice) - Number(providerCost || 0)) / Number(userPrice)) * 100)}%
            {' '}({Number(marginAlert)}% alert threshold)
          </div>
        )}

        <div className="field">
          <label className="field-label">Resolution labels</label>
          <input className="input" value={resolutions} onChange={e => setResolutions(e.target.value)}
            placeholder="Standard, HD, 4K" />
        </div>

        <div className="field">
          <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>
            Supported tools <span style={{ color: 'var(--rose)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TOOL_TYPES.map(tool => (
              <button
                key={tool}
                type="button"
                onClick={() => toggleTool(tool)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer',
                  border: `1.5px solid ${tools.includes(tool) ? 'var(--ink-950)' : 'var(--hairline)'}`,
                  background: tools.includes(tool) ? 'var(--ink-950)' : 'var(--paper-tint)',
                  color: tools.includes(tool) ? 'white' : 'var(--ink-700)',
                  transition: 'all 0.1s',
                }}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Description (optional)</label>
          <textarea className="textarea" rows={2} value={description}
            onChange={e => setDescription(e.target.value)} placeholder="Brief description of this model" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsTrending(!isTrending)}
            style={{
              width: 42, height: 24, borderRadius: 12,
              background: isTrending ? 'var(--mint-500)' : 'var(--hairline-strong)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: isTrending ? 20 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--ink-700)' }}>
            Mark as trending (shown first to users)
          </span>
        </div>
      </div>
    </Modal>
  )
}

// ── OpenRouter Browser Modal ───────────────────────────────────────────────────

function OpenRouterBrowser({ existingIds, onAdd }) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all') // all | free | not_added

  const { data, isLoading } = useQuery({
    queryKey: ['openrouter-browse', search],
    queryFn: () => aiApi.browseOpenRouter({ search: search || undefined, limit: 50 }).then(r => r.data.data),
    staleTime: 60_000,
  })

  const models = (data?.models || []).filter(m => {
    if (filter === 'not_added') return !existingIds.includes(m.id)
    if (filter === 'free')      return !m.pricing?.prompt || parseFloat(m.pricing.prompt) === 0
    return true
  })

  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Search 400+ models…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All models</option>
          <option value="free">Free only</option>
          <option value="not_added">Not added yet</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>Loading models…</div>
      ) : (
        <div style={{ maxHeight: 440, overflow: 'auto' }}>
          <div className="stack" style={{ gap: 6 }}>
            {models.map(m => {
              const isAdded = existingIds.includes(m.id)
              return (
                <div key={m.id} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  background: isAdded ? 'rgba(247,127,0,0.04)' : 'var(--paper-tint)',
                  border: `1px solid ${isAdded ? 'rgba(247,127,0,0.2)' : 'var(--hairline)'}`,
                  borderRadius: 'var(--radius-md)',
                  opacity: isAdded ? 0.7 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name || m.id}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 1 }}>
                      {m.id}
                      {m.pricing?.prompt && (
                        <span style={{ marginLeft: 8 }}>
                          {parseFloat(m.pricing.prompt) === 0 ? '· Free' : `· $${m.pricing.prompt}/1K`}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdded ? (
                    <span style={{ fontSize: 11.5, color: 'var(--mint-700)', fontWeight: 500, padding: '3px 8px', background: 'rgba(247,127,0,0.1)', borderRadius: 20 }}>
                      Added ✓
                    </span>
                  ) : (
                    <button className="btn ghost" style={{ fontSize: 12, flexShrink: 0 }} onClick={() => onAdd(m)}>
                      <Icon name="plus" size={12} /> Add
                    </button>
                  )}
                </div>
              )
            })}
            {models.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--ink-500)' }}>No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function AdminAIPanel() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)

  const [tab,         setTab]         = useState('models')
  const [showAdd,     setShowAdd]     = useState(false)
  const [showBrowse,  setShowBrowse]  = useState(false)
  const [editModel,   setEditModel]   = useState(null)
  const [addFromOR,   setAddFromOR]   = useState(null) // pre-fill from OpenRouter browse

  const { data: statsData } = useQuery({
    queryKey: ['ai-admin-stats'],
    queryFn: async () => {
      const res = await aiApi.adminStats()
      return res.data?.data?.stats || res.data?.data || {}
    },
  })

  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => aiApi.getModels().then(r => r.data.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (modelId) => aiApi.toggleModel(modelId),
    onSuccess: () => {
      pushToast({ title: 'Model toggled', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['ai-models'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const stats  = statsData || {}
  const models = modelsData?.models || []
  const existingIds = models.map(m => m.openrouter_id)

  // When user picks a model from OpenRouter browser → pre-fill the Add modal
  function handleORAdd(orModel) {
    setShowBrowse(false)
    setAddFromOR({
      openrouter_id: orModel.id,
      name: orModel.name || orModel.id.split('/').pop(),
      provider_name: orModel.id.split('/')[0],
      tier: (!orModel.pricing?.prompt || parseFloat(orModel.pricing.prompt) === 0) ? 'free' : 'standard',
    })
    setShowAdd(true)
  }

  return (
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Mint AI panel</h1>
          <p className="text-ink-500 font-medium mt-1">Manage models, usage analytics, and AI routing configurations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-ink-200 rounded-xl text-sm font-bold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-all shadow-sm" onClick={() => setShowBrowse(true)}>
            <Icon name="search" size={16} /> Browse OpenRouter
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-white rounded-xl text-sm font-bold hover:bg-ink-800 transition-all shadow-md shadow-ink-900/20" onClick={() => { setAddFromOR(null); setShowAdd(true) }}>
            <Icon name="plus" size={16} /> Add model
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Total generations', value: stats.total_generations ?? 0 },
          { label: 'Completed',         value: stats.completed ?? 0 },
          { label: 'Failed',            value: stats.failed ?? 0 },
          { label: 'Active users',      value: stats.unique_users ?? 0 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-ink-200/60 rounded-[1.5rem] p-6 flex flex-col gap-2 shadow-sm">
            <div className="text-xs font-bold text-ink-500 uppercase tracking-widest">{s.label}</div>
            <div className="text-3xl font-display font-bold text-ink-950 tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-ink-200/60 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
        <div className="border-b border-ink-200 bg-ink-50/50 p-2 flex gap-2 overflow-x-auto">
          <button 
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab === 'models' ? 'bg-white text-ink-950 shadow-sm border border-ink-200/60' : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/50'}`}
            onClick={() => setTab('models')}
          >
            Models ({models.length})
          </button>
          <button 
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab === 'usage' ? 'bg-white text-ink-950 shadow-sm border border-ink-200/60' : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/50'}`}
            onClick={() => setTab('usage')}
          >
            Usage analytics
          </button>
        </div>
        
        <div className="p-6 md:p-8">
          {tab === 'models' && (
            <div className="flex flex-col gap-4">
              {isLoading ? (
                [1,2,3].map(i => <SkeletonCard key={i} />)
              ) : models.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <div className="w-16 h-16 bg-mint-50 text-mint-500 rounded-full flex items-center justify-center mb-6">
                    <Icon name="sparkles" size={28} />
                  </div>
                  <h3 className="text-xl font-display font-bold text-ink-950 mb-2">No models added yet</h3>
                  <p className="text-ink-500 mb-8">Browse OpenRouter to add models to the platform.</p>
                  <button className="flex items-center justify-center gap-2 px-6 py-3 bg-ink-950 text-white rounded-xl text-sm font-bold hover:bg-ink-800 transition-all shadow-md shadow-ink-900/20" onClick={() => setShowBrowse(true)}>
                    <Icon name="search" size={18} /> Browse OpenRouter
                  </button>
                </div>
              ) : (
                models.map(model => {
                  const traffic = model.traffic_status || 'idle'
                  const tmeta   = TRAFFIC_META[traffic] || TRAFFIC_META.idle
                  const tier    = TIER_COLORS[model.tier] || TIER_COLORS.free
                  return (
                    <div key={model.id} className={`bg-ink-50/30 border border-ink-200 rounded-[1.5rem] p-5 md:p-6 transition-opacity ${model.is_active ? 'opacity-100' : 'opacity-50 grayscale-[50%]'}`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex gap-4 items-start">
                          <div className="w-12 h-12 rounded-xl flex shrink-0 items-center justify-center" style={{ background: `${tmeta.color}18` }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: tmeta.color }} />
                          </div>
                          <div>
                            <div className="font-bold text-lg text-ink-950 flex items-center gap-2">
                              {model.name}
                              {model.is_trending && <div className="text-mint-500"><Icon name="trending" size={16} /></div>}
                              {!model.is_active && <span className="text-xs font-bold uppercase tracking-widest text-ink-400 px-2 py-1 bg-ink-100 rounded-md">Disabled</span>}
                            </div>
                            <div className="text-sm text-ink-500 font-medium mt-1">
                              {model.provider_name} <span className="mx-2 opacity-30">|</span> <span className="font-mono text-xs opacity-70">{model.openrouter_id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                            {model.tier}
                          </span>
                          <span className="text-xs font-bold" style={{ color: tmeta.color }}>
                            {tmeta.label}
                          </span>
                          <div className="h-4 w-px bg-ink-200 mx-1"></div>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink-600 hover:text-ink-950 hover:bg-ink-100 rounded-lg transition-colors" onClick={() => setEditModel(model)}>
                            <Icon name="edit" size={14} /> Edit
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate(model.id)}
                            disabled={toggleMutation.isPending}
                            className={`w-11 h-6 rounded-full relative transition-colors ${model.is_active ? 'bg-mint-500' : 'bg-ink-200'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${model.is_active ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6 pt-5 border-t border-ink-100 text-sm">
                        <div className="text-ink-500">Requests: <strong className="text-ink-900">{model.total_requests || 0}</strong></div>
                        <div className="text-ink-500">Failures: <strong className={model.total_failures > 0 ? 'text-rose-600' : 'text-ink-900'}>{model.total_failures || 0}</strong></div>
                        {model.avg_response_ms > 0 && <div className="text-ink-500">Avg: <strong className="text-ink-900">{Math.round(model.avg_response_ms)}ms</strong></div>}
                        {model.user_price_per_1k_tokens != null && <div className="text-ink-500">User price: <strong className="text-ink-900">INR {model.user_price_per_1k_tokens}/1K</strong></div>}
                        {model.provider_cost_per_1k_tokens != null && <div className="text-ink-500">Cost: <strong className="text-ink-900">INR {model.provider_cost_per_1k_tokens}/1K</strong></div>}
                        <div className="text-ink-500">Tools: <strong className="text-ink-900">{normalizeTools(model.supported_tools).join(', ') || '—'}</strong></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {tab === 'usage' && (
            <div className="overflow-x-auto rounded-2xl border border-ink-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ink-50/80 border-b border-ink-200">
                    {['Model', 'Tier', 'Requests', 'Failures', 'Avg response', 'Error rate'].map((h, i) => (
                      <th key={h} className={`px-5 py-4 text-[10px] font-bold text-ink-500 uppercase tracking-widest ${i >= 2 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {models.filter(m => (m.total_requests || 0) > 0).map((m) => {
                    const errRate = m.total_requests > 0 ? ((m.total_failures / m.total_requests) * 100).toFixed(1) : '0'
                    const tier    = TIER_COLORS[m.tier] || TIER_COLORS.free
                    return (
                      <tr key={m.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold text-ink-950">{m.name}</div>
                          <div className="text-xs text-ink-500 mt-0.5">{m.provider_name}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                            {m.tier}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-bold text-ink-950">{m.total_requests || 0}</td>
                        <td className={`px-5 py-4 text-right text-sm font-bold ${m.total_failures > 0 ? 'text-rose-600' : 'text-ink-950'}`}>{m.total_failures || 0}</td>
                        <td className="px-5 py-4 text-right text-sm text-ink-700">{m.avg_response_ms ? `${Math.round(m.avg_response_ms)}ms` : '—'}</td>
                        <td className={`px-5 py-4 text-right text-sm font-bold ${parseFloat(errRate) > 10 ? 'text-rose-600' : 'text-ink-950'}`}>{errRate}%</td>
                      </tr>
                    )
                  })}
                  {models.filter(m => m.total_requests > 0).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-ink-500 text-sm font-medium">
                        No usage data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit model modal */}
      {(showAdd || editModel) && (
        <ModelModal
          model={editModel || (addFromOR ? { ...addFromOR, supported_tools: [] } : null)}
          models={models}
          onClose={() => { setShowAdd(false); setEditModel(null); setAddFromOR(null) }}
        />
      )}

      {/* OpenRouter browser modal */}
      {showBrowse && (
        <Modal
          title="Browse OpenRouter models"
          subtitle="400+ models available"
          onClose={() => setShowBrowse(false)}
          maxWidth={700}
        >
          <OpenRouterBrowser
            existingIds={existingIds}
            onAdd={handleORAdd}
          />
        </Modal>
      )}
    </div>
  )
}
