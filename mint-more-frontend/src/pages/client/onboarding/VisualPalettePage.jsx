import React from 'react'
import { useOnboardingContext } from './useOnboardingContext'
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch as HeroColorSwatch,
  ColorSwatchPicker,
  parseColor,
} from "@heroui/react"
import { Icon as HeroIcon } from "@iconify/react"
import Icon from '../../../components/ui/Icon'

const colorPresets = [
  "#0F172A", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6"
]

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

export default function VisualPalettePage() {
  const { form, handleSuggestPalette, presetPalettes, setPaletteCustomized, updateField } = useOnboardingContext()
  const [activeColorIdx, setActiveColorIdx] = React.useState(0)

  React.useEffect(() => {
    if (form?.palette?.length && activeColorIdx >= form.palette.length) {
      setActiveColorIdx(Math.max(0, form.palette.length - 1))
    }
  }, [form?.palette, activeColorIdx])

  const activeColor = form?.palette?.[activeColorIdx] || '#111111'
  const safeColor = React.useMemo(() => safeParseColor(activeColor), [activeColor])

  const handleChange = (hex) => {
    setPaletteCustomized(true)
    const newPalette = [...(form?.palette || [])]
    newPalette[activeColorIdx] = hex
    updateField('palette', newPalette)
  }

  const shuffleColor = () => {
    const randomHue = Math.floor(Math.random() * 360)
    const randomSaturation = 50 + Math.floor(Math.random() * 50)
    const randomLightness = 40 + Math.floor(Math.random() * 30)
    try {
      handleChange(parseColor(`hsl(${randomHue}, ${randomSaturation}%, ${randomLightness}%)`).toString("hex"))
    } catch {
      handleChange('#3b82f6')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 w-full max-w-[1050px] mx-auto items-start pb-12">
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-8 w-full min-w-0">
        <div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Establish your visual palette</h1>
          <p className="muted max-w-lg" style={{ marginTop: 8 }}>
            Choose the core colors that define your brand identity. These will be automatically applied to your AI-generated templates and graphics.
          </p>
        </div>

        <div className="bg-white border border-ink-200 rounded-3xl shadow-sm p-8 flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Brand Colors</h2>
              <p className="text-sm text-ink-500 mt-1">Select a color to edit it in the inspector.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-ink-50 p-1 rounded-xl border border-ink-100">
                <span className="text-xs font-semibold text-ink-500 px-2 tracking-wide uppercase">Count</span>
                <div className="flex gap-1">
                  {[2, 3, 4].map(num => {
                    const active = form?.palette?.length === num
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          active 
                            ? 'bg-white text-ink-950 shadow-sm border border-ink-200' 
                            : 'text-ink-500 hover:text-ink-900 hover:bg-ink-100/50 border border-transparent'
                        }`}
                        onClick={() => {
                          setPaletteCustomized(true)
                          let nextPalette = [...(form?.palette || [])]
                          if (nextPalette.length > num) {
                            nextPalette = nextPalette.slice(0, num)
                          } else if (nextPalette.length < num) {
                            const suggestion = presetPalettes?.[form?.business_type || 'restaurant']?.[0] || presetPalettes?.other?.[0] || ['#111111', '#FFFFFF', '#E63946', '#457B9D']
                            while (nextPalette.length < num) {
                              nextPalette.push(suggestion[nextPalette.length] || '#111111')
                            }
                          }
                          updateField('palette', nextPalette)
                        }}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                type="button"
                className="btn ghost flex items-center gap-1.5 px-3 py-1.5"
                onClick={handleSuggestPalette}
              >
                <Icon name="sparkles" size={14} />
                <span className="font-medium text-[13px]">Auto-generate</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(form?.palette || []).map((color, idx) => {
              const isActive = activeColorIdx === idx;
              return (
              <div key={idx} className="flex flex-col items-center group">
                <button
                  type="button"
                  onClick={() => setActiveColorIdx(idx)}
                  aria-label={`Select color ${color}`}
                  className={`w-full aspect-square rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-center bg-white outline-none focus:outline-none focus:ring-0 tap-highlight-transparent ${
                    isActive 
                      ? 'p-2' 
                      : 'p-0 border border-ink-200 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                  style={isActive ? { border: `3px solid ${color}` } : {}}
                >
                  <HeroColorSwatch 
                    color={color} 
                    size="lg" 
                    className="w-full h-full transition-all"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      backgroundColor: color, 
                      borderRadius: isActive ? '16px' : 'inherit',
                    }} 
                  />
                </button>
                <div className={`mt-4 px-3 py-1.5 rounded-lg border transition-colors ${
                  isActive 
                    ? 'bg-ink-900 border-ink-900 text-white' 
                    : 'bg-ink-50 border-ink-200 text-ink-600 group-hover:border-ink-300 group-hover:bg-ink-100'
                }`}>
                  <code className="text-xs font-mono tracking-wider font-semibold">
                    {(color || '').toUpperCase()}
                  </code>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Color Inspector */}
      <div className="w-full">
        <div className="bg-white border border-ink-200 rounded-3xl shadow-sm p-6 flex flex-col gap-5 sticky top-6">
          <div className="flex items-center gap-3 px-1 pb-1 border-b border-ink-100">
            <div className="w-8 h-8 rounded-full bg-ink-50 border border-ink-200 flex items-center justify-center text-ink-500">
              <HeroIcon icon="gravity-ui:pipette" className="size-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-ink-950 uppercase tracking-wider">Color Inspector</h3>
              <p className="text-xs font-medium text-ink-500">Editing Color {activeColorIdx + 1}</p>
            </div>
          </div>

          <ColorPicker 
            value={safeColor} 
            onChange={(val) => {
              if (val) handleChange(val.toString("hex"))
            }}
          >
            <div className="flex flex-col gap-4 w-full">
              <ColorArea
                aria-label="Color area"
                className="w-full h-56 rounded-2xl relative overflow-hidden border border-ink-200 shadow-inner cursor-crosshair mt-2"
                colorSpace="hsb"
                xChannel="saturation"
                yChannel="brightness"
                style={{ background: 'var(--color-area-background)' }}
              >
                <ColorArea.Thumb 
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2" 
                  style={{ backgroundColor: 'var(--color-area-thumb-color)' }}
                />
              </ColorArea>

              <div className="flex items-center gap-3 mt-1">
                <ColorSlider aria-label="Hue slider" channel="hue" className="flex-1" colorSpace="hsb">
                  <ColorSlider.Track className="h-5 w-full rounded-xl relative border border-ink-200 cursor-pointer overflow-hidden">
                    <ColorSlider.Thumb className="w-5 h-5 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing top-1/2 -translate-y-1/2" />
                  </ColorSlider.Track>
                </ColorSlider>
                <Button
                  isIconOnly
                  aria-label="Shuffle color"
                  size="md"
                  variant="flat"
                  className="h-10 w-10 min-w-10 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 flex items-center justify-center transition-colors shrink-0"
                  onPress={shuffleColor}
                >
                  <HeroIcon className="size-5" icon="gravity-ui:shuffle" />
                </Button>
              </div>

              <ColorField aria-label="Color field" className="w-full">
                <ColorField.Group variant="flat" className="flex items-center gap-3 border border-ink-200 rounded-xl px-3 py-2.5 bg-ink-50 w-full focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-transparent transition-all">
                  <ColorField.Prefix className="shrink-0 flex items-center">
                    <HeroColorSwatch 
                      color={activeColor} 
                      size="sm" 
                      className="w-6 h-6 rounded-md border border-black/10 shadow-xs" 
                      style={{ width: 24, height: 24, backgroundColor: activeColor, borderRadius: 6 }} 
                    />
                  </ColorField.Prefix>
                  <ColorField.Input className="bg-transparent font-mono text-sm font-semibold text-ink-950 uppercase outline-none w-full border-none p-0 focus:ring-0" />
                </ColorField.Group>
              </ColorField>

              <div className="pt-4 border-t border-ink-100 mt-1">
                <span className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-3 block">Document Colors</span>
                <ColorSwatchPicker className="flex flex-wrap gap-2.5" size="sm">
                  {colorPresets.map((preset) => (
                    <ColorSwatchPicker.Item 
                      key={preset} 
                      color={preset}
                      className="w-6 h-6 rounded-full cursor-pointer border border-ink-200 hover:scale-110 active:scale-95 transition-transform overflow-hidden flex items-center justify-center relative shadow-sm"
                      style={{ backgroundColor: preset }}
                    >
                      <ColorSwatchPicker.Swatch 
                        className="w-full h-full" 
                        style={{ width: '100%', height: '100%', backgroundColor: preset, borderRadius: 'inherit' }} 
                      />
                    </ColorSwatchPicker.Item>
                  ))}
                </ColorSwatchPicker>
              </div>
            </div>
          </ColorPicker>
        </div>
      </div>
    </div>
  )
}
