const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

const newStep6 = `          {/* STEP 6: Content Cadence */}
          {step === 6 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Set content frequency</h1>
                <p className="muted" style={{ marginTop: 8 }}>Determine how often Autopilot schedules and drafts content.</p>
              </div>

              <div className="field">
                <label className="field-label">Posting Frequency</label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { id: '1', title: '1 Post per week', desc: 'Basic presence' },
                    { id: '3', title: '3 Posts per week', desc: 'Recommended balance', recommended: true },
                    { id: '5', title: '5 Posts per week', desc: 'High growth' },
                    { id: '7', title: 'Daily posts', desc: 'Maximum visibility' }
                  ].map(option => {
                    const isSelected = form.posting_frequency === option.id;
                    return (
                      <div
                        key={option.id}
                        onClick={() => updateField('posting_frequency', option.id)}
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
                        <div className={\`text-xs \${isSelected ? 'text-orange-600/80' : 'text-ink-500'}\`}>
                          {option.desc}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

`;

const marker = '          {/* STEP 7: Festivals & Occasions */}';
code = code.replace(marker, newStep6 + marker);
fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Restored and updated step 6 successfully');
