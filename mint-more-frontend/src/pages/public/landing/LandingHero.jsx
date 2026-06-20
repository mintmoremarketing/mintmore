export default function LandingHero({ spotlight, onMoveSpotlight, onSetSpotlight }) {
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
          <img className="landing-image-bottom" src="/landing/creative-rock-reveal.jpg" alt="Creative team producing work on rocky hills" />
          <img className="landing-image-top" src="/landing/creative-rock-mask.png" alt="Black rocky landscape mask" />
        </div>
      </div>
    </section>
  )
}
