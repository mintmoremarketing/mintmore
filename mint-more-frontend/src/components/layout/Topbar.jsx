import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'

export default function Topbar({
	walletBalance,
	onWalletClick,
	onNotifClick,
	notifUnread,
	unreadCount,
}) {
	const isLow = walletBalance !== null && walletBalance < 100

	return (
		<header className="topbar">
			<div className="row topbar-actions" style={{ gap: 8 }}>
				{walletBalance !== null && walletBalance !== undefined && (
					<button
						className="wallet-chip"
						onClick={onWalletClick}
						style={{
							borderColor: isLow ? 'rgba(217,119,6,0.4)' : undefined,
							color: isLow ? 'var(--amber)' : undefined,
						}}
					>
						<Icon name="wallet" size={13} />
						<span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
							{rupee(walletBalance)}
						</span>
						{isLow && (
							<span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 500 }}>
								Low
							</span>
						)}
					</button>
				)}

				<button
					className="icon-btn notif-btn"
					onClick={onNotifClick}
					style={{ position: 'relative' }}
				>
					<Icon name="bell" size={15} />
					{notifUnread && (
						<span
							className="pip"
							style={{
								position: 'absolute',
								top: 4,
								right: 4,
								width: unreadCount > 9 ? 16 : 8,
								height: 8,
								borderRadius: 4,
								background: 'var(--mint-500)',
								fontSize: 9,
								fontWeight: 600,
								color: 'white',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								lineHeight: 1,
							}}
						>
							{unreadCount > 9 ? '9+' : ''}
						</span>
					)}
				</button>
			</div>
		</header>
	)
}
