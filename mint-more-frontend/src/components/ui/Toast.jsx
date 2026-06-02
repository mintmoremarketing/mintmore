import Icon from './Icon'

export function ToastHost({ toasts }) {
	return (
		<div
			style={{
				position: 'fixed',
				bottom: 20,
				right: 20,
				zIndex: 100,
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
				pointerEvents: 'none',
			}}
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 10,
						padding: '12px 14px',
						background: 'var(--ink-950)',
						color: 'white',
						borderRadius: 'var(--radius-lg)',
						boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
						minWidth: 260,
						maxWidth: 340,
						animation: 'slideUp 0.2s ease',
					}}
				>
					<div
						style={{
							width: 22,
							height: 22,
							borderRadius: '50%',
							flexShrink: 0,
							background:
								t.tone === 'amber' ? 'var(--amber)' : 'var(--mint-500)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Icon name={t.icon || 'check'} size={11} strokeWidth={2.4} />
					</div>
					<div>
						<div style={{ fontWeight: 500, fontSize: 13.5 }}>{t.title}</div>
						{t.body && (
							<div
								style={{
									fontSize: 12,
									color: 'rgba(255,255,255,0.65)',
									marginTop: 2,
									lineHeight: 1.4,
								}}
							>
								{t.body}
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	)
}
