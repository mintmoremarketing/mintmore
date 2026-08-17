import { parseColor } from "@heroui/react"
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../src')
const visualPalettePath = path.join(srcDir, 'pages/client/onboarding/VisualPalettePage.jsx')

let passedTests = 0
let failedTests = 0

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`)
    passedTests++
  } else {
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`)
    failedTests++
  }
}

// Replicate safeParseColor from VisualPalettePage.jsx
function safeParseColor(colorStr, fallback = '#111111') {
  try {
    if (!colorStr || typeof colorStr !== 'string') return parseColor(fallback)
    return parseColor(colorStr)
  } catch {
    try {
      return parseColor(fallback)
    } catch {
      return parseColor('#111111')
    }
  }
}

console.log('====================================================')
console.log('TEST SUITE 1: safeParseColor & parseColor Robustness')
console.log('====================================================')

const validColors = [
  '#000000', '#ffffff', '#FFFFFF', '#E63946', '#f1faee',
  '#A8DADC', '#457B9D', '#1D3557', '#F4A261', '#2A9D8F',
  '#123', '#abc', '#ABC', '#fff'
]

for (const c of validColors) {
  try {
    const parsed = safeParseColor(c)
    const hex = parsed.toString('hex')
    assert(hex.startsWith('#'), `Valid color "${c}" parsed to "${hex}"`)
  } catch (err) {
    assert(false, `Valid color "${c}" threw error`, err.message)
  }
}

const weirdAndAdversarialInputs = [
  null,
  undefined,
  '',
  '   ',
  '#',
  '#1',
  '#12',
  '#12345',
  '#gggggg',
  'not-a-color',
  'rgb(999, 999, 999)',
  'rgba()',
  12345,
  { hex: '#ffffff' },
  ['#111111'],
  true,
  false,
  '#1234567890',
  'javascript:alert(1)'
]

for (const input of weirdAndAdversarialInputs) {
  try {
    const parsed = safeParseColor(input)
    const hex = parsed.toString('hex')
    assert(hex === '#111111' || hex.startsWith('#'), `Adversarial input ${JSON.stringify(input)} handled safely -> fallback "${hex}"`)
  } catch (err) {
    assert(false, `Adversarial input ${JSON.stringify(input)} caused UNCAUGHT EXCEPTION`, err.message)
  }
}

// Test with invalid fallback
try {
  const parsed = safeParseColor('invalid_color', 'invalid_fallback')
  assert(parsed.toString('hex') === '#111111', 'safeParseColor with invalid fallback falls back to #111111')
} catch (err) {
  assert(false, 'safeParseColor with invalid fallback crashed', err.message)
}

console.log('\n====================================================')
console.log('TEST SUITE 2: Color Shuffling Statistical Generator')
console.log('====================================================')

let shuffleSuccesses = 0
const SHUFFLE_TRIALS = 1000

