import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AskAnythingWidget from './landing/AskAnythingWidget'
import LandingHero from './landing/LandingHero'
import { navItems } from './landing/landingContent'
import { CreatorsSection, PricingSection, ProofStrip, StatsRow, WorkflowSection } from './landing/LandingSections'

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
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">CREATYV <span>by Mint More</span></Link>
        <div className="landing-links">
          {navItems.map(item => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} onClick={scrollToSection}>{item}</a>
          ))}
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-login">Log in</Link>
          <Link to="/register" className="landing-cta">Get started</Link>
        </div>
      </nav>

      <LandingHero spotlight={spotlight} onMoveSpotlight={moveSpotlight} onSetSpotlight={setSpotlight} />
      <ProofStrip />
      <WorkflowSection />
      <StatsRow />
      <PricingSection />
      <CreatorsSection />
      <AskAnythingWidget visible={showAsk && !footerVisible} />

      <footer className="landing-footer" ref={footerRef}>
        <div className="landing-footer-brand">
          <strong>CREATYV</strong>
          <span>Creative work, managed by Mint More.</span>
        </div>
        <div className="landing-footer-grid">
          <div>
            <h4>Platform</h4>
            <a href="#platform" onClick={scrollToSection}>Hero</a>
            <a href="#how-it-works" onClick={scrollToSection}>How it works</a>
            <a href="#features" onClick={scrollToSection}>Features</a>
          </div>
          <div>
            <h4>Workspace</h4>
            <span>Calendar</span>
            <span>Mintbox</span>
            <span>Mint AI</span>
          </div>
          <div>
            <h4>Contact</h4>
            <a href="mailto:agency@mintmoremarketing.com">agency@mintmoremarketing.com</a>
            <a href="tel:+918092282114">8092282114</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>(c) 2026 Mint More Marketing</span>
          <span>Built for Indian businesses that need content every month.</span>
        </div>
      </footer>
    </main>
  )
}
