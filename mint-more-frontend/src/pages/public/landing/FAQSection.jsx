import { useState } from 'react'
import { faqData } from './landingContent'

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section className="py-24 px-4 bg-[#f9f9f9] text-[#15120f]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-12 text-center" style={{ fontFamily: 'var(--font-landing-display)' }}>
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-4">
          {faqData.map((faq, i) => (
            <div key={i} className="bg-white border border-[#15120f]/10 rounded-2xl overflow-hidden transition-all">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
                className="w-full text-left px-6 py-5 flex items-center justify-between font-bold text-lg focus:outline-none"
              >
                <span>{faq.q}</span>
                <span className="text-[var(--landing-accent)] text-2xl font-light">
                  {openIndex === i ? '−' : '+'}
                </span>
              </button>
              
              <div 
                className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === i ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-[#15120f]/70 font-medium leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
