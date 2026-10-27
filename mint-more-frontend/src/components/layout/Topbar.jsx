import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useCartStore } from '../../store/cart'
import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'
import { ADMIN_NAV } from './navigation'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function UsageBar({ label, value, max, tone = 'mint' }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0
  return (
    <div className={`mintcoin-usage-row mintcoin-usage-${tone}`}>
      <div className="mintcoin-usage-label-row">
        <span>{label}</span>
        <strong>{value}/{max || 0}</strong>
      </div>
      <div className="mintcoin-meter">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Topbar({
  isMobile,
  onMenuClick,
  walletBalance,
  mintCoinBalance,
  usageSummary,
  onWalletClick,
  onMintCoinClick,
  onNotifClick,
  notifUnread,
  unreadCount,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isGuest } = useAuthStore()
  const role = useAuthStore(s => s.user?.role)
  // Admin top bar names where you are: "Work / Orders". Longest matching route wins.
  const adminHere = role === 'admin'
    ? ADMIN_NAV.filter(item => pathname === item.route || pathname.startsWith(`${item.route}/`)).sort((a, b) => b.route.length - a.route.length)[0]
    : null
  const cartCount = useCartStore(s => s.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0))
  const [mintPopoverOpen, setMintPopoverOpen] = useState(false)
  const isLow = walletBalance !== null && walletBalance !== undefined && walletBalance < 100

  const balance = Number(usageSummary?.mintcoin_balance ?? mintCoinBalance ?? 0)
  const trialRemaining = Number(usageSummary?.trial?.remaining ?? 0)
  const selected = usageSummary?.selected || {}
  const imageLeft = Number(selected.image_generations_left ?? 0)
  const videoLeft = Number(selected.video_generations_left ?? 0)
  const imageUnlimited = Boolean(selected.image_unlimited)
  const videoUnlimited = Boolean(selected.video_unlimited)
  const textFree = selected.text_free !== false
  const usableNow = selected.tool_type === 'video'
    ? (videoUnlimited ? (videoLeft || 1) : videoLeft)
    : selected.tool_type === 'text'
      ? 1
      : (imageUnlimited ? (imageLeft || 1) : (trialRemaining + imageLeft))
  const usableLabel = useMemo(() => {
    if (selected.tool_type === 'video') {
      return videoUnlimited ? '∞ Unlimited' : `${videoLeft} videos`
    }
    if (selected.tool_type === 'text') {
      return 'Text is free'
    }
    return imageUnlimited ? '∞ Unlimited' : `${imageLeft} images`
  }, [selected.tool_type, videoUnlimited, videoLeft, imageUnlimited, imageLeft])

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {isMobile && (
          <button
            className="icon-btn"
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{ flexShrink: 0, padding: 0 }}
          >
            <svg
              width="16" height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
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

        {!isMobile && adminHere && (
          <div className="flex items-center gap-1.5 text-sm">
            {adminHere.group && <><span className="text-ink-400">{adminHere.group}</span><span className="text-ink-300">/</span></>}
            <span className="font-semibold text-ink-900">{adminHere.label}</span>
          </div>
        )}
      </div>

      <div id="topbar-center-slot" className="flex-1 flex items-center justify-between px-4 min-w-0" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {/* {mintCoinBalance !== null && mintCoinBalance !== undefined && (
          <div
            className="mintcoin-chip-wrap"
            onMouseEnter={() => setMintPopoverOpen(true)}
            onMouseLeave={() => setMintPopoverOpen(false)}
          >
            <button
              className="mintcoin-chip"
              onClick={() => {
                setMintPopoverOpen(v => !v)
                onMintCoinClick?.()
              }}
              onFocus={() => setMintPopoverOpen(true)}
              onBlur={() => setMintPopoverOpen(false)}
              title="MintCoin balance"
              aria-label={`MintCoin balance ${balance}`}
            >
              <span className="mintcoin-mark">
                <Icon name="coin" size={13} />
              </span>
              <span className="mintcoin-label">MintCoin</span>
              <span className="mono mintcoin-amount">
                {Number(balance).toLocaleString('en-IN')}
              </span>
            </button>

            {mintPopoverOpen && (
              <div className="mintcoin-popover">
                <div className="mintcoin-popover-head">
                  <strong>MintCoin usage</strong>
                  <span>{usableLabel}</span>
                </div>
                <UsageBar
                  label="Usable now"
                  value={usableNow}
                  max={Math.max(balance, usableNow, 1)}
                />
                <div className="mintcoin-popover-grid">
                  <div>
                    <span>Trial images</span>
                    <strong>{trialRemaining}</strong>
                  </div>
                  <div>
                    <span>Text</span>
                    <strong>{textFree ? 'Free' : 'Paid'}</strong>
                  </div>
                  <div>
                    <span>Image left</span>
                    <strong>{imageUnlimited ? '∞' : imageLeft}</strong>
                  </div>
                  <div>
                    <span>Video left</span>
                    <strong>{videoUnlimited ? '∞' : videoLeft}</strong>
                  </div>
                </div>
                <div className="mintcoin-popover-foot">
                  <span>Usable now</span>
                  <strong>{usableLabel}</strong>
                </div>
              </div>
            )}
          </div>
        )} */}

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

        {isGuest && (
          <button
            className="btn mint guest-topbar-cta"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => navigate('/register')}
          >
            Get started free
          </button>
        )}

        {!isGuest && role === 'client' && (
          <button
            className="icon-btn notif-btn"
            onClick={() => navigate('/cart')}
            aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
          >
            <Icon name="shoppingBag" size={15} />
            {cartCount > 0 && (
              <span key={cartCount} className="notif-badge cart-badge" aria-hidden="true">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        )}

        {!isGuest && (
          <button
            className="icon-btn notif-btn"
            onClick={onNotifClick}
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            {/* Keyed so the ring replays each time new notifications arrive. */}
            <span className="notif-bell">
              <Icon name="bell" size={15} />
            </span>
            {notifUnread && (
              <span key={unreadCount} className="notif-badge" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
