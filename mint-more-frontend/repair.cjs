const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

const targetStr = `                          {num}

              </div>
          )}

          {/* STEP 6: Content Cadence */}`;

// Let's just use string replacement manually via indexOf.
const startAnchor = `                          {num}
                        >
                          {num}`; // wait, my view_file showed exactly:
// 1208:                         >
// 1209:                           {num}
// 1210: 
// 1211:               </div>
// 1212:           )}
// 1213: 
// 1214:           {/* STEP 6: Content Cadence */}

const anchorStart = code.indexOf('                          {num}\n\n              </div>\n          )}\n\n          {/* STEP 6: Content Cadence */}');
if (anchorStart !== -1) {
    console.log('Found with exact match');
} else {
    // fuzzy match
    const regex = /                          \{num\}\r?\n\r?\n              <\/div>\r?\n          \)\}\r?\n\r?\n          \{\/\* STEP 6: Content Cadence \*\/\}/;
    if (code.match(regex)) {
        console.log('Found with regex');
        
        const replacement = `                          {num}
                        </button>
                      )
                    })}
                  </div>
                  <button className="btn ghost" type="button" onClick={handleSuggestPalette} style={{ padding: '4px 10px', fontSize: 11.5 }}>
                    <Icon name="sparkles" size={13} /> Suggest palette
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {form.palette.map((color, idx) => (
                  <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                    <div 
                      className="transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-orange-500 hover:ring-offset-2 cursor-pointer"
                      onClick={() => document.getElementById(\`color-picker-\${idx}\`).click()}
                      style={{
                        aspectRatio: '1', borderRadius: 12, background: color, border: '2px solid var(--hairline-strong)',
                        marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }} 
                    />
                    <input
                      id={\`color-picker-\${idx}\`}
                      type="color"
                      value={color}
                      onChange={e => {
                        const newPalette = [...form.palette]
                        newPalette[idx] = e.target.value
                        updateField('palette', newPalette)
                      }}
                      style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                    />
                    <code style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{color}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: Content Cadence */}`;
          
        code = code.replace(regex, replacement);
        fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
        console.log('Replaced successfully');
    } else {
        console.log('Not found at all');
    }
}

