import { STATUS_META } from '../../utils/format'
import { StatusBadge } from './StatusBadge'

export default function StatusChip({ status, dot = true }) {
	if (['assigned', 'in_progress', 'delivered', 'revision', 'blocked'].includes(status)) {
		return <StatusBadge status={status} />
	}
	const meta = STATUS_META[status] || { label: status, tone: 'neutral' }
	return (
		<span className={`badge ${meta.tone}`}>
			{dot && <span className="bdot" />}
			{meta.label}
		</span>
	)
}
