import { useState } from 'react'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'

const PRESET_REASONS = [
  'Color palette adjustment',
  'Copy/typo edit',
  'Logo placement/branding',
  'Dimensions/aspect ratio',
]

export default function AdminRejectModal({ post, isOpen = true, onClose, onReject, onSuccess, isSubmitting = false }) {
  const [reason, setReason] = useState('')
  const [internalSubmitting, setInternalSubmitting] = useState(false)
  const pushToast = useUIStore(s => s.pushToast)

  if (!isOpen || !post) return null

  const submitting = isSubmitting || internalSubmitting
  const trimmedReason = reason.trim()
  const isValid = trimmedReason.length > 0

  const handleChipClick = (chip) => {
    if (!reason.trim()) {
      setReason(chip)
    } else if (!reason.includes(chip)) {
      setReason(prev => `${prev.trim()}\n• ${chip}`)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!isValid || submitting) return

    if (typeof onReject === 'function') {
      return onReject(trimmedReason)
    }

    // Default internal reject logic
    try {
      setInternalSubmitting(true)
      const res = await creativeApi.adminRejectCreative(post.id, { reason: trimmedReason })
      pushToast({
        title: 'Creative rejected',
        body: 'Feedback and revision request sent to designer.',
        tone: 'amber',
      })
      if (typeof onSuccess === 'function') {
        onSuccess(res?.data?.data || res?.data)
      }
      onClose()
    } catch (err) {
      pushToast({
        title: 'Could not reject creative',
        body: err.response?.data?.message || err.message || 'Please try again',
        tone: 'amber',
      })
    } finally {
      setInternalSubmitting(false)
    }
  }

  const mediaUrl = post.creative_url || post.preview_media_url || post.media_url
  const isVideo = post.content_type === 'video' || post.media_type === 'video' || (mediaUrl && /\.(mp4|webm|mov)$/i.test(mediaUrl))
  const clientName = post.client_business_name || post.client_name || post.business_name || 'Client'
  const designerName = post.designer_name || 'Assigned Designer'

  return (
    <Modal
      title="Reject & Request Changes"
      subtitle={`Review feedback for ${clientName}`}
      onClose={onClose}
      maxWidth={520}
      footer={(
        <div className="flex items-center justify-between w-full pt-2">
          <button
            type="button"
            className="px-5 py-2.5 rounded-full border border-ink-200 hover:bg-ink-50 text-ink-700 font-bold text-sm transition-colors"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            <Icon name="x" size={16} />
            {submitting ? 'Rejecting...' : 'Reject & Send Feedback'}
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Post Preview Summary Card */}
        <div className="bg-ink-50/70 border border-ink-100 rounded-2xl p-4 flex gap-4 items-center">
          {mediaUrl ? (
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-950 flex-shrink-0 flex items-center justify-center border border-ink-200">
              {isVideo ? (
                <video src={mediaUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-ink-100 flex-shrink-0 flex items-center justify-center text-ink-400 border border-ink-200">
              <Icon name="image" size={24} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-ink-950 truncate m-0 mb-1">{post.title || 'Creative Post'}</h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="font-medium text-ink-700">Client: {clientName}</span>
              <span>•</span>
              <span className="font-medium text-ink-700">Designer: {designerName}</span>
            </div>
          </div>
        </div>

        {/* Quick Reason Chips */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider">
            Quick Feedback Suggestions
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_REASONS.map(preset => (
              <button
                key={preset}
                type="button"
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ink-100/80 hover:bg-ink-200/80 text-ink-800 transition-colors border border-ink-200/60 flex items-center gap-1"
                onClick={() => handleChipClick(preset)}
              >
                <Icon name="plus" size={12} className="text-ink-500" />
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-600 uppercase tracking-wider flex items-center justify-between">
            <span>Mandatory Revision Reason <span className="text-rose-500">*</span></span>
            <span className="text-[11px] font-medium text-ink-400">Sent directly to designer</span>
          </label>
          <textarea
            className="textarea min-h-[120px] p-3 text-sm rounded-xl border border-ink-200 focus:border-ink-950 focus:ring-1 focus:ring-ink-950 transition-colors"
            placeholder="Describe the required adjustments in detail (e.g. Please update brand logo to primary white variant and adjust caption font size)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          {!isValid && reason.length > 0 && (
            <span className="text-xs text-rose-500 font-medium mt-1">Please provide a valid non-empty reason.</span>
          )}
        </div>
      </div>
    </Modal>
  )
}
