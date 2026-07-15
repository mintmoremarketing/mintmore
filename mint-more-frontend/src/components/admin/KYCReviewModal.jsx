import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'

export default function KYCReviewModal({ submission, onClose }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [images, setImages] = useState({ document_front: null, document_back: null, selfie: null })
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!submission) return
    const fields = ['document_front', 'document_back', 'selfie']
    fields.forEach(field => {
      // The backend expects an admin token, so we can't just put the URL in an <img> tag directly
      // if it's protected by bearer token. We have to fetch it as blob.
      api.get(`/kyc/admin/submissions/${submission.id}/documents/${field}`, { responseType: 'blob' })
        .then(res => setImages(prev => ({ ...prev, [field]: URL.createObjectURL(res.data) })))
        .catch(err => console.error('Failed to load image', field, err))
    })

    return () => {
      // Cleanup object URLs
      Object.values(images).forEach(url => { if (url) URL.revokeObjectURL(url) })
    }
    // eslint-disable-next-line
  }, [submission?.id])

  const review = useMutation({
    mutationFn: (status) => api.patch(`/kyc/admin/review/${submission.id}`, { status, note }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-pending'] })
      pushToast({ title: 'KYC Reviewed', body: `Submission was ${status}.`, icon: 'check' })
      onClose()
    },
    onError: error => pushToast({ title: 'Review failed', body: error.response?.data?.message || error.message, tone: 'amber', icon: 'x' })
  })

  if (!submission) return null

  return (
    <Modal title="Review KYC Submission" open={true} onClose={onClose} width="800px">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-between items-center bg-ink-50 p-4 rounded-xl">
          <div>
            <div className="text-sm font-bold text-ink-900">{submission.full_name}</div>
            <div className="text-xs text-ink-500">{submission.email}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-ink-500 uppercase tracking-wider">Document Type</div>
            <div className="text-sm font-bold uppercase">{submission.document_type || 'N/A'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-ink-500 uppercase tracking-wider">Document No.</div>
            <div className="text-sm font-mono font-bold bg-white px-2 py-1 border border-ink-200 rounded">{submission.document_number || 'N/A'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['document_front', 'document_back', 'selfie'].map(field => (
            <div key={field} className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500">{field.replace('_', ' ')}</div>
              <div className="aspect-[4/3] bg-ink-50 rounded-xl overflow-hidden border border-ink-200 flex items-center justify-center relative">
                {images[field] ? (
                  <img src={images[field]} alt={field} className="w-full h-full object-contain bg-black/5" />
                ) : (
                  <div className="text-ink-300 animate-pulse"><Icon name="image" size={32} /></div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-500">Rejection Note (Optional)</label>
          <input 
            type="text" 
            placeholder="Reason for rejection (e.g. blurry image)" 
            className="input w-full"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-ink-200/50">
          <button 
            className="flex-1 py-3 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all disabled:opacity-50"
            disabled={review.isPending}
            onClick={() => review.mutate('approved')}
          >
            {review.isPending && review.variables === 'approved' ? 'Approving...' : 'Approve'}
          </button>
          <button 
            className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-full transition-all disabled:opacity-50"
            disabled={review.isPending}
            onClick={() => review.mutate('rejected')}
          >
            {review.isPending && review.variables === 'rejected' ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
