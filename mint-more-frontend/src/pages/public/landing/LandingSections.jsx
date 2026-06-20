import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  bentoCards,
  integrations,
  proofBrands,
  rollingCards,
  stories,
  tabFeatures,
  valueCards,
  workflowSlides,
} from './landingContent'

function MiniIcon({ label }) {
  const initials = label.split(' ').map(part => part[0]).join('').slice(0, 2)
  return <span className="landing-mini-icon" aria-hidden="true">{initials}</span>
}

function WorkflowMock({ slide }) {
  return (
    <div className="landing-slide-mock" aria-hidden="true">
      <div className="landing-slide-window">
        <div className="landing-slide-window-head">
          <span />
          <strong>{slide.mockTitle}</strong>
          <button type="button">Open</button>
        </div>
        <div className="landing-slide-rows">
          {slide.mockRows.map((row, index) => (
            <div key={row} className={index === 0 ? 'is-active' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{row}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwipeMarkers({ items, activeId, onSelect }) {
  return (
    <div className="landing-swipe-markers" aria-label="Feature slides">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeId ? 'is-active' : ''}
          aria-label={`Show ${item.label}`}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  )
}

export function ProofStrip() {
  return (
    <section className="landing-proof">
      <span>Built for teams who need content every month</span>
      <div className="landing-logo-strip">
        {proofBrands.map(brand => <strong key={brand}>{brand}</strong>)}
      </div>
    </section>
  )
}

export function WorkflowSection() {
  const [activeId, setActiveId] = useState(workflowSlides[0].id)
  const activeIndex = Math.max(0, workflowSlides.findIndex(item => item.id === activeId))

  return (
    <section className="landing-workflow landing-animate" id="how-it-works">
      <div className="landing-centered-head">
        <p>How it works</p>
        <h2>Your whole creative program, finally connected in one workflow.</h2>
      </div>

      <div className="landing-swipe-shell">
        <div className="landing-swipe-track" style={{ '--active-index': activeIndex }}>
          {workflowSlides.map(slide => (
            <article className={`landing-swipe-card ${slide.tone}`} key={slide.id}>
              <div className="landing-swipe-copy">
                <span>{slide.label}</span>
                <h3>{slide.title}</h3>
                <p>{slide.body}</p>
                <button type="button">{slide.cta}</button>
              </div>
              <WorkflowMock slide={slide} />
            </article>
          ))}
        </div>
      </div>

      <SwipeMarkers items={workflowSlides} activeId={activeId} onSelect={setActiveId} />
    </section>
  )
}

export function StatsRow() {
  return (
    <section className="landing-feature-flow landing-animate" id="features">
      <div className="landing-centered-head">
        <p>Why CREATYV</p>
        <h2>Creative operations that feel lighter for the business.</h2>
      </div>
      <div className="landing-feature-list">
        {valueCards.slice(0, 6).map(([title, body]) => (
          <article className="landing-value-card" key={title}>
            <MiniIcon label={title} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function PricingSection() {
  return (
    <section className="landing-social-block landing-animate" id="pricing">
      <article className="landing-social-tile">
        <div className="landing-social-art" aria-hidden="true">
          <span className="social-sticker instagram">IG</span>
          <span className="social-sticker facebook">FB</span>
          <span className="social-sticker youtube">YT</span>
        </div>
        <div>
          <p className="landing-kicker">Connected channels</p>
          <h2>Connects with Instagram, Facebook, and YouTube</h2>
          <p>Plan content in CREATYV, approve the creative, then move it toward the places your customers already follow you.</p>
          <div className="landing-social-grid">
            {integrations.map(([title, body]) => (
              <span key={title}>
                <strong>{title}</strong>
                {body}
              </span>
            ))}
          </div>
          <div className="landing-cta-row">
            <Link to="/register" className="landing-primary">Create your account</Link>
            <Link to="/login" className="landing-secondary">View dashboard</Link>
          </div>
        </div>
      </article>
    </section>
  )
}

export function CreatorsSection() {
  return (
    <>
      <section className="landing-bento landing-animate">
        <div className="landing-centered-head">
          <p>Workspace</p>
          <h2>One clean operating system for monthly creative work.</h2>
        </div>
        <div className="landing-bento-grid">
          {bentoCards.map(([title, body, size]) => (
            <article className={`landing-bento-card ${size}`} key={title}>
              <MiniIcon label={title} />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-stories landing-animate" id="stories">
        <div className="landing-centered-head">
          <p>Success stories</p>
          <h2>From teams who used to do a lot of unnecessary manual work.</h2>
        </div>
        <div className="landing-story-track" aria-label="Success stories">
          {stories.map(([title, body, person], index) => (
            <article className={`landing-story-card story-${index}`} key={title}>
              <span>{title}</span>
              <p>{body}</p>
              <strong>{person}</strong>
            </article>
          ))}
        </div>
        <div className="landing-swipe-markers story-markers" aria-hidden="true">
          {stories.map(([title], index) => <i key={title} className={index === 0 ? 'is-active' : ''} />)}
        </div>
      </section>

      <section className="landing-scroll-stack" aria-label="CREATYV workflow stack">
        {rollingCards.map(([title, body, tone], index) => (
          <article className={`landing-stack-card ${tone}`} key={title} style={{ '--stack-index': index }}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </>
  )
}
