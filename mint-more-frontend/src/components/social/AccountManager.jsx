import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { socialApi } from '../../api/social'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { SkeletonCard } from '../ui/Skeleton'

export const PLATFORM_META = {
  facebook:  { icon: 'facebook',  label: 'Facebook',  color: '#1877F2' },
  instagram: { icon: 'instagram', label: 'Instagram',  color: '#E1306C' },
  youtube:   { icon: 'youtube',   label: 'YouTube',    color: '#FF0000' },
}

export function ConnectPermissionsModal({ platform, onClose, onConfirm }) {
  const isInstagramOnly = platform === 'instagram'
  return (
    <Modal
      title={isInstagramOnly ? 'Connect Instagram' : 'Connect Facebook & Instagram'}
      subtitle="Before we redirect, here's what we're asking Meta for."
      onClose={onClose}
      maxWidth={520}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={onConfirm}>
            Continue <Icon name="arrowRight" />
          </button>
        </div>
      )}
    >
      <div className="stack" style={{ gap: 12, lineHeight: 1.55, color: 'var(--ink-700)' }}>
        <div className="card" style={{ padding: 14, background: 'var(--paper-tint)' }}>
          We'll be able to post to your Facebook Page, read your post analytics, and post to your linked Instagram account when you connect both channels.
        </div>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Why we need it</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Publish posts and reels to the account you choose.</li>
            <li>Read Page and Instagram insights after you've connected them.</li>
            <li>Refresh the connection when Meta tokens expire.</li>
          </ul>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
          You can disconnect at any time from the Accounts tab.
        </div>
      </div>
    </Modal>
  )
}

