import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import VerificationPanel from '../../../components/settings/VerificationPanel'
import { SkeletonCard } from '../../../components/ui/Skeleton'

export default function AccountVerificationPage() {
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile').then(r => r.data.data),
  })

  const { data: kycData, isLoading: isKycLoading } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => api.get('/kyc/status').then(r => r.data.data),
  })

  if (isProfileLoading || isKycLoading) {
    return <SkeletonCard />
  }

  const profile = profileData?.profile || {}
  const kyc = kycData || {}

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Account Verification</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Please complete your business verification. This is required before publishing your first paid brief.
        </p>
      </div>

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #dde1e7' }}>
        <VerificationPanel profile={profile} kyc={kyc} />
      </div>
    </div>
  )
}
