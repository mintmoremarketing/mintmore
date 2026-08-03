import React, { useState, useRef, useEffect, useMemo } from 'react'
import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PreviewApprovePage() {
  const {
    form,
    topics,
    scheduledDays,
    hoveredDateKey,
    expandedTopicId,
    formatFilter,
    swapModalState,
    setHoveredDateKey,
    setExpandedTopicId,
    setFormatFilter,
    handleSwapTopic,
    openSwapModal,
    closeSwapModal,
    handleOptOutFestival,
    handleFinishOnboarding,
    sampleFestivals,
  } = useOnboardingContext()

  const [activeSwapTab, setActiveSwapTab] = useState('unused') // 'unused' | 'festivals' | 'custom'
  const [selectedSwapTopicId, setSelectedSwapTopicId] = useState(null)
  const [selectedSwapFestival, setSelectedSwapFestival] = useState(null)
  const [customSwapText, setCustomSwapText] = useState('')

  // R5: Sidebar Hover Auto-Scroll Ref Mapping & Effect
  const sidebarItemRefs = useRef({})

  useEffect(() => {
    if (hoveredDateKey && sidebarItemRefs.current[hoveredDateKey]) {
      sidebarItemRefs.current[hoveredDateKey].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [hoveredDateKey])

  // R2: Strict Set-Based Unused Topics Calculation
  const scheduledTopicIds = useMemo(() => {
    return new Set(
      (scheduledDays || [])
        .filter(d => d.hasPost && d.topic?.id)
        .map(d => d.topic.id)
    )
  }, [scheduledDays])

  const unusedTopics = useMemo(() => {
    return (topics || []).filter(t => !scheduledTopicIds.has(t.id) && t.category !== 'festival')
  }, [topics, scheduledTopicIds])

  const activeDateItem = scheduledDays?.find(d => d.dateKey === swapModalState?.targetDateKey)

  const handleCloseSwapModal = () => {
    setSelectedSwapTopicId(null)
    setSelectedSwapFestival(null)
    setCustomSwapText('')
    closeSwapModal()
  }

  const handleConfirmSwap = () => {
    if (!swapModalState?.targetDateKey) return

    if (activeSwapTab === 'custom') {
      if (!customSwapText.trim()) return
      handleSwapTopic(swapModalState.targetDateKey, null, {
        title: customSwapText.trim(),
        text: customSwapText.trim(),
      })
      setCustomSwapText('')
    } else if (activeSwapTab === 'festivals') {
      if (!selectedSwapFestival) return
      const brandName = (form?.business_name || '').trim() || 'Your Brand'
      const baseFestTopic = (topics || []).find(t => t.category === 'festival')
      handleSwapTopic(swapModalState.targetDateKey, null, {
        title: `${selectedSwapFestival.name} Greeting`,
        description: selectedSwapFestival.description || `Festive celebration post for ${selectedSwapFestival.name}`,
        captionPreview: `Warmest wishes on ${selectedSwapFestival.name} from all of us at ${brandName}! 🎉✨`,
        visualPrompt: `Festive celebration graphic for ${selectedSwapFestival.name} in brand palette.`,
        format: 'reel',
        category: 'festival',
        festivalName: selectedSwapFestival.name,
        date: selectedSwapFestival.date,
        hashtags: ['#festivevibes', `#${selectedSwapFestival.name.replace(/[^a-zA-Z0-9]/g, '')}`, '#celebrations'],
      })
      setSelectedSwapFestival(null)
    } else if (selectedSwapTopicId) {
      handleSwapTopic(swapModalState.targetDateKey, selectedSwapTopicId)
      setSelectedSwapTopicId(null)
    }
  }

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-[var(--paper)] text-ink-950 relative overflow-hidden pb-20">
      {/* Calendar Header with Format Pills */}
      <div className="px-6 pt-6 pb-4 border-b border-hairline bg-paper flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="text-[11px] font-bold text-mint-500 uppercase tracking-widest mb-1">
            Step 12 of 12 • Autopilot Schedule Review
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-ink-950 tracking-tight">
            Review Your Monthly Content Calendar
          </h1>
          <p className="text-xs text-ink-500 mt-1 max-w-xl">
            Tailored schedule for <strong className="text-ink-900">{(form?.business_name || '').trim() || 'your brand'}</strong> based on {form?.posting_frequency || '3'} posts/week. Click any day tile or hover to inspect or swap scheduled topics.
          </p>
        </div>

        {/* Format Filter Bar */}
        <div className="flex items-center gap-1 bg-paper-tint p-1 rounded-xl border border-hairline shrink-0 self-start sm:self-center">
          {[
            { id: 'all', label: 'All', icon: 'grid' },
            { id: 'reel', label: 'Reels', icon: 'video' },
            { id: 'carousel', label: 'Carousels', icon: 'image' },
            { id: 'post', label: 'Posts', icon: 'file' },
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFormatFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                formatFilter === pill.id
                  ? 'bg-ink-950 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-paper'
              }`}
            >
              <Icon name={pill.icon} size={14} className={formatFilter === pill.id ? "text-white" : "text-ink-400"} />
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid + Sidebar Container (Full-bleed Edge-to-Edge) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] border-t border-l border-hairline w-full min-h-0 overflow-hidden">
        
        {/* Left: 5-Week (35-Day) Edge-to-Edge Calendar Grid */}
        <div className="flex flex-col flex-1 border-r border-hairline overflow-y-auto min-h-0 bg-paper">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-hairline bg-paper-tint sticky top-0 z-10">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="py-2.5 px-2 text-center text-[10px] font-bold text-ink-400 uppercase tracking-wider border-r last:border-r-0 border-hairline"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 flex-1">
            {scheduledDays?.map((day) => {
              const isHovered = hoveredDateKey === day.dateKey
              const isFilteredOut = formatFilter !== 'all' && day.format !== formatFilter
              const isSwapped = day.status === 'swapped'

              return (
                <div
                  key={day.dateKey}
                  onMouseEnter={() => {
                    setHoveredDateKey(day.dateKey)
                    if (day.hasPost && day.topic?.id) {
                      setExpandedTopicId(day.topic.id)
                    }
                  }}
                  onMouseLeave={() => setHoveredDateKey(null)}
                  /* R4: Clicking directly on a scheduled tile opens the Swap Scheduled Topic modal */
                  onClick={() => {
                    if (day.hasPost && day.dateKey) {
                      if (day.topic?.id) {
                        setExpandedTopicId(day.topic.id)
                      }
                      setHoveredDateKey(day.dateKey)
                      openSwapModal(day.dateKey)
                    }
                  }}
                  className={`min-h-[110px] p-2 border-b border-r border-hairline flex flex-col transition-all cursor-pointer relative ${
                    !day.isCurrentMonth ? 'bg-ink-50/50 opacity-40' : day.isPast ? 'bg-ink-50/30 text-ink-600' : 'bg-white'
                  } ${day.isToday ? 'bg-mint-50/20' : ''} ${
                    isHovered ? 'ring-2 ring-mint-500 ring-inset z-10 bg-mint-50/10' : ''
                  }`}
                >
                  {/* Top Bar: Date Number + Badges */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold ${
                        day.isToday
                          ? 'bg-mint-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]'
                          : 'text-ink-600'
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    {isSwapped && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                        Swapped
                      </span>
                    )}
                  </div>

                  {/* Scheduled Topic Content Card */}
                  {day.hasPost && day.topic && !isFilteredOut && (
                    <div
                      className={`mt-auto p-2 rounded-lg border transition-all text-left ${
                        isSwapped
                          ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                          : 'bg-paper-tint border-hairline hover:border-mint-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
                            day.format === 'reel'
                              ? 'bg-pink-500 text-white'
                              : day.format === 'carousel'
                              ? 'bg-blue-500 text-white'
                              : 'bg-mint-600 text-white'
                          }`}
                        >
                          {day.format === 'social_post' ? 'post' : day.format}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-ink-950 line-clamp-2 leading-tight">
                        {day.topic?.title}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Interactive Dual-Mode Sidebar */}
        <div className="bg-paper-tint flex flex-col border-b lg:border-b-0 border-hairline overflow-hidden shrink-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-hairline bg-paper flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-950 flex items-center gap-1.5">
                <Icon name="sparkles" size={13} className="text-mint-500" />
                {hoveredDateKey ? `Focused: ${hoveredDateKey}` : 'Scheduled Topics'}
              </h3>
              <p className="text-[11px] text-ink-500 mt-0.5">
                {scheduledDays?.filter(d => d.hasPost).length || 0} posts planned this month
              </p>
            </div>
            {hoveredDateKey && (
              <button
                type="button"
                onClick={() => setHoveredDateKey(null)}
                className="text-[10px] font-semibold text-ink-400 hover:text-ink-800"
              >
                Clear Focus
              </button>
            )}
          </div>

          {/* Scrollable Topics List */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full flex flex-col divide-y divide-hairline">
              {scheduledDays
                ?.filter(d => d.hasPost)
                .map((day) => {
                  const isExpanded = expandedTopicId === day.topic?.id
                  const isHighlighted = hoveredDateKey === day.dateKey

                  return (
                    <div
                      key={day.dateKey}
                      /* R5: DOM Ref assignment mapping dateKey to DOM element for smooth auto-scroll */
                      ref={(el) => {
                        if (el) {
                          sidebarItemRefs.current[day.dateKey] = el
                        } else {
                          delete sidebarItemRefs.current[day.dateKey]
                        }
                      }}
                      className={`px-4 py-3.5 transition-all cursor-pointer group ${
                        isHighlighted
                          ? 'bg-mint-50 shadow-[inset_4px_0_0_0_#0f766e]'
                          : 'bg-white hover:bg-ink-50/50'
                      }`}
                      onClick={() => setExpandedTopicId(isExpanded ? null : day.topic?.id)}
                    >
                      {/* Topic Grid Row Template */}
                      <div className="w-full grid grid-cols-[70px_1fr_auto_20px] items-center gap-3">
                        {/* 1. Date Column */}
                        <div className="text-[10px] font-bold text-ink-500 tabular-nums uppercase tracking-wide">
                          {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>

                        {/* 2. Title Column */}
                        <div className={`text-xs font-bold truncate transition-colors ${isHighlighted ? 'text-mint-900' : 'text-ink-950 group-hover:text-ink-900'}`}>
                          {day.topic?.title}
                        </div>

                        {/* 3. Format Badge Column */}
                        <div
                          className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
                            day.format === 'reel'
                              ? 'bg-pink-100 text-pink-700'
                              : day.format === 'carousel'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {day.format === 'social_post' ? 'post' : day.format}
                        </div>

                        {/* 4. Chevron Column */}
                        <div className="flex justify-end">
                          <Icon
                            name={isExpanded ? 'chevronUp' : 'chevronDown'}
                            size={14}
                            className={`transition-colors ${isHighlighted ? 'text-mint-600' : 'text-ink-300 group-hover:text-ink-500'}`}
                          />
                        </div>
                      </div>

                    {/* Accordion Inline Expansion View */}
                    {isExpanded && day.topic && (
                      <div className="mt-3 pt-3 border-t border-hairline space-y-3 text-xs text-ink-700 animate-fade-in">
                        {day.topic?.festivalName && (
                          <div className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block">
                            Festival: {day.topic?.festivalName}
                          </div>
                        )}

                        {day.topic?.description && (
                          <p className="leading-relaxed text-ink-600">{day.topic?.description}</p>
                        )}

                        {day.topic?.captionPreview && (
                          <div className="p-2.5 rounded-lg bg-paper-tint border border-hairline text-[11px]">
                            <div className="font-bold text-[9px] uppercase tracking-wider text-ink-400 mb-1">
                              Draft Caption
                            </div>
                            <p className="text-ink-800 leading-normal">{day.topic?.captionPreview}</p>
                          </div>
                        )}


                        {day.topic?.hashtags && (
                          <div className="flex flex-wrap gap-1">
                            {day.topic?.hashtags?.map((tag, tIdx) => (
                              <span key={tIdx} className="text-[10px] font-medium text-mint-700 bg-mint-50 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* R3: Opt-out festival button if current topic is a festival */}
                        {day.topic?.category === 'festival' && handleOptOutFestival && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOptOutFestival(day.dateKey)
                            }}
                            className="btn ghost sm w-full text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-center gap-1.5"
                          >
                            <Icon name="xCircle" size={12} /> Opt-Out Festival & Use Brand Topic
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openSwapModal(day.dateKey)
                          }}
                          className="btn secondary sm w-full mt-2 flex items-center justify-center gap-1.5"
                        >
                          <Icon name="refreshCw" size={12} /> Swap Scheduled Topic
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Swap Scheduled Topic Modal */}
      {swapModalState?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-xs animate-fade-in"
          onClick={handleCloseSwapModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-hairline"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-hairline flex items-center justify-between bg-paper-tint">
              <div>
                <h3 className="font-bold text-base text-ink-950">Swap Scheduled Topic</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  Target date: <strong>{activeDateItem?.dateKey}</strong> ({activeDateItem?.topic?.title})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSwapModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-100 text-ink-500 transition-colors"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* R3: Festival Opt-out Banner inside Swap Modal */}
            {activeDateItem?.topic?.category === 'festival' && handleOptOutFestival && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-900">Festival Slot Scheduled</div>
                  <div className="text-[11px] text-amber-700">Want to opt out and preserve post count with a brand topic?</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleOptOutFestival(activeDateItem.dateKey)
                    handleCloseSwapModal()
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shrink-0 shadow-xs"
                >
                  Opt-Out & Replace
                </button>
              </div>
            )}

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-hairline px-4 bg-paper">
              {[
                { id: 'unused', label: `Unused Topics (${unusedTopics.length})` },
                { id: 'festivals', label: 'Other Festivals' },
                { id: 'custom', label: 'Custom Request' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSwapTab(tab.id)
                    setSelectedSwapTopicId(null)
                    setSelectedSwapFestival(null)
                  }}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                    activeSwapTab === tab.id
                      ? 'border-mint-500 text-mint-600'
                      : 'border-transparent text-ink-500 hover:text-ink-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Tab Body */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
              {/* R2: Tab 1 Unused Topics rendering strictly un-scheduled topics with empty state handling */}
              {activeSwapTab === 'unused' && (
                <div className="space-y-2">
                  {unusedTopics.length === 0 ? (
                    <div className="py-8 text-center text-ink-500">
                      <Icon name="checkCircle" size={24} className="mx-auto mb-2 text-mint-500" />
                      <p className="text-xs font-bold text-ink-900">All available topics are currently scheduled!</p>
                      <p className="text-[11px] text-ink-400 mt-1">
                        Select another tab (e.g., Other Festivals or Custom Request) to swap with a new topic.
                      </p>
                    </div>
                  ) : (
                    unusedTopics.map(topic => (
                      <div
                        key={topic.id}
                        onClick={() => setSelectedSwapTopicId(topic.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedSwapTopicId === topic.id
                            ? 'border-mint-500 bg-mint-50/20 ring-1 ring-mint-500'
                            : 'border-hairline hover:border-hairline-strong bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase text-ink-400">{topic.format}</span>
                          <span className="text-[10px] font-medium text-mint-600 bg-mint-50 px-2 py-0.5 rounded">Unused Topic</span>
                        </div>
                        <h4 className="text-xs font-bold text-ink-950">{topic.title}</h4>
                        <p className="text-[11px] text-ink-500 line-clamp-1 mt-0.5">{topic.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSwapTab === 'festivals' && (
                <div className="space-y-2">
                  {(sampleFestivals || []).map(fest => (
                    <div
                      key={fest.id}
                      onClick={() => {
                        setSelectedSwapFestival(fest)
                        setSelectedSwapTopicId(null)
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedSwapFestival?.id === fest.id
                          ? 'border-mint-500 bg-mint-50/20 ring-1 ring-mint-500'
                          : 'bg-white border-hairline hover:border-mint-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-mint-600 bg-mint-50 px-2 py-0.5 rounded">
                            {fest.region}
                          </span>
                          {fest.date && (
                            <span className="text-[10px] font-medium text-ink-500">
                              {new Date(fest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {selectedSwapFestival?.id === fest.id && (
                          <span className="text-[10px] font-bold text-mint-600">Selected</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-ink-950">{fest.name}</h4>
                      <p className="text-[11px] text-ink-500 mt-0.5">
                        {fest.description || `Automated festival post greeting for ${fest.name}.`}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeSwapTab === 'custom' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-ink-900 block">
                    What topic or prompt do you want to schedule instead?
                  </label>
                  <textarea
                    value={customSwapText}
                    onChange={e => setCustomSwapText(e.target.value)}
                    placeholder="E.g., Special promotion for our anniversary weekend with 20% discount..."
                    className="w-full p-3 rounded-xl min-h-[100px] text-xs border border-hairline bg-paper focus:border-mint-500 outline-none text-ink-950 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 border-t border-hairline bg-paper-tint flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn ghost sm"
                onClick={handleCloseSwapModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={
                  activeSwapTab === 'custom'
                    ? !customSwapText.trim()
                    : activeSwapTab === 'festivals'
                    ? !selectedSwapFestival
                    : !selectedSwapTopicId
                }
                onClick={handleConfirmSwap}
              >
                Confirm & Swap Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-80 right-0 p-4 bg-white border-t border-hairline-strong shadow-lg z-40 flex justify-between items-center">
        <div className="text-xs text-ink-600 hidden sm:block">
          Ready with your content plan for <strong>{(form?.business_name || '').trim() || 'your brand'}</strong>?
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button type="button" className="btn ghost" onClick={handleFinishOnboarding}>
            Skip & Finish
          </button>
          <button type="button" className="btn primary" onClick={handleFinishOnboarding}>
            <Icon name="check" size={13} /> Approve calendar & Start
          </button>
        </div>
      </div>
    </div>
  )
}
