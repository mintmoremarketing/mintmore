const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

const oldManual = `              {/* Manual festival checklist */}
              {form.festival_mode === 'manual' && (
                <div className="field animate-in fade-in duration-300">
                  <label className="field-label">Select the occasions to cover</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {(onboardingEvents && onboardingEvents.length > 0 ? onboardingEvents : [
                      { id: 'diwali', title: 'Diwali', date: '2026-11-01', region: 'National' },
                      { id: 'holi', title: 'Holi', date: '2026-03-25', region: 'National' },
                      { id: 'eid', title: 'Eid', date: '2026-04-10', region: 'National' },
                      { id: 'durga_puja', title: 'Durga Puja', date: '2026-10-20', region: 'East & West' },
                      { id: 'christmas', title: 'Christmas', date: '2026-12-25', region: 'Global' },
                      { id: 'ganesh_chaturthi', title: 'Ganesh Chaturthi', date: '2026-09-15', region: 'West & National' },
                      { id: 'independence_day', title: 'Independence Day', date: '2026-08-15', region: 'National' },
                      { id: 'republic_day', title: 'Republic Day', date: '2026-01-26', region: 'National' },
                    ]).map(fest => {
                      const active = form.selected_festivals.includes(fest.id)
                      const dateStr = fest.date 
                        ? new Date(fest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : fest.region || 'National'
                      return (
                        <div
                          key={fest.id}
                          onClick={() => toggleFestival(fest.id)}
                          style={{
                            padding: 14,
                            border: \`1.5px solid \${active ? 'var(--ink-950)' : 'var(--hairline-strong)'}\`,
                            borderRadius: 14,
                            cursor: 'pointer',
                            background: active ? 'var(--paper-tint)' : 'var(--paper)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: active ? 'var(--ink-950)' : 'var(--paper-tint)',
                            color: active ? '#fff' : 'var(--ink-300)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <Icon name={active ? 'check' : 'plus'} size={12} style={{ color: active ? '#fff' : 'var(--ink-500)' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-950)' }}>{fest.title || fest.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-550)', marginTop: 2 }}>{dateStr}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}`;

const newManual = `              {/* Manual festival checklist */}
              {form.festival_mode === 'manual' && (
                <div className="field animate-in fade-in duration-300" style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--paper-tint)', border: '1px dashed var(--hairline-strong)', textAlign: 'center' }}>
                  <Icon name="calendar" size={24} style={{ color: 'var(--ink-400)', marginBottom: 8, display: 'inline-block' }} />
                  <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink-800)' }}>You can choose later from the calendar</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-550)', marginTop: 4 }}>Once onboarding is complete, you'll be able to hand-pick specific festivals from your social calendar.</div>
                </div>
              )}`;

const oldLead = `              {/* Lead time */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>Design lead time</label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', padding: '3px 10px', borderRadius: 8 }}>{form.festival_lead_days} days before</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="14"
                  step="1"
                  value={form.festival_lead_days}
                  onChange={e => updateField('festival_lead_days', e.target.value)}
                  className="w-full h-1.5 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-orange-"
                  style={{ outline: 'none' }}
                />
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>How many days before each festival Mintbox begins designing the post and sends you a preview.</p>
              </div>`;

const newLead = `              {/* Lead time tiles */}
              <div className="field">
                <label className="field-label">Design lead time</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { id: '3', title: '3 days before', desc: 'Fast turnaround' },
                    { id: '7', title: '7 days before', desc: 'Recommended', recommended: true },
                    { id: '11', title: '11 days before', desc: 'Plenty of time' }
                  ].map(option => {
                    const isSelected = String(form.festival_lead_days) === option.id;
                    return (
                      <div
                        key={option.id}
                        onClick={() => updateField('festival_lead_days', option.id)}
                        className={\`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center gap-1 \${
                          isSelected 
                            ? 'border-orange-500 bg-orange-50/50 shadow-md shadow-orange-500/10 scale-[1.02]' 
                            : 'border-ink-200 bg-white hover:border-orange-300 hover:bg-orange-50/20'
                        }\`}
                      >
                        {option.recommended && (
                          <div className="absolute -top-2.5 bg-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                            Recommended
                          </div>
                        )}
                        <div className={\`font-bold text-sm \${isSelected ? 'text-orange-700' : 'text-ink-900'}\`}>
                          {option.title}
                        </div>
                        <div className={\`text-[10px] \${isSelected ? 'text-orange-600/80' : 'text-ink-500'}\`}>
                          {option.desc}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="muted" style={{ margin: '12px 0 0', fontSize: 12 }}>How many days before each festival Mintbox begins designing the post and sends you a preview.</p>
              </div>`;

code = code.replace(oldManual, newManual);
code = code.replace(oldLead, newLead);

fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Success');
