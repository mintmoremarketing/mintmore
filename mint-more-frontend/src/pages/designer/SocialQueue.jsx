import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { creativeApi } from '../../api/creative'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import { useUIStore } from '../../store/ui'

export default function SocialQueue({ onOpenBrandContext }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [uploadPost, setUploadPost] = useState(null)
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'rejected' | 'draft' | 'in_review' | 'scheduled'

  const { data: response, isLoading } = useQuery({
    queryKey: ['designer-social-queue'],
    queryFn: () => creativeApi.getDesignerSocialQueue().then(res => res.data),
  })

  const queueData = response?.data
  const posts = useMemo(() => {
    return queueData?.queue || queueData?.posts || []
  }, [queueData])

  const counts = useMemo(() => ({
    all: posts.length,
    rejected: posts.filter(p => p.status === 'rejected').length,
    draft: posts.filter(p => p.status === 'draft').length,
    in_review: posts.filter(p => p.status === 'pending_admin_review' || p.status === 'pending_client_review').length,
    scheduled: posts.filter(p => p.status === 'scheduled' || p.status === 'published').length,
  }), [posts])

  const filteredPosts = useMemo(() => {
    if (filterTab === 'rejected') return posts.filter(p => p.status === 'rejected')
    if (filterTab === 'draft') return posts.filter(p => p.status === 'draft')
    if (filterTab === 'in_review') return posts.filter(p => p.status === 'pending_admin_review' || p.status === 'pending_client_review')
    if (filterTab === 'scheduled') return posts.filter(p => p.status === 'scheduled' || p.status === 'published')
    return posts
  }, [posts, filterTab])

  const uploadMutation = useMutation({
    mutationFn: ({ postId, payload }) => creativeApi.uploadCreative(postId, payload),
    onSuccess: () => {
      pushToast({ title: 'Creative uploaded successfully', body: 'Submitted for admin review.', tone: 'mint' })
      queryClient.invalidateQueries({ queryKey: ['designer-social-queue'] })
      setUploadPost(null)
    },
    onError: err => pushToast({ title: 'Upload failed', body: err.response?.data?.message || err.message, tone: 'amber' }),
  })

  if (isLoading) return <div className="card" style={{ padding: 20 }}>Loading social queue...</div>

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* ── Summary Metrics Bar ── */}
      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 16, borderLeft: counts.rejected > 0 ? '4px solid var(--rose, #ef4444)' : undefined }}>
          <div className="h-eyebrow" style={{ color: counts.rejected > 0 ? 'var(--rose, #ef4444)' : undefined }}>Needs Revision</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{counts.rejected}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Rejected with feedback</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow">Ready for Upload</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{counts.draft}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Client calendar drafts</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow">In Review</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{counts.in_review}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Admin / Client review</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow">Approved / Scheduled</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{counts.scheduled}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Ready for publishing</div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="tabs row wrap" style={{ gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {[
          { key: 'all', label: 'All Posts', count: counts.all },
          { key: 'rejected', label: 'Needs Revision', count: counts.rejected, highlight: counts.rejected > 0 },
          { key: 'draft', label: 'Drafts', count: counts.draft },
          { key: 'in_review', label: 'In Review', count: counts.in_review },
          { key: 'scheduled', label: 'Scheduled', count: counts.scheduled },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`btn sm ${filterTab === tab.key ? 'primary' : 'ghost'}`}
            onClick={() => setFilterTab(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: filterTab === tab.key ? undefined : (tab.highlight ? 'rgba(239, 68, 68, 0.08)' : undefined),
              color: filterTab === tab.key ? undefined : (tab.highlight ? 'var(--rose, #ef4444)' : undefined),
            }}
          >
            {tab.label}
            <span
              className="mono"
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 999,
                background: filterTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--hairline-strong)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Posts List ── */}
      {filteredPosts.length === 0 ? (
        <div className="empty card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="empty-glyph" style={{ marginBottom: 12 }}><Icon name="sparkles" size={24} /></div>
          <h3 style={{ margin: 0 }}>No posts found</h3>
          <p className="muted" style={{ marginTop: 4 }}>
            {filterTab === 'rejected'
              ? 'Great job! No creatives currently require revision.'
              : filterTab === 'draft'
              ? 'No new draft posts waiting for design assets.'
              : 'There are no posts matching the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {filteredPosts.map(post => {
            const isRejected = post.status === 'rejected'
            const feedbackText = post.client_feedback || post.admin_feedback || post.rejection_reason || (post.rejection_history?.[post.rejection_history.length - 1]?.reason)
            const lastRejection = Array.isArray(post.rejection_history) && post.rejection_history.length > 0
              ? post.rejection_history[post.rejection_history.length - 1]
              : null
            const reviewerRole = post.client_feedback ? 'Client' : post.admin_feedback ? 'Admin' : (lastRejection?.by === 'client' ? 'Client' : 'Admin')
            const rejectionTime = lastRejection?.timestamp ? new Date(lastRejection.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null

            return (
              <div
                key={post.id}
                className="card p-18 row between wrap"
                style={{
                  gap: 20,
                  border: isRejected ? '1.5px solid rgba(239, 68, 68, 0.4)' : undefined,
                  background: isRejected ? 'rgba(254, 242, 242, 0.4)' : undefined,
                }}
              >
                <div className="stack" style={{ flex: 1, minWidth: 280, gap: 10 }}>
                  <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                    <StatusBadge status={post.status} />
                    <div className="h-eyebrow" style={{ textTransform: 'uppercase' }}>
                      {post.client_business_name || post.client_name || post.user?.business_name || 'Client'}
                    </div>
                    {post.publish_at && <DateBadge date={post.publish_at} />}
                    {post.content_type && (
                      <span className="badge neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                        {post.content_type}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: 0, fontSize: 16 }}>{post.title || 'Untitled Social Post'}</h3>
                  {post.caption && (
                    <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {post.caption}
                    </p>
                  )}

                  {/* ── Prominent Rejection / Feedback Banner ── */}
                  {isRejected && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: 13,
                      }}
                    >
                      <div className="row between" style={{ alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}>
                          <Icon name="alertCircle" size={14} /> Changes Requested by {reviewerRole}
                        </strong>
                        {rejectionTime && (
                          <span style={{ fontSize: 11, color: '#b91c1c' }}>{rejectionTime}</span>
                        )}
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.45, color: '#7f1d1d' }}>
                        {feedbackText || 'Please review the client brief and re-upload an updated creative asset.'}
                      </p>
                    </div>
                  )}

                  {/* Existing Creative Asset preview */}
                  {post.creative_url && (
                    <div className="row wrap" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <span className="muted" style={{ fontSize: 12 }}>Current asset:</span>
                      <a
                        href={post.creative_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn ghost sm"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                      >
                        <Icon name="externalLink" size={12} /> View File ↗
                      </a>
                    </div>
                  )}
                </div>

                <div className="stack" style={{ gap: 8, minWidth: 160, justifyContent: 'center' }}>
                  {onOpenBrandContext && (
                    <button
                      type="button"
                      className="btn outline sm"
                      onClick={() => onOpenBrandContext(post)}
                    >
                      <Icon name="palette" size={13} /> Brand Context
                    </button>
                  )}
                  {isRejected ? (
                    <button
                      type="button"
                      className="btn sm"
                      style={{ background: 'var(--rose, #ef4444)', color: '#fff', border: 'none' }}
                      onClick={() => setUploadPost(post)}
                    >
                      <Icon name="refresh" size={13} /> Re-upload Revision
                    </button>
                  ) : post.status === 'draft' ? (
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => setUploadPost(post)}
                    >
                      <Icon name="upload" size={13} /> Upload Creative
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setUploadPost(post)}
                    >
                      <Icon name="upload" size={13} /> Update Asset
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Dual-Mode Creative Upload Modal ── */}
      {uploadPost && (
        <UploadCreativeModal
          post={uploadPost}
          onClose={() => setUploadPost(null)}
          onUpload={(payload) => uploadMutation.mutate({ postId: uploadPost.id, payload })}
          isUploading={uploadMutation.isPending}
        />
      )}
    </div>
  )
}

function UploadCreativeModal({ post, onClose, onUpload, isUploading }) {
  const pushToast = useUIStore(s => s.pushToast)
  const isRevision = post.status === 'rejected'

  const [mode, setMode] = useState('file') // 'file' | 'url'
  const [file, setFile] = useState(null)
  const [directUrl, setDirectUrl] = useState(post.creative_url || '')
  const [caption, setCaption] = useState(post.caption || '')
  const [title, setTitle] = useState(post.title || '')
  const [mediaType, setMediaType] = useState(post.content_type || 'image')
  const [internalUploading, setInternalUploading] = useState(false)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    let finalUrl = directUrl.trim()

    if (mode === 'file') {
      if (!file && !finalUrl) {
        return pushToast({ title: 'Select a file or enter a URL', tone: 'amber' })
      }
      if (file) {
        setInternalUploading(true)
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('kind', 'social_creative')
          const res = await api.post('/creative/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          finalUrl = res.data?.data?.url || res.data?.url
        } catch (err) {
          setInternalUploading(false)
          return pushToast({
            title: 'File upload failed',
            body: err.response?.data?.message || err.message,
            tone: 'amber',
          })
        }
        setInternalUploading(false)
      }
    }

    if (!finalUrl) {
      return pushToast({ title: 'Creative URL is required', tone: 'amber' })
    }

    onUpload({
      creative_url: finalUrl,
      caption: caption.trim(),
      title: title.trim(),
      media_type: mediaType,
      content_type: mediaType,
    })
  }

  return (
    <Modal
      title={isRevision ? `Re-upload Revision: ${post.title || 'Creative'}` : `Upload Creative: ${post.title || 'Creative'}`}
      subtitle={`Client: ${post.client_business_name || post.client_name || 'Client'}`}
      onClose={onClose}
      maxWidth={540}
      footer={(
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={onClose}
            disabled={isUploading || internalUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={handleSubmit}
            disabled={isUploading || internalUploading || (mode === 'file' && !file && !directUrl.trim()) || (mode === 'url' && !directUrl.trim())}
          >
            {internalUploading ? 'Uploading file...' : isUploading ? 'Submitting...' : isRevision ? 'Submit Revision' : 'Upload & Fulfill'}
          </button>
        </div>
      )}
    >
      <div className="stack" style={{ gap: 14 }}>
        {/* Revision Context if Rejected */}
        {isRevision && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              fontSize: 12.5,
              color: '#991b1b',
            }}
          >
            <strong>Feedback to address:</strong>{' '}
            {post.client_feedback || post.admin_feedback || post.rejection_reason || 'Please update the creative according to specifications.'}
          </div>
        )}

        {/* Upload Mode Selector */}
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn sm ${mode === 'file' ? 'primary' : 'outline'}`}
            onClick={() => setMode('file')}
            style={{ flex: 1 }}
          >
            <Icon name="upload" size={13} /> File Upload
          </button>
          <button
            type="button"
            className={`btn sm ${mode === 'url' ? 'primary' : 'outline'}`}
            onClick={() => setMode('url')}
            style={{ flex: 1 }}
          >
            <Icon name="link" size={13} /> Direct Asset URL
          </button>
        </div>

        {/* Mode 1: File Input */}
        {mode === 'file' ? (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Select Asset File (Image / Video) <span style={{ color: 'var(--rose, #ef4444)' }}>*</span>
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                background: 'var(--paper)',
                fontSize: 13,
              }}
            />
            {file && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>
        ) : (
          /* Mode 2: Direct URL Input */
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Asset URL (CDN, Figma, Cloudinary, Drive) <span style={{ color: 'var(--rose, #ef4444)' }}>*</span>
            </label>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="https://example.com/assets/creative-v2.png"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                background: 'var(--paper)',
                fontSize: 13,
              }}
            />
          </div>
        )}

        {/* Media Type Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Media Type
          </label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--hairline)',
              background: 'var(--paper)',
              fontSize: 13,
            }}
          >
            <option value="image">Image (Single Graphic / Photo)</option>
            <option value="video">Video / Reel (MP4, MOV)</option>
            <option value="carousel">Carousel (Multi-slide Album)</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Post Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post Title..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              background: 'var(--paper)',
              fontSize: 13,
            }}
          />
        </div>

        {/* Caption */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Copy / Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write or refine the accompanying caption..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              background: 'var(--paper)',
              fontSize: 13,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
    </Modal>
  )
}
