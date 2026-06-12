import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'

export default function GuestBanner() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const needsVerification = user && user.role !== 'admin' && (user.kyc_level || 0) < 1

  if (!needsVerification) return null

  return (
    <div className="verification-banner">
      <div className="row" style={{ gap: 8 }}>
        <Icon name="shield" size={13} />
        Complete verification before publishing paid briefs or accepting paid work.
      </div>
      <button className="btn mint" style={{ fontSize: 12 }} onClick={() => navigate('/settings?section=verification')}>
        Complete verification <Icon name="arrowRight" size={12} />
      </button>
    </div>
  )
}
