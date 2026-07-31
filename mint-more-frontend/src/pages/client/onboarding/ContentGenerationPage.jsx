import React, { useEffect, useState, useCallback } from 'react'
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

  // Trigger OpenRouter AI generation API call on mount
  useEffect(() => {
    let isMounted = true

    // Progressive phase step animations while loading
    const phaseTimers = [
      setTimeout(() => isMounted && setGenerationPhase(1), 1000),
      setTimeout(() => isMounted && setGenerationPhase(2), 2200),
      setTimeout(() => isMounted && setGenerationPhase(3), 3500),
    ]

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
        const normalized = rawList.map((item, idx) => ({
          id: `ai-topic-${idx + 1}-${Date.now()}`,
          title: item.title || `Content Focus Topic ${idx + 1}`,
          description: item.desc || item.description || `Tailored marketing strategy topic for ${brandName}.`,
          format: item.format || (idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post'),
          category: item.type === 'festival' ? 'festival' : (idx % 2 === 0 ? 'evergreen' : 'promotional'),
          captionPreview: item.captionPreview || `Exclusive feature post for ${brandName}! Check out ${item.title} ✨ #brand #mintmore`,
          visualPrompt: item.visualPrompt || `High quality graphic design for ${item.title} featuring brand palette.`,
          hashtags: item.hashtags || ['#brand', '#trending', `#${brandName.replace(/[^a-zA-Z0-9]/g, '')}`],
          festivalName: item.type === 'festival' ? item.title : null,
          festival_id: item.festival_id || null,
          event_date: item.date || null,
        }))

        // Ensure 15 topics total
        const final15 = [...normalized]
        while (final15.length < 15) {
          const idx = final15.length
          final15.push({
            id: `ai-topic-${idx + 1}-${Date.now()}`,
            title: `Brand Spotlight #${idx + 1}`,
            description: `Engaging customer story & promotional post for ${brandName}.`,
            format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
            category: 'evergreen',
            captionPreview: `Discover why customers love ${brandName}! Visit us today. 🌟`,
            visualPrompt: `Clean modern layout card in brand colors.`,
            hashtags: ['#brand', '#quality', '#localbusiness'],
            festivalName: null,
          })
        }

        setGeneratedTopics(final15.slice(0, 15))
        setStatus('deck')
        pushToast({ title: '15 AI Topics generated!', icon: 'sparkles' })
      })
      .catch(err => {
        if (!isMounted) return
        console.warn('AI generation API fallback:', err)
        const brandName = (form?.business_name || '').trim() || 'Your Brand'
        const fallback15 = Array.from({ length: 15 }, (_, idx) => ({
          id: `ai-topic-fallback-${idx + 1}-${Date.now()}`,
          title: idx === 4 ? `Festival Celebration Post` : `Brand Topic ${idx + 1}: ${brandName} Feature`,
          description: `Custom generated topic designed to drive engagement for ${brandName}.`,
          format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
          category: idx === 4 ? 'festival' : (idx % 2 === 0 ? 'evergreen' : 'promotional'),
          captionPreview: `Welcome to ${brandName}! Elevating quality and service for our local community. ✨`,
          visualPrompt: `Creative brand visual concept.`,
          hashtags: ['#brandstory', '#quality', '#local'],
          festivalName: idx === 4 ? 'Festival Special' : null,
        }))
        setGeneratedTopics(fallback15)
        setStatus('deck')
        pushToast({ title: 'Topics generated with default strategy.', tone: 'amber', icon: 'sparkles' })
      })

    return () => {
      isMounted = false
      phaseTimers.forEach(clearTimeout)
    }
  }, [form, pushToast])

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

    if (currentIndex < generatedTopics.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // All 15 reviewed
      const approvedList = generatedTopics.filter(t => nextApproved.has(t.id))
      finishAndNavigate(approvedList)
    }
  }

  const handleApproveAll = () => {
    const allIds = new Set(generatedTopics.map(t => t.id))
    setApprovedSet(allIds)
    finishAndNavigate(generatedTopics)
  }

  const currentTopic = generatedTopics[currentIndex]

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] w-full relative px-4 py-8">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes stepBreath {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.65; }
            }
          `,
        }}
      />

      {status === 'generating' ? (
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-950 mb-3">
            Generating 15 AI Topics
          </h2>
          <p className="text-ink-500 text-sm md:text-base mb-10 leading-relaxed">
            Connecting to OpenRouter AI to analyze your brand voice and craft a 15-topic content deck.
          </p>

          <div className="flex flex-col gap-6 w-full text-left relative">
            <div className="absolute left-[15px] top-[16px] bottom-[16px] w-[2px] bg-ink-100 rounded-full overflow-hidden">
              <div
                className="w-full bg-mint-500 transition-all duration-1000 ease-out"
                style={{ height: `${Math.min((generationPhase + 1) * 25, 100)}%` }}
              />
            </div>

            {[
              { title: 'Connecting to OpenRouter AI Engine', subtitle: 'Analyzing brand voice context' },
              { title: 'Injecting regional occasion & festival rules', subtitle: 'Setting up festival posts' },
              { title: 'Structuring 15-topic starter plan', subtitle: 'Drafting initial content topics' },
              { title: 'Applying design templates & format metadata', subtitle: 'Finalizing flashcard deck' },
            ].map((item, index) => {
              const done = generationPhase > index
              const active = generationPhase === index

              return (
                <div key={index} className="flex items-start gap-5 relative z-10">
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 transition-all duration-500 ${
                      done
                        ? 'bg-mint-500 text-white shadow-md shadow-mint-500/20 scale-100'
                        : active
                        ? 'bg-white border-2 border-mint-500 text-mint-500 shadow-lg shadow-mint-500/30 scale-110'
                        : 'bg-white border border-ink-200 text-ink-300 scale-100'
                    }`}
                  >
                    {done ? (
                      <Icon name="check" size={14} />
                    ) : active ? (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--mint-500)',
                          animation: 'stepBreath 1.5s ease-in-out infinite',
                        }}
                      />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-ink-200" />
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span
                      className={`text-[15px] transition-colors duration-300 ${
                        done ? 'text-ink-950 font-bold' : active ? 'text-mint-700 font-bold' : 'text-ink-400 font-medium'
                      }`}
                    >
                      {item.title}
                    </span>
                    {(done || active) && (
                      <span className={`text-xs mt-0.5 transition-all duration-300 ${done ? 'text-ink-500' : 'text-mint-600/80'}`}>
                        {done ? 'Complete' : `${item.subtitle}...`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Interactive 15-Topic Yes/No Flashcard Deck UI */
        <div className="w-full max-w-xl mx-auto flex flex-col items-center">
          {/* Deck Header & Progress */}
          <div className="w-full flex items-center justify-between mb-4">
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
              className="text-xs font-bold text-mint-700 hover:text-mint-900 bg-mint-50 hover:bg-mint-100 border border-mint-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0"
            >
              <Icon name="check" size={13} /> Approve All ({generatedTopics.length}) & Continue
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden mb-6">
            <div
              className="bg-mint-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / generatedTopics.length) * 100}%` }}
            />
          </div>

          {/* Card Counter Indicator */}
          <div className="text-xs font-bold text-ink-500 mb-3">
            Topic Card {currentIndex + 1} of {generatedTopics.length}
          </div>

          {/* Main Interactive Flashcard Card */}
          {currentTopic && (
            <div className="w-full bg-white rounded-2xl border-2 border-hairline shadow-xl p-6 md:p-8 flex flex-col gap-4 relative transition-all duration-300">
              {/* Top Badges */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    currentTopic.format === 'reel'
                      ? 'bg-pink-100 text-pink-700 border border-pink-200'
                      : currentTopic.format === 'carousel'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-mint-100 text-mint-800 border border-mint-200'
                  }`}
                >
                  {currentTopic.format}
                </span>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    currentTopic.category === 'festival'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-ink-100 text-ink-700 border border-ink-200'
                  }`}
                >
                  {currentTopic.category === 'festival' ? '🎉 Festival Topic' : '✨ Brand Topic'}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-lg md:text-xl font-bold text-ink-950 leading-snug">
                  {currentTopic.title}
                </h3>
                <p className="text-xs md:text-sm text-ink-600 mt-2 leading-relaxed">
                  {currentTopic.description}
                </p>
              </div>

              {/* Sample Draft Caption Box */}
              {currentTopic.captionPreview && (
                <div className="p-3.5 rounded-xl bg-paper-tint border border-hairline text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                    AI Draft Caption
                  </div>
                  <p className="text-ink-800 leading-relaxed italic">
                    "{currentTopic.captionPreview}"
                  </p>
                </div>
              )}

              {/* Visual Concept Box */}
              {currentTopic.visualPrompt && (
                <div className="p-3.5 rounded-xl bg-paper-tint border border-hairline text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                    Visual Prompt Concept
                  </div>
                  <p className="text-ink-700 leading-relaxed">
                    {currentTopic.visualPrompt}
                  </p>
                </div>
              )}

              {/* Hashtag List */}
              {currentTopic.hashtags && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {currentTopic.hashtags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-semibold text-mint-700 bg-mint-50 px-2 py-0.5 rounded-md border border-mint-100">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Swipe / Click Control Buttons */}
          <div className="w-full flex items-center justify-between gap-4 mt-6">
            <button
              type="button"
              onClick={() => handleSwipe(false)}
              className="flex-1 py-3.5 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Icon name="x" size={16} /> Skip / No
            </button>

            <button
              type="button"
              onClick={() => handleSwipe(true)}
              className="flex-1 py-3.5 px-4 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-mint-500/20"
            >
              <Icon name="check" size={16} /> Approve / Yes
            </button>
          </div>

          <p className="text-[11px] text-ink-400 mt-4 text-center">
            Reviewing topic {currentIndex + 1} of {generatedTopics.length}. Approved topics will populate your 28-day schedule.
          </p>
        </div>
      )}
    </div>
  )
}
