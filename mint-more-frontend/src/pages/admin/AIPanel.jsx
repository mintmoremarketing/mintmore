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
  free:     { bg: 'rgba(16,185,129,0.1)',  color: 'var(--mint-700)' },
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
                  background: isAdded ? 'rgba(16,185,129,0.04)' : 'var(--paper-tint)',
                  border: `1px solid ${isAdded ? 'rgba(16,185,129,0.2)' : 'var(--hairline)'}`,
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
                    <span style={{ fontSize: 11.5, color: 'var(--mint-700)', fontWeight: 500, padding: '3px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: 20 }}>
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
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Mint AI panel</h1>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => setShowBrowse(true)}>
              <Icon name="search" /> Browse OpenRouter
            </button>
            <button className="btn primary" onClick={() => { setAddFromOR(null); setShowAdd(true) }}>
              <Icon name="plus" /> Add model
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="reveal">
        {[
          { label: 'Total generations', value: stats.total_generations ?? 0 },
          { label: 'Completed',         value: stats.completed ?? 0 },
          { label: 'Failed',            value: stats.failed ?? 0 },
          { label: 'Active users',      value: stats.unique_users ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ padding: 18, background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'models', label: `Models (${models.length})` },
        { value: 'usage',  label: 'Usage analytics' },
      ]} />

      {tab === 'models' && (
        <div className="stack" style={{ gap: 10 }}>
          {isLoading ? (
            [1,2,3].map(i => <SkeletonCard key={i} />)
          ) : models.length === 0 ? (
            <div className="empty">
              <div className="empty-glyph"><Icon name="sparkles" size={22} /></div>
              <h3>No models added yet</h3>
              <p>Browse OpenRouter to add models to the platform.</p>
              <button className="btn primary" onClick={() => setShowBrowse(true)}>
                <Icon name="search" /> Browse OpenRouter
              </button>
            </div>
          ) : (
            models.map(model => {
              const traffic = model.traffic_status || 'idle'
              const tmeta   = TRAFFIC_META[traffic] || TRAFFIC_META.idle
              const tier    = TIER_COLORS[model.tier] || TIER_COLORS.free
              return (
                <div key={model.id} style={{
                  background: 'var(--paper)', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-lg)', padding: 18,
                  opacity: model.is_active ? 1 : 0.5,
                  transition: 'opacity 0.2s',
                }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${tmeta.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: tmeta.color }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                          {model.name}
                          {model.is_trending && <Icon name="trending" size={12} />}
                          {!model.is_active && (
                            <span style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 400 }}>Disabled</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                          {model.provider_name} · <span className="mono">{model.openrouter_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: 0.04, padding: '3px 9px', borderRadius: 20,
                        background: tier.bg, color: tier.color,
                      }}>
                        {model.tier}
                      </span>
                      <span style={{ fontSize: 11.5, color: tmeta.color, fontWeight: 500 }}>
                        {tmeta.label}
                      </span>
                      <button
                        className="btn ghost"
                        style={{ fontSize: 12 }}
                        onClick={() => setEditModel(model)}
                      >
                        <Icon name="edit" size={12} /> Edit
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate(model.id)}
                        disabled={toggleMutation.isPending}
                        style={{
                          width: 42, height: 24, borderRadius: 12,
                          background: model.is_active ? 'var(--mint-500)' : 'var(--hairline-strong)',
                          border: 'none', cursor: 'pointer', position: 'relative',
                          transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2,
                          left: model.is_active ? 20 : 2,
                          width: 20, height: 20, borderRadius: '50%', background: 'white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="row" style={{ gap: 20, marginTop: 12, fontSize: 12, color: 'var(--ink-500)', flexWrap: 'wrap' }}>
                    <span>Requests: <strong style={{ color: 'var(--ink-800)' }}>{model.total_requests || 0}</strong></span>
                    <span>Failures: <strong style={{ color: model.total_failures > 0 ? 'var(--rose)' : 'var(--ink-800)' }}>{model.total_failures || 0}</strong></span>
                    {model.avg_response_ms > 0 && (
                      <span>Avg: <strong style={{ color: 'var(--ink-800)' }}>{Math.round(model.avg_response_ms)}ms</strong></span>
                    )}
                    {model.user_price_per_1k_tokens != null && (
                      <span>User price: <strong style={{ color: 'var(--ink-800)' }}>INR {model.user_price_per_1k_tokens}/1K</strong></span>
                    )}
                    {model.provider_cost_per_1k_tokens != null && (
                      <span>Provider cost: <strong style={{ color: 'var(--ink-800)' }}>INR {model.provider_cost_per_1k_tokens}/1K</strong></span>
                    )}
                    <span>Tools: <strong style={{ color: 'var(--ink-800)' }}>{normalizeTools(model.supported_tools).join(', ') || '—'}</strong></span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'usage' && (
        <div className="stack" style={{ gap: 14 }}>
          {/* Per-model usage table */}
          <div className="card-flat">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--paper-tint)', borderBottom: '1px solid var(--hairline)' }}>
                  {['Model', 'Tier', 'Requests', 'Failures', 'Avg response', 'Error rate'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.04, color: 'var(--ink-500)', textAlign: i >= 2 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.filter(m => (m.total_requests || 0) > 0).map((m) => {
                  const errRate = m.total_requests > 0 ? ((m.total_failures / m.total_requests) * 100).toFixed(1) : '0'
                  const tier    = TIER_COLORS[m.tier] || TIER_COLORS.free
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{m.provider_name}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tier.bg, color: tier.color, textTransform: 'uppercase' }}>
                          {m.tier}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>{m.total_requests || 0}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: (m.total_failures || 0) > 0 ? 'var(--rose)' : 'var(--ink-800)' }}>{m.total_failures || 0}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13 }}>{m.avg_response_ms ? `${Math.round(m.avg_response_ms)}ms` : '—'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: parseFloat(errRate) > 10 ? 'var(--rose)' : 'var(--ink-800)' }}>{errRate}%</td>
                    </tr>
                  )
                })}
                {models.filter(m => m.total_requests > 0).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
                      No usage data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          maxWidth={600}
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
