import Icon from '../ui/Icon'

/** The Creatyv Pro tab while the plan is still being built. */
export default function ProComingSoon({ onTryAi }) {
	return (
		<section aria-labelledby="pro-coming-title" className="pro-soon flex min-h-[40vh] flex-col items-center justify-center py-12 text-center md:py-20">
			<h2 id="pro-coming-title" className="text-[52px] font-semibold leading-none tracking-[-0.04em] text-ink-950 md:text-[88px]">
				Creatyv Pro
			</h2>
			<p className="mt-4 text-xl font-medium text-orange-600 md:text-2xl">Coming soon</p>
			<button
				type="button"
				onClick={onTryAi}
				className="mt-10 inline-flex h-12 items-center gap-1.5 rounded-full bg-ink-950 px-6 text-base font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
			>
				Edit with AI today <Icon name="arrowRight" size={16} />
			</button>
		</section>
	)
}
