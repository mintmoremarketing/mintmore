import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function ConnectChannelsPage() {
  const {
    connectedAccounts,
    form,
    pushToast,
    queryClient,
    socialApi,
    updateField,
  } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Connect your target channels</h1>
        <p className="muted" style={{ marginTop: 8 }}>Integrate your accounts to publish direct from CREATYV.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { id: 'facebook', name: 'Meta (Facebook & Instagram)', icons: [ { name: 'facebook', color: '#1877F2' }, { name: 'instagram', color: '#E1306C' }, { name: 'meta', color: '#0668E1' } ] },
          { id: 'youtube', name: 'YouTube Channels', icon: 'youtube', color: '#FF0000' },
          { id: 'google_business_profile', name: 'Google Business Profile', icon: 'globe', color: '#4285F4' },
        ].map(plat => {
          const account = connectedAccounts.find(a => a.platform === plat.id)
          const isGbMock = plat.id === 'google_business_profile' && form.connected_platforms.includes(plat.id)
          const connected = Boolean(account || isGbMock)

          return (
            <div
              key={plat.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                border: '1px solid var(--hairline-strong)',
                borderRadius: 14,
                background: 'var(--paper-tint)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {plat.icons ? (
                    plat.icons.map((ic, i) => (
                      <div
                        key={ic.name}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'white',
                          display: 'grid',
                          placeItems: 'center',
                          border: '2px solid var(--paper-tint)',
                          marginLeft: i > 0 ? -12 : 0,
                          zIndex: i,
                        }}
                      >
                        <Icon name={ic.name} size={16} style={{ color: ic.color }} />
                      </div>
                    ))
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', display: 'grid', placeItems: 'center', border: '1px solid var(--hairline)' }}>
                      <Icon name={plat.icon} size={16} style={{ color: plat.color }} />
                    </div>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)', display: 'block' }}>{plat.name}</span>
                  {connected && (
                    <span style={{ fontSize: 11, color: 'var(--mint-600)', fontWeight: 700, display: 'block', marginTop: 2 }}>
                      ✓ Connected {account?.page_name ? `(${account.page_name})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={`btn ${connected ? 'ghost' : 'primary'}`}
                onClick={async () => {
                  if (connected) {
                    if (plat.id === 'google_business_profile') {
                      updateField('connected_platforms', form.connected_platforms.filter(p => p !== plat.id))
                      pushToast({ title: 'Channel disconnected', icon: 'check' })
                    } else if (account) {
                      try {
                        await socialApi.disconnect(account.id)
                        queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
                        pushToast({ title: 'Channel disconnected successfully!', icon: 'check' })
                      } catch (err) {
                        pushToast({ title: 'Disconnect failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
                      }
                    }
                  } else if (plat.id === 'google_business_profile') {
                    updateField('connected_platforms', [...form.connected_platforms, plat.id])
                    pushToast({ title: 'Google Business Profile connected successfully!', icon: 'check' })
                  } else {
                    const accessToken = localStorage.getItem('access_token')
                    if (plat.id === 'facebook') return socialApi.connectFacebook(accessToken)
                    if (plat.id === 'instagram') return socialApi.connectInstagram(accessToken)
                    if (plat.id === 'youtube') return socialApi.connectYouTube(accessToken)
                  }
                }}
              >
                {connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
