import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { api } from '../../api/client'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'layers' },
  { id: 'twitter', label: 'X / Twitter', icon: 'sparkles' },
]

function getTomorrow10AM() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function AdminDirectUploadModal({
  isOpen = false,
  onClose,
  initialClientId = null,
  initialClientName = '',
  onSuccess,
}) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)

  const [clientId, setClientId] = useState(initialClientId || '')
  const [mode, setMode] = useState('file') // 'file' | 'url'
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState('')
  const [directUrl, setDirectUrl] = useState('')
  const [title, setTitle] = useState('Direct Creative Post')
  const [caption, setCaption] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [targetPlatforms, setTargetPlatforms] = useState(['instagram', 'facebook'])
  const [scheduledAt, setScheduledAt] = useState(getTomorrow10AM())
  const [bypassClientReview, setBypassClientReview] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch clients for dropdown selector
  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => creativeApi.getAdminClients().then(r => r.data?.data?.clients || r.data?.clients || []),
    enabled: isOpen,
  })

  const clients = Array.isArray(clientsData) ? clientsData : []

  useEffect(() => {
    if (initialClientId) {
      setClientId(initialClientId)
    } else if (clients.length > 0 && !clientId) {
      setClientId(clients[0].id)
    }
  }, [initialClientId, clients, clientId])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview)
      }
    }
  }, [filePreview])

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)

    if (filePreview && filePreview.startsWith('blob:')) {
      URL.revokeObjectURL(filePreview)
    }

    const preview = URL.createObjectURL(selectedFile)
    setFilePreview(preview)

    if (selectedFile.type.startsWith('video/')) {
      setMediaType('video')
    } else {
      setMediaType('image')
    }
  }

  const togglePlatform = (platformId) => {
    setTargetPlatforms(prev => {
      if (prev.includes(platformId)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter(p => p !== platformId)
      }
      return [...prev, platformId]
    })
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!clientId) {
      return pushToast({ title: 'Please select a client', tone: 'amber' })
    }

    let finalCreativeUrl = directUrl.trim()

    if (mode === 'file') {
      if (!file && !finalCreativeUrl) {
        return pushToast({ title: 'Please choose a file or enter a direct URL', tone: 'amber' })
      }
      if (file) {
        setIsSubmitting(true)
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('kind', 'social_creative')
          const uploadRes = await api.post('/creative/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          finalCreativeUrl = uploadRes.data?.data?.url || uploadRes.data?.url
        } catch (uploadErr) {
          setIsSubmitting(false)
          return pushToast({
            title: 'File upload failed',
            body: uploadErr.response?.data?.message || uploadErr.message,
            tone: 'amber',
          })
        }
      }
    }

    if (!finalCreativeUrl) {
      setIsSubmitting(false)
      return pushToast({ title: 'Creative URL or asset is required', tone: 'amber' })
    }

    let isoScheduledAt = null
    if (scheduledAt) {
      try {
        isoScheduledAt = new Date(scheduledAt).toISOString()
      } catch {
        isoScheduledAt = new Date().toISOString()
      }
    }

    const payload = {
      client_id: clientId,
      creative_url: finalCreativeUrl,
      title: title.trim() || 'Direct Creative Post',
      caption: caption.trim(),
      media_type: mediaType,
      target_platforms: targetPlatforms,
      scheduled_at: isoScheduledAt,
      bypass_client_review: Boolean(bypassClientReview),
    }

    try {
      setIsSubmitting(true)
      const res = await creativeApi.adminDirectUpload(payload)

      pushToast({
        title: bypassClientReview ? 'Creative uploaded & scheduled directly' : 'Creative uploaded & routed to client review',
        body: `Asset assigned to client calendar for ${new Date(isoScheduledAt).toLocaleDateString('en-IN')}.`,
        tone: 'mint',
      })

      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
      queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] })
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] })
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ['admin-brand', clientId] })
      }

      if (typeof onSuccess === 'function') {
        onSuccess(res.data?.data || res.data)
      }
      onClose()
    } catch (err) {
      pushToast({
        title: 'Direct upload failed',
        body: err.response?.data?.message || err.message || 'Please verify form fields and try again',
        tone: 'amber',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedClient = clients.find(c => c.id === clientId)
  const clientDisplayName = selectedClient?.business_name || selectedClient?.full_name || selectedClient?.email || initialClientName || 'Client'

  return (
    <Modal
      title="Direct Creative Upload"
      subtitle={`Admin upload for ${clientDisplayName}`}
      onClose={onClose}
      maxWidth={600}
      footer={(
        <div className="flex items-center justify-between w-full pt-2">
          <button
            type="button"
            className="px-5 py-2.5 rounded-full border border-ink-200 hover:bg-ink-50 text-ink-700 font-bold text-sm transition-colors"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2.5 rounded-full bg-mint-500 hover:bg-mint-600 text-white font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={handleSubmit}
            disabled={isSubmitting || !clientId || (mode === 'url' && !directUrl.trim()) || (mode === 'file' && !file && !directUrl.trim())}
          >
            <Icon name="upload" size={16} />
            {isSubmitting ? 'Uploading & Scheduling...' : 'Direct Upload Creative'}
          </button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-1">
        {/* Client Workspace Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider flex items-center justify-between">
            <span>Target Client Workspace <span className="text-rose-500">*</span></span>
            {isLoadingClients && <span className="text-[11px] text-ink-400">Loading clients...</span>}
          </label>
          <select
            className="input bg-white border border-ink-200 text-sm font-medium text-ink-900 rounded-xl"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">— Select Target Client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.business_name ? `${c.business_name} (${c.full_name || c.email})` : (c.full_name || c.email)}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Mode Selector */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600 uppercase tracking-wider">Asset Source</span>
            <div className="flex items-center gap-1 bg-ink-100/80 p-1 rounded-xl">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${mode === 'file' ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
                onClick={() => setMode('file')}
              >
                File Upload
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${mode === 'url' ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
                onClick={() => setMode('url')}
              >
                Direct URL
              </button>
            </div>
          </div>

          {mode === 'file' ? (
            <div className="flex flex-col gap-3">
              <label className="border-2 border-dashed border-ink-200 hover:border-ink-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-ink-50/40 hover:bg-ink-50/80 flex flex-col items-center justify-center gap-2">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-600 mb-1">
                  <Icon name="upload" size={20} />
                </div>
                <div className="text-sm font-bold text-ink-900">
                  {file ? file.name : 'Click or drag & drop creative file here'}
                </div>
                <div className="text-xs text-ink-500">
                  Supports PNG, JPG, MP4, WebM (up to 50MB)
                </div>
              </label>

              {filePreview && (
                <div className="relative rounded-2xl overflow-hidden bg-ink-950 max-h-48 flex items-center justify-center border border-ink-200">
                  {mediaType === 'video' ? (
                    <video src={filePreview} className="max-h-48 w-full object-contain" controls />
                  ) : (
                    <img src={filePreview} alt="Preview" className="max-h-48 w-full object-contain" />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                className="input border border-ink-200 text-sm rounded-xl"
                type="url"
                placeholder="https://cdn.example.com/creatives/post-asset.png"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                disabled={isSubmitting}
              />
              {directUrl && (
                <div className="relative rounded-2xl overflow-hidden bg-ink-950 max-h-48 flex items-center justify-center border border-ink-200">
                  {mediaType === 'video' ? (
                    <video src={directUrl} className="max-h-48 w-full object-contain" controls />
                  ) : (
                    <img src={directUrl} alt="Preview" className="max-h-48 w-full object-contain" onError={() => {}} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media Type & Schedule Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">Media Type</label>
            <select
              className="input bg-white border border-ink-200 text-sm font-medium rounded-xl"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="image">Image Post</option>
              <option value="video">Video / Reel</option>
              <option value="carousel">Carousel</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">Scheduled Date & Time</label>
            <input
              type="datetime-local"
              className="input bg-white border border-ink-200 text-sm font-medium rounded-xl"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">Title</label>
          <input
            className="input bg-white border border-ink-200 text-sm rounded-xl"
            placeholder="e.g. Festival Special Offer Announcement"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">Post Caption</label>
          <textarea
            className="textarea min-h-[90px] text-sm rounded-xl border border-ink-200 focus:border-ink-950"
            placeholder="Write compelling caption text, emojis, and hashtags..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Target Platforms Multi-Select */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">Target Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => {
              const isSelected = targetPlatforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-ink-950 text-white border-ink-950 shadow-sm'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                  disabled={isSubmitting}
                >
                  <Icon name={p.icon} size={14} className={isSelected ? 'text-white' : 'text-ink-500'} />
                  {p.label}
                  {isSelected && <Icon name="check" size={12} className="text-mint-400" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bypass Client Review Toggle */}
        <div className="bg-ink-50/70 border border-ink-100 rounded-2xl p-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-ink-950">Bypass Client Review (Schedule directly)</div>
            <p className="text-xs font-medium text-ink-500 mt-1 m-0">
              When enabled, the post is scheduled immediately without requiring client confirmation.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={bypassClientReview}
              onChange={(e) => setBypassClientReview(e.target.checked)}
              disabled={isSubmitting}
            />
            <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mint-500" />
          </label>
        </div>
      </form>
    </Modal>
  )
}
