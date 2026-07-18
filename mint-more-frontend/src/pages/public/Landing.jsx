import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AskAnythingWidget from './landing/AskAnythingWidget'
import LandingHero from './landing/LandingHero'
import { navItems } from './landing/landingContent'
import {
  CreatorsSection,
  ManagedSection,
  RoadmapSection,
  SocialSection,
  PricingSection,
  ProofStrip,
  StatsRow,
  WorkflowSection,
} from './landing/LandingSections'

const ANNOUNCEMENT = 'Creatyv Phase 1 is now live. Create your account and start for free.'

function AnnouncementBar() {
  return (
    <div className="landing-announcement" role="status" aria-label={ANNOUNCEMENT}>
      <div className="landing-announcement-track">
        <div className="landing-announcement-group">
          <span>{ANNOUNCEMENT}</span>
          <span aria-hidden="true">{ANNOUNCEMENT}</span>
        </div>
        <div className="landing-announcement-group" aria-hidden="true">
          <span>{ANNOUNCEMENT}</span>
          <span>{ANNOUNCEMENT}</span>
        </div>
      </div>
    </div>
  )
}

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

        if (entry.target.classList.contains('landing-stat-number')) {
          const target = Number(entry.target.dataset.target || 0)
          const suffix = entry.target.dataset.suffix || ''
          anime({
            targets: { value: 0 },
            value: target,
            duration: 1100,
            easing: 'easeOutCubic',
            update: anim => {
              entry.target.textContent = `${Math.round(anim.animatables[0].target.value).toLocaleString('en-IN')}${suffix}`
            },
          })
          return
        }

        anime({
          targets: entry.target.querySelectorAll('.landing-card, .landing-pricing-card, .landing-value-card, .landing-bento-card, .landing-story-card, .landing-integration-board article, .landing-swipe-card, .landing-social-tile'),
          translateY: [24, 0],
          opacity: [0, 1],
          delay: anime.stagger(100),
          duration: 640,
          easing: 'easeOutExpo',
        })
      })
    }, { threshold: 0.18 })

    rootRef.current.querySelectorAll('.landing-animate, .landing-stat-number').forEach(el => observer.observe(el))
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
      <AnnouncementBar />
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">CREATYV <span>by Mint More Marketing</span></Link>
        <div className="landing-links">
          {navItems.map(item => (
            <a key={item.id} href={`#${item.id}`} onClick={scrollToSection}>{item.label}</a>
          ))}
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-login">Log In</Link>
          <Link to="/register" className="landing-cta">Start for Free</Link>
        </div>
      </nav>

      <LandingHero spotlight={spotlight} onMoveSpotlight={moveSpotlight} onSetSpotlight={setSpotlight} />
      <ProofStrip />
      <WorkflowSection />
      <StatsRow />
      <ManagedSection />
      <SocialSection />
      <PricingSection />
      <RoadmapSection />
      <CreatorsSection />
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
          </div>
        </div>
        <div className="landing-footer-grid">
          <strong>CREATYV</strong>
          <span>Creative work, managed by Mint More.</span>
        </div>
        <div className="landing-footer-bottom">
          <span>(c) 2026 Mint More Marketing</span>
          <span>Built for Indian businesses that need content every month.</span>
        </div>
      </footer>
    </main>
  )
}
