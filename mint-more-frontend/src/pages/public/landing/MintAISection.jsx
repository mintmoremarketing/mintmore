export default function MintAISection() {
  return (
    <section className="py-24 px-4 bg-[#15120f] text-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Mint AI
          </h2>
          <h3 className="text-2xl md:text-3xl font-medium mb-6 text-white/90">
            One idea. Multiple possibilities.
          </h3>
          <p className="text-lg text-white/70 mb-8" style={{ fontFamily: 'var(--font-landing-sans)' }}>
            Tell Creatyv what you want to communicate.<br/><br/>
            For example:<br/>
            <span className="italic">"Create an Instagram launch post for a new café menu targeting college students."</span>
            <br/><br/>
            Creatyv can help you generate the caption, visual direction, image and video content required for the campaign.
            <br/><br/>
            Edit the output, save it to your workspace and add it directly to your content calendar.
          </p>
          <button className="landing-primary px-8 py-3 rounded-full font-bold text-lg transition-transform hover:scale-105">
            Try Mint AI
          </button>
        </div>
        
        {/* Placeholder for Mint AI demo image/UI */}
        <div className="relative aspect-square md:aspect-[4/3] bg-white/5 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center p-8">
          <img 
            src="https://images.unsplash.com/photo-1673809033306-382a931448b4?auto=format&fit=crop&w=800&q=80" 
            alt="AI Interface Demo" 
            className="w-full h-full object-cover rounded-2xl opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center text-white/50 font-medium">
            AI Interface Demo
          </div>
        </div>
      </div>
    </section>
  )
}
