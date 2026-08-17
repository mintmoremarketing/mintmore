import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { socialApi } from '../../api/social'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import Modal from '../../components/ui/Modal'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { timeAgo } from '../../utils/format'

const PLATFORM_META = {
  facebook:  { icon: 'facebook',  label: 'Facebook',  color: '#1877F2' },
  instagram: { icon: 'instagram', label: 'Instagram',  color: '#E1306C' },
  youtube:   { icon: 'youtube',   label: 'YouTube',    color: '#FF0000' },
}

const INSTAGRAM_CONTENT_TYPES = ['image', 'video', 'carousel', 'reel']

const inferContentTypeFromMediaItems = (items = []) => {
  const mediaItems = Array.isArray(items) ? items.filter(Boolean) : []
  const mediaTypes = mediaItems.map(item => String(item.media_type || '').toLowerCase())

  if (mediaItems.length > 1 && mediaTypes.every(type => type === 'image')) return 'carousel'
  if (mediaTypes.includes('video')) return 'video'
  if (mediaItems.length === 1) return mediaTypes[0] === 'video' ? 'video' : 'image'
  return 'text'
}

const getMediaPreviewKind = (item) => {
  const type = String(item?.media_type || '').toLowerCase()
  return type.startsWith('video') ? 'video' : 'image'
}

const getMediaPreviewSource = (item) => item?.thumbnail_url || item?.preview_url || item?.media_url || ''

const toLocalDateTimeInput = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const nextAvailableSchedule = (dateString) => {
  const now = new Date()
  if (!dateString) return toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000))
  const dateOnly = new Date(`${dateString}T09:00:00`)
  if (Number.isNaN(dateOnly.getTime())) return toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000))
  if (dateOnly.getTime() <= now.getTime()) return toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000))
  return toLocalDateTimeInput(dateOnly)
}

const MediaTile = ({ item, selected, onClick, compact = false }) => {
  const [previewFailed, setPreviewFailed] = useState(false)
  const kind = getMediaPreviewKind(item)
  const previewUrl = item?.thumbnail_url || item?.preview_url || item?.media_url || ''
  const fileName = item?.original_name || item?.name || 'Media asset'
  const subtitle = [item?.job_title, item?.mime_type || (kind === 'video' ? 'Video' : 'Image')].filter(Boolean).join(' • ')

  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: `1px solid ${selected ? 'var(--mint-500)' : 'var(--hairline)'}`,
        boxShadow: selected ? '0 0 0 1px rgba(34,197,94,0.12)' : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: 'var(--paper)',
      }}
      title={fileName}
    >
      <div style={{
        aspectRatio: compact ? '1 / 1' : '4 / 5',
        background: 'var(--paper-tint)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {!previewFailed && previewUrl ? (
          kind === 'video' ? (
            <video
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              poster={item?.thumbnail_url || undefined}
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <img
              src={previewUrl}
              alt={fileName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setPreviewFailed(true)}
            />
          )
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-400)',
            background: 'linear-gradient(180deg, rgba(248,250,252,0.9), rgba(241,245,249,0.96))',
            padding: 12,
            textAlign: 'center',
          }}>
            <div>
              <Icon name={kind === 'video' ? 'video' : 'image'} />
              <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.35 }}>Preview unavailable</div>
            </div>
          </div>
        )}
        {selected && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--mint-500)',
            display: 'grid',
            placeItems: 'center',
            color: 'white',
            boxShadow: '0 4px 14px rgba(34,197,94,0.28)',
          }}>
            <Icon name="check" size={12} strokeWidth={3} />
          </div>
        )}
        <div style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          padding: '4px 7px',
          borderRadius: 999,
          background: 'rgba(15,23,42,0.76)',
          color: 'white',
          fontSize: 10.5,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <Icon name={kind === 'video' ? 'video' : 'image'} size={10} />
          {kind === 'video' ? 'Video' : 'Image'}
        </div>
      </div>
      <div style={{ padding: compact ? '8px 10px' : '10px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}

const renderFacebookGrid = (items) => {
  const count = items.length
  if (count === 0) return null

  const renderMediaGridItem = (item, style = {}) => {
    const kind = getMediaPreviewKind(item)
    const source = getMediaPreviewSource(item)
    if (!source) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-400)', background: 'var(--paper-tint)', ...style }}>
          <Icon name={kind === 'video' ? 'video' : 'image'} />
        </div>
      )
    }
    return kind === 'video'
      ? <video src={source} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111827', ...style }} />
      : <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  }

  if (count === 1) {
    return (
      <div style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden' }}>
        {renderMediaGridItem(items[0], { width: '100%', height: '100%', display: 'block', objectFit: 'cover' })}
      </div>
    )
  }

  if (count === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, height: 280, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderMediaGridItem(item)}
          </div>
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1.2fr 1fr', gap: 4, height: 280, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ gridColumn: 'span 2', width: '100%', height: '100%', overflow: 'hidden' }}>
          {renderMediaGridItem(items[0])}
        </div>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {renderMediaGridItem(items[1])}
        </div>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {renderMediaGridItem(items[2])}
        </div>
      </div>
    )
  }

  if (count === 4) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 4, height: 280, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        {items.slice(0, 4).map((item, idx) => (
          <div key={idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderMediaGridItem(item)}
          </div>
        ))}
      </div>
    )
  }

  // 5 or more images
  const remaining = count - 5
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: '1.2fr 1fr', gap: 4, height: 280, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ gridColumn: 'span 3', width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[0])}
      </div>
      <div style={{ gridColumn: 'span 3', width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[1])}
      </div>
      <div style={{ gridColumn: 'span 2', width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[2])}
      </div>
      <div style={{ gridColumn: 'span 2', width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[3])}
      </div>
      <div style={{ gridColumn: 'span 2', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {renderMediaGridItem(items[4])}
        {remaining > 0 && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'grid', placeItems: 'center', color: '#fff', fontSize: '20px', fontWeight: 700
          }}>
            +{remaining}
          </div>
        )}
      </div>
    </div>
  )
}

const PostMediaPreview = ({ media = [] }) => {
  const items = Array.isArray(media) ? media.filter(Boolean) : []
  if (!items.length) return null

  const renderMediaGridItem = (item, style = {}) => {
    const kind = getMediaPreviewKind(item)
    const source = getMediaPreviewSource(item)
    if (!source) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-400)', background: 'var(--paper-tint)', ...style }}>
          <Icon name={kind === 'video' ? 'video' : 'image'} />
        </div>
      )
    }
    return kind === 'video'
      ? <video src={source} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111827', ...style }} />
      : <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  }

  const count = items.length

  if (count === 1) {
    return (
      <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden' }}>
        {renderMediaGridItem(items[0])}
      </div>
    )
  }

  if (count === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
        {items.slice(0, 2).map((item, idx) => (
          <div key={idx} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderMediaGridItem(item)}
          </div>
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2px', height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {renderMediaGridItem(items[0])}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gap: '2px', height: '100%' }}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderMediaGridItem(items[1])}
          </div>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {renderMediaGridItem(items[2])}
          </div>
        </div>
      </div>
    )
  }

  // 4 or more images
  const remaining = count - 4
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '2px', height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[0])}
      </div>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[1])}
      </div>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderMediaGridItem(items[2])}
      </div>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {renderMediaGridItem(items[3])}
        {remaining > 0 && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'grid', placeItems: 'center', color: '#fff', fontSize: '14px', fontWeight: 700
          }}>
            +{remaining} more
          </div>
        )}
      </div>
    </div>
  )
}

