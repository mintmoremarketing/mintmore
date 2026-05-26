export function Skeleton({ width, height = 16, radius = 6, style }) {
	return (
		<div
			className="skeleton"
			style={{ width, height, borderRadius: radius, ...style }}
		/>
	)
}

export function SkeletonCard() {
	return (
		<div className="card" style={{ padding: 16 }}>
			<Skeleton width="60%" height={14} style={{ marginBottom: 10 }} />
			<Skeleton width="100%" height={20} style={{ marginBottom: 8 }} />
			<Skeleton width="80%" height={14} />
		</div>
	)
}
