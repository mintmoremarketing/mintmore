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

function WorkflowPreview({ feature }) {
  const preview = feature.preview || {}

  if (preview.kind === 'image') {
    return (
      <div className="landing-tab-preview landing-tab-preview-image">
        <div className="landing-tab-preview-head">
          <span>{preview.badge || feature.label}</span>
          <strong>{preview.label || 'Preview'}</strong>
        </div>
        <div className="landing-tab-preview-frame">
          <img src={preview.src} alt={preview.alt || ''} />
        </div>
      </div>
    )
  }

  if (preview.kind === 'meter') {
    return (
      <div className="landing-tab-preview landing-tab-preview-meter">
        <div className="landing-tab-preview-head">
          <span>{preview.badge || feature.label}</span>
          <strong>{preview.label || 'Meter'}</strong>
        </div>
        <div className="landing-tab-preview-meter-row">
          <div className="landing-tab-preview-chip">
            <span>Balance</span>
            <strong>₹{preview.value || '0'}</strong>
          </div>
          <div className="landing-tab-preview-ring" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="46" />
              <circle cx="60" cy="60" r="46" className="meter-progress" />
            </svg>
            <strong>Usage</strong>
          </div>
        </div>
        <p>{preview.detail}</p>
        <div className="landing-tab-preview-footer">
          <span>Images</span>
          <strong>5 free</strong>
          <span>Video</span>
          <strong>Coin priced</strong>
        </div>
      </div>
    )
  }

  if (preview.kind === 'folder') {
    return (
      <div className="landing-tab-preview landing-tab-preview-folder">
        <div className="landing-tab-preview-head">
          <span>{preview.badge || feature.label}</span>
          <strong>{preview.label || 'Folder'}</strong>
        </div>
        <div className="landing-tab-preview-folder-stack" aria-hidden="true">
          <div className="back" />
          <div className="middle" />
          <div className="front" />
        </div>
        <p>{preview.detail}</p>
      </div>
    )
  }

  if (preview.kind === 'calendar') {
    return (
      <div className="landing-tab-preview landing-tab-preview-calendar">
        <div className="landing-tab-preview-head">
          <span>{preview.badge || feature.label}</span>
          <strong>{preview.label || 'Calendar'}</strong>
        </div>
        <div className="landing-tab-preview-calendar-grid" aria-hidden="true">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
          {Array.from({ length: 21 }).map((_, index) => (
            <span key={index} className={index === 2 || index === 7 || index === 14 ? 'is-active' : ''}>
              {index + 1}
            </span>
          ))}
        </div>
        <p>{preview.detail}</p>
      </div>
    )
  }

  return (
    <div className="landing-tab-preview">
      <div className="landing-tab-preview-head">
        <span>{feature.label}</span>
        <strong>{feature.title}</strong>
      </div>
      <p>{feature.body}</p>
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
    <section className="landing-proof" aria-label="Feature labels">
      <div className="landing-logo-strip" aria-hidden="true">
        <div className="landing-logo-strip-track">
          {proofBrands.map(brand => <strong key={`primary-${brand}`}>{brand}</strong>)}
          {proofBrands.map(brand => <strong key={`secondary-${brand}`}>{brand}</strong>)}
        </div>
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
        <h2>Your complete content engine, connected from prompt to publish.</h2>
      </div>

      <div className="landing-desktop-tabs" aria-label="CREATYV workflow tabs">
        <div className="landing-tab-switcher" style={{ '--active-index': Math.max(0, tabFeatures.findIndex(item => item.id === desktopTab)) }}>
          <span className="landing-tab-indicator" aria-hidden="true" />
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
          </div>
          <div className="landing-tab-visual" aria-hidden="true">
            <WorkflowPreview feature={desktopFeature} />
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

export function ManagedSection() {
  return (
    <section className="landing-managed landing-animate" id="managed-by-mmm">
      <div className="landing-centered-head">
        <p>Managed by MMM</p>
        <h2>For businesses that want the technology plus hands-on creative support.</h2>
      </div>
      <div className="landing-card-grid two">
        {[
          ['Strategy support', 'We help map out the month, the campaign goals, and the content mix.'],
          ['Production support', 'Requests, revisions, and creative handoff stay coordinated in one workflow.'],
        ].map(([title, body]) => (
          <article className="landing-card" key={title}>
            <MiniIcon label={title} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function SocialSection() {
  return (
    <section className="landing-social-block landing-animate" id="social">
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

export function RoadmapSection() {
  return (
    <section className="landing-roadmap landing-animate" id="roadmap">
      <div className="landing-centered-head">
        <p>Roadmap</p>
        <h2>What we’re building next.</h2>
      </div>
      <div className="landing-card-grid features">
        {[
          ['More publishing depth', 'Expand post formats, scheduling controls, and platform options.'],
          ['Richer analytics', 'Bring clearer reporting for accounts, posts, and campaign performance.'],
          ['Smarter AI workflow', 'Keep improving how prompts, references, and outputs stay aligned.'],
        ].map(([title, body]) => (
          <article className="landing-card" key={title}>
            <MiniIcon label={title} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
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

export function PricingSection() {
  const [billing, setBilling] = useState('monthly')
  const isAnnual = billing === 'annual'

  return (
    <section className="landing-pricing-block landing-animate" id="pricing">
      <div className="landing-centered-head">
        <p>CREATYV PRICING PLANS</p>
        <h2>Generate AI text, images and videos for free. Buy Mint Coins whenever you need more.</h2>
        <div className="landing-pricing-toggle-wrap">
          <span>Choose monthly or annual billing. Annual prices are shown as the effective monthly rate and are billed annually.</span>
          <div className="landing-pricing-toggle">
            <button className={!isAnnual ? 'active' : ''} onClick={() => setBilling('monthly')}>Monthly</button>
            <button className={isAnnual ? 'active' : ''} onClick={() => setBilling('annual')}>Annually</button>
          </div>
        </div>
      </div>
      
      <div className="landing-pricing-cards">
        <article className="landing-pricing-card">
          <div className="landing-pricing-header">
            <h3>FREE</h3>
            <div className="price">₹0<span>/month</span></div>
            <p>For individuals, SMEs and brands exploring Creatyv.</p>
          </div>
          <ul className="landing-pricing-features">
            <li>Limited monthly AI generations</li>
            <li>1,000 Mint Coins included</li>
            <li>AI text generation</li>
            <li>AI image generation</li>
            <li>AI video generation</li>
            <li>Save content drafts</li>
            <li>Access your content workspace</li>
            <li>Standard account access</li>
          </ul>
          <div className="landing-pricing-cta">
            <Link to="/register" className="btn outline">Start for Free</Link>
            <small>No payment method required.</small>
          </div>
        </article>
        
        <article className="landing-pricing-card recommended">
          <div className="recommended-badge">Recommended</div>
          <div className="landing-pricing-header">
            <h3>SOCIAL</h3>
            <div className="price">{isAnnual ? '₹1,699' : '₹1,999'}<span>/month</span></div>
            <p>For creators, businesses and teams that want to create and publish regularly.</p>
            {isAnnual && <small className="annual-total">Annual billing total: ₹20,388/year</small>}
          </div>
          <ul className="landing-pricing-features">
            <li>Higher monthly AI generation limits</li>
            <li>10,000 Mint Coins recharged every month</li>
            <li>AI text generation</li>
            <li>AI image generation</li>
            <li>AI video generation</li>
            <li>Visual content calendar</li>
            <li>Instagram scheduling and publishing</li>
            <li>Facebook scheduling and publishing</li>
            <li>YouTube scheduling and publishing</li>
            <li>Post review and approval workflow</li>
            <li>Brand workspace</li>
            <li>Priority product access</li>
            <li>Insights access when launched</li>
          </ul>
          <div className="landing-pricing-cta">
            <Link to="/register" className="btn mint">Upgrade to Social</Link>
          </div>
        </article>

        <article className="landing-pricing-card">
          <div className="landing-pricing-header">
            <h3>MANAGED BY MMM</h3>
            <div className="price">{isAnnual ? '₹7,999' : '₹9,999'}<span>/month</span></div>
            <p>For businesses that want Creatyv’s technology with professional marketing support.</p>
            {isAnnual && <small className="annual-total">Annual billing total: ₹95,988/year</small>}
          </div>
          <ul className="landing-pricing-features">
            <li><strong>Everything included in Social</strong></li>
            <li>Custom monthly content plan</li>
            <li>Content strategy support</li>
            <li>Professional copy and creative assistance</li>
            <li>Review and approval dashboard</li>
            <li>Scheduling and publishing support</li>
            <li>Mint More Marketing execution</li>
            <li>Dedicated coordination</li>
            <li>Custom deliverables based on your requirements*</li>
            <li>Reporting and recommendations</li>
          </ul>
          <div className="landing-pricing-cta">
            <a href="mailto:agency@mintmoremarketing.com" className="btn outline">Contact MMM</a>
            <small>*Custom scope and deliverables are finalised before onboarding.</small>
          </div>
        </article>
      </div>

      <div className="landing-pricing-table-wrapper">
        <h3 className="landing-table-title">PRICING COMPARISON</h3>
        <table className="landing-pricing-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th>Social</th>
              <th>Managed by MMM</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>AI Text Generation</td><td>Limited</td><td>Higher limit</td><td>Included</td></tr>
            <tr><td>AI Image Generation</td><td>Limited</td><td>Higher limit</td><td>Included</td></tr>
            <tr><td>AI Video Generation</td><td>Limited</td><td>Higher limit</td><td>Included</td></tr>
            <tr><td>Mint Coins (Tokens)</td><td>1,000/month</td><td>10,000/month</td><td>10,000/month + managed service</td></tr>
            <tr><td>Content Calendar</td><td>Included</td><td>Included</td><td>Included + Assisted Reminders</td></tr>
            <tr><td>Festival Greetings</td><td>Not included</td><td>Not included</td><td>Included with Personalised Messaging</td></tr>
            <tr><td>Mint Box (Storage)</td><td>10 GB included</td><td>100 GB included</td><td>250 GB included</td></tr>
            <tr><td>Save Drafts</td><td>Included</td><td>Included</td><td>Included</td></tr>
            <tr><td>Instagram Publishing</td><td>Not included</td><td>Included</td><td>Managed</td></tr>
            <tr><td>Facebook Publishing</td><td>Not included</td><td>Included</td><td>Managed</td></tr>
            <tr><td>YouTube Publishing</td><td>Not included</td><td>Included</td><td>Managed</td></tr>
            <tr><td>Review & Approval</td><td>Basic</td><td>Included</td><td>Included</td></tr>
            <tr><td>Content Strategy</td><td>Not included</td><td>Self-managed</td><td>MMM supported</td></tr>
            <tr><td>Creative Execution</td><td>AI-assisted</td><td>AI-assisted</td><td>MMM supported</td></tr>
            <tr><td>Account Executive</td><td>Not included</td><td>Not included</td><td>MMM Trained Assistant</td></tr>
            <tr><td>Performance Insights</td><td>Coming soon</td><td>Coming soon</td><td>Coming soon</td></tr>
            <tr><td>Monthly Billing</td><td>Free</td><td>₹1,999/month</td><td>₹9,999/month</td></tr>
            <tr><td>Annual Billing</td><td>Not applicable</td><td>₹1,699/month (₹20,388/year)</td><td>₹7,999/month (₹95,988/year)</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