const normalizePlatforms = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      return normalizePlatforms(parsed)
    } catch {
      return trimmed
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    }
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap(item => normalizePlatforms(item))
  }
  return []
}

function SocialPostPreview({ platform, account, caption, hashtags, contentType, mediaItems = [] }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.facebook
  const name = account?.page_name || account?.platform_name || account?.platform_username || 'Your business'
  const handle = account?.platform_username || name
  const text = [caption, hashtags].filter(Boolean).join('\n')
  const items = Array.isArray(mediaItems) ? mediaItems.filter(Boolean) : []
  const primaryMedia = items[0]
  const primaryMediaUrl = getMediaPreviewSource(primaryMedia)
  const isCarousel = contentType === 'carousel' && items.length > 1

  const renderMediaItem = (item, style = {}) => {
    const kind = getMediaPreviewKind(item)
    const source = getMediaPreviewSource(item)

    if (!source) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-400)', background: 'var(--paper-tint)', ...style }}>
          <Icon name={kind === 'video' ? 'video' : 'image'} />
        </div>
      )
    }

    return kind === 'video'
      ? <video src={source} muted controls poster={item?.thumbnail_url || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111827', ...style }} />
      : <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  }

  const renderMedia = (platformAspect = '1') => {
    if (!items.length) {
      return (
        <div style={{ color: 'var(--ink-400)', textAlign: 'center', padding: 20 }}>
          <Icon name="image" />
          <div style={{ fontSize: 12, marginTop: 6 }}>Media preview</div>
        </div>
      )
    }

    if (isCarousel) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 4,
            background: 'var(--paper-tint)',
          }}
        >
          {items.slice(0, 4).map((item, index) => (
            <div key={`${item.media_url}-${index}`} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderMediaItem(item)}
            </div>
          ))}
        </div>
      )
    }

    return primaryMediaUrl
      ? (contentType === 'video' || contentType === 'reel'
        ? <video src={primaryMediaUrl} muted controls poster={primaryMedia?.thumbnail_url || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : renderMediaItem(primaryMedia, { width: '100%', height: '100%' }))
      : null
  }

  if (platform === 'instagram') {
    return (
      <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', background: 'var(--paper)', maxWidth: 360 }}>
        <div className="row between" style={{ padding: '12px 14px' }}>
          <div className="row" style={{ gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${meta.color}18`, display: 'grid', placeItems: 'center', color: meta.color }}>
              <Icon name={meta.icon} size={16} />
            </div>
            <strong style={{ fontSize: 13 }}>{handle}</strong>
          </div>
          <Icon name="more" size={16} />
        </div>
        <div style={{ aspectRatio: '1', background: 'var(--paper-tint)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {renderMedia('1')}
        </div>
        <div style={{ padding: 14 }}>
          <div className="row" style={{ gap: 13, marginBottom: 9 }}>
            <Icon name="heart" size={18} />
            <Icon name="chat" size={18} />
            <Icon name="send" size={18} />
          </div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
            <strong>{handle}</strong> {text || 'Your caption will appear here.'}
          </div>
        </div>
      </div>
    )
  }

  if (platform === 'youtube') {
    return (
      <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', background: 'var(--paper)', maxWidth: 420 }}>
        <div style={{ aspectRatio: '16 / 9', background: '#111827', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {items.length && (contentType === 'video' || contentType === 'reel')
            ? <video src={primaryMediaUrl} muted controls poster={primaryMedia?.thumbnail_url || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : isCarousel
              ? renderMedia('16 / 9')
              : <Icon name="youtube" size={38} style={{ color: meta.color }} />}
        </div>
        <div style={{ padding: 14 }}>
          <strong style={{ display: 'block', marginBottom: 5 }}>{caption.split('\n')[0] || 'YouTube post preview'}</strong>
          <div className="muted" style={{ fontSize: 12 }}>{name}</div>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{text || 'Description will appear here.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, background: 'var(--paper)', maxWidth: 430, overflow: 'hidden' }}>
      <div style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${meta.color}16`, display: 'grid', placeItems: 'center', color: meta.color }}>
            <Icon name={meta.icon} size={18} />
          </div>
          <div>
            <strong style={{ fontSize: 14 }}>{name}</strong>
            <div className="row" style={{ gap: 5, color: 'var(--ink-500)', fontSize: 12 }}>
              Just now <span>-</span> <Icon name="globe" size={11} />
            </div>
          </div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
          {text || 'Your caption will appear here.'}
        </p>
      </div>
      {items.length > 0 && (
        <div style={{ background: 'var(--paper-tint)', overflow: 'hidden' }}>
          {renderFacebookGrid(items)}
        </div>
      )}
      <div className="row between" style={{ borderTop: '1px solid var(--hairline)', padding: '10px 18px', color: 'var(--ink-500)', fontSize: 13 }}>
        <span><Icon name="thumbsUp" size={14} /> Like</span>
        <span><Icon name="chat" size={14} /> Comment</span>
        <span><Icon name="send" size={14} /> Share</span>
      </div>
    </div>
  )
}

