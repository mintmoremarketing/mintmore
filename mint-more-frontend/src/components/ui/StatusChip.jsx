import { STATUS_META } from '../../utils/format'

export default function StatusChip({ status, dot = true }) {
	const meta = STATUS_META[status] || { label: status, tone: 'neutral' }
	return (
		<span className={`badge ${meta.tone}`}>
			{dot && <span className="bdot" />}
			{meta.label}
		</span>
	)
}
