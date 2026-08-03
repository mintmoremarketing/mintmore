import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'
import { aiApi } from '../../../api/ai'
import { getOnboardingStepByNumber } from './config'

export default function ContentGenerationPage() {
  const navigate = useNavigate()
  const {
    form,
    setTopics,
    setApprovedTopicIds,
    pushToast,
  } = useOnboardingContext()

  const [status, setStatus] = useState('generating') // 'generating' | 'deck'
  const [generationPhase, setGenerationPhase] = useState(0)
  const [generatedTopics, setGeneratedTopics] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [approvedSet, setApprovedSet] = useState(new Set())
  const [rejectedSet, setRejectedSet] = useState(new Set())

  // Suggestions state
  const [customSuggestions, setCustomSuggestions] = useState([])
  const [customInput, setCustomInput] = useState('')

  const hasFetched = React.useRef(false)

  const [loadingProgress, setLoadingProgress] = useState(0)
  const backendResolved = useRef(false)
  const backendTopics = useRef(null)

  // Trigger OpenRouter AI generation API call on mount
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    let isMounted = true

    const payload = {
      business_name: form?.business_name || '',
      business_type: form?.business_type || 'restaurant',
      description: form?.description || '',
      preferred_language: form?.preferred_language || 'en',
      address_state: form?.address_state || '',
      festival_mode: form?.festival_mode || 'autopilot',
    }

    aiApi
      .generateOnboardingTopics(payload)
      .then(res => {
        if (!isMounted) return
        const raw = res.data?.data || res.data || []
        const rawList = Array.isArray(raw) ? raw : []

        const brandName = (form?.business_name || '').trim() || 'Your Brand'
        const normalized = rawList
          .filter(item => item.type !== 'festival')
          .map((item, idx) => ({
            id: `ai-topic-${idx + 1}-${Date.now()}`,
            title: item.title || `Content Focus Topic ${idx + 1}`,
            description: item.desc || item.description || `Tailored marketing strategy topic for ${brandName}.`,
            format: item.format || (idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post'),
            category: idx % 2 === 0 ? 'evergreen' : 'promotional',
            festivalName: null,
            festival_id: null,
            event_date: null,
          }))

        const final15 = [...normalized]
        while (final15.length < 15) {
          const idx = final15.length
          final15.push({
            id: `ai-topic-${idx + 1}-${Date.now()}`,
            title: `Brand Spotlight #${idx + 1}`,
            description: `Engaging customer story & promotional post for ${brandName}.`,
            format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
            category: 'evergreen',
            festivalName: null,
          })
        }

        backendTopics.current = final15.slice(0, 15)
        backendResolved.current = true
      })
      .catch(err => {
        if (!isMounted) return
        console.warn('AI generation API fallback:', err)
        const brandName = (form?.business_name || '').trim() || 'Your Brand'
        const fallback15 = Array.from({ length: 15 }, (_, idx) => ({
          id: `ai-topic-fallback-${idx + 1}-${Date.now()}`,
          title: `Brand Topic ${idx + 1}: ${brandName} Feature`,
          description: `Custom generated topic designed to drive engagement for ${brandName}.`,
          format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
          category: idx % 2 === 0 ? 'evergreen' : 'promotional',
          festivalName: null,
        }))
        
        backendTopics.current = fallback15
        backendResolved.current = true
      })

    return () => {
      isMounted = false
    }
  }, [form])

  // Choreographed Progress Counter Loop
  useEffect(() => {
    if (status !== 'generating') return
    let timeoutId
    let isMounted = true

    const loop = (currentProgress) => {
      if (!isMounted) return

      // If backend is done, race to 100 and finish
      if (backendResolved.current) {
        if (currentProgress < 100) {
          const next = Math.min(100, currentProgress + 5)
          setLoadingProgress(next)
          timeoutId = setTimeout(() => loop(next), 40)
          return
        } else {
          // At 100, transition to deck
          timeoutId = setTimeout(() => {
            if (isMounted && backendTopics.current) {
              setGeneratedTopics(backendTopics.current)
              setStatus('deck')
              pushToast({ title: '15 AI Topics generated!', icon: 'sparkles' })
            }
          }, 300)
          return
        }
      }

      // Choreographed artificial pacing
      if (currentProgress < 100) {
        let increment = 1
        let delay = 100

        if (currentProgress < 10) {
          increment = 1
          delay = 300 // constant motion
        } else if (currentProgress < 50) {
          increment = 2
          delay = 100 // runs faster
        } else if (currentProgress < 55) {
          increment = 1
          delay = 800 // slowly
        } else if (currentProgress < 95) {
          increment = 3
          delay = 80 // runs quickly
        } else if (currentProgress < 99) {
          increment = 1
          delay = 1500 // slowly walks 96, 97, 98, 99
        } else {
          // At 99, wait infinitely for backendResolved.current
          increment = 0
          delay = 500
        }

        const next = Math.min(99, currentProgress + increment)
        setLoadingProgress(next)
        timeoutId = setTimeout(() => loop(next), delay)
      }
    }

    loop(0)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [status, pushToast])

  const finishAndNavigate = useCallback((finalApprovedTopics) => {
    const topicListToSave = Array.isArray(finalApprovedTopics) ? finalApprovedTopics : generatedTopics
    if (setTopics) setTopics(topicListToSave)
    if (setApprovedTopicIds) setApprovedTopicIds(topicListToSave.map(t => t.id))

    pushToast({ title: `${topicListToSave.length} topics locked into your calendar!`, icon: 'check' })
    const step12 = getOnboardingStepByNumber(12)
    navigate(`/onboarding/${step12 ? step12.slug : 'step-12'}`)
  }, [generatedTopics, setTopics, setApprovedTopicIds, pushToast, navigate])

  const handleSwipe = (approved) => {
    const currentTopic = generatedTopics[currentIndex]
    if (!currentTopic) return

    let nextApproved = new Set(approvedSet)
    let nextRejected = new Set(rejectedSet)

    if (approved) {
      nextApproved.add(currentTopic.id)
      setApprovedSet(nextApproved)
    } else {
      nextRejected.add(currentTopic.id)
      setRejectedSet(nextRejected)
    }

    setCurrentIndex(prev => prev + 1)
  }

  const handleUndo = () => {
    if (currentIndex === 0) return
    const prevIndex = currentIndex - 1
    const prevTopic = generatedTopics[prevIndex]
    
    setApprovedSet(prev => {
      const next = new Set(prev)
      next.delete(prevTopic.id)
      return next
    })
    setRejectedSet(prev => {
      const next = new Set(prev)
      next.delete(prevTopic.id)
      return next
    })
    setCurrentIndex(prevIndex)
  }

  const handleAddSuggestion = () => {
    if (!customInput.trim()) return
    const newTopic = {
      id: `ai-topic-custom-${Date.now()}`,
      title: customInput.trim(),
      description: 'Custom topic suggested by user.',
      format: 'post',
      category: 'evergreen',
      festivalName: null,
    }
    setCustomSuggestions(prev => [...prev, newTopic])
    setCustomInput('')
  }

  const handleRemoveSuggestion = (id) => {
    setCustomSuggestions(prev => prev.filter(t => t.id !== id))
  }

  const handleFinishWithSuggestions = () => {
    const approvedList = generatedTopics.filter(t => approvedSet.has(t.id))
    finishAndNavigate([...approvedList, ...customSuggestions])
  }

  const handleApproveAll = () => {
    const allIds = new Set(generatedTopics.map(t => t.id))
    setApprovedSet(allIds)
    finishAndNavigate(generatedTopics)
  }

  const currentTopic = generatedTopics[currentIndex]
  const isEndOfDeck = currentIndex >= generatedTopics.length

  return (
    <div className="flex flex-col min-h-0 h-full w-full relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes stepBreath {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.65; }
            }
            @keyframes pulseGlow {
              0%, 100% { box-shadow: 0 0 0 0 rgba(232, 59, 3, 0.4); }
              50% { box-shadow: 0 0 30px 10px rgba(232, 59, 3, 0.2); }
            }
            @keyframes spinSlow {
              100% { transform: rotate(360deg); }
            }
            @keyframes floatAnimation {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
          `,
        }}
      />

      {status === 'generating' ? (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full px-4 py-8">
          {/* Glassmorphism Container */}
          <div className="relative w-full p-10 md:p-14 rounded-3xl backdrop-blur-xl bg-white/60 border border-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.06)] flex flex-col items-center text-center overflow-hidden">
            {/* Background glowing orb */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-10 blur-[80px]" 
              style={{ backgroundColor: '#e83b03' }}
            />

            {/* Central Animated AI Icon */}
            <div className="relative z-10 mb-8" style={{ animation: 'floatAnimation 4s ease-in-out infinite' }}>
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center relative bg-white shadow-sm"
                style={{ animation: 'pulseGlow 2.5s infinite' }}
              >
                {/* Rotating ring */}
                <div 
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#e83b03] border-r-[#e83b03]/30"
                  style={{ animation: 'spinSlow 1.5s linear infinite' }}
                />
                <Icon name="sparkles" size={40} style={{ color: '#e83b03' }} />
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink-950 mb-3 relative z-10">
              Generating Your Strategy
            </h2>
            {/* Dynamic Status Text based on progress */}
            <div className="h-6 relative z-10 mb-4 w-full overflow-hidden flex justify-center items-center">
              <span className="text-ink-500 text-sm md:text-base font-medium transition-all duration-300">
                {loadingProgress < 10 && 'Connecting to OpenRouter AI...'}
                {loadingProgress >= 10 && loadingProgress < 50 && 'Analyzing brand voice & rules...'}
                {loadingProgress >= 50 && loadingProgress < 55 && 'Structuring 15-topic starter plan...'}
                {loadingProgress >= 55 && loadingProgress < 95 && 'Injecting creativity & story angles...'}
                {loadingProgress >= 95 && loadingProgress < 100 && 'Finalizing flashcard deck & designs...'}
                {loadingProgress === 100 && 'Done!'}
              </span>
            </div>

            {/* Premium Progress Bar Wrapper */}
            <div className="w-full max-w-sm relative z-10 flex flex-col">
              {/* Aesthetic Percentage */}
              <div className="w-full flex justify-end mb-2">
                <span className="text-[11px] font-bold text-ink-400 tracking-wider">
                  {loadingProgress}%
                </span>
              </div>
              
              {/* The Bar */}
              <div className="w-full h-2.5 bg-ink-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-all ease-out"
                  style={{ 
                    width: `${loadingProgress}%`,
                    transitionDuration: backendResolved.current ? '40ms' : '300ms',
                    background: 'linear-gradient(90deg, #f4c1b2 0%, #e83b03 100%)',
                    boxShadow: '0 0 10px rgba(232, 59, 3, 0.4)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : isEndOfDeck ? (
        /* End of Deck / Split Pane UI */
        <div className="w-full h-full flex flex-col lg:flex-row bg-ink-50 overflow-hidden">
          {/* Left Pane: Completion Message */}
          <div className="flex-1 h-full overflow-y-auto px-4 py-8 lg:px-12 lg:py-12 flex flex-col items-center justify-center">
            <div className="w-full max-w-md mx-auto text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm border border-[#e83b03]/20 bg-[#e83b03]/10 text-[#e83b03]">
                <Icon name="check" size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-ink-950 tracking-tight mb-3">
                All done!
              </h2>
              <p className="text-ink-600 mb-8 leading-relaxed">
                You've reviewed all 15 AI-generated topics. Any custom suggestions you've added on the right will be included in your final calendar.
              </p>
              
              <div className="w-full flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="py-3.5 px-6 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-600 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Icon name="arrow-left" size={16} /> Undo Last
                </button>
                <button
                  type="button"
                  onClick={handleFinishWithSuggestions}
                  className="py-3.5 px-6 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5"
                  style={{ backgroundColor: '#e83b03', boxShadow: '0 4px 14px rgba(232, 59, 3, 0.25)' }}
                >
                  Generate Calendar <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Pane: Scrollable Custom Suggestions Panel */}
          <div className="w-full lg:w-[400px] h-full bg-white border-l border-ink-200 flex flex-col shadow-[-4px_0_12px_rgba(0,0,0,0.03)] shrink-0 z-10">
            {/* Sticky Header */}
            <div className="p-6 border-b border-ink-100 bg-white sticky top-0 z-10">
              <h3 className="text-sm font-bold text-ink-950">Any other ideas?</h3>
              <p className="text-[11px] text-ink-500 mt-1 mb-4">Add a specific topic you want to ensure gets scheduled.</p>
              
              <div className="flex gap-2">
                <input 
                  className="input flex-1 text-xs" 
                  placeholder="e.g. Weekly behind the scenes..."
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSuggestion()}
                />
                <button 
                  type="button" 
                  className="btn secondary sm" 
                  onClick={handleAddSuggestion}
                  disabled={!customInput.trim()}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Scrollable Suggestions List */}
            <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col gap-2">
              {customSuggestions.length > 0 ? (
                <>
                  <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1">Added Suggestions ({customSuggestions.length})</span>
                  {customSuggestions.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between p-3 rounded-lg bg-ink-50 border border-ink-100 group">
                      <span className="text-xs font-medium text-ink-900 line-clamp-2">{topic.title}</span>
                      <button 
                        type="button" 
                        className="text-ink-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-3"
                        onClick={() => handleRemoveSuggestion(topic.id)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
                  <Icon name="lightbulb" size={32} className="text-ink-300 mb-3" />
                  <p className="text-xs text-ink-500 font-medium">No custom ideas yet</p>
                  <p className="text-[10px] text-ink-400 mt-1 px-4">They will appear here when you add them above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Interactive 15-Topic Split Pane UI */
        <div className="w-full h-full flex flex-col lg:flex-row bg-ink-50 overflow-hidden">
          
          {/* Left Pane: Scrollable Flashcard Area */}
          <div className="flex-1 h-full overflow-y-auto flex flex-col bg-ink-50">
            {/* Deck Header (Pinned to Top) */}
            <div className="w-full p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-mint-600 bg-mint-50 px-2.5 py-1 rounded-full border border-mint-200">
                  AI Flashcard Review • Step 11 of 12
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-ink-950 tracking-tight mt-1">
                  Curate Your AI Topic Ideas
                </h2>
              </div>
              <button
                type="button"
                onClick={handleApproveAll}
                className="text-xs font-bold text-mint-700 hover:text-mint-900 bg-mint-50 hover:bg-mint-100 border border-mint-200 px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
              >
                <Icon name="check" size={14} /> Approve All ({generatedTopics.length})
              </button>
            </div>

            {/* Main Interactive Flashcard Area (Perfectly Centered) */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[600px]">
              <div className="w-full max-w-2xl mx-auto flex flex-col relative">
                
                {/* Progress Bar (Integrated tightly above the card) */}
                <div className="w-full bg-ink-200 h-1.5 rounded-full overflow-hidden mb-8 shadow-inner">
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{ width: `${((currentIndex + 1) / generatedTopics.length) * 100}%`, backgroundColor: '#e83b03' }}
                  />
                </div>

                {/* Card Counter & Stable Undo Button */}
                <div className="w-full flex justify-between items-center mb-4 px-2">
                  <div className="text-xs font-extrabold text-ink-500 uppercase tracking-widest">
                    Card {currentIndex + 1} of {generatedTopics.length}
                  </div>
                  {/* The Undo button is always rendered to maintain flex spacing, but hidden/disabled on Card 1 */}
                  <button 
                    onClick={handleUndo} 
                    disabled={currentIndex === 0}
                    className={`text-xs font-bold flex items-center gap-1.5 transition-all ${
                      currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    <Icon name="arrow-left" size={14} /> Undo Last Card
                  </button>
                </div>

                {/* Massive Premium Flashcard Card */}
                {currentTopic && (
                  <div className="w-full bg-white rounded-[32px] shadow-xl border border-ink-200/60 flex flex-col items-center justify-center text-center p-10 md:p-16 relative transition-all duration-300 min-h-[340px]">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-50/30 rounded-[32px] pointer-events-none" />
                    <h3 className="text-2xl md:text-3xl font-black text-ink-950 leading-tight mb-5 relative z-10">
                      {currentTopic.title}
                    </h3>
                    <p className="text-base md:text-lg text-ink-600 leading-relaxed max-w-lg relative z-10">
                      {currentTopic.description}
                    </p>
                  </div>
                )}

                {/* Grid Swipe / Click Control Buttons */}
                <div className="w-full grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => handleSwipe(false)}
                    className="h-16 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
                  >
                    <Icon name="x" size={20} /> Skip / No
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwipe(true)}
                    className="h-16 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#e83b03', boxShadow: '0 8px 24px rgba(232, 59, 3, 0.25)' }}
                  >
                    <Icon name="check" size={20} /> Approve / Yes
                  </button>
                </div>

                <p className="text-xs text-ink-400 mt-6 text-center font-medium">
                  Approved topics will automatically populate your final calendar.
                </p>
              </div>
            </div>
          </div>

          {/* Right Pane: Scrollable Custom Suggestions Panel */}
          <div className="w-full lg:w-[400px] h-full bg-white border-l border-ink-200 flex flex-col shadow-[-4px_0_12px_rgba(0,0,0,0.03)] shrink-0 z-10">
            {/* Sticky Header */}
            <div className="p-6 border-b border-ink-100 bg-white sticky top-0 z-10">
              <h3 className="text-sm font-bold text-ink-950">Any other ideas?</h3>
              <p className="text-[11px] text-ink-500 mt-1 mb-4">Add a specific topic you want to ensure gets scheduled.</p>
              
              <div className="flex gap-2">
                <input 
                  className="input flex-1 text-xs" 
                  placeholder="e.g. Weekly behind the scenes..."
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSuggestion()}
                />
                <button 
                  type="button" 
                  className="btn secondary sm" 
                  onClick={handleAddSuggestion}
                  disabled={!customInput.trim()}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Scrollable Suggestions List */}
            <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col gap-2">
              {customSuggestions.length > 0 ? (
                <>
                  <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-1">Added Suggestions ({customSuggestions.length})</span>
                  {customSuggestions.map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between p-3 rounded-lg bg-ink-50 border border-ink-100 group">
                      <span className="text-xs font-medium text-ink-900 line-clamp-2">{topic.title}</span>
                      <button 
                        type="button" 
                        className="text-ink-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-3"
                        onClick={() => handleRemoveSuggestion(topic.id)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
                  <Icon name="lightbulb" size={32} className="text-ink-300 mb-3" />
                  <p className="text-xs text-ink-500 font-medium">No custom ideas yet</p>
                  <p className="text-[10px] text-ink-400 mt-1 px-4">They will appear here when you add them above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
