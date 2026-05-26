export default function Tabs({ items, value, onChange }) {
	return (
		<div className="tabs">
			{items.map((it) => (
				<button
					key={it.value}
					className={`tab ${value === it.value ? 'active' : ''}`}
					onClick={() => onChange(it.value)}
				>
					{it.label}
					{typeof it.count !== 'undefined' && (
						<span className="pill">{it.count}</span>
					)}
				</button>
			))}
		</div>
	)
}
