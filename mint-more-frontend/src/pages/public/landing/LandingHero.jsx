import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function LandingHero({ spotlight, onMoveSpotlight, onSetSpotlight }) {
  const heroLine = 'CREATYV moves your business'
  const ctaLine = 'Plan your first month'
  const [ctaActive, setCtaActive] = useState(false)
  const activeLine = ctaActive ? ctaLine : heroLine

  return (
    <section className="landing-hero" id="platform">
      <div className="landing-media-shell" aria-label="Hover to reveal creative production">
        <div
          className={`landing-image-reveal${spotlight.active ? ' is-revealed' : ''}`}
          tabIndex={0}
          style={{
            '--spot-x': `${spotlight.x}%`,
            '--spot-y': `${spotlight.y}%`,
          }}
          onPointerEnter={onMoveSpotlight}
          onPointerMove={onMoveSpotlight}
          onPointerLeave={() => onSetSpotlight(prev => ({ ...prev, active: false }))}
          onFocus={() => onSetSpotlight({ x: 50, y: 50, active: true })}
          onBlur={() => onSetSpotlight(prev => ({ ...prev, active: false }))}
        >
          <img className="landing-image-bottom" src="/landing/creative-rock-reveal.webp" alt="Creative team producing work on rocky hills" />
          <img className="landing-image-top" src="/landing/creative-rock-mask.webp" alt="Black rocky landscape mask" />
          <div className="landing-hero-center-copy" aria-live="polite">
            <Link
              to="/register"
              className={`landing-hero-phrase-action${ctaActive ? ' is-cta' : ''}`}
              aria-label={ctaLine}
              onPointerEnter={() => setCtaActive(true)}
              onPointerLeave={() => setCtaActive(false)}
              onFocus={() => setCtaActive(true)}
              onBlur={() => setCtaActive(false)}
            >
              <span className="landing-hero-phrase-stage" key={activeLine}>
                <span className="landing-hero-phrase" aria-label={activeLine}>
                  {activeLine.split('').map((char, index) => (
                  <span
                    aria-hidden="true"
                    className="landing-hero-char"
                    style={{
                      '--char-delay': `${index * 34}ms`,
                    }}
                    key={`${char}-${index}`}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                ))}
                </span>
              </span>
              <span className="landing-hero-cta-hint">Click to start</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
