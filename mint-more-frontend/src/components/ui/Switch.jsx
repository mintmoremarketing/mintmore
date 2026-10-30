/** An on/off switch. The thumb slides; the track takes the brand colour only when on. */
export default function Switch({ checked, onChange, label, disabled = false, id }) {
	return (
		<button
			id={id}
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className="group relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			<span className={`absolute inset-0 rounded-full transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible:ring-2 group-focus-visible:ring-ink-900 group-focus-visible:ring-offset-2 ${checked ? 'bg-mint-500' : 'bg-ink-200 group-hover:bg-ink-300'}`} />
			<span className={`relative ml-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-90 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
		</button>
	)
}
