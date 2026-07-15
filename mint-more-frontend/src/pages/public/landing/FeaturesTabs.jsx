import { useState } from 'react'
import { newFeatureTabs } from './landingContent'

export default function FeaturesTabs() {
  const [activeTab, setActiveTab] = useState(newFeatureTabs[0].id)
  
  const activeData = newFeatureTabs.find(t => t.id === activeTab) || newFeatureTabs[0]

  return (
    <section className="py-24 px-4 bg-[#f9f9f9] text-[#15120f]" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-sm font-bold tracking-widest uppercase text-[var(--landing-accent)] mb-4">One Connected Workspace</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Everything Your Brand Needs to Create, Organise and Publish Consistently.
          </h2>
          <p className="mt-6 text-lg text-[#15120f]/70 max-w-2xl font-medium">
            Move from a rough idea to published content without switching between multiple AI tools, storage drives, spreadsheets, approval chats and social platforms.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Tab Navigation */}
          <div className="lg:w-1/3 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 hide-scrollbar scroll-smooth">
            {newFeatureTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-5 py-4 rounded-xl font-bold transition-all whitespace-nowrap lg:whitespace-normal ${
                  activeTab === tab.id 
                    ? 'bg-white shadow-sm border border-[#15120f]/5 text-[#15120f]' 
                    : 'text-[#15120f]/50 hover:bg-[#15120f]/5 hover:text-[#15120f]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="lg:w-2/3 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-[#15120f]/5 landing-animate relative overflow-hidden">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">{activeData.title}</h3>
            <p className="text-lg text-[#15120f]/70 mb-8 font-medium">
              {activeData.description}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8">
              {activeData.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 min-w-5 h-5 rounded-full bg-[var(--landing-accent-wash)] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--landing-accent)]"></div>
                  </div>
                  <span className="font-medium text-[#15120f]/80">{feat}</span>
                </div>
              ))}
            </div>

            {activeData.supportLine && (
              <p className="font-bold text-[var(--landing-accent-deep)] italic mb-8">
                {activeData.supportLine}
              </p>
            )}

            {/* Placeholder Demo Image */}
            <div className="mt-8 rounded-2xl overflow-hidden border border-[#15120f]/10 bg-[#f9f9f9] aspect-video relative">
              <img 
                src="https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=1200&q=80" 
                alt={`${activeData.label} Demo`}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center text-[#15120f]/40 font-bold tracking-widest uppercase">
                {activeData.label} Preview
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
