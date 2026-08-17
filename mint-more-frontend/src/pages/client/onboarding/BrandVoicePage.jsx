import { useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'
import { aiApi } from '../../../api/ai'
import { useUIStore } from '../../../store/ui'

export default function BrandVoicePage() {
  const { ageSegments, form, sampleCopyPreview, toggleTargetAge, tones, updateField } = useOnboardingContext()
  const pushToast = useUIStore(s => s.pushToast)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGeneratePreview = async () => {
    if (!form.custom_tone || form.custom_tone.trim() === '') {
      pushToast({ title: 'Please enter a custom tone description first', tone: 'amber' })
      return
    }
    try {
      setIsGenerating(true)
      const res = await aiApi.generateTonePreview({
        business_name: form.business_name,
        business_type: form.business_type,
        custom_tone: form.custom_tone
      })
      if (res.data?.data) {
        updateField('custom_tone_preview', res.data.data)
        pushToast({ title: 'Preview generated!', icon: 'sparkles', tone: 'mint' })
      }
    } catch (err) {
      pushToast({ title: 'Failed to generate preview', body: err.message, tone: 'amber' })
    } finally {
      setIsGenerating(false)
    }
  }

  const liveTonePreview = (
    <div className="bg-white rounded-2xl border border-[var(--ink-200)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-[var(--ink-50)] to-white px-5 py-3 border-b border-[var(--ink-100)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[var(--mint-500)] flex items-center justify-center text-white shadow-sm">
            <Icon name="sparkles" size={10} />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-[var(--ink-500)] uppercase">Live Preview</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--ink-200)]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--ink-200)]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--ink-200)]"></div>
        </div>
      </div>
      
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          {form.logos && form.logos.length > 0 ? (
            <img 
              src={form.logos[0].preview_url || form.logos[0].url} 
              alt="Brand Logo" 
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[var(--ink-200)] shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--ink-100)] to-[var(--ink-200)] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[var(--ink-400)] uppercase">
              {form.business_name ? form.business_name.substring(0, 2) : 'B'}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <div className="text-[13px] font-bold text-[var(--ink-950)] leading-tight">
              {form.business_name || 'Your Brand Name'}
            </div>
            <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
              Just now
            </div>
          </div>
        </div>
        <div className="relative pt-1">
          <p className="text-[14px] text-[var(--ink-900)] leading-relaxed whitespace-pre-wrap m-0">
            {sampleCopyPreview}
          </p>
        </div>
      </div>
      
      <div className="px-5 py-3 border-t border-[var(--ink-100)] bg-[var(--ink-50)]/50 flex items-center gap-4 text-[var(--ink-400)]">
        <Icon name="heart" size={16} />
        <Icon name="chat" size={16} />
        <Icon name="send" size={16} />
        <Icon name="bookmark" size={16} className="ml-auto" />
      </div>
    </div>
  )

  return (
    <div className="lg:flex lg:justify-between gap-8 xl:gap-12">
      <div className="w-full lg:max-w-[640px] flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-950)]">Establish your brand voice</h1>
          <p className="text-[13.5px] text-[var(--ink-500)] mt-1.5">Tone dictates all future AI-generated post copy.</p>
        </div>

        <div className="space-y-4">
          <label className="text-[13px] font-semibold text-[var(--ink-950)] flex items-center gap-2">
            Select Tone of Voice
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tones.map(t => {
              const isActive = form.tone === t.id;
              return (
                <label
                  key={t.id}
                  className={`group relative flex flex-col p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isActive 
                      ? 'bg-white border-[var(--mint-500)] shadow-sm' 
                      : 'bg-white border-[var(--ink-200)] hover:border-[var(--ink-300)] hover:bg-[var(--ink-50)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="tone"
                    className="sr-only"
                    checked={isActive}
                    onChange={() => updateField('tone', t.id)}
                  />
                  
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-sm font-semibold transition-colors ${isActive ? 'text-[var(--ink-950)]' : 'text-[var(--ink-950)]'}`}>
                      {t.name}
                    </div>
                    {isActive ? (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[#10b981] flex items-center justify-center pop-in">
                        <Icon name="check" size={12} style={{ color: '#10b981', marginTop: 1 }} />
                      </div>
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[var(--ink-200)] group-hover:border-[var(--ink-300)] transition-colors" />
                    )}
                  </div>
                  <div className={`text-[12.5px] leading-relaxed transition-colors pr-6 ${isActive ? 'text-[var(--ink-500)]' : 'text-[var(--ink-500)]'}`}>
                    {t.description}
                  </div>
                </label>
              )
            })}
          </div>
          {form.tone === 'other' && (
            <div className="mt-3 pop-in">
              <textarea
                value={form.custom_tone || ''}
                onChange={(e) => updateField('custom_tone', e.target.value)}
                placeholder="Describe your custom brand tone (e.g. Quirky, sarcastic but very helpful tech wizard)"
                className="w-full min-h-[100px] p-4 text-[13px] text-[var(--ink-900)] bg-white border border-[var(--ink-200)] rounded-xl focus:border-[var(--mint-500)] focus:ring-1 focus:ring-[var(--mint-500)] outline-none transition-all resize-y placeholder:text-[var(--ink-400)]"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isGenerating || !form.custom_tone}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--ink-950)] text-white text-[12.5px] font-bold rounded-lg hover:bg-black transition-colors disabled:opacity-50"
                >
                  <Icon name={isGenerating ? "refresh" : "sparkles"} size={14} className={isGenerating ? "animate-spin" : "text-[var(--mint-400)]"} />
                  {isGenerating ? "Generating..." : "Generate Preview"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-6 border-t border-[var(--ink-100)]">
          <label className="text-[13px] font-semibold text-[var(--ink-950)] flex items-center gap-2">
            Target Audience Segment
          </label>
          <div className="flex flex-wrap gap-2.5">
            {ageSegments.map(seg => {
              const active = form.target_ages.includes(seg.id)
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => toggleTargetAge(seg.id)}
                  className={`relative flex items-center px-4 py-2 text-[12.5px] font-medium rounded-full transition-all duration-300 border ${
                    active 
                      ? 'bg-white text-[var(--ink-950)] border-[var(--ink-300)] shadow-sm' 
                      : 'bg-white text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-300)] hover:bg-[var(--ink-50)]'
                  }`}
                >
                  <div 
                    className={`flex items-center justify-center overflow-hidden transition-all duration-300 ease-out ${
                      active ? 'w-[14px] opacity-100 scale-100 mr-1.5' : 'w-0 opacity-0 scale-50 mr-0'
                    }`}
                  >
                    <div className="text-[#10b981] flex-shrink-0">
                      <Icon name="check" size={14} style={{ strokeWidth: 3 }} />
                    </div>
                  </div>
                  <span>{seg.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="block lg:hidden pt-4">
          {liveTonePreview}
        </div>
      </div>

      <div className="hidden lg:block relative w-full lg:max-w-[380px] xl:max-w-[420px] shrink-0">
        <div className="sticky top-8">
          {liveTonePreview}
        </div>
      </div>
    </div>
  )
}
