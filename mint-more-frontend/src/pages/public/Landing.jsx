import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const navItems = ['Platform', 'How it works', 'Pricing', 'For creators']

const proofBrands = ['Local stores', 'D2C brands', 'Restaurants', 'Coaches', 'Studios', 'Retailers']

const workflow = [
  ['01', 'Pick your month', 'Choose festival, offer, and campaign creatives from a clean monthly calendar.'],
  ['02', 'Send custom requests', 'Need a reel cover, flyer, launch post, or menu creative? Brief CREATYV in minutes.'],
  ['03', 'Review in Mintbox', 'Your files, comments, revisions, and final delivery stay attached to the project.'],
]

const statRows = [
  [20, '', 'pilot clients being onboarded'],
  [10, '', 'monthly MintCoins included'],
  [24, 'h', 'structured review windows'],
]


const quickQuestions = [
  'Who is CREATYV for?',
  'How do MintCoins work?',
  'Can I request custom designs?',
  'Do freelancers see my work?',
]

const localAnswer = (question) => {
  const text = String(question || '').toLowerCase()
  if (text.includes('freelancer') || text.includes('creator')) return 'For the first launch, requests go to the Mint More internal creative team. The freelancer marketplace stays hidden behind feature flags until the team decides to open it.'
  if (text.includes('coin') || text.includes('credit')) return 'MintCoins are monthly creative credits. Clients use them for calendar creatives and some requests. Extra selections can be sent to Mint More for review instead of blocking the client.'
  if (text.includes('custom') || text.includes('design') || text.includes('request')) return 'Yes. Clients can send custom requests like social posts, reel covers, product creatives, offer creatives, stories, flyers, menus, and banners. Mint More ops reviews the scope.'
  if (text.includes('mintbox') || text.includes('file') || text.includes('revision')) return 'Mintbox keeps references, drafts, revisions, and final files attached to the project. Revision feedback stays with the delivery so both sides keep context.'
  if (text.includes('price') || text.includes('pricing') || text.includes('cost')) return 'Pilot pricing is controlled by Mint More admins. The client-facing experience focuses on monthly MintCoins, calendar creatives, and ops-reviewed custom requests.'
  return 'CREATYV is for Indian businesses that need regular marketing creatives without managing scattered WhatsApp messages, folders, sheets, and follow-ups.'
}

function AskAnythingWidget() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me about CREATYV, MintCoins, custom requests, Mintbox, clients, designers, or the future freelancer marketplace.' },
  ])

  const ask = async (text = question) => {
    const cleaned = String(text || '').trim()
    if (!cleaned || loading) return
    setOpen(true)
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: cleaned }])
    setLoading(true)

    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
      const res = await fetch(base + '/public/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleaned }),
      })
      if (!res.ok) throw new Error('Q&A unavailable')
      const data = await res.json()
      const answer = data?.data?.answer || data?.data?.data?.answer
      setMessages(prev => [...prev, { role: 'assistant', text: answer || localAnswer(cleaned) }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: localAnswer(cleaned) }])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (event) => {
    event.preventDefault()
    ask()
  }

  return (
    <div className={'landing-ask-widget' + (open ? ' is-open' : '')}>
      {open && (
        <div className="landing-ask-panel">
          <div className="landing-ask-head">
            <div className="landing-ask-avatar" aria-hidden="true"><span /></div>
            <div>
              <strong>Holly</strong>
              <span>CREATYV Q&A agent</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Q&A">x</button>
          </div>
          <div className="landing-ask-messages">
            {messages.map((message, index) => (
              <div key={index} className={'landing-ask-bubble ' + message.role}>{message.text}</div>
            ))}
            {loading && <div className="landing-ask-bubble assistant">Thinking through the simplest answer...</div>}
          </div>
          <div className="landing-ask-chips">
            {quickQuestions.map(item => <button key={item} type="button" onClick={() => ask(item)}>{item}</button>)}
          </div>
          <p>AI can make mistakes. For pricing or launch commitments, confirm with Mint More.</p>
        </div>
      )}
      <form className="landing-ask-bar" onSubmit={onSubmit}>
        <input value={question} onFocus={() => setOpen(true)} onChange={event => setQuestion(event.target.value)} placeholder="Ask me anything..." />
        <button type="submit" aria-label="Ask question">?</button>
      </form>
    </div>
  )
}

