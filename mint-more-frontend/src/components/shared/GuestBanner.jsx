import { useAuthStore } from '../../store/auth'
import Icon from '../ui/Icon'
import { OPEN_KYC_EVENT } from '../freelancer/completionApi'

// Only freelancers need ID verification now: it gates auto-assignment of paid orders.
// LAUNCH-HIDDEN: clients used to see "Complete verification before publishing paid
// briefs" from the agency flow; service checkout does not require it.
const NEEDS_VERIFICATION_ROLES = ['freelancer']

export default function GuestBanner() {
  const user = useAuthStore(s => s.user)
  // Same rule as order matching (users.kyc_status = 'verified'), not kyc_level.
  const needsVerification = user && NEEDS_VERIFICATION_ROLES.includes(user.role) && user.kyc_status !== 'verified'

  if (!needsVerification) return null
  const pending = user.kyc_status === 'pending'

  return (
    <div className="verification-banner" role="status">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <Icon name="shield" size={13} />
        <span>{pending ? 'Your ID is under review. Orders start once it is approved.' : 'Verify your ID to start receiving orders.'}</span>
      </div>
      {!pending && (
        <button type="button" className="verification-banner-link" onClick={() => window.dispatchEvent(new Event(OPEN_KYC_EVENT))}>
          Verify now <Icon name="arrowRight" size={12} />
        </button>
      )}
    </div>
  )
}
