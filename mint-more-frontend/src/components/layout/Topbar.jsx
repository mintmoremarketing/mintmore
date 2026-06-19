import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'

export default function Topbar({
  isMobile,
  onMenuClick,
  walletBalance,
  mintCoinBalance,
  onWalletClick,
  onMintCoinClick,
  onNotifClick,
  notifUnread,
  unreadCount,
}) {
  const navigate   = useNavigate()
  const { isGuest } = useAuthStore()
  const isLow = walletBalance !== null && walletBalance !== undefined && walletBalance < 100

  return (
    <header className="topbar">

      {/* ── Left ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isMobile && (
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'white',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {/* Three-line hamburger — explicit lines, not a path */}
            <svg
              width="16" height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <line x1="2" y1="4"  x2="14" y2="4"  />
              <line x1="2" y1="8"  x2="14" y2="8"  />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>
        )}

        {isMobile && (
          <span
            onClick={() => navigate('/dashboard')}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17, fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink-950)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            CREAT<span style={{ color: 'var(--mint-500)', fontWeight: 650 }}>YV</span>
          </span>
        )}
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>

        {/* MintCoin chip */}
        {mintCoinBalance !== null && mintCoinBalance !== undefined && (
          <button
            className="mintcoin-chip"
            onClick={onMintCoinClick}
            title="MintCoin balance"
            aria-label={`MintCoin balance ${mintCoinBalance}`}
          >
            <span className="mintcoin-mark">
              <Icon name="coin" size={13} />
            </span>
            <span className="mintcoin-label">MintCoin</span>
            <span className="mono mintcoin-amount">
              {Number(mintCoinBalance).toLocaleString('en-IN')}
            </span>
          </button>
        )}

        {/* Wallet chip */}
        {walletBalance !== null && walletBalance !== undefined && (
          <button
            className="wallet-chip"
            onClick={onWalletClick}
            style={{
              borderColor: isLow ? 'rgba(217,119,6,0.4)' : undefined,
              color:       isLow ? 'var(--amber)'        : undefined,
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

        {/* Guest CTA */}
        {isGuest && (
          <button
            className="btn mint guest-topbar-cta"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => navigate('/register')}
          >
            Get started free
          </button>
        )}

        {/* Notification bell */}
        {!isGuest && (
          <button
            className="icon-btn notif-btn"
            onClick={onNotifClick}
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            <Icon name="bell" size={15} />
            {notifUnread && (
              <span style={{
                position: 'absolute',
                top: 3, right: 3,
                minWidth: 8, height: 8,
                borderRadius: 4,
                background: 'var(--mint-500)',
                fontSize: 9, fontWeight: 600,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: unreadCount > 9 ? '0 3px' : 0,
              }}>
                {unreadCount > 9 ? '9+' : ''}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