function ConnectPermissionsModal({ platform, onClose, onConfirm }) {
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

function AccountCard({ account, onDisconnect, onRefreshMeta, onOpenInstagramApp }) {
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

function CreatePostModal({ accounts, onClose, onSaved, onPublished, initialPost = null, defaultScheduleDate = '' }) {
  const pushToast   = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const isEditing = Boolean(initialPost?.id)
  
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 960)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 960)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const totalStepsCount = isDesktop ? 2 : 3
  const [step, setStep] = useState(1)
  const [postType, setPostType] = useState(() => {
    if (initialPost?.target_platforms?.includes('youtube')) return 'youtube'
    return 'social'
  })
  const [title, setTitle] = useState(initialPost?.title || '')

  const [caption, setCaption] = useState(initialPost?.caption || '')
  const [hashtags, setHashtags] = useState(Array.isArray(initialPost?.hashtags) ? initialPost.hashtags.join(' ') : '')
  const [selectedAccountIds, setSelectedAccountIds] = useState(() => {
    if (Array.isArray(initialPost?.metadata?.target_accounts)) return initialPost.metadata.target_accounts;
    if (Array.isArray(initialPost?.target_platforms)) {
      return initialPost.target_platforms.map(p => accounts.find(a => a.platform === p)?.id).filter(Boolean);
    }
    return [];
  })

  useEffect(() => {
    setSelectedAccountIds([])
  }, [postType])
  
  const selectedPlatforms = useMemo(() => {
    const s = new Set();
    selectedAccountIds.forEach(id => {
      const acc = accounts.find(a => a.id === id);
      if (acc) s.add(acc.platform);
    });
    return Array.from(s);
  }, [selectedAccountIds, accounts]);

  const [scheduleDatePart, setScheduleDatePart] = useState(() => {
    const init = initialPost?.publish_at
      ? toLocalDateTimeInput(initialPost.publish_at)
      : defaultScheduleDate
        ? nextAvailableSchedule(defaultScheduleDate)
        : ''
    return init ? init.split('T')[0] : ''
  })

  const [scheduleTimePart, setScheduleTimePart] = useState(() => {
    const init = initialPost?.publish_at
      ? toLocalDateTimeInput(initialPost.publish_at)
      : defaultScheduleDate
        ? nextAvailableSchedule(defaultScheduleDate)
        : ''
    return init ? init.split('T')[1] : ''
  })

  const scheduleDate = (scheduleDatePart && scheduleTimePart)
    ? `${scheduleDatePart}T${scheduleTimePart}`
    : ''
  const [mediaFiles, setMediaFiles] = useState([])
  const [mintboxMedia, setMintboxMedia] = useState([])
  const existingMedia = useMemo(() => Array.isArray(initialPost?.media) ? initialPost.media : [], [initialPost])
  const [existingMediaTouched, setExistingMediaTouched] = useState(false)
  const existingMediaUrls = useMemo(() => existingMedia.map(item => item.media_url).filter(Boolean), [existingMedia])
  const hasSelectedMedia = Boolean(mediaFiles.length || mintboxMedia.length || (existingMediaUrls.length && !existingMediaTouched))
  const hasPlainTextOnly = !hasSelectedMedia && caption.trim().length > 0
  const inferredMediaContentType = useMemo(() => {
    if (mediaFiles.length > 1 || mintboxMedia.length > 1) return 'carousel'
    const item = mediaFiles[0] || mintboxMedia[0]
    if (!item) return 'text'
    const type = item.type || item.media_type || ''
    return type.startsWith('video') ? 'video' : 'image'
  }, [mediaFiles, mintboxMedia])

  const [contentType, setContentType] = useState(initialPost?.content_type || 'text')
  const [previewPlatform, setPreviewPlatform] = useState('facebook')
  const effectiveContentType = useMemo(() => {
    if (postType === 'youtube') return 'video'
    if (hasSelectedMedia) return inferredMediaContentType
    return 'text'
  }, [hasSelectedMedia, inferredMediaContentType, postType])

  const needsMedia = effectiveContentType !== 'text'
  const instagramSelected = selectedPlatforms.includes('instagram')
  const instagramContentBlocked = instagramSelected && !INSTAGRAM_CONTENT_TYPES.includes(effectiveContentType)

  const selectedMediaItems = useMemo(() => {
    if (mediaFiles.length) {
      return mediaFiles.map(file => ({
        media_url: URL.createObjectURL(file),
        preview_url: URL.createObjectURL(file),
        media_type: file.type.startsWith('video') ? 'video' : 'image',
        mime_type: file.type,
      }))
    }
    if (mintboxMedia.length) return mintboxMedia.map(item => ({ ...item, preview_url: item.thumbnail_url || item.media_url }))
    if (!existingMediaTouched && existingMedia.length) return existingMedia.map(item => ({ ...item, preview_url: item.thumbnail_url || item.media_url }))
    return []
  }, [mediaFiles, mintboxMedia, existingMedia, existingMediaTouched])

  useEffect(() => () => {
    selectedMediaItems.forEach(item => { if (item.media_url?.startsWith('blob:')) URL.revokeObjectURL(item.media_url) })
  }, [selectedMediaItems])

  const scheduleDateIsPast = Boolean(scheduleDate && new Date(scheduleDate) <= new Date())

  const { data: mediaLibrary = [] } = useQuery({
    queryKey: ['social-media-library'],
    queryFn: () => socialApi.getMediaLibrary().then(r => r.data.data.media || []),
  })

  const filteredMediaLibrary = useMemo(() => {
    if (postType === 'youtube') {
      return mediaLibrary.filter(item => item.media_type === 'video');
    }
    return mediaLibrary;
  }, [mediaLibrary, postType])

  const isYouTubeEligible = useMemo(() => {
    const videoItems = selectedMediaItems.filter(item => item.media_type === 'video' || item.mime_type?.startsWith('video'));
    const imageItems = selectedMediaItems.filter(item => item.media_type === 'image' || item.mime_type?.startsWith('image'));
    return videoItems.length === 1 && imageItems.length === 0;
  }, [selectedMediaItems])

  const connectedPlatforms = useMemo(() => {
    const active = accounts.filter(a => a.is_active)
    if (postType === 'youtube') {
      return active.filter(a => a.platform === 'youtube')
    } else {
      return active.filter(a => a.platform !== 'youtube')
    }
  }, [accounts, postType])

  const toggleAccount = (id) => {
    setSelectedAccountIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const hasUnsavedContent = !isEditing && (caption.trim().length > 0 || mediaFiles.length > 0 || mintboxMedia.length > 0)

  const persistDraft = async ({ publishNow = false } = {}) => {
    if (postType === 'youtube') {
      if (!title.trim()) {
        throw new Error('A video title is required for YouTube uploads.')
      }
      if (!isYouTubeEligible) {
        throw new Error('YouTube requires exactly one video (no images or text-only posts allowed).')
      }
    }

    if (scheduleDate && scheduleDateIsPast) {
      throw new Error('Please choose a future schedule time.')
    }
    const payload = {
      title: postType === 'youtube' ? title.trim() : null,
      caption,
      hashtags: hashtags.split(' ').filter(Boolean),
      content_type: effectiveContentType,
      target_platforms: selectedPlatforms,
      metadata: { target_accounts: selectedAccountIds },
      publish_at: publishNow ? null : (scheduleDate ? new Date(scheduleDate).toISOString() : null),
    }

    if (isEditing) {
      await socialApi.updatePost(initialPost.id, payload)
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      if (publishNow || scheduleDate) {
        await socialApi.publishPost(initialPost.id)
      }
      return initialPost
    }

    const postRes = await socialApi.createPost(payload)
    const post = postRes.data.data.post

    if (mintboxMedia.length) {
      await socialApi.addMedia(post.id, {
        media_items: mintboxMedia.map(item => ({
          media_url: item.media_url,
          media_type: item.media_type,
          mime_type: item.mime_type,
          file_size_bytes: item.size_bytes,
        })),
      })
    } else if (mediaFiles.length) {
      const fd = new FormData()
      mediaFiles.forEach(file => fd.append('media', file))
      fd.append('media_type', mediaFiles[0]?.type.startsWith('video') ? 'video' : 'image')
      await socialApi.addMedia(post.id, fd)
    }

    if (publishNow || scheduleDate) {
      await socialApi.publishPost(post.id)
    }
    return post;
  }

  const saveDraftAndClose = async () => {
    if (!hasUnsavedContent) { onClose(); return }
    try {
      await persistDraft({ publishNow: false })
      await queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      pushToast({ title: 'Saved as draft', icon: 'check' })
    } catch {
      // ignore
    } finally {
      onClose()
    }
  }

  const actionMutation = useMutation({
    mutationFn: persistDraft,
    onSuccess: async () => {
      pushToast({ title: isEditing ? 'Draft saved' : (scheduleDate ? 'Post scheduled!' : 'Post published!'), icon: 'check' })
      await queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      onSaved?.()
      if (!isEditing) onPublished?.()
      onClose()
    },
    onError: err => pushToast({
      title: 'Failed',
      body: err.response?.data?.message || err.message,
      tone: 'amber',
      icon: 'x',
    }),
  })

  const handlePublishNow = () => actionMutation.mutate({ publishNow: true })
  const handleSaveDraft = () => actionMutation.mutate({ publishNow: false })

  const renderFormFields = () => (
    <div className="stack" style={{ gap: 16 }}>
      {/* Segmented control to toggle Post Type */}
      <div style={{ display: 'flex', border: '1px solid var(--hairline-strong)', borderRadius: 10, padding: 3, background: 'var(--paper-tint)', marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setPostType('social')}
          style={{
            flex: 1, padding: '8px 12px', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 650,
            background: postType === 'social' ? 'var(--paper)' : 'transparent',
            color: postType === 'social' ? 'var(--ink-950)' : 'var(--ink-400)',
            boxShadow: postType === 'social' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
            cursor: 'pointer', transition: 'all 0.12s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Icon name="image" size={13} style={{ color: postType === 'social' ? 'var(--mint-600)' : 'inherit' }} />
          Social Post
        </button>
        <button
          type="button"
          onClick={() => setPostType('youtube')}
          style={{
            flex: 1, padding: '8px 12px', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 650,
            background: postType === 'youtube' ? 'var(--paper)' : 'transparent',
            color: postType === 'youtube' ? 'var(--ink-950)' : 'var(--ink-400)',
            boxShadow: postType === 'youtube' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
            cursor: 'pointer', transition: 'all 0.12s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Icon name="play" size={13} style={{ color: postType === 'youtube' ? 'var(--rose-600)' : 'inherit' }} />
          YouTube Video
        </button>
      </div>

      {postType === 'youtube' && (
        <div className="field">
          <label className="field-label">Video Title (Required)</label>
          <input
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter YouTube video title..."
            maxLength={100}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>
            {title.length}/100 characters
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label">{postType === 'youtube' ? 'Description' : 'Caption'}</label>
        <textarea
          className="textarea"
          rows={4}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder={postType === 'youtube' ? 'Write your YouTube video description...' : 'Write your caption...'}
        />
        <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>
          {caption.length} characters
        </div>
      </div>

      {postType === 'social' && (
        <div className="field">
          <label className="field-label">Hashtags</label>
          <input
            className="input"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
            placeholder="#marketing #india #creative"
          />
        </div>
      )}

      <div className="field">
        <label className="field-label">Media</label>
        
        {/* Only show upload area if YouTube eligibility criteria or multi-upload limits are met */}
        {!(postType === 'youtube' && selectedMediaItems.length >= 1) ? (
          <div
            style={{
              height: 90, borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--hairline)', background: 'var(--paper-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ink-400)',
            }}
            onClick={() => document.getElementById('social-media-upload')?.click()}
          >
            {mediaFiles.length ? (
              <span style={{ fontSize: 13, color: 'var(--ink-700)', textAlign: 'center', padding: '0 14px' }}>
                <Icon name="check" size={13} style={{ color: 'var(--mint-600)' }} /> {mediaFiles.length} file{mediaFiles.length > 1 ? 's' : ''} selected
              </span>
            ) : existingMediaUrls.length && !existingMediaTouched ? (
              <span style={{ fontSize: 13, color: 'var(--ink-700)', textAlign: 'center', padding: '0 14px' }}>
                <Icon name="image" size={13} /> Existing media attached to this post
              </span>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Icon name="upload" size={20} />
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {postType === 'youtube' ? 'Upload video file' : 'Upload up to 20 images or videos'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--ink-600)', padding: '10px 14px', background: 'var(--paper-tint)', borderRadius: 10, border: '1px solid var(--hairline)' }}>
            <Icon name="check" size={13} style={{ color: 'var(--mint-600)' }} /> Video file selected. Delete it below to upload a different one.
          </div>
        )}

        <input
          id="social-media-upload"
          type="file"
          accept={postType === 'youtube' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'}
          multiple={postType !== 'youtube'}
          style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files || [])
            if (postType === 'youtube') {
              const videoFiles = files.filter(f => f.type.startsWith('video'))
              if (videoFiles.length > 0) {
                setMediaFiles([videoFiles[0]])
                setMintboxMedia([])
                setExistingMediaTouched(true)
              }
            } else {
              setMediaFiles(prev => {
                const combined = [...prev, ...files]
                return combined.slice(0, 20)
              })
              setMintboxMedia([])
              setExistingMediaTouched(true)
            }
            e.target.value = ''
          }}
        />
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 7 }}>
          {postType === 'youtube' ? 'Select a video file to upload.' : 'Choose files or select from Mintbox library below.'}
        </div>
        
        {selectedMediaItems.length > 0 && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
            {selectedMediaItems.map((item, idx) => (
              <div key={idx} style={{ position: 'relative', height: 80, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                {item.media_type === 'video' ? (
                  <video src={item.preview_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={item.preview_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {item.media_type === 'video' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <Icon name="play" size={24} style={{ color: '#fff' }} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mediaFiles.length > 0) {
                      setMediaFiles(prev => prev.filter((_, i) => i !== idx))
                    } else if (mintboxMedia.length > 0) {
                      setMintboxMedia(prev => prev.filter((_, i) => i !== idx))
                    }
                  }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 0, borderRadius: '50%', color: 'white', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            
            {postType !== 'youtube' && selectedMediaItems.length < 20 && (
              <div 
                style={{ height: 80, borderRadius: 8, border: '2px dashed var(--hairline-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-400)' }}
                onClick={() => document.getElementById('social-media-upload')?.click()}
              >
                <Icon name="plus" size={20} />
              </div>
            )}
          </div>
        )}

        {filteredMediaLibrary.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="field-label" style={{ marginBottom: 7 }}>Or choose from Mintbox</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxHeight: 150, overflowY: 'auto', paddingRight: 2 }}>
              {filteredMediaLibrary.map(item => (
                <MediaTile
                  key={item.id}
                  item={item}
                  compact
                  selected={mintboxMedia.some(existing => existing.id === item.id)}
                  onClick={() => {
                    const isAlreadySelected = mintboxMedia.some(existing => existing.id === item.id)
                    if (postType === 'youtube') {
                      if (isAlreadySelected) {
                        setMintboxMedia([])
                      } else {
                        setMintboxMedia([item])
                        setMediaFiles([])
                        setExistingMediaTouched(true)
                      }
                    } else {
                      const nextSelection = isAlreadySelected
                        ? mintboxMedia.filter(existing => existing.id !== item.id)
                        : [...mintboxMedia, item]
                      setMintboxMedia(nextSelection)
                      setMediaFiles([])
                      setExistingMediaTouched(true)
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {instagramSelected && (
          <div style={{ fontSize: 12, color: instagramContentBlocked ? 'var(--rose)' : 'var(--ink-500)', marginTop: 8 }}>
            Instagram post demands images/videos. Make sure target accounts are chosen correctly.
          </div>
        )}
      </div>

      {/* Scheduling Choice — premium pill selector */}
      <div style={{
        background: 'var(--paper)',
        border: '1.5px solid var(--hairline-strong)',
        borderRadius: '14px',
        padding: '6px',
        marginTop: 4,
        overflow: 'hidden',
      }}>
        {/* Two-pill selector row */}
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Publish Now pill */}
          <button
            type="button"
            onClick={() => { setScheduleDatePart(''); setScheduleTimePart('') }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: !(scheduleDatePart || scheduleTimePart)
                ? 'linear-gradient(135deg, var(--mint-500, #10b981) 0%, var(--mint-600, #059669) 100%)'
                : 'transparent',
              color: !(scheduleDatePart || scheduleTimePart) ? '#fff' : 'var(--ink-500)',
              transition: 'all 200ms ease',
              textAlign: 'left',
              boxShadow: !(scheduleDatePart || scheduleTimePart) ? '0 2px 8px rgba(16,185,129,0.30)' : 'none',
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: !(scheduleDatePart || scheduleTimePart) ? 'rgba(255,255,255,0.2)' : 'var(--ink-100)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="zap" size={14} style={{ color: !(scheduleDatePart || scheduleTimePart) ? '#fff' : 'var(--ink-400)' }} />
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>Publish Now</div>
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: 1 }}>Goes live immediately</div>
            </div>
          </button>

          {/* Schedule pill */}
          <button
            type="button"
            onClick={() => {
              if (!(scheduleDatePart || scheduleTimePart)) {
                const next = nextAvailableSchedule(new Date().toISOString())
                setScheduleDatePart(next.split('T')[0])
                setScheduleTimePart(next.split('T')[1])
              }
            }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: (scheduleDatePart || scheduleTimePart)
                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                : 'transparent',
              color: (scheduleDatePart || scheduleTimePart) ? '#fff' : 'var(--ink-500)',
              transition: 'all 200ms ease',
              textAlign: 'left',
              boxShadow: (scheduleDatePart || scheduleTimePart) ? '0 2px 8px rgba(99,102,241,0.30)' : 'none',
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: (scheduleDatePart || scheduleTimePart) ? 'rgba(255,255,255,0.2)' : 'var(--ink-100)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="clock" size={14} style={{ color: (scheduleDatePart || scheduleTimePart) ? '#fff' : 'var(--ink-400)' }} />
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>Schedule</div>
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: 1 }}>
                {(scheduleDatePart || scheduleTimePart)
                  ? `${scheduleDatePart} · ${scheduleTimePart}`
                  : 'Pick date and time'}
              </div>
            </div>
          </button>
        </div>

        {/* Date + Time inputs — slide in when Schedule selected */}
        {Boolean(scheduleDatePart || scheduleTimePart) && (
          <div style={{
            display: 'flex', gap: 10, padding: '12px 8px 8px',
            borderTop: '1px solid var(--hairline)', marginTop: 6,
          }}>
            <div style={{ flex: 1.2 }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--ink-400)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Date</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="brief-text-input"
                  type="date"
                  value={scheduleDatePart}
                  min={toLocalDateTimeInput(new Date()).split('T')[0]}
                  onChange={e => setScheduleDatePart(e.target.value)}
                  style={{ minHeight: '38px', padding: '8px 12px 8px 34px', fontSize: '13px', borderRadius: 10, width: '100%' }}
                />
                <Icon name="calendar" size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
              </div>
            </div>
            <div style={{ flex: 0.8 }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--ink-400)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Time</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="brief-text-input"
                  type="time"
                  value={scheduleTimePart}
                  onChange={e => setScheduleTimePart(e.target.value)}
                  style={{ minHeight: '38px', padding: '8px 12px 8px 34px', fontSize: '13px', borderRadius: 10, width: '100%' }}
                />
                <Icon name="clock" size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
              </div>
            </div>
          </div>
        )}
      </div>
      {instagramContentBlocked && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 14px',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: '10px', color: 'var(--rose-700)', fontSize: '13px', fontWeight: 550,
          alignItems: 'center', marginTop: 10
        }}>
          <Icon name="xCircle" size={16} style={{ color: 'var(--rose-600)', flexShrink: 0 }} />
          <span>Instagram does not support text-only posts. Please select a photo or video file to proceed.</span>
        </div>
      )}
      </div>
  )

  const renderPreviews = () => {
    // Determine which platforms to show toggle for
    const previewablePlatforms = postType === 'youtube'
      ? ['youtube']
      : (selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook', 'instagram']).filter(p => ['facebook', 'instagram'].includes(p))
    const showToggle = previewablePlatforms.length > 1 && postType !== 'youtube'
    // Ensure the active previewPlatform is valid
    const activePlatform = (previewablePlatforms.includes(previewPlatform) ? previewPlatform : previewablePlatforms[0]) || 'facebook'

    const PLATFORM_TOGGLE_META = {
      facebook:  { label: 'Facebook',  icon: 'facebook',  color: '#1877f2' },
      instagram: { label: 'Instagram', icon: 'instagram', color: '#e1306c' },
    }

    return (
      <div className="stack" style={{ gap: 12 }}>
        {/* Header row: label + toggle pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ink-400)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Live Feed Preview
          </div>
          {showToggle && (
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#f1f5f9', borderRadius: 999,
              padding: '3px', gap: 2,
            }}>
              {previewablePlatforms.map(p => {
                const meta = PLATFORM_TOGGLE_META[p]
                const isActive = activePlatform === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreviewPlatform(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 999,
                      fontSize: '12px', fontWeight: isActive ? 600 : 400,
                      background: isActive ? '#fff' : 'transparent',
                      color: isActive ? meta.color : '#64748b',
                      border: 'none', cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Preview pane */}
        {postType === 'youtube' ? (
          <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--hairline-strong)', background: 'var(--paper)' }}>
            <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedMediaItems.length > 0 ? (
                <video src={selectedMediaItems[0].preview_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
                  <Icon name="play" size={40} style={{ color: '#ff0000', marginBottom: 8 }} />
                  <div>YouTube Video Mock Preview</div>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.2)' }}>
                <div style={{ width: '0%', height: '100%', background: '#ff0000' }} />
              </div>
            </div>
            <div style={{ padding: 14, textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--ink-950)' }}>
                {title || 'Video Title'}
              </h4>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', display: 'flex', gap: 6, marginBottom: 10 }}>
                <span>0 views</span><span>·</span><span>Just now</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mint-50)', border: '1px solid var(--mint-100)', display: 'grid', placeItems: 'center', color: 'var(--mint-600)', fontWeight: 700, fontSize: 13 }}>
                  {selectedAccountIds.length > 0 ? (accounts.find(a => a.id === selectedAccountIds[0])?.page_name || 'Y').charAt(0).toUpperCase() : 'Y'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink-950)' }}>
                    {selectedAccountIds.length > 0 ? (accounts.find(a => a.id === selectedAccountIds[0])?.page_name || 'YouTube Channel') : 'YouTube Channel'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>1.2K subscribers</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <SocialPostPreview
            key={activePlatform}
            platform={activePlatform}
            account={accounts.find(a => a.platform === activePlatform)}
            caption={caption}
            hashtags={hashtags}
            contentType={effectiveContentType}
            mediaItems={selectedMediaItems}
          />
        )}
      </div>
    )
  }

  const renderAccountSelection = () => (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ padding: 16, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline-strong)', marginBottom: 4 }}>
        <div className="h-eyebrow" style={{ marginBottom: 8 }}>Post summary</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-700)', marginBottom: 10 }}>
          {caption.slice(0, 120)}{caption.length > 120 ? '...' : ''}
        </div>
        {selectedAccountIds.length > 0 ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {selectedAccountIds.map(id => {
              const acc = connectedPlatforms.find(a => a.id === id)
              const meta = PLATFORM_META[acc?.platform] || {}
              return (
                <span key={id} className="badge neutral" style={{ fontSize: 12 }}>
                  <Icon name={meta.icon} size={11} style={{ color: meta.color }} />
                  &nbsp;{acc?.page_name || meta.label}
                </span>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--amber-700)', fontWeight: 550 }}>
            No channels selected yet. Choose one below.
          </div>
        )}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--ink-950)', marginBottom: 4 }}>
        Select accounts to publish to
      </div>
      {connectedPlatforms.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13, border: '1.5px dashed var(--hairline-strong)', borderRadius: '12px' }}>
          No connected accounts. Go to the Accounts tab to connect.
        </div>
      ) : (
        connectedPlatforms.map(acc => {
          const meta = PLATFORM_META[acc.platform] || {}
          const selected = selectedAccountIds.includes(acc.id)
          return (
            <div
              key={acc.id}
              onClick={() => toggleAccount(acc.id)}
              style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '12px 14px',
                background: selected ? 'rgba(247,127,0,0.06)' : 'var(--paper-tint)',
                border: `1.5px solid ${selected ? 'rgba(247,127,0,0.4)' : 'var(--hairline)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              <Icon name={meta.icon} size={16} style={{ color: meta.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {acc.page_name || acc.platform_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                  {meta.label}
                </div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2px solid ${selected ? 'var(--mint-500)' : 'var(--hairline-strong)'}`,
                background: selected ? 'var(--mint-500)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <Icon name="check" size={11} strokeWidth={3} style={{ color: 'white' }} />}
              </div>
            </div>
          )
        })
      )}
      {instagramContentBlocked && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 14px',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: '10px', color: 'var(--rose-700)', fontSize: '13px', fontWeight: 550,
          alignItems: 'center', marginTop: 10
        }}>
          <Icon name="xCircle" size={16} style={{ color: 'var(--rose-600)', flexShrink: 0 }} />
          <span>Instagram does not support text-only posts. Please select a photo or video file to proceed.</span>
        </div>
      )}
    </div>
  )

  const modalMaxWidth = isDesktop && step === 1 ? 1080 : 640

  return (
    <Modal
      title={isEditing ? 'Edit post' : 'Create post'}
      subtitle={isEditing ? `Edit draft — Step ${step} of ${totalStepsCount}` : `Step ${step} of ${totalStepsCount}`}
      onClose={saveDraftAndClose}
      maxWidth={modalMaxWidth}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {step > 1 && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>Back</button>}
          <button className="btn ghost" onClick={saveDraftAndClose}>
            {hasUnsavedContent ? 'Save draft' : 'Cancel'}
          </button>
          {isEditing ? (
            <>
              <button className="btn ghost" onClick={handleSaveDraft} disabled={actionMutation.isPending}>Save draft</button>
              {step < totalStepsCount ? (
                <button className="btn primary" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !caption.trim()}>
                  Continue <Icon name="arrowRight" />
                </button>
              ) : (
                <button className="btn primary" onClick={handlePublishNow} disabled={actionMutation.isPending || selectedAccountIds.length === 0 || (needsMedia && !hasSelectedMedia) || instagramContentBlocked}>
                  {actionMutation.isPending ? 'Publishing...' : 'Publish now'}
                </button>
              )}
            </>
          ) : step < totalStepsCount ? (
            <button className="btn primary" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !caption.trim()}>
              Continue <Icon name="arrowRight" />
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => actionMutation.mutate({ publishNow: !scheduleDate })}
              disabled={actionMutation.isPending || selectedAccountIds.length === 0 || (needsMedia && !hasSelectedMedia) || instagramContentBlocked || scheduleDateIsPast}
            >
              {actionMutation.isPending ? 'Publishing...' : scheduleDate ? 'Schedule post' : 'Publish now'}
            </button>
          )}
        </div>
      )}
    >
      {step === 1 && (
        isDesktop ? (
          <div className="composer-split-layout">
            <div className="composer-form-col">
              {renderFormFields()}
            </div>
            <div className="composer-preview-col">
              {renderPreviews()}
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {renderFormFields()}
          </div>
        )
      )}

      {step === 2 && isDesktop && (
        <div className="stack" style={{ gap: 12 }}>
          {renderAccountSelection()}
        </div>
      )}

      {step === 2 && !isDesktop && (
        <div className="stack" style={{ gap: 16 }}>
          {renderPreviews()}
        </div>
      )}

      {step === 3 && !isDesktop && (
        <div className="stack" style={{ gap: 12 }}>
          {renderAccountSelection()}
        </div>
      )}
    </Modal>
  )
}

export default function Social() {
  const { accessToken } = useAuthStore()
  const queryClient     = useQueryClient()
  const pushToast       = useUIStore(s => s.pushToast)
  const location        = useLocation()
  const [searchParams]  = useSearchParams()
  const composeHandledRef = useRef(false)
  const [tab, setTab] = useState(() => location.pathname.includes('/posts') ? 'posts' : 'analytics')

  useEffect(() => {
    if (location.pathname.includes('/posts')) setTab('posts')
    else if (location.pathname.includes('/insights')) setTab('analytics')
  }, [location.pathname])
  const [showCreate, setShowCreate] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [connectPrompt, setConnectPrompt] = useState(null)
  const [postFilter, setPostFilter] = useState('all')
  const [loadingDraftId, setLoadingDraftId] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const composeRequested = searchParams.get('compose') === '1'
  const composePublishDate = searchParams.get('publish_at') || ''

  useEffect(() => {
    const handleCloseMenu = () => setActiveMenuId(null)
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  const { data: accountsData, isLoading: accLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn:  () => socialApi.getAccounts().then(r => r.data.data),
  })
  const accounts = accountsData?.accounts || []
  const connectedAccounts = accounts.filter(account => account.is_active)

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', postFilter],
    queryFn:  () => socialApi.listPosts(postFilter !== 'all' ? { status: postFilter } : {}).then(r => r.data.data),
    enabled:  tab === 'posts',
  })

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['social-analytics-summary'],
    queryFn: () => socialApi.getAnalyticsSummary().then(r => r.data.data),
    enabled: tab === 'analytics',
  })

  const disconnectMutation = useMutation({
    mutationFn: (id) => socialApi.disconnect(id),
    onSuccess: () => {
      pushToast({ title: 'Account disconnected', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
    },
  })

  const deletePostMutation = useMutation({
    mutationFn: (id) => socialApi.deletePost(id),
    onSuccess: () => {
      pushToast({ title: 'Post deleted', icon: 'trash' })
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      queryClient.invalidateQueries({ queryKey: ['social-analytics-summary'] })
    },
    onError: (err) => {
      pushToast({
        title: 'Delete failed',
        body: err.response?.data?.message || err.message,
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  const posts = (postsData?.posts || []).filter(p => !p.metadata?.is_topic)
  const summary = analyticsData?.summary
  const accountTotals = useMemo(() => connectedAccounts.reduce((totals, account) => {
    const stats = account.stats || {}
    totals.followers += Number(stats.followers_count || 0)
    totals.posts += Number(stats.posts_count || 0)
    totals.likes += Number(stats.page_likes_count || 0)
    return totals
  }, { followers: 0, posts: 0, likes: 0 }), [connectedAccounts])

  const facebookThresholdAccount = connectedAccounts.find(account => account.platform === 'facebook' && account.stats?.insights_available === false)

  useEffect(() => {
    if (!composeRequested || composeHandledRef.current) return
    if (tab !== 'posts' || !connectedAccounts.length) return
    setEditingPost(null)
    setShowCreate(true)
    composeHandledRef.current = true
  }, [composeRequested, connectedAccounts.length, tab])

  const refreshAccounts = async () => {
    try {
      pushToast({ title: 'Refreshing connections from Meta', icon: 'refresh' })
      await socialApi.refreshFromMeta()
      await queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
    } catch (err) {
      pushToast({
        title: 'Refresh failed',
        body: err.response?.data?.message || err.message,
        tone: 'amber',
        icon: 'x',
      })
    }
  }

  const confirmConnect = () => {
    if (!connectPrompt) return
    const platform = connectPrompt
    setConnectPrompt(null)
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

  const openDraftEditor = async (postId) => {
    try {
      setLoadingDraftId(postId)
      const res = await socialApi.getPost(postId)
      setEditingPost(res.data.data.post)
      setShowCreate(false)
    } catch (err) {
      pushToast({
        title: 'Could not open draft',
        body: err.response?.data?.message || err.message,
        tone: 'amber',
        icon: 'x',
      })
    } finally {
      setLoadingDraftId(null)
    }
  }

  const closeComposer = () => {
    setShowCreate(false)
    setEditingPost(null)
  }

  // ── STATUS CONFIG (Task 4) ──────────────────────────────────────────────
  const STATUS_CONFIG = {
    published: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981', label: 'Published' },
    draft:     { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', dot: '#94a3b8', label: 'Draft'      },
    scheduled: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', dot: '#3b82f6', label: 'Scheduled'  },
    failed:    { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444', label: 'Failed'      },
  }

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999, fontSize: '11px', fontWeight: 600,
        background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-mint-500 mb-2">Social media</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900 tracking-tight m-0 pb-1">
            {tab === 'posts' ? 'Publishing' : 'Insights'}
          </h1>
          <p className="text-ink-500 text-sm md:text-base mt-2">
            {tab === 'posts' 
              ? 'Plan and schedule posts for every connected channel from one place.' 
              : 'Track reach, engagement, and audience growth across your connected channels.'}
          </p>
        </div>
        {connectedAccounts.length > 0 && tab === 'posts' && (
          <button
            onClick={() => { setEditingPost(null); setShowCreate(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, var(--mint-500, #10b981) 0%, var(--mint-600, #059669) 100%)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: 650, letterSpacing: '-0.01em',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
              transition: 'all 150ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.50)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,185,129,0.35)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: 'rgba(255,255,255,0.25)', borderRadius: 6, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>+</span>
            Create post
          </button>
        )}
      </div>



      {tab === 'analytics' && (
        analyticsLoading ? <SkeletonCard /> : (
          <div className="stack" style={{ gap: 14 }}>
            {facebookThresholdAccount && (
              <div className="card" style={{ padding: 16, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>Analytics status</div>
                <div style={{ lineHeight: 1.55, color: 'var(--ink-700)' }}>
                  Analytics become available once your Page reaches 100 followers. You currently have {Number(facebookThresholdAccount.stats?.followers_count || 0).toLocaleString('en-IN')} followers.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 8 }}>
                  We still show your Page likes, post count, and connection status below.
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Published posts', summary?.posts || 0],
                ['Views', Number(summary?.views || 0).toLocaleString('en-IN')],
                ['Reach', Number(summary?.reach || 0).toLocaleString('en-IN')],
                ['Engagement rate', `${summary?.engagement_rate_percent || 0}%`],
              ].map(([label, value]) => (
                <div key={label} className="card" style={{ padding: 18 }}>
                  <div className="h-eyebrow">{label}</div>
                  <div className="mono" style={{ fontSize: 25, fontWeight: 600, marginTop: 8 }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="card" style={{ padding: 20 }}>
                <div className="h-eyebrow">Connected channels</div>
                <div style={{ fontSize: 28, fontWeight: 650, marginTop: 8 }}>{connectedAccounts.length}</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {connectedAccounts.length
                    ? connectedAccounts.map(account => {
                      const meta = PLATFORM_META[account.platform] || {}
                      return <span key={account.id} className="badge neutral"><Icon name={meta.icon} size={11} style={{ color: meta.color }} /> {account.page_name || account.platform_name || meta.label}</span>
                    })
                    : <span className="muted">Connect Facebook, Instagram, or YouTube to start insights.</span>}
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div className="h-eyebrow">Account stats</div>
                <div style={{ fontSize: 28, fontWeight: 650, marginTop: 8 }}>
                  {accountTotals.followers.toLocaleString('en-IN')}
                </div>
                <p className="muted" style={{ margin: '6px 0 0' }}>Total followers across connected Facebook and Instagram accounts.</p>
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  <span className="badge neutral">Posts: {accountTotals.posts.toLocaleString('en-IN')}</span>
                  <span className="badge neutral">Page likes: {accountTotals.likes.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div className="h-eyebrow">Posting queue</div>
                <div style={{ fontSize: 28, fontWeight: 650, marginTop: 8 }}>{summary?.posts || 0}</div>
                <p className="muted" style={{ margin: '6px 0 0' }}>published posts counted for this period.</p>
                <button className="btn primary" style={{ marginTop: 12 }} disabled={!connectedAccounts.length} onClick={() => { setEditingPost(null); setShowCreate(true); }}>
                  <Icon name="plus" /> Create post
                </button>
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="h-eyebrow">What this means</div>
              <p style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{summary?.insight}</p>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                Based on the last {summary?.period_days || 30} days. Engagement benchmark: {summary?.benchmark_engagement_rate_percent || 0}%.
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'posts' && (
        <div className="stack" style={{ gap: 0 }}>
          {/* Task 5: polished tab bar with active underline + count badges */}
          {(() => {
            const allStatusCounts = {
              all: posts.length,
              draft: posts.filter(p => p.status === 'draft').length,
              scheduled: posts.filter(p => p.status === 'scheduled').length,
              published: posts.filter(p => p.status === 'published').length,
              failed: posts.filter(p => p.status === 'failed').length,
            }
            const tabDefs = [
              { key: 'all', label: 'All' },
              { key: 'draft', label: 'Drafts' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'published', label: 'Published' },
              { key: 'failed', label: 'Failed' },
            ]
            return (
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
                {tabDefs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setPostFilter(t.key)}
                    style={{
                      padding: '9px 16px', fontSize: '14px', cursor: 'pointer',
                      fontWeight: postFilter === t.key ? 600 : 400,
                      color: postFilter === t.key ? '#0f172a' : '#64748b',
                      borderBottom: postFilter === t.key ? '2px solid #10b981' : '2px solid transparent',
                      background: 'none', border: 'none', borderRadius: 0,
                      transition: 'all 150ms ease',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {t.label}
                    {allStatusCounts[t.key] > 0 && (
                      <span style={{
                        background: postFilter === t.key ? '#dcfce7' : '#f1f5f9',
                        color: postFilter === t.key ? '#166534' : '#64748b',
                        fontSize: '11px', fontWeight: 600,
                        padding: '1px 6px', borderRadius: 10,
                      }}>{allStatusCounts[t.key]}</span>
                    )}
                  </button>
                ))}
              </div>
            )
          })()}

          {postsLoading ? (
            <div className="stack" style={{ gap: 10 }}>
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : posts.length === 0 ? (
            <div className="empty">
              <div className="empty-glyph"><Icon name="layers" size={22} /></div>
              <h3>No {postFilter !== 'all' ? postFilter : ''} posts</h3>
              <p>Create and schedule posts to your connected accounts.</p>
              <button className="btn primary" onClick={() => { setEditingPost(null); setShowCreate(true); }}>
                <Icon name="plus" /> Create post
              </button>
            </div>
          ) : (
            <div className="social-feed-grid">
              {posts.map(post => {
                const isEditable = ['draft', 'scheduled', 'failed'].includes(post.status)
                const isDraft     = post.status === 'draft'
                const isScheduled = post.status === 'scheduled'
                const isPublished = post.status === 'published'
                const isFailed    = post.status === 'failed'
                const imported    = post.metadata?.source === 'historical_import' || post.platform_statuses?.some(s => s.source === 'historical_import')
                const mediaItems  = Array.isArray(post.media) ? post.media.filter(Boolean) : []
                const platforms   = normalizePlatforms(post.target_platforms)
                const hasMedia    = mediaItems.length > 0
                const isInstagramTextOnly = platforms.includes('instagram') && !hasMedia

                const targetAccountNames = (post.metadata?.target_accounts || [])
                  .map(id => accounts.find(a => a.id === id)?.page_name)
                  .filter(Boolean)
                  .join(', ') || platforms.map(p => PLATFORM_META[p]?.label).join(', ')

                const timestamp = post.publish_at
                  ? `Scheduled for ${new Date(post.publish_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : post.published_at
                  ? `Published ${timeAgo(post.published_at)}`
                  : post.status === 'draft' ? 'Unsaved draft'
                  : post.status === 'failed' ? 'Failed to publish'
                  : ''

                return (() => {
                    // Generate a deterministic avatar color from the page name
                    const avatarColors = ['#1877F2','#E1306C','#FF6B35','#7C3AED','#059669','#DC2626','#D97706']
                    const colorIdx = (targetAccountNames || 'A').charCodeAt(0) % avatarColors.length
                    const avatarColor = avatarColors[colorIdx]
                    const initials = (targetAccountNames || 'P').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

                    // Find the primary account object for this post
                    const primaryAccountId = post.metadata?.target_accounts?.[0]
                    const primaryAccount = accounts.find(a => a.id === primaryAccountId)
                    const avatarUrl = primaryAccount?.picture_url || primaryAccount?.profile_image_url || null

                    // Human readable timestamp
                    const friendlyTime = post.publish_at
                      ? new Date(post.publish_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' + new Date(post.publish_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : post.published_at
                      ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' at ' + new Date(post.published_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : post.status === 'draft' ? 'Draft' : post.status === 'failed' ? 'Failed' : 'Pending'

                    const primaryPlatform = platforms[0] || 'facebook'
                    const platMeta = PLATFORM_META[primaryPlatform] || PLATFORM_META.facebook

                    return (
                      <div
                        key={post.id}
                        style={{
                          background: '#fff',
                          border: '1px solid #dde1e7',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: isEditable ? 'pointer' : 'default',
                          transition: 'box-shadow 150ms ease',
                        }}
                        onClick={() => isEditable && openDraftEditor(post.id)}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
                        role={isEditable ? 'button' : undefined}
                        tabIndex={isEditable ? 0 : -1}
                      >
                        {/* ── Top toolbar: status badge + action buttons ── */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f7f8fa', borderBottom: '1px solid #e4e6ea' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Platform icon */}
                            <span style={{ width: 20, height: 20, borderRadius: 4, background: platMeta.color + '15', display: 'grid', placeItems: 'center' }}>
                              <Icon name={platMeta.icon} size={12} style={{ color: platMeta.color }} />
                            </span>
                            {platforms.length > 1 && platforms.slice(1).map(p => (
                              <Icon key={p} name={PLATFORM_META[p]?.icon || 'globe'} size={12} style={{ color: PLATFORM_META[p]?.color }} />
                            ))}
                            <StatusBadge status={post.status} />
                            {imported && <span style={{ fontSize: '10px', color: '#94a3b8', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 999 }}>Imported</span>}
                            {post.metadata?.impersonated_by && (
                              <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 999, fontWeight: 600, border: '1px solid #fcd34d' }}>
                                Auto published by Mintmore
                              </span>
                            )}
                            {isInstagramTextOnly && (
                              <span title="Instagram requires media — this post may fail." style={{ fontSize: 13, cursor: 'help' }}>⚠️</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {isDraft && (
                              <button type="button" onClick={() => openDraftEditor(post.id)}
                                style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', cursor: 'pointer' }}>
                                Publish
                              </button>
                            )}
                            {isScheduled && (
                              <button type="button" onClick={() => openDraftEditor(post.id)}
                                style={{ fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', cursor: 'pointer' }}>
                                Reschedule
                              </button>
                            )}
                            {isPublished && post.metadata?.post_url && (
                              <a href={post.metadata.post_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: 6, background: 'none', border: '1px solid #e2e8f0', color: '#475569', textDecoration: 'none', display: 'inline-flex', gap: 3 }}>
                                View ↗
                              </a>
                            )}
                            {isFailed && (
                              <button type="button" onClick={() => openDraftEditor(post.id)}
                                style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', cursor: 'pointer' }}>
                                Retry
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── Facebook post body ── */}
                        <div style={{ padding: '12px 14px 0' }}>
                          {/* Header: avatar + name + time + ··· */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                              {/* Profile picture / avatar */}
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={initials}
                                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid #e4e6ea' }} />
                              ) : (
                                <div style={{
                                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                  background: `linear-gradient(135deg, ${avatarColor}cc, ${avatarColor})`,
                                  display: 'grid', placeItems: 'center',
                                  color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em',
                                }}>
                                  {initials}
                                </div>
                              )}
                              <div style={{ lineHeight: 1.25 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#050505' }}>
                                    {targetAccountNames || 'Your Page'}
                                  </span>
                                  {/* Verified checkmark */}
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill={platMeta.color}>
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="1.5" fill="none"/>
                                    <circle cx="12" cy="12" r="12" fill={platMeta.color}/>
                                    <path d="M8.5 12.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                  </svg>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                  <span style={{ fontSize: '12px', color: '#65676b' }}>{friendlyTime}</span>
                                  <span style={{ color: '#bcc0c4', fontSize: 10 }}>·</span>
                                  {/* Globe icon SVG */}
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                  </svg>
                                </div>
                              </div>
                            </div>
                            {/* Three dots dropdown */}
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setActiveMenuId(curr => curr === post.id ? null : post.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#65676b', fontSize: 20, lineHeight: 1, padding: '2px 6px',
                                  borderRadius: 4, userSelect: 'none', display: 'flex', alignItems: 'center'
                                }}
                              >
                                ···
                              </button>
                              
                              {activeMenuId === post.id && (
                                <div
                                  style={{
                                    position: 'absolute', right: 0, top: 24,
                                    background: '#ffffff', border: '1px solid #dde1e7',
                                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 50, minWidth: 110, overflow: 'hidden'
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null)
                                      if (window.confirm('Delete this post?')) {
                                        deletePostMutation.mutate(post.id)
                                      }
                                    }}
                                    style={{
                                      width: '100%', padding: '10px 12px', border: 'none',
                                      background: 'none', textAlign: 'left', cursor: 'pointer',
                                      fontSize: 13, color: '#ef4444', display: 'flex',
                                      alignItems: 'center', gap: 8, transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <Icon name="trash" size={13} style={{ color: '#ef4444' }} />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Caption */}
                          {post.caption && (
                            <p style={{ margin: '10px 0 12px', fontSize: '14px', lineHeight: 1.5, color: '#050505', whiteSpace: 'pre-wrap' }}>
                              {post.caption}
                            </p>
                          )}
                          {isFailed && isInstagramTextOnly && (
                            <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
                              Failed: Instagram requires media
                            </p>
                          )}
                        </div>

                        {/* Media zone */}
                        {hasMedia ? (
                          <div style={{ width: '100%', lineHeight: 0 }}>
                            <PostMediaPreview media={mediaItems} />
                          </div>
                        ) : null}


                        {/* ── Facebook engagement footer ── */}
                        <div style={{ borderTop: '1px solid #e4e6ea', margin: '0 14px', padding: '4px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                            {[
                              { label: 'Like', icon: 'M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5' },
                              { label: 'Comment', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                              { label: 'Share', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
                            ].map(({ label, icon }) => (
                              <button key={label} type="button" onClick={e => e.stopPropagation()}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 4px', background: 'none', border: 'none', cursor: 'default', borderRadius: 6, color: '#65676b', fontSize: '13px', fontWeight: 600 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d={icon}/>
                                </svg>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })()
              })}
            </div>
          )}
        </div>
      )}

      {(showCreate || editingPost) && (
        <CreatePostModal
          accounts={accounts}
          initialPost={editingPost}
          defaultScheduleDate={composePublishDate}
          onClose={closeComposer}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['social-posts'] })}
          onPublished={() => queryClient.invalidateQueries({ queryKey: ['social-posts'] })}
        />
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
