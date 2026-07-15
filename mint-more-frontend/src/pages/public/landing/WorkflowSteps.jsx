import { newWorkflowSteps } from './landingContent'

export default function WorkflowSteps() {
  return (
    <section className="py-24 px-4 bg-white text-[#15120f]" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing-display)' }}>
            Your complete content engine,
            <br className="hidden md:block"/> connected from prompt to publish.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {newWorkflowSteps.map((step) => (
            <div key={step.id} className="flex flex-col landing-animate">
              <span className="text-[var(--landing-accent)] text-4xl font-bold mb-4 font-mono">{step.id}.</span>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-[#15120f]/70 leading-relaxed font-medium">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
