export default function DashboardTeaserSection() {
  return (
    <section className="py-24 px-4 bg-white text-[#15120f] overflow-hidden" id="dashboard">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 landing-animate">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6" style={{ fontFamily: 'var(--font-landing-display)' }}>
            One Workspace for Your Entire Content Workflow
          </h2>
          <p className="text-lg text-[#15120f]/70 font-medium max-w-2xl mx-auto">
            Creatyv brings content creation, planning, storage, approvals and publishing into one simple brand dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <div className="bg-[#f9f9f9] p-8 md:p-12 rounded-3xl border border-[#15120f]/5 landing-animate">
            <h3 className="text-2xl font-bold mb-4">Brand Dashboard</h3>
            <p className="text-[#15120f]/70 mb-6 font-medium">Manage your complete social media workflow from one place.</p>
            <ul className="space-y-3 mb-8">
              {[
                'Generate monthly content plans using AI',
                'Create captions, images and videos',
                'Store drafts, brand assets and generated content in Mintbox',
                'Organise posts in a visual content calendar',
                'Review and approve content',
                'Schedule posts across supported platforms',
                'Publish content directly from Creatyv',
                'Track what is drafted, approved, scheduled and published'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium">
                  <div className="mt-1 min-w-4 h-4 rounded-full bg-[var(--landing-accent)] text-white flex items-center justify-center text-[10px]">✓</div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-bold text-[var(--landing-accent-deep)] italic">Everything stays connected-from the first idea to the final post.</p>
            
            <div className="mt-8 relative aspect-[4/3] rounded-2xl overflow-hidden bg-white border border-[#15120f]/10">
              <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80" alt="Dashboard Demo" className="w-full h-full object-cover opacity-70" />
            </div>
          </div>

          <div className="bg-[#15120f] p-8 md:p-12 rounded-3xl border border-[#15120f]/10 text-white landing-animate">
            <h3 className="text-2xl font-bold mb-4">Managed by MMM</h3>
            <p className="text-white/70 mb-6 font-medium">Prefer to have your marketing handled by professionals?</p>
            <p className="text-white/80 mb-6 leading-relaxed">
              Choose <strong className="text-[var(--landing-accent)]">Managed by MMM</strong> and let Mint More Marketing take care of content strategy, planning, creative execution, approvals, scheduling and publishing.
            </p>
            <p className="text-white/80 mb-8 leading-relaxed">
              You can continue to review and approve everything from your Creatyv dashboard while the MMM team manages the work behind the scenes.
            </p>
            <button className="bg-white text-[#15120f] px-8 py-3 rounded-full font-bold transition-transform hover:scale-105">
              Contact MMM
            </button>
            
            <div className="mt-12 relative aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80" alt="Team Demo" className="w-full h-full object-cover opacity-60" />
            </div>
          </div>
        </div>

        {/* Freelancer Teaser */}
        <div className="bg-[var(--landing-accent-wash)] rounded-3xl p-8 md:p-16 text-center landing-animate border border-[var(--landing-accent)]/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[var(--landing-accent)]"></div>
          <span className="inline-block px-4 py-1 bg-white rounded-full text-xs font-bold tracking-wider uppercase text-[var(--landing-accent-deep)] mb-6 shadow-sm">
            Coming Soon
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Freelancer Marketplace
          </h2>
          <h3 className="text-2xl font-bold mb-6 text-[#15120f]">
            Get Discovered. Get Hired. Get Paid.
          </h3>
          <p className="text-lg text-[#15120f]/70 font-medium max-w-3xl mx-auto mb-10 leading-relaxed">
            A creative opportunity marketplace where freelancers, students, job seekers and experienced professionals can find projects, work with verified brands and build a sustainable income from their skills.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10 text-left">
            {[
              'Find paid projects from growing brands',
              'Receive relevant auto-matched opportunities',
              'Work with verified businesses',
              'Receive payment for approved work'
            ].map((f, i) => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm text-sm font-medium flex gap-3">
                <span className="text-[var(--landing-accent)]">✦</span> {f}
              </div>
            ))}
          </div>
          
          <p className="font-bold text-[var(--landing-accent-deep)] italic mb-8">
            Be among the first creative professionals to access paid opportunities through Creatyv.
          </p>
          <button className="landing-primary px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105">
            Join the Freelancer Waitlist
          </button>
        </div>
      </div>
    </section>
  )
}
