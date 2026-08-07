import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { creativeApi } from '../../api/creative'
import Icon from '../../components/ui/Icon'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useUIStore } from '../../store/ui'

export default function SocialQueue({ onOpenBrandContext }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [uploadPost, setUploadPost] = useState(null)

  const { data: response, isLoading } = useQuery({
    queryKey: ['designer-social-queue'],
    queryFn: () => creativeApi.designerSocialQueue().then(res => res.data),
  })

  const posts = response?.data?.posts || []

  const uploadMutation = useMutation({
    mutationFn: ({ postId, creative_url }) => creativeApi.uploadCreativeToSocialPost(postId, { creative_url }),
    onSuccess: () => {
      pushToast({ title: 'Creative uploaded successfully', tone: 'mint' })
      queryClient.invalidateQueries({ queryKey: ['designer-social-queue'] })
      setUploadPost(null)
    },
    onError: err => pushToast({ title: 'Upload failed', body: err.message, tone: 'amber' }),
  })

  if (isLoading) return <div className="card" style={{ padding: 20 }}>Loading social queue...</div>

  if (posts.length === 0) {
    return (
      <div className="empty">
        <div className="empty-glyph"><Icon name="sparkles" size={20} /></div>
        <h3>No social drafts</h3>
        <p>There are currently no drafts across client calendars.</p>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {posts.map(post => (
        <div key={post.id} className="card p-18 row between wrap" style={{ gap: 20 }}>
          <div className="stack" style={{ flex: 1, minWidth: 300, gap: 10 }}>
            <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
              <StatusBadge status={post.status} />
              <div className="h-eyebrow" style={{ textTransform: 'uppercase' }}>
                {post.client_business_name || post.client_name}
              </div>
              <DateBadge date={post.publish_at} />
            </div>
            <h3 style={{ margin: 0 }}>{post.title}</h3>
            <p className="muted" style={{ margin: 0 }}>{post.caption}</p>
          </div>
          
          <div className="stack" style={{ gap: 8, minWidth: 150 }}>
            <button className="btn outline" onClick={() => onOpenBrandContext(post)}>
              <Icon name="palette" /> Brand Context
            </button>
            <button className="btn" onClick={() => setUploadPost(post)}>
              <Icon name="upload" /> Upload Creative
            </button>
          </div>
        </div>
      ))}
      
      {uploadPost && (
        <UploadCreativeModal 
          post={uploadPost} 
          onClose={() => setUploadPost(null)} 
          onUpload={(url) => uploadMutation.mutate({ postId: uploadPost.id, creative_url: url })} 
          isUploading={uploadMutation.isPending}
        />
      )}
    </div>
  )
}

function UploadCreativeModal({ post, onClose, onUpload, isUploading }) {
  const { api } = require('../../api/client')
  const pushToast = useUIStore(s => s.pushToast)
  const [file, setFile] = useState(null)
  const [internalUploading, setInternalUploading] = useState(false)
  
  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!file) return pushToast({ title: 'Select a file', tone: 'amber' })
    setInternalUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', 'social_creative')
      const res = await api.post('/assets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }})
      const url = res.data.data.url
      onUpload(url)
    } catch (err) {
      pushToast({ title: 'File upload failed', body: err.message, tone: 'amber' })
      setInternalUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content card p-24 stack" style={{ maxWidth: 500, width: '100%', background: 'var(--surface)' }}>
        <h2>Upload Creative for {post.title}</h2>
        <p className="muted">Client: {post.client_business_name}</p>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Select Image/Video</label>
          <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ marginTop: 8, display: 'block' }} />
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn ghost" onClick={onClose} disabled={isUploading || internalUploading}>Cancel</button>
          <button className="btn" onClick={handleUpload} disabled={isUploading || internalUploading || !file}>
            {internalUploading ? 'Uploading file...' : isUploading ? 'Saving...' : 'Upload & Fulfill'}
          </button>
        </div>
      </div>
    </div>
  )
}