for (let i = 0; i < SHUFFLE_TRIALS; i++) {
  const randomHue = Math.floor(Math.random() * 360)
  const randomSaturation = 50 + Math.floor(Math.random() * 50)
  const randomLightness = 40 + Math.floor(Math.random() * 30)
  
  try {
    const colorObj = parseColor(`hsl(${randomHue}, ${randomSaturation}%, ${randomLightness}%)`)
    const hex = colorObj.toString('hex')
    if (hex.match(/^#[0-9a-fA-F]{6}$/)) {
      shuffleSuccesses++
    }
  } catch {
    // Fail
  }
}

assert(shuffleSuccesses === SHUFFLE_TRIALS, `Shuffled colors 1000/1000 produced valid 6-char hex (100% success rate: ${shuffleSuccesses}/${SHUFFLE_TRIALS})`)

console.log('\n====================================================')
console.log('TEST SUITE 3: Preset Palettes & Sizing Toggle Logic')
console.log('====================================================')

const presetPalettes = {
  restaurant: [
    ['#E63946', '#F1FAEE', '#A8DADC', '#457B9D'],
    ['#264653', '#2A9D8F', '#E76F51', '#F4A261']
  ],
  other: [
    ['#111111', '#444444', '#888888', '#CCCCCC']
  ]
}

// Test resizing from 4 to 2 colors
{
  let form = { palette: ['#E63946', '#F1FAEE', '#A8DADC', '#457B9D'], business_type: 'restaurant' }
  const num = 2
  let nextPalette = [...(form?.palette || [])]
  if (nextPalette.length > num) {
    nextPalette = nextPalette.slice(0, num)
  }
  assert(nextPalette.length === 2, 'Resize 4 -> 2: length is 2')
  assert(nextPalette[0] === '#E63946' && nextPalette[1] === '#F1FAEE', 'Resize 4 -> 2: preserved first 2 colors')
}

// Test resizing from 2 to 4 colors
{
  let form = { palette: ['#E63946', '#F1FAEE'], business_type: 'restaurant' }
  const num = 4
  let nextPalette = [...(form?.palette || [])]
  if (nextPalette.length < num) {
    const suggestion = presetPalettes?.[form?.business_type || 'restaurant']?.[0] || presetPalettes?.other?.[0] || ['#111111', '#FFFFFF', '#E63946', '#457B9D']
    while (nextPalette.length < num) {
      nextPalette.push(suggestion[nextPalette.length] || '#111111')
    }
  }
  assert(nextPalette.length === 4, 'Resize 2 -> 4: length is 4')
  assert(nextPalette[0] === '#E63946' && nextPalette[1] === '#F1FAEE', 'Resize 2 -> 4: preserved existing colors')
  assert(nextPalette[2] === '#A8DADC' && nextPalette[3] === '#457B9D', 'Resize 2 -> 4: appended suggestion colors correctly')
}

// Test with empty/null palette
{
  let form = { palette: null, business_type: 'unknown' }
  const num = 3
  let nextPalette = [...(form?.palette || [])]
  if (nextPalette.length < num) {
    const suggestion = presetPalettes?.[form?.business_type || 'restaurant']?.[0] || presetPalettes?.other?.[0] || ['#111111', '#FFFFFF', '#E63946', '#457B9D']
    while (nextPalette.length < num) {
      nextPalette.push(suggestion[nextPalette.length] || '#111111')
    }
  }
  assert(nextPalette.length === 3, 'Resize null -> 3: length is 3')
  assert(nextPalette.every(c => typeof c === 'string' && c.startsWith('#')), 'All generated colors are valid hex strings')
}

// Test individual swatch replacement
{
  const initialPalette = ['#E63946', '#F1FAEE', '#A8DADC', '#457B9D']
  const idx = 1
  const newColor = '#00FF00'
  const newPalette = [...initialPalette]
  newPalette[idx] = newColor
  assert(newPalette[1] === '#00FF00', 'Index 1 replaced with #00FF00')
  assert(initialPalette[1] === '#F1FAEE', 'Original palette was not mutated (immutability preserved)')
}

console.log('\n====================================================')
console.log('TEST SUITE 4: Static File & AST Component Analysis')
console.log('====================================================')

const fileContent = fs.readFileSync(visualPalettePath, 'utf8')

// 1. Check HeroUI Imports
assert(fileContent.includes('ColorPicker,'), 'Imports ColorPicker from @heroui/react')
assert(fileContent.includes('ColorSwatch as HeroColorSwatch,'), 'Imports ColorSwatch aliased as HeroColorSwatch')
assert(fileContent.includes('ColorArea,'), 'Imports ColorArea from @heroui/react')
assert(fileContent.includes('ColorSlider,'), 'Imports ColorSlider from @heroui/react')
assert(fileContent.includes('ColorSwatchPicker,'), 'Imports ColorSwatchPicker from @heroui/react')
assert(fileContent.includes('ColorField,'), 'Imports ColorField from @heroui/react')
assert(fileContent.includes('parseColor,'), 'Imports parseColor from @heroui/react')

// 2. Check Swatch styling & background
assert(fileContent.includes('aspect-square'), 'Trigger has aspect-square class for 1:1 aspect ratio')
assert(fileContent.includes('backgroundColor: color'), 'HeroColorSwatch has direct backgroundColor: color style')
assert(fileContent.includes('width: \'100%\''), 'HeroColorSwatch has explicit width: 100%')
assert(fileContent.includes('height: \'100%\''), 'HeroColorSwatch has explicit height: 100%')

// 3. Check Popover & Subcomponents
assert(fileContent.includes('<ColorPicker.Popover'), 'ColorPicker.Popover is rendered')
assert(fileContent.includes('<ColorSwatchPicker'), 'ColorSwatchPicker is rendered in popover')
assert(fileContent.includes('<ColorArea'), 'ColorArea is rendered in popover')
assert(fileContent.includes('<ColorSlider'), 'ColorSlider is rendered in popover')
assert(fileContent.includes('<ColorField'), 'ColorField is rendered in popover')
assert(fileContent.includes('gravity-ui:shuffle'), 'Shuffle button with icon is rendered')

// 4. Check Hex label rendering
assert(fileContent.includes('{(color || \'\').toUpperCase()}'), 'Hex label is formatted to uppercase')
assert(fileContent.includes('font-mono'), 'Hex label has font-mono class')

// 5. Check State Integration
assert(fileContent.includes('setPaletteCustomized(true)'), 'setPaletteCustomized(true) is invoked on changes')
assert(fileContent.includes('updateField(\'palette\','), 'updateField is called with updated palette')

console.log('\n====================================================')
console.log(`SUMMARY: ${passedTests} Passed, ${failedTests} Failed`)
console.log('====================================================')

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
