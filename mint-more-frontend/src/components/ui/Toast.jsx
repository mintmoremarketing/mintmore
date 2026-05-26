import Icon from './Icon'

export function ToastHost({ toasts }) {
	return (
		<div className="toast-host">
			{toasts.map((t) => (
				<div className="toast" key={t.id}>
					<div
						className="toast-icon"
						style={{ background: t.tone === 'amber' ? 'var(--amber)' : 'var(--mint-500)' }}
					>
						<Icon name={t.icon || 'check'} size={11} strokeWidth={2.4} />
					</div>
					<div>
						<div style={{ fontWeight: 500 }}>{t.title}</div>
						{t.body && (
							<div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
								{t.body}
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	)
}
