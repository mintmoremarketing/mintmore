import re

with open('src/pages/admin/AIPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_str = r'  return \(\n    <div className="stack-6">'
replacement = '''  return (
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
'''

new_content = re.sub(start_str + r'.*?  \)\n}\n', replacement, content, flags=re.DOTALL)
if new_content == content:
    print('Failed to replace AdminAIPanel')
else:
    with open('src/pages/admin/AIPanel.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Successfully replaced AdminAIPanel')
