import { useState } from 'react'
import { Link } from 'react-router-dom'
import ScrollStack, { ScrollStackItem } from '../../../components/landing/ScrollStack'
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

function StoryCarousel() {
  const [activeStory, setActiveStory] = useState(0)
  const previousStory = () => setActiveStory(index => (index - 1 + stories.length) % stories.length)
  const nextStory = () => setActiveStory(index => (index + 1) % stories.length)

  return (
    <>
      <div className="landing-story-controls">
        <button type="button" aria-label="Previous story" onClick={previousStory}>←</button>
        <button type="button" aria-label="Next story" onClick={nextStory}>→</button>
      </div>
      <div className="landing-story-viewport" aria-label="Success stories">
        <div
          className="landing-story-track"
          style={{ '--story-index': activeStory }}
        >
          {stories.map(([title, body, person], index) => (
            <article className={`landing-story-card story-${index}`} key={title}>
              <span>{title}</span>
              <p>{body}</p>
              <strong>{person}</strong>
            </article>
          ))}
        </div>
      </div>
      <div className="landing-swipe-markers story-markers" aria-label="Story slides">
        {stories.map(([title], index) => (
          <button
            key={title}
            type="button"
            className={index === activeStory ? 'is-active' : ''}
            aria-label={`Show ${title} story`}
            onClick={() => setActiveStory(index)}
          />
        ))}
      </div>
    </>
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
  const [desktopTab, setDesktopTab] = useState(tabFeatures[0].id)
  const desktopFeature = tabFeatures.find(item => item.id === desktopTab) || tabFeatures[0]

  return (
    <section className="landing-workflow landing-animate" id="how-it-works">
      <div className="landing-centered-head">
        <p>How it works</p>
        <h2>Your whole creative program, finally connected in one workflow.</h2>
      </div>

      <div className="landing-desktop-tabs" aria-label="CREATYV workflow tabs">
        <div className="landing-tab-switcher">
          {tabFeatures.map(feature => (
            <button
              key={feature.id}
              type="button"
              className={feature.id === desktopTab ? 'is-active' : ''}
              onClick={() => setDesktopTab(feature.id)}
            >
              {feature.label}
            </button>
          ))}
        </div>
        <article className={`landing-tab-panel ${desktopFeature.tone}`}>
          <div className="landing-tab-copy">
            <span>{desktopFeature.label}</span>
            <h3>{desktopFeature.title}</h3>
            <p>{desktopFeature.body}</p>
            <ul>
              {desktopFeature.points.map(point => <li key={point}>{point}</li>)}
            </ul>
          </div>
          <div className="landing-tab-visual" aria-hidden="true">
            <div className="landing-tab-board">
              <div className="landing-tab-board-head">
                <strong>{desktopFeature.label}</strong>
                <span>Live workspace</span>
              </div>
              {desktopFeature.points.map((point, index) => (
                <div key={point} className={index === 0 ? 'is-active' : ''}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{point}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="landing-swipe-shell landing-mobile-swipe">
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

      <div className="landing-mobile-swipe">
        <SwipeMarkers items={workflowSlides} activeId={activeId} onSelect={setActiveId} />
      </div>
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
          <p>Testimonials</p>
          <h2>From teams who used to do a lot of unnecessary manual work.</h2>
        </div>
        <StoryCarousel />
      </section>

      <section className="landing-scroll-stack" aria-label="CREATYV workflow stack">
        <div className="landing-stack-intro">
          <p>See the workflow</p>
          <h2>One screen hands the work to the next.</h2>
        </div>
        <ScrollStack
          className="landing-stack-pin"
          itemDistance={28}
          itemScale={0}
          itemStackDistance={14}
          stackPosition="8%"
          scaleEndPosition="8%"
          baseScale={1}
          blurAmount={0}
          useWindowScroll
        >
          {rollingCards.map(([title, body, tone], index) => (
            <ScrollStackItem key={title} itemClassName={`landing-stack-card ${tone}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              {tone === 'cta' ? (
                <div className="landing-stack-cta">
                  <p>{body}</p>
                  <div>
                    <Link to="/register">Try for free</Link>
                    <a href="mailto:agency@mintmoremarketing.com">Contact us</a>
                  </div>
                  <small>Start with your calendar, requests, Mintbox, and publishing workflow.</small>
                </div>
              ) : (
                <p>{body}</p>
              )}
            </ScrollStackItem>
          ))}
        </ScrollStack>
      </section>
    </>
  )
}
