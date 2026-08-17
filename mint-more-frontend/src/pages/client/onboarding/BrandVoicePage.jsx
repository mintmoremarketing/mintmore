import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function BrandVoicePage() {
  const { ageSegments, form, sampleCopyPreview, toggleTargetAge, tones, updateField } = useOnboardingContext()

  return (
    <div className="flex flex-col gap-8">
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
                className={`relative px-4 py-2 text-[12.5px] font-medium rounded-full transition-all duration-200 border ${
                  active 
                    ? 'bg-[var(--mint-500)] text-white border-[var(--mint-600)] shadow-sm' 
                    : 'bg-white text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-300)] hover:bg-[var(--ink-50)]'
                }`}
              >
                {seg.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--ink-50)] to-white border border-[var(--ink-200)] shadow-sm">
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--mint-400)]" />
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink-500)] uppercase tracking-wider mb-2">
            <Icon name="sparkles" size={14} className="text-[var(--mint-500)]" />
            Live Tone Preview
          </div>
          <p className="text-[13.5px] text-[var(--ink-800)] leading-relaxed italic m-0">
            "{sampleCopyPreview}"
          </p>
        </div>
      </div>
    </div>
  )
}