export default function Landing() {
  const rootRef = useRef(null)
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50, active: false })

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
          targets: entry.target.querySelectorAll('.landing-card, .landing-pricing-card'),
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

  const moveSpotlight = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSpotlight({
      active: true,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <main className="landing-page" ref={rootRef}>
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">CREATYV <span>by Mint More</span></Link>
        <div className="landing-links">
          {navItems.map(item => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</a>
          ))}
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-login">Log in</Link>
          <Link to="/register" className="landing-cta">Get started</Link>
        </div>
      </nav>

      <section className="landing-hero" id="platform">
        <div className="landing-media-shell" aria-label="Hover to reveal creative production">
          <div
            className={`landing-image-reveal${spotlight.active ? ' is-revealed' : ''}`}
            tabIndex={0}
            style={{
              '--spot-x': `${spotlight.x}%`,
              '--spot-y': `${spotlight.y}%`,
            }}
            onPointerEnter={moveSpotlight}
            onPointerMove={moveSpotlight}
            onPointerLeave={() => setSpotlight(prev => ({ ...prev, active: false }))}
            onFocus={() => setSpotlight({ x: 50, y: 50, active: true })}
            onBlur={() => setSpotlight(prev => ({ ...prev, active: false }))}
          >
            <img className="landing-image-bottom" src="/landing/creative-rock-reveal.jpg" alt="Creative team producing work on rocky hills" />
            <img className="landing-image-top" src="/landing/creative-rock-mask.png" alt="Black rocky landscape mask" />
          </div>
        </div>
      </section>

      <section className="landing-proof">
        <span>Built for teams who need content every month</span>
        <div className="landing-logo-strip">
          {proofBrands.map(brand => <strong key={brand}>{brand}</strong>)}
        </div>
      </section>

      <section className="landing-section landing-animate" id="how-it-works">
        <div className="landing-section-head">
          <p>How it works</p>
          <h2>One workflow for calendar creatives, custom requests, delivery, and publishing.</h2>
        </div>
        <div className="landing-card-grid">
          {workflow.map(([step, title, body]) => (
            <article className="landing-card" key={title}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-stats">
        {statRows.map(([target, suffix, label]) => (
          <div key={label}>
            <strong className="landing-stat-number" data-target={target} data-suffix={suffix}>0{suffix}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="landing-split landing-animate" id="pricing">
        <div>
          <p className="landing-kicker">Pricing</p>
          <h2>Start with monthly creative credits. Add custom work when the business needs it.</h2>
          <Link to="/register" className="landing-primary">Join pilot launch</Link>
        </div>
        <div className="landing-pricing-stack">
          {[
            ['Calendar plan', '10 MintCoins / month', 'Use coins on monthly event creatives, offer posts, and business moments.'],
            ['Custom designs', 'Ops reviewed', 'Send one-off requests. CREATYV reviews scope and assigns internal designers.'],
            ['Marketplace', 'Feature flagged', 'Freelancer matching stays hidden until the pilot clients are ready for it.'],
          ].map(([title, price, body]) => (
            <article className="landing-pricing-card" key={title}>
              <h3>{title}</h3>
              <strong>{price}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-animate" id="for-creators">
        <div className="landing-section-head">
          <p>For creators</p>
          <h2>Internal designers get clear tasks, slots, due dates, client context, and Mintbox delivery.</h2>
        </div>
        <div className="landing-card-grid two">
          <article className="landing-card">
            <span>Ops</span>
            <h3>Assign work without chaos</h3>
            <p>Morning, evening, and night slots make production load visible before work starts slipping.</p>
          </article>
          <article className="landing-card">
            <span>Review</span>
            <h3>Every delivery has context</h3>
            <p>Briefs, files, comments, revisions, and approvals stay attached to the same creative record.</p>
          </article>
        </div>
      </section>

      <AskAnythingWidget />

      <footer className="landing-footer">
        <strong>CREATYV</strong>
        <span>Creative work, managed by Mint More.</span>
        <div>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </main>
  )
}
