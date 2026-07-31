const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

const step12Start = '          {/* STEP 12: First post preview approval */}';
const sIdx = code.indexOf(step12Start);
if(sIdx === -1) {
  console.log('Step 12 start not found');
  process.exit(1);
}

// Find the first `          )}` after sIdx
const endMarker = '          )}';
const eIdx = code.indexOf(endMarker, sIdx);
if(eIdx === -1) {
  console.log('Step 12 end not found');
  process.exit(1);
}

const newStep12 = `          {/* STEP 12: Calendar Review */}
          {step === 12 && (
            <div className="flex flex-col lg:flex-row w-full flex-1 min-h-0 animate-fade-in h-full relative">
              
              {/* Left Column (Header + Calendar Grid) */}
              <div className="flex-1 flex flex-col min-w-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <div className="text-center md:text-left px-6 py-6 sm:px-10 sm:py-8 md:px-12 shrink-0">
                  <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--orange-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                    Autopilot Configuration
                  </div>
                  <h1 className="h-display h-1" style={{ margin: 0 }}>Review your first month plan</h1>
                  <p className="text-ink-500 text-sm md:text-base mt-2 max-w-2xl">Here is your tailored content calendar. We've aligned your approved topics with optimal posting dates.</p>
                </div>
                
                {/* Modern Calendar Panel */}
                <div className="w-full flex-1 flex flex-col">
                  
                  {/* Calendar Grid */}
                  <div className="p-6 md:p-8 flex-1">
                    <div className="grid grid-cols-7 gap-x-2 gap-y-4 text-center text-xs font-bold text-ink-400 mb-4">
                      <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2 flex-1">
                      {scheduledDays.map((data, i) => {
                        const isSelected = selectedDayIndex === i
                        return (
                          <div 
                            key={i}
                            onClick={() => {
                              if (data) setSelectedDayIndex(isSelected ? null : i)
                            }}
                            className={\`relative border rounded-2xl flex flex-col p-2 min-h-[90px] transition-all duration-300 \${
                              isSelected ? 'bg-orange-500/10 border-orange-500 shadow-md ring-2 ring-orange-500/30 ring-offset-1' :
                              data ? 'bg-white border-ink-200 hover:border-orange-500 hover:shadow-md cursor-pointer' : 
                              'bg-ink-50/50 border-ink-100 opacity-60'
                            }\`}
                          >
                            <span className={\`text-sm font-bold \${isSelected ? 'text-orange-600' : 'text-ink-900'} text-center mt-1\`}>
                              {15 + i > 30 ? 15 + i - 30 : 15 + i}
                            </span>
                            
                            {data && (
                              <div className="mt-auto mb-1 flex justify-center">
                                <div className={\`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full \${
                                  data.format === 'Reel' ? 'bg-pink-500 text-white' :
                                  data.format === 'Carousel' ? 'bg-blue-500 text-white' :
                                  'bg-orange-500 text-white'
                                }\`}>
                                  {data.format}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
`;

code = code.substring(0, sIdx) + newStep12 + code.substring(eIdx + endMarker.length);

// Insert states
const stateInjection = `
  const [scheduledDays, setScheduledDays] = useState([])
  const [expandedTopicIndex, setExpandedTopicIndex] = useState(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(null)
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapDayIndex, setSwapDayIndex] = useState(null)
  const [swapTab, setSwapTab] = useState('festivals')
  const [customSwapText, setCustomSwapText] = useState('')

  useEffect(() => {
    if (step === 12 && scheduledDays.length === 0) {
      const days = Array(28).fill(null)
      days[14] = { format: 'Reel', topic: { title: 'Behind the Scenes', desc: 'A quick look at our daily operations.' } }
      days[16] = { format: 'Carousel', topic: { title: 'Top 5 Tips', desc: 'Educational carousel.' } }
      days[18] = { format: 'Post', topic: { title: 'Customer Review', desc: 'Highlighting a great review.' } }
      days[21] = { format: 'Reel', topic: { title: 'Product Showcase', desc: 'Showing off our best features.' } }
      days[23] = { format: 'Carousel', topic: { title: 'Industry Trends', desc: 'What is happening in the industry.' } }
      days[25] = { format: 'Post', topic: { title: 'Industry Trends', desc: 'Building excitement for the future.' } }
      setScheduledDays(days)
    }
  }, [step, scheduledDays.length])
`

code = code.replace('  const [step, setStep] = useState(1)', '  const [step, setStep] = useState(1)\n' + stateInjection);

