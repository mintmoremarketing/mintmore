import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'

export default function GuestBanner() {
  const navigate = useNavigate()
  const { isGuest, user } = useAuthStore()

  const showKycWall     = !isGuest && user && !user.is_approved
  const showKycUpgrade  = !isGuest && user?.is_approved && (user?.kyc_level || 0) < 1

  if (isGuest) return (
    <div style={{
      background: 'var(--ink-950)', color: 'white',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
        <Icon name="eye" size={14} style={{ color: 'var(--mint-400)', flexShrink: 0 }} />
        <span>
          You're in <strong>demo mode</strong> - explore the business dashboard before creating an account.
          <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>
            Live tools and real orders require an account.
          </span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn ghost"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={() => navigate('/login')}
        >
          Sign in
        </button>
        <button
          className="btn mint"
          style={{ fontSize: 12 }}
          onClick={() => navigate('/register')}
        >
          Create free account
        </button>
      </div>
    </div>
  )

  if (showKycWall) return (
    <div style={{
      background: 'rgba(217,119,6,0.08)',
      borderBottom: '1px solid rgba(217,119,6,0.2)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--amber)' }}>
        <Icon name="clock" size={13} />
        Your account is under review. You'll be notified once approved (usually within 24h).
      </div>
    </div>
  )

  if (showKycUpgrade) return (
    <div style={{
      background: 'rgba(16,185,129,0.06)',
      borderBottom: '1px solid rgba(16,185,129,0.15)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--mint-700)' }}>
        <Icon name="shield" size={13} />
        Complete KYC to unlock the freelancer marketplace and direct hiring.
      </div>
      <button className="btn mint" style={{ fontSize: 12 }} onClick={() => navigate('/settings')}>
        Complete KYC <Icon name="arrowRight" size={12} />
      </button>
    </div>
  )

  return null
}
