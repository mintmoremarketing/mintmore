import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'

export default function Topbar({ title, walletBalance, onWalletClick, onNotifClick, notifUnread }) {
	return (
		<header className="topbar">
			<div>{title && <h1 className="topbar-title">{title}</h1>}</div>
			<div className="row" style={{ gap: 8 }}>
				{walletBalance !== undefined && (
					<button className="wallet-chip" onClick={onWalletClick}>
						<Icon name="wallet" size={13} />
						<span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
							{rupee(walletBalance)}
						</span>
					</button>
				)}
				<button className="icon-btn notif-btn" onClick={onNotifClick}>
					<Icon name="bell" size={15} />
					{notifUnread && <span className="pip" />}
				</button>
			</div>
		</header>
	)
}