export function AccountCard({ account, onDisconnect, onRefreshMeta, onOpenInstagramApp }) {
  const meta   = PLATFORM_META[account.platform] || {}
  const isLow  = account.token_status === 'expiring_soon'
  const isExp  = account.token_status === 'expired'
  const stats  = account.stats || {}
  const linkedInstagram = stats.linked_instagram || null
  const statItems = account.platform === 'instagram'
    ? [
      ['Followers', stats.followers_count],
      ['Posts', stats.posts_count],
      ['Following', stats.following_count],
      ['Connection', 'Connected'],
    ]
    : [
      ['Followers', stats.followers_count ?? stats.page_likes_count],
      ['Page likes', stats.page_likes_count],
      ['Posts', stats.posts_count],
      ['Connection', 'Connected'],
    ]

  return (
    <div style={{
      background: 'var(--paper)', border: `1px solid ${isExp ? 'rgba(225,29,72,0.3)' : isLow ? 'rgba(217,119,6,0.3)' : 'var(--hairline)'}`,
      borderRadius: 'var(--radius-lg)', padding: 18,
    }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${meta.color}18`, color: meta.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name={meta.icon} size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {account.page_name || account.platform_name || account.platform_username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
              {meta.label}
            </div>
            {account.platform === 'instagram' && account.platform_username && (
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                @{account.platform_username}
              </div>
            )}
          </div>
        </div>
        <button
          className="btn ghost"
          style={{ fontSize: 12, color: 'var(--rose)' }}
          onClick={() => onDisconnect(account.id)}
        >
          Disconnect
        </button>
      </div>

      <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isExp ? 'var(--rose)' : isLow ? 'var(--amber)' : 'var(--mint-500)',
        }} />
        {isExp ? (
          <span style={{ color: 'var(--rose)', fontWeight: 500 }}>Token expired - reconnect needed</span>
        ) : isLow ? (
          <span style={{ color: 'var(--amber)' }}>
            Expires in {account.token_days_remaining} days
          </span>
        ) : (
          <span style={{ color: 'var(--ink-500)' }}>
            Connected - {account.token_days_remaining ? `${account.token_days_remaining} days remaining` : 'Valid'}
          </span>
        )}
      </div>

      {account.platform === 'facebook' && !linkedInstagram && (
        <div style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 12,
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.18)',
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--ink-700)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Instagram not linked yet</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Open Instagram on your phone and switch to a professional account if needed.</li>
            <li>Go to Settings → Account → Linked accounts → Connect to Facebook.</li>
            <li>Choose <strong>{account.page_name || 'your Facebook Page'}</strong> and then come back here.</li>
          </ol>
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-500)' }}>
            Open Instagram on your phone to complete this step.
          </div>
        </div>
      )}

      {account.platform === 'facebook' && linkedInstagram && (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: 'var(--paper-tint)',
          border: '1px solid var(--hairline)',
          fontSize: 12.5,
          lineHeight: 1.45,
          color: 'var(--ink-600)',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 4 }}>
            Instagram linked
          </div>
          This Page is connected to <strong>@{linkedInstagram.username || linkedInstagram.name || linkedInstagram.id}</strong>.
          You can publish to Instagram once the account appears in the accounts list below.
        </div>
      )}

      {account.platform === 'facebook' && (
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" type="button" onClick={onRefreshMeta}>
            Refresh from Meta
          </button>
          <button className="btn ghost" type="button" onClick={onOpenInstagramApp}>
            Open Instagram app
          </button>
        </div>
      )}

      {account.platform === 'facebook' && stats.insights_available === false && (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.24)',
          color: 'var(--ink-700)',
          fontSize: 12.8,
          lineHeight: 1.45,
        }}>
          Analytics become available once your Page reaches 100 followers. You currently have {Number(stats.followers_count || 0).toLocaleString('en-IN')} followers.
        </div>
      )}

      <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
        {statItems.map(([label, value]) => (
          <div
            key={label}
            style={{
              minWidth: 92,
              padding: '9px 10px',
              borderRadius: 12,
              background: 'var(--paper-tint)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>
              {typeof value === 'number' && Number.isFinite(value)
                ? value.toLocaleString('en-IN')
                : String(value || '?')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AccountManager() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [connectPrompt, setConnectPrompt] = useState(null)

  const { data: accountsData, isLoading: accLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
  })

  const accounts = accountsData?.accounts || []

  const disconnectMutation = useMutation({
    mutationFn: (id) => socialApi.disconnectAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
      pushToast({ title: 'Account disconnected', icon: 'check' })
    },
    onError: (err) => pushToast({ title: 'Could not disconnect', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
  })

  const refreshAccounts = async () => {
    try {
      pushToast({ title: 'Refreshing accounts...', icon: 'refreshCcw' })
      await socialApi.syncAccounts()
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
      pushToast({ title: 'Accounts refreshed', icon: 'check' })
    } catch (err) {
      pushToast({ title: 'Could not refresh', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    }
  }

  const confirmConnect = () => {
    if (!connectPrompt) return
    const platform = connectPrompt
    setConnectPrompt(null)
    const accessToken = localStorage.getItem('access_token')
    if (platform === 'facebook') return socialApi.connectFacebook(accessToken)
    if (platform === 'instagram') return socialApi.connectInstagram(accessToken)
    if (platform === 'youtube') return socialApi.connectYouTube(accessToken)
  }

  const openInstagramApp = () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    if (isMobile) {
      window.location.href = 'instagram://app'
      return
    }
    pushToast({
      title: 'Open Instagram on your phone',
      body: 'Instagram settings need to be completed on a mobile device.',
      icon: 'info',
    })
  }

  return (
    <div className="stack reveal" style={{ gap: 14 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="h-eyebrow" style={{ marginBottom: 14 }}>Add account</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => setConnectPrompt('facebook')}>
            <Icon name="facebook" size={14} style={{ color: '#1877F2' }} />
            Connect Facebook &amp; Instagram
          </button>
          <button className="btn ghost" onClick={() => setConnectPrompt('instagram')}>
            <Icon name="instagram" size={14} style={{ color: '#E1306C' }} />
            Connect Instagram only
          </button>
          <button className="btn ghost" onClick={() => setConnectPrompt('youtube')}>
            <Icon name="youtube" size={14} style={{ color: '#FF0000' }} />
            Connect YouTube
          </button>
          <button className="btn primary" onClick={refreshAccounts}>
            <Icon name="refresh" size={14} />
            Refresh from Meta
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 10 }}>
          You'll be redirected to connect your own Facebook Pages, Instagram Business accounts, or YouTube channel.
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 6 }}>
          Follower and post counts are pulled live from Meta once the account is connected.
          If Instagram is missing, it usually means the Instagram account is not linked to the same Facebook Page yet.
        </div>
      </div>

      {accLoading ? (
        <SkeletonCard />
      ) : accounts.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="layers" size={22} /></div>
          <h3>No accounts connected</h3>
          <p>Connect your Facebook Pages, Instagram Business accounts, or YouTube channel.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {accounts.map(acc => (
            <AccountCard
              key={acc.id}
              account={acc}
              onDisconnect={(id) => disconnectMutation.mutate(id)}
              onRefreshMeta={refreshAccounts}
              onOpenInstagramApp={openInstagramApp}
            />
          ))}
        </div>
      )}

      {connectPrompt && (
        <ConnectPermissionsModal
          platform={connectPrompt}
          onClose={() => setConnectPrompt(null)}
          onConfirm={confirmConnect}
        />
      )}
    </div>
  )
}
