import { STAGE_META } from './serviceUtils'

export default function StageBadge({ stage }) {
	const meta = STAGE_META[stage] || { label: stage, tone: 'bg-ink-50 text-ink-600 border-ink-200' }
	return (
		<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${meta.tone}`}>
			{meta.label}
		</span>
	)
}
