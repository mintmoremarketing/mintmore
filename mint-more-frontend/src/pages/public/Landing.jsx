import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const Icon = ({ children }) => <span className="landing-icon" aria-hidden="true">{children}</span>

const Word = ({ children, accent = false }) => (
  <span className={`hero-word${accent ? ' accent' : ''}`}>{children}</span>
)

export default function Landing() {
  const rootRef = useRef(null)

  useEffect(() => {
    const anime = window.anime
    if (!anime || !rootRef.current) return

    anime.timeline()
      .add({
        targets: '.hero-word',
        translateY: [28, 0],
        opacity: [0, 1],
        delay: anime.stagger(80),
        duration: 760,
        easing: 'easeOutExpo',
      })
      .add({
        targets: '.landing-hero-copy, .landing-hero-actions',
        translateY: [16, 0],
        opacity: [0, 1],
        delay: anime.stagger(90),
        duration: 620,
        easing: 'easeOutExpo',
      }, '-=420')

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        if (entry.target.dataset.animated) return
        entry.target.dataset.animated = 'true'

        if (entry.target.classList.contains('landing-stat-number')) {
          const target = Number(entry.target.dataset.target || 0)
          const suffix = entry.target.dataset.suffix || ''
          anime({
            targets: { value: 0 },
            value: target,
            duration: 1300,
            easing: 'easeOutCubic',
            update: anim => {
              const value = Math.round(anim.animatables[0].target.value)
              entry.target.textContent = `${value.toLocaleString('en-IN')}${suffix}`
            },
          })
        } else {
          anime({
            targets: entry.target.querySelectorAll('.feature-card, .pricing-card'),
            translateY: [28, 0],
            opacity: [0, 1],
            delay: anime.stagger(110),
            duration: 760,
            easing: 'easeOutExpo',
          })
        }
      })
    }, { threshold: 0.22 })

    rootRef.current.querySelectorAll('.landing-animate, .landing-stat-number').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="landing-page" ref={rootRef}>
      <div className="landing-grid-overlay" />
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">Mint <em>More</em></Link>
        <div className="landing-links">
          {['How it Works', 'Pricing', 'For Creators'].map(label => (
            <a key={label} href={`#${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</a>
          ))}
        </div>
        <Link to="/register" className="landing-cta">Get Started</Link>
      </nav>

      <section className="landing-hero">
        <p className="landing-kicker">Managed creative ops for Indian businesses</p>
        <h1>
          <Word>Creative</Word>{' '}
          <Word>Work,</Word>{' '}
          <Word accent>Managed.</Word>
        </h1>
        <p className="landing-hero-copy">
          Hire verified creators, manage briefs, review deliverables, and publish content from one operating layer built for Indian SMBs.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="landing-primary">Start a brief</Link>
          <Link to="/login" className="landing-secondary">Open workspace</Link>
        </div>
      </section>

      <section className="landing-proof">
        <div>Trusted by <strong>500+ brands</strong></div>
        <div className="platform-strip">
          <span>Instagram</span>
          <span>YouTube</span>
          <span>LinkedIn</span>
        </div>
      </section>

      <section className="landing-section landing-animate" id="how-it-works">
        <div className="section-head">
          <p>How it works</p>
          <h2>One clean path from idea to published creative.</h2>
        </div>
        <div className="feature-grid">
          {[
            ['01', 'Post Brief', 'Answer guided prompts and attach references without writing a production document from scratch.'],
            ['02', 'Match Creators', 'Mint More routes the work to the right internal team or verified creator pool.'],
            ['03', 'Deliver & Publish', 'Review files in Mintbox, request revisions, and connect deliverables to social publishing.'],
          ].map(([step, title, body]) => (
            <article className="feature-card" key={title}>
              <Icon>{step}</Icon>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-stats">
        {[
          [2400, '+', 'Projects delivered'],
          [98, '%', 'On-time rate'],
          [0, '', 'Platform fee for clients'],
        ].map(([target, suffix, label]) => (
          <div key={label}>
            <strong className="landing-stat-number" data-target={target} data-suffix={suffix}>0{suffix}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="landing-section landing-animate" id="pricing">
        <div className="section-head">
          <p>Pricing</p>
          <h2>Simple entry points. Ops-heavy where it matters.</h2>
        </div>
        <div className="pricing-grid">
          {[
            ['Monthly Creative Calendar', '10 MintCoins', 'Pick monthly moments and let Mint More produce the creatives.'],
            ['Custom Requests', 'Ops reviewed', 'Submit one-off designs, reels, offers, flyers, or campaign assets.'],
            ['Creator Marketplace', 'Coming next', 'Turn on verified freelancer matching when your team is ready to scale.'],
          ].map(([title, price, body]) => (
            <article className="pricing-card" key={title}>
              <h3>{title}</h3>
              <strong>{price}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-animate" id="for-creators">
        <div className="section-head compact">
          <p>For creators</p>
          <h2>Clear briefs, protected payments, structured revisions.</h2>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Mint More</span>
        <div>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </main>
  )
}
