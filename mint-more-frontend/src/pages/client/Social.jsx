import { useEffect, useMemo, useState } from 'react'
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

const INSTAGRAM_CONTENT_TYPES = ['image', 'carousel', 'reel']

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

function SocialPostPreview({ platform, account, caption, hashtags, contentType, mediaUrls = [] }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.facebook
  const name = account?.page_name || account?.platform_name || account?.platform_username || 'Your business'
  const handle = account?.platform_username || name
  const text = [caption, hashtags].filter(Boolean).join('\n')
  const primaryMedia = mediaUrls[0]
  const isCarousel = contentType === 'carousel' && mediaUrls.length > 1

  const renderMedia = (platformAspect = '1') => {
    if (!mediaUrls.length) {
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
          {mediaUrls.slice(0, 4).map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ))}
        </div>
      )
    }

    return primaryMedia
      ? (contentType === 'video' || contentType === 'reel'
        ? <video src={primaryMedia} muted controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <img src={primaryMedia} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
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
          {mediaUrls.length && (contentType === 'video' || contentType === 'reel')
            ? <video src={primaryMedia} muted controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
      {mediaUrls.length > 0 && (
        <div style={{ maxHeight: 360, background: 'var(--paper-tint)', overflow: 'hidden' }}>
          {isCarousel
            ? renderMedia('16 / 9')
            : (contentType === 'video' || contentType === 'reel'
              ? <video src={primaryMedia} muted controls style={{ width: '100%', display: 'block' }} />
              : <img src={primaryMedia} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />)}
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

function CreatePostModal({ accounts, onClose, onSaved, onPublished, initialPost = null }) {
  const pushToast   = useUIStore(s => s.pushToast)
  const queryClient = useQueryClient()
  const isEditing = Boolean(initialPost?.id)
  const [step, setStep] = useState(1)
  const [caption, setCaption] = useState(initialPost?.caption || '')
  const [hashtags, setHashtags] = useState(Array.isArray(initialPost?.hashtags) ? initialPost.hashtags.join(' ') : '')
  const [contentType, setContentType] = useState(initialPost?.content_type || 'text')
  const [selectedPlatforms, setSelectedPlatforms] = useState(normalizePlatforms(initialPost?.target_platforms))
  const [scheduleDate, setScheduleDate] = useState(initialPost?.publish_at ? new Date(initialPost.publish_at).toISOString().slice(0, 16) : '')
  const [mediaFiles, setMediaFiles] = useState([])
  const [mintboxMedia, setMintboxMedia] = useState([])
  const existingMedia = useMemo(() => Array.isArray(initialPost?.media) ? initialPost.media : [], [initialPost])
  const existingMediaUrls = useMemo(() => existingMedia.map(item => item.media_url).filter(Boolean), [existingMedia])
  const [existingMediaTouched, setExistingMediaTouched] = useState(false)
  const needsMedia = contentType !== 'text'
  const hasMedia = Boolean(mediaFiles.length || mintboxMedia.length || existingMediaUrls.length)
  const instagramSelected = selectedPlatforms.includes('instagram')
  const instagramContentBlocked = instagramSelected && !INSTAGRAM_CONTENT_TYPES.includes(contentType)

  const mediaPreviewUrls = useMemo(() => {
    if (mediaFiles.length) return mediaFiles.map(file => URL.createObjectURL(file))
    if (mintboxMedia.length) return mintboxMedia.map(item => item.media_url)
    if (!existingMediaTouched && existingMediaUrls.length) return existingMediaUrls
    return []
  }, [mediaFiles, mintboxMedia, existingMediaUrls, existingMediaTouched])

  useEffect(() => () => {
    mediaPreviewUrls.filter(url => url?.startsWith('blob:')).forEach(url => URL.revokeObjectURL(url))
  }, [mediaPreviewUrls])

  useEffect(() => {
    if (!initialPost) return
    setCaption(initialPost.caption || '')
    setHashtags(Array.isArray(initialPost.hashtags) ? initialPost.hashtags.join(' ') : '')
    setContentType(initialPost.content_type || 'text')
    setSelectedPlatforms(normalizePlatforms(initialPost.target_platforms))
    setScheduleDate(initialPost.publish_at ? new Date(initialPost.publish_at).toISOString().slice(0, 16) : '')
    setMediaFiles([])
    setMintboxMedia([])
    setExistingMediaTouched(false)
    setStep(1)
  }, [initialPost])

  const { data: mediaLibrary = [] } = useQuery({
    queryKey: ['social-media-library'],
    queryFn: () => socialApi.getMediaLibrary().then(r => r.data.data.media || []),
  })

  const connectedPlatforms = accounts.filter(a => a.is_active)

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const persistDraft = async ({ publishNow = false } = {}) => {
    const payload = {
      caption,
      hashtags: hashtags.split(' ').filter(Boolean),
      content_type: contentType,
      target_platforms: selectedPlatforms,
      publish_at: publishNow ? null : (scheduleDate || null),
    }

    if (isEditing) {
      await socialApi.updatePost(initialPost.id, payload)
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      if (publishNow) {
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

    await socialApi.publishPost(post.id)

    return post
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

  return (
    <Modal
      title={isEditing ? 'Edit draft' : 'Create post'}
      subtitle={isEditing ? 'Update your draft and publish when ready.' : `Step ${step} of 3`}
      onClose={onClose}
      maxWidth={640}
      footer={(
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {step > 1 && !isEditing && <button className="btn ghost" onClick={() => setStep(s => s - 1)}>Back</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          {isEditing ? (
            <>
              <button className="btn ghost" onClick={handleSaveDraft} disabled={actionMutation.isPending}>Save draft</button>
              <button className="btn primary" onClick={handlePublishNow} disabled={actionMutation.isPending || selectedPlatforms.length === 0 || (needsMedia && !hasMedia) || instagramContentBlocked}>
                {actionMutation.isPending ? 'Publishing...' : 'Publish now'}
              </button>
            </>
          ) : step < 3 ? (
            <button className="btn primary" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !caption.trim()}>
              Continue <Icon name="arrowRight" />
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => actionMutation.mutate({ publishNow: !scheduleDate })}
              disabled={actionMutation.isPending || selectedPlatforms.length === 0 || (needsMedia && !hasMedia) || instagramContentBlocked}
            >
              {actionMutation.isPending ? 'Publishing...' : scheduleDate ? 'Schedule post' : 'Publish now'}
            </button>
          )}
        </div>
      )}
    >
      {step === 1 && (
        <div className="stack" style={{ gap: 16 }}>
          <div>
            <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Content type</label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {['text','image','video','carousel','reel'].map(type => (
                <button
                  key={type}
                  className={`badge ${contentType === type ? 'violet' : 'neutral'}`}
                  style={{ padding: '6px 12px', cursor: 'pointer', border: 'none', textTransform: 'capitalize' }}
                  onClick={() => setContentType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Caption</label>
            <textarea
              className="textarea"
              rows={5}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Write your caption..."
            />
            <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>
              {caption.length} characters
            </div>
          </div>

          <div className="field">
            <label className="field-label">Hashtags</label>
            <input
              className="input"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#marketing #india #creative"
            />
          </div>

          {contentType !== 'text' && (
            <div className="field">
              <label className="field-label">Media</label>
              <div
                style={{
                  height: 100, borderRadius: 'var(--radius-md)',
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
                      {contentType === 'carousel' ? 'Upload multiple JPG, PNG, or WebP images' : 'Upload a JPG, PNG, or WebP'}
                    </div>
                  </div>
                )}
              </div>
              <input
                id="social-media-upload"
                type="file"
                accept={contentType === 'video' || contentType === 'reel' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'}
                multiple={contentType === 'carousel'}
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  setMediaFiles(contentType === 'carousel' ? files : files.slice(0, 1))
                  setMintboxMedia([])
                  setExistingMediaTouched(true)
                }}
              />
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 7 }}>
                Use Mintbox below for reusable assets and carousel-ready reference media.
              </div>
              {mediaLibrary.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="field-label" style={{ marginBottom: 7 }}>Or choose from Mintbox</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, maxHeight: 160, overflowY: 'auto' }}>
                    {mediaLibrary.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        className="btn ghost"
                        onClick={() => {
                          if (contentType === 'carousel') {
                            setMintboxMedia(current =>
                              current.some(existing => existing.id === item.id)
                                ? current.filter(existing => existing.id !== item.id)
                                : [...current, item]
                            )
                          } else {
                            setMintboxMedia([item])
                          }
                          setMediaFiles([])
                          setExistingMediaTouched(true)
                        }}
                        style={{
                          justifyContent: 'flex-start',
                          borderColor: mintboxMedia.some(existing => existing.id === item.id) ? 'var(--mint-500)' : undefined,
                          minWidth: 0,
                        }}
                        title={`${item.job_title} - ${item.original_name}`}
                      >
                        <Icon name={item.media_type === 'video' ? 'video' : 'image'} size={13} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.original_name}</span>
                        {contentType === 'carousel' && mintboxMedia.some(existing => existing.id === item.id) && <Icon name="check" size={12} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {contentType === 'carousel' && mediaFiles.length > 1 && (
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>
                  Carousel mode supports up to 10 selected images.
                </div>
              )}
              {instagramSelected && (
                <div style={{ fontSize: 12, color: instagramContentBlocked ? 'var(--rose)' : 'var(--ink-500)', marginTop: 8 }}>
                  Instagram-only posts work best as images, carousels, or reels. Pick the Instagram account in step 2 if that is the destination you want.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>
            Select platforms to publish to
          </div>
          {connectedPlatforms.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
              No connected accounts. Go to the Accounts tab to connect.
            </div>
          ) : (
            connectedPlatforms.map(acc => {
              const meta = PLATFORM_META[acc.platform] || {}
              const selected = selectedPlatforms.includes(acc.platform)
              return (
                <div
                  key={acc.id}
                  onClick={() => togglePlatform(acc.platform)}
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
        </div>
      )}

      {step === 3 && (
        <div className="stack" style={{ gap: 18 }}>
          <div style={{ padding: 16, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
            <div className="h-eyebrow" style={{ marginBottom: 8 }}>Post summary</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-700)', marginBottom: 10 }}>
              {caption.slice(0, 120)}{caption.length > 120 ? '...' : ''}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {selectedPlatforms.map(id => {
                const acc = connectedPlatforms.find(a => a.platform === id)
                const meta = PLATFORM_META[id] || {}
                return (
                  <span key={id} className="badge neutral" style={{ fontSize: 12 }}>
                    <Icon name={meta.icon} size={11} style={{ color: meta.color }} />
                    &nbsp;{acc?.page_name || meta.label}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Schedule (leave empty to publish now)</label>
            <input
              className="input"
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
            />
          </div>

          {scheduleDate && (
            <div style={{ fontSize: 13, color: 'var(--ink-600)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="clock" size={13} />
              Scheduled for {new Date(scheduleDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}

          <div>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>Live preview</div>
            <div style={{ display: 'grid', gap: 14 }}>
              {selectedPlatforms.length === 0 ? (
                <div className="empty" style={{ padding: 18 }}>
                  <h3>Select a platform to preview the post</h3>
                </div>
              ) : selectedPlatforms.map(platform => {
                const account = connectedPlatforms.find(a => a.platform === platform)
                return (
                  <SocialPostPreview
                    key={platform}
                    platform={platform}
                    account={account}
                    caption={caption}
                    hashtags={hashtags}
                    contentType={contentType}
                    mediaUrls={mediaPreviewUrls}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Social() {
  const { accessToken } = useAuthStore()
  const queryClient     = useQueryClient()
  const pushToast       = useUIStore(s => s.pushToast)
  const [tab, setTab] = useState('analytics')
  const [showCreate, setShowCreate] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [connectPrompt, setConnectPrompt] = useState(null)
  const [postFilter, setPostFilter] = useState('all')
  const [loadingDraftId, setLoadingDraftId] = useState(null)

  const { data: accountsData, isLoading: accLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn:  () => socialApi.getAccounts().then(r => r.data.data),
  })
  const accounts = accountsData?.accounts || []
  const connectedAccounts = accounts.filter(account => account.is_active)
  const effectiveTab = !accLoading && connectedAccounts.length === 0 && tab === 'analytics'
    ? 'accounts'
    : tab

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', postFilter],
    queryFn:  () => socialApi.listPosts(postFilter !== 'all' ? { status: postFilter } : {}).then(r => r.data.data),
    enabled:  effectiveTab === 'posts',
  })

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['social-analytics-summary'],
    queryFn: () => socialApi.getAnalyticsSummary().then(r => r.data.data),
    enabled: effectiveTab === 'analytics',
  })

  const disconnectMutation = useMutation({
    mutationFn: (id) => socialApi.disconnect(id),
    onSuccess: () => {
      pushToast({ title: 'Account disconnected', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
    },
  })

  const posts = postsData?.posts || []
  const summary = analyticsData?.summary
  const accountTotals = useMemo(() => connectedAccounts.reduce((totals, account) => {
    const stats = account.stats || {}
    totals.followers += Number(stats.followers_count || 0)
    totals.posts += Number(stats.posts_count || 0)
    totals.likes += Number(stats.page_likes_count || 0)
    return totals
  }, { followers: 0, posts: 0, likes: 0 }), [connectedAccounts])

  const facebookThresholdAccount = connectedAccounts.find(account => account.platform === 'facebook' && account.stats?.insights_available === false)

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

  return (
    <div className="stack-6">
      <div className="row between reveal">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Social media</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Insights &amp; publishing</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Track reach first, then plan posts for every connected channel from one place.
          </p>
        </div>
        {connectedAccounts.length > 0 && (
          <button className="btn primary" onClick={() => { setEditingPost(null); setShowCreate(true); }}>
            <Icon name="plus" /> Create post
          </button>
        )}
      </div>

      <Tabs value={effectiveTab} onChange={setTab} items={[
        { value: 'analytics', label: 'Analytics' },
        { value: 'posts', label: 'Posts' },
        { value: 'accounts', label: `Accounts (${connectedAccounts.length})` },
      ]} />

      {effectiveTab === 'accounts' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="card reveal" style={{ padding: 20 }}>
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
        </div>
      )}

      {effectiveTab === 'analytics' && (
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

      {effectiveTab === 'posts' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <Tabs value={postFilter} onChange={setPostFilter} items={[
              { value: 'all', label: 'All' },
              { value: 'draft', label: 'Drafts' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'published', label: 'Published' },
              { value: 'failed', label: 'Failed' },
            ]} />
            <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => { setEditingPost(null); setShowCreate(true); }}>
              <Icon name="plus" /> Create post
            </button>
          </div>

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
            <div className="stack" style={{ gap: 10 }}>
              {posts.map(post => {
                const isEditable = ['draft', 'scheduled', 'failed'].includes(post.status)
                const imported = post.metadata?.source === 'historical_import' || post.platform_statuses?.some(s => s.source === 'historical_import')
                return (
                  <div
                    key={post.id}
                    role={isEditable ? 'button' : undefined}
                    tabIndex={isEditable ? 0 : -1}
                    onClick={() => isEditable && openDraftEditor(post.id)}
                    onKeyDown={(e) => { if (isEditable && (e.key === 'Enter' || e.key === ' ')) openDraftEditor(post.id) }}
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 18,
                      cursor: isEditable ? 'pointer' : 'default',
                    }}
                  >
                    <div className="row between" style={{ marginBottom: 10, gap: 12 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, flex: 1, minWidth: 0 }}>
                        {post.caption?.slice(0, 80)}{post.caption?.length > 80 ? '...' : ''}
                      </div>
                      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                        {imported && <span className="badge neutral">Imported from Facebook</span>}
                        <span className={`badge ${post.status === 'published' ? 'mint' : post.status === 'failed' ? 'rose' : post.status === 'scheduled' ? 'violet' : 'neutral'}`}>
                          <span className="bdot" />{post.status}
                        </span>
                        {isEditable && (
                          <button className="btn ghost" type="button" onClick={(e) => { e.stopPropagation(); openDraftEditor(post.id); }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      {normalizePlatforms(post.target_platforms).map(p => {
                        const meta = PLATFORM_META[p] || {}
                        return (
                          <span key={p} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', color: 'var(--ink-500)' }}>
                            <Icon name={meta.icon} size={12} style={{ color: meta.color }} />
                            {meta.label}
                          </span>
                        )
                      })}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                      {post.publish_at
                        ? `Scheduled: ${new Date(post.publish_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                        : post.published_at
                        ? `Published: ${timeAgo(post.published_at)}`
                        : `Created: ${timeAgo(post.created_at)}`
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {(showCreate || editingPost) && (
        <CreatePostModal
          accounts={accounts}
          initialPost={editingPost}
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
