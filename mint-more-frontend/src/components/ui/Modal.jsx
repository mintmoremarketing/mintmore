import Icon from './Icon'

export default function Modal({ title, subtitle, children, onClose, footer, maxWidth }) {
	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div
				className="modal"
				style={{ maxWidth: maxWidth || 480 }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-head">
					<div>
						<h2>{title}</h2>
						{subtitle && <div className="subtitle">{subtitle}</div>}
					</div>
					<button className="icon-btn" onClick={onClose} aria-label="Close">
						<Icon name="x" size={14} />
					</button>
				</div>
				<div className="modal-body">{children}</div>
				{footer && <div className="modal-foot">{footer}</div>}
			</div>
		</div>
	)
}
