import Icon from './Icon'
import { PASSWORD_RULES } from '../../utils/passwordPolicy'

/** What a new password still needs, ticked off as it's typed. */
export default function PasswordChecklist({ password = '', id }) {
	return (
		<ul id={id} className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2" aria-label="Password requirements">
			{PASSWORD_RULES.map(rule => {
				const met = rule.test(password)
				return (
					<li key={rule.key} className={`flex items-center gap-1.5 transition-colors duration-150 ${met ? 'text-emerald-700' : 'text-ink-500'}`}>
						<span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${met ? 'bg-emerald-600 text-white' : 'border border-ink-300'}`} aria-hidden="true">
							{met && <Icon name="check" size={10} />}
						</span>
						{rule.label}<span className="sr-only">{met ? ', done' : ', missing'}</span>
					</li>
				)
			})}
		</ul>
	)
}