// Now we insert the SidePanel at the end, right before the last </div>
const sidePanelCode = `
      {/* Right Side Panel (Step 12) */}
      {step === 12 && (
        <div className="w-full lg:w-[340px] flex flex-col shrink-0 bg-gradient-to-b from-ink-950 to-ink-900 text-white relative overflow-hidden lg:h-full border-l border-ink-800 lg:fixed lg:right-0 lg:top-0 z-20">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
          
          <div className="p-6 pb-4 border-b border-white/10 shrink-0 relative z-10">
            <h3 className="text-sm font-bold tracking-widest uppercase text-ink-300 flex items-center gap-2">
              <Icon name="sparkles" size={14} className="text-white" /> Topic Details
            </h3>
          </div>
          
          <div className="flex-1 flex flex-col relative z-10 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
            {selectedDayIndex !== null && scheduledDays[selectedDayIndex] ? (
              (() => {
                const data = scheduledDays[selectedDayIndex];
                return (
                  <div className="flex flex-col gap-4 animate-fade-in-up p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-white bg-white/10 px-3 py-1 rounded-full border border-white/20">Day {selectedDayIndex + 1}</span>
                      <span className={\`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full \${
                        data.format === 'Reel' ? 'bg-pink-500/20 text-pink-400' :
                        data.format === 'Carousel' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-orange-500/20 text-orange-400'
                      }\`}>{data.format}</span>
                    </div>
                    <h4 className="font-bold text-xl leading-tight text-white">{data.topic?.title}</h4>
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-sm text-ink-300 leading-relaxed">{data.topic?.desc}</p>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {scheduledDays.map((data, i) => {
                  if (!data) return null;
                  return (
                    <div 
                      key={i}
                      onClick={() => setExpandedTopicIndex(expandedTopicIndex === i ? null : i)}
                      className={\`p-3.5 rounded-xl border transition-all cursor-pointer \${expandedTopicIndex === i ? 'bg-white/10 border-white/30 shadow-md' : 'bg-white/5 border-white/10 hover:border-white/20'}\`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">Day {15 + i > 30 ? 15 + i - 30 : 15 + i}</span>
                        <span className={\`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full \${
                          data.format === 'Reel' ? 'bg-pink-500/20 text-pink-400' :
                          data.format === 'Carousel' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-orange-500/20 text-orange-400'
                        }\`}>{data.format}</span>
                      </div>
                      <h4 className="font-bold text-sm leading-tight text-white">
                        {data.topic?.title}
                      </h4>
                      
                      {expandedTopicIndex === i && (
                        <div className="mt-3 pt-3 border-t border-white/10 animate-fade-in text-xs text-ink-300 leading-relaxed">
                          <p className="mb-3">{data.topic?.desc}</p>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwapDayIndex(i);
                              setSwapModalOpen(true);
                            }}
                            className="w-full py-2.5 text-xs rounded-xl border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-colors flex items-center justify-center gap-2"
                          >
                            Swap Scheduled Topic
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Approve Action */}
          <div className="p-6 pt-4 shrink-0 relative z-10 bg-ink-950/50 backdrop-blur-md">
            <button 
              className="w-full rounded-2xl py-4 font-bold text-[15px] shadow-lg shadow-orange-500/20 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 bg-orange-500 text-white hover:bg-orange-600" 
              onClick={() => {}}
            >
              <Icon name="check" size={18} /> 
              Approve and Finish
            </button>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {swapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col border border-ink-100">
            <div className="p-5 border-b border-ink-100 flex items-center justify-between shrink-0 bg-ink-50/50">
              <h3 className="font-bold text-lg text-ink-950">Swap Scheduled Topic</h3>
              <button onClick={() => setSwapModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-100 text-ink-500 hover:text-ink-950 transition-colors">
                <Icon name="x" size={16} />
              </button>
            </div>
            
            <div className="flex px-4 border-b border-ink-100 pt-2">
              {[{id: 'festivals', label: 'Other Festivals'}, {id: 'brands', label: 'Unused Topics'}, {id: 'custom', label: 'Custom Request'}].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSwapTab(tab.id)}
                  className={\`pb-3 px-4 text-sm font-medium border-b-2 transition-colors \${swapTab === tab.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-ink-500 hover:text-ink-900'}\`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
              {swapTab === 'festivals' && (
                <div className="text-sm text-ink-500 text-center py-8">
                  No other festivals fall exactly on this day.
                </div>
              )}
              {swapTab === 'brands' && (
                <div className="text-sm text-ink-500 text-center py-8">
                  No extra topics generated. Try custom!
                </div>
              )}
              {swapTab === 'custom' && (
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-ink-950">What do you want to post instead?</label>
                  <textarea 
                    value={customSwapText}
                    onChange={e => setCustomSwapText(e.target.value)}
                    placeholder="E.g., Announcement about our new summer collection..."
                    className="p-3 rounded-xl min-h-[100px] resize-none border border-ink-200 bg-ink-50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-ink-950"
                  />
                  <button 
                    className="px-4 py-2 bg-orange-500 text-white rounded-xl font-medium self-end mt-2 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!customSwapText.trim()}
                    onClick={() => setSwapModalOpen(false)}
                  >
                    Confirm Swap
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-ink-100 bg-ink-50/50 flex items-center justify-end gap-3">
              <button className="px-4 py-2 rounded-xl font-medium text-ink-700 hover:bg-ink-100 transition-colors" onClick={() => setSwapModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20"
                onClick={() => setSwapModalOpen(false)}
              >
                Swap Scheduled Topic
              </button>
            </div>
          </div>
        </div>
      )}
`

const lastDivIdx = code.lastIndexOf('    </div>');
const mainContentCloseIdx = code.lastIndexOf('      </div>', lastDivIdx);
if (mainContentCloseIdx !== -1) {
    let insertIdx = mainContentCloseIdx + '      </div>'.length;
    if (code[insertIdx] === '\r') insertIdx++;
    if (code[insertIdx] === '\n') insertIdx++;
    code = code.substring(0, insertIdx) + sidePanelCode + code.substring(insertIdx);
} else {
    code = code.replace(/    <\/div>\s*<\/div>\s*\)\s*}/, '    </div>\n' + sidePanelCode + '    </div>\n  )\n}');
}

fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Successfully generated updated Onboarding.jsx');
