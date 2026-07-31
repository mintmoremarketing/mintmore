const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

// 1. Swap Sidebar labels
code = code.replace(
  "{ step: 4, label: 'Visual Palette' },\n                { step: 5, label: 'Brand Assets' }",
  "{ step: 4, label: 'Brand Assets' },\n                { step: 5, label: 'Visual Palette' }"
);

// 2. Extract Step 4 Block
const step4Start = '          {/* STEP 4: Brand Colors */}';
const step5Start = '          {/* STEP 5: Brand Assets (Logos & Files) */}';
const step6Start = '          {/* STEP 6: Content Cadence */}';

const s4Idx = code.indexOf(step4Start);
const s5Idx = code.indexOf(step5Start);
const s6Idx = code.indexOf(step6Start);

let step4Block = code.substring(s4Idx, s5Idx);
let step5Block = code.substring(s5Idx, s6Idx);

// 3. Swap the steps inside the blocks
step4Block = step4Block.replace('{/* STEP 4: Brand Colors */}', '{/* STEP 5: Brand Colors */}');
step4Block = step4Block.replace('{step === 4 && (', '{step === 5 && (');

step5Block = step5Block.replace('{/* STEP 5: Brand Assets (Logos & Files) */}', '{/* STEP 4: Brand Assets (Logos & Files) */}');
step5Block = step5Block.replace('{step === 5 && (', '{step === 4 && (');

// 4. Transform Step 5 (Visual Palette)

// Remove "Extract colors from your logo"
const extractCardRegex = /<div className="card" style=\{\{ padding: 16, background: 'var\(--paper-tint\)', border: '1px dashed var\(--hairline-strong\)', borderRadius: 14 \}\}>[\s\S]*?<\/div>\s*<\/div>\s*\)\s*\}/;
step4Block = step4Block.replace(extractCardRegex, '</div>\n          )}');

// Remove "Custom Palette Colors" (small color picker boxes)
const smallPickersRegex = /<div className="field">\s*<label className="field-label">Custom Palette Colors<\/label>[\s\S]*?<\/div>\s*<\/div>/;
step4Block = step4Block.replace(smallPickersRegex, '');

// Update Large Color Tiles to be Interactive!
const oldTilesRegex = /<div style=\{\{ display: 'flex', gap: 12 \}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const newTiles = `<div style={{ display: 'flex', gap: 12 }}>
                {form.palette.map((color, idx) => (
                  <label key={idx} className="group relative block" style={{ flex: 1, cursor: 'pointer' }}>
                    <div className="transition-all duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-orange-500 group-hover:ring-offset-2" style={{
                      aspectRatio: '1', borderRadius: 12, background: color, border: '2px solid var(--hairline-strong)',
                      marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }} />
                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        const newPalette = [...form.palette]
                        newPalette[idx] = e.target.value
                        updateField('palette', newPalette)
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div style={{ textAlign: 'center' }}>
                      <code style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{color}</code>
                    </div>
                  </label>
                ))}
              </div>
            </div>`;

step4Block = step4Block.replace(oldTilesRegex, newTiles);

// 5. Re-assemble code (putting Step 5 Block first, then Step 4 Block)
code = code.substring(0, s4Idx) + step5Block + step4Block + code.substring(s6Idx);

fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Successfully applied all Step 4 & 5 enhancements!');
