import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AskAnythingWidget from './landing/AskAnythingWidget'
import LandingHero from './landing/LandingHero'
import MintAISection from './landing/MintAISection'
import WorkflowSteps from './landing/WorkflowSteps'
import FeaturesTabs from './landing/FeaturesTabs'
import AudienceSection from './landing/AudienceSection'
import DashboardTeaserSection from './landing/DashboardTeaserSection'
import FAQSection from './landing/FAQSection'
import { navItems } from './landing/landingContent'

export default function Landing() {
  const rootRef = useRef(null)
  const footerRef = useRef(null)
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50, active: false })
  const [showAsk, setShowAsk] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('landing-scrollbar-hidden')
    return () => document.documentElement.classList.remove('landing-scrollbar-hidden')
  }, [])

  useEffect(() => {
    const anime = window.anime
    if (!anime || !rootRef.current) return

    anime({
      targets: '.landing-image-reveal',
      opacity: [0, 1],
      duration: 900,
      easing: 'easeOutExpo',
    })

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.target.dataset.animated) return
        entry.target.dataset.animated = 'true'

        anime({
          targets: entry.target.querySelectorAll('.landing-card, .landing-animate'),
          translateY: [24, 0],
          opacity: [0, 1],
          delay: anime.stagger(100),
          duration: 640,
          easing: 'easeOutExpo',
        })
      })
    }, { threshold: 0.18 })

    rootRef.current.querySelectorAll('.landing-animate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateAskVisibility = () => setShowAsk(window.scrollY > Math.min(window.innerHeight * 0.14, 120))
    updateAskVisibility()
    window.addEventListener('scroll', updateAskVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateAskVisibility)
  }, [])

  useEffect(() => {
    if (!footerRef.current) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      setFooterVisible(Boolean(entry?.isIntersecting))
    }, { rootMargin: '0px 0px 180px 0px', threshold: 0.01 })
    observer.observe(footerRef.current)
    return () => observer.disconnect()
  }, [])

  const moveSpotlight = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSpotlight({
      active: true,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }

  const scrollToSection = event => {
    const href = event.currentTarget.getAttribute('href')
    if (!href?.startsWith('#')) return
    const target = document.querySelector(href)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="landing-page" ref={rootRef}>
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">CREATYV <span>by Mint More</span></Link>
        <div className="landing-links">
          {navItems.map(item => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} onClick={scrollToSection}>{item}</a>
          ))}
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-login">Log In</Link>
          <Link to="/register" className="landing-cta">Start for Free</Link>
        </div>
      </nav>

      <LandingHero spotlight={spotlight} onMoveSpotlight={moveSpotlight} onSetSpotlight={setSpotlight} />
      
      <MintAISection />
      <WorkflowSteps />
      <FeaturesTabs />
      <AudienceSection />
      <DashboardTeaserSection />
      <FAQSection />

      {/* Final CTA Section */}
      <section className="py-32 px-4 bg-[var(--landing-accent-wash)] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--landing-accent)]"></div>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 text-[#15120f]" style={{ fontFamily: 'var(--font-landing-display)' }}>
          Your next month of content<br/>can start today.
        </h2>
        <p className="text-xl text-[#15120f]/70 font-medium max-w-3xl mx-auto mb-12">
          Create social media content with AI, organise your ideas and keep your brand consistently active from one simple workspace.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register" className="landing-primary px-10 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105">
            Create for Free
          </Link>
          <button className="px-10 py-4 rounded-full font-bold text-lg text-[#15120f] border border-[#15120f]/20 hover:bg-[#15120f]/5 transition-colors bg-white">
            Contact Mint More Marketing
          </button>
        </div>
        <p className="mt-8 font-bold text-[#15120f]">Create for your brand. Switch to Creatyv.</p>
      </section>

      <AskAnythingWidget visible={showAsk && !footerVisible} />

      <footer className="landing-footer" ref={footerRef}>
        <div className="landing-footer-directory">
          <div className="landing-footer-locations">
            <div>
              <h4>Mumbai, IN</h4>
              <span>Office details coming soon</span>
              <span>India</span>
            </div>
            <div>
              <h4>Kolkata, IN</h4>
              <span>Office details coming soon</span>
              <span>India</span>
            </div>
          </div>
          <div>
            <h4>Company</h4>
            <span>About</span>
            <span>Careers</span>
            <span>Our data</span>
            <span>Partners</span>
          </div>
          <div>
            <h4>Features</h4>
            <span>Calendar</span>
            <span>Mintbox</span>
            <span>Mint AI</span>
            <span>Publishing</span>
          </div>
          <div>
            <h4>More tools</h4>
            <span>Content planner</span>
            <span>Creative briefs</span>
            <span>Social insights</span>
            <span>Storage add-ons</span>
          </div>
          <div>
            <h4>Support</h4>
            <span>Help center</span>
            <span>Ask a question</span>
            <a href="mailto:agency@mintmoremarketing.com">Contact team</a>
            <a href="tel:+918092282114">8092282114</a>
          </div>
          <div>
            <h4>Follow us</h4>
            <span>Instagram</span>
            <span>YouTube</span>
            <span>LinkedIn</span>
          </div>
          <div>
            <h4>Trust</h4>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
            <span>Refund and Cancellation Policy</span>
          </div>
        </div>
        <div className="landing-footer-grid">
          <strong>CREATYV</strong>
          <span>Built by Mint More Marketing.</span>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 Creatyv. All rights reserved.</span>
          <span>Get Creative with Creatyv.</span>
        </div>
      </footer>
    </main>
  )
}
