export default function AudienceSection() {
  const audiences = [
    { title: 'Creators', desc: 'Generate, plan and publish content consistently.' },
    { title: 'Small Businesses & SMEs', desc: 'Manage professional content without the cost of a full-service agency.' },
    { title: 'Founders', desc: 'Build their brand and stay active online without hiring a large team.' },
    { title: 'In-House Marketing Teams', desc: 'Keep content creation, approvals and publishing organised.' },
    { title: 'Growing Brands', desc: 'Start independently and move to Managed by MMM when they need expert support.' },
  ]

  return (
    <section className="py-24 px-4 bg-[#15120f] text-white overflow-hidden">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="landing-animate">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-10" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Who Is Creatyv For?
          </h2>
          <div className="space-y-6">
            {audiences.map((aud, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors">
                <h3 className="text-xl font-bold mb-2 text-[var(--landing-accent)]">{aud.title}</h3>
                <p className="text-white/70 font-medium">{aud.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-animate lg:mt-32">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Built by marketers who manage content every day.
          </h2>
          <p className="text-lg text-white/70 font-medium mb-6 leading-relaxed">
            Creatyv is developed by <strong className="text-white">Mint More Marketing</strong>, a creative and social media agency working with brands across content, design, video, strategy and digital marketing.
          </p>
          <p className="text-lg text-white/70 font-medium leading-relaxed">
            We built Creatyv to solve the same problems that brands, creators and marketing teams face every day: scattered ideas, inconsistent posting, delayed approvals and disconnected tools.
          </p>
        </div>
      </div>
    </section>
  )
}
