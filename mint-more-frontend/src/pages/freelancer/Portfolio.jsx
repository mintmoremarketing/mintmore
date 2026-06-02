import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portfolioApi } from '../../api/portfolio'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

function PortfolioItemModal({ item, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const fileRef     = useRef(null)
  const isEdit      = !!item

  const [title,        setTitle]        = useState(item?.title        || '')
  const [description,  setDescription]  = useState(item?.description  || '')
  const [costMin,      setCostMin]      = useState(item?.project_cost_min || '')
  const [costMax,      setCostMax]      = useState(item?.project_cost_max || '')
  const [duration,     setDuration]     = useState(item?.project_duration || '')
  const [tags,         setTags]         = useState(item?.tags?.join(', ') || '')
  const [tools,        setTools]        = useState(item?.tools_used?.join(', ') || '')
  const [coverFile,    setCoverFile]    = useState(null)
  const [coverPreview, setCoverPreview] = useState(item?.cover_image_url || null)

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('title', title)
      if (description) fd.append('description', description)
      if (costMin) fd.append('project_cost_min', costMin)
      if (costMax) fd.append('project_cost_max', costMax)
      if (duration) fd.append('project_duration', duration)
      if (tags) fd.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean)))
      if (tools) fd.append('tools_used', JSON.stringify(tools.split(',').map(t => t.trim()).filter(Boolean)))
      if (coverFile) fd.append('cover_image', coverFile)
      return portfolioApi.create(fd)
    },
    onSuccess: () => {
      pushToast({ title: 'Portfolio item added!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-portfolio'] })
      onSaved()
      onClose()
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const updateMutation = useMutation({
    mutationFn: () => portfolioApi.update(item.id, {
      title, description,
      project_cost_min: costMin ? parseFloat(costMin) : null,
      project_cost_max: costMax ? parseFloat(costMax) : null,
      project_duration: duration || null,
      tags:   tags.split(',').map(t => t.trim()).filter(Boolean),
      tools_used: tools.split(',').map(t => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      pushToast({ title: 'Portfolio item updated!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-portfolio'] })
      onSaved()
      onClose()
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      title={isEdit ? 'Edit portfolio item' : 'Add portfolio item'}
      onClose={onClose}
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => isEdit ? updateMutation.mutate() : createMutation.mutate()}
            disabled={isPending || !title || (!isEdit && !coverFile)}
          >
            {isPending ? 'Saving…' : isEdit ? 'Update item' : 'Add to portfolio'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {/* Cover image */}
        <div>
          <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>
            Cover image {!isEdit && <span style={{ color: 'var(--rose)' }}>*</span>}
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              height: 160, borderRadius: 'var(--radius-md)',
              border: `2px dashed ${coverPreview ? 'transparent' : 'var(--hairline)'}`,
              background: 'var(--paper-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden', position: 'relative',
            }}
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--ink-400)' }}>
                <Icon name="upload" size={24} />
                <div style={{ fontSize: 13, marginTop: 8 }}>Click to upload cover image</div>
              </div>
            )}
            {coverPreview && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>Change image</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div className="field">
          <label className="field-label">Title <span style={{ color: 'var(--rose)' }}>*</span></label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Transport & Logistics Logo Design" />
        </div>

        <div className="field">
          <label className="field-label">Description</label>
          <textarea className="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the project…" />
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label className="field-label">Min cost (₹)</label>
            <input className="input" type="number" value={costMin} onChange={e => setCostMin(e.target.value)} placeholder="e.g. 8000" />
          </div>
          <div className="field">
            <label className="field-label">Max cost (₹)</label>
            <input className="input" type="number" value={costMax} onChange={e => setCostMax(e.target.value)} placeholder="e.g. 16000" />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Project duration</label>
          <input className="input" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 1-7 days" />
        </div>

        <div className="field">
          <label className="field-label">Tags (comma-separated)</label>
          <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Logo Design, Branding, Transport" />
        </div>

        <div className="field">
          <label className="field-label">Tools used (comma-separated)</label>
          <input className="input" value={tools} onChange={e => setTools(e.target.value)} placeholder="e.g. Illustrator, Photoshop" />
        </div>
      </div>
    </Modal>
  )
}

export default function Portfolio() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [showModal, setShowModal]   = useState(false)
  const [editItem,  setEditItem]    = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-portfolio'],
    queryFn: () => portfolioApi.getMyPortfolio().then(r => r.data.data.items || []),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id) => portfolioApi.remove(id),
    onSuccess: () => {
      pushToast({ title: 'Item deleted', icon: 'trash' })
      queryClient.invalidateQueries({ queryKey: ['my-portfolio'] })
    },
  })

  const items = data || []

  return (
    <div className="stack-6">
      <div className="row between reveal">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Portfolio</h1>
        </div>
        <button className="btn primary" onClick={() => { setEditItem(null); setShowModal(true) }}>
          <Icon name="plus" /> Add item
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="image" size={22} /></div>
          <h3>No portfolio items yet</h3>
          <p>Add your best work to attract the right clients.</p>
          <button className="btn primary" onClick={() => { setEditItem(null); setShowModal(true) }}>
            <Icon name="plus" /> Add first item
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}
          className="reveal">
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'var(--paper)', border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              }}
            >
              {/* Cover */}
              <div style={{ aspectRatio: '4/3', background: 'var(--paper-tint)', overflow: 'hidden', position: 'relative' }}>
                {item.cover_image_url ? (
                  <img src={item.cover_image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-300)' }}>
                    <Icon name="image" size={28} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-950)', marginBottom: 4 }}>
                  {item.title}
                </div>
                {(item.project_cost_min || item.project_cost_max) && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
                    {item.project_cost_min && item.project_cost_max
                      ? `${rupee(item.project_cost_min)}–${rupee(item.project_cost_max)}`
                      : rupee(item.project_cost_min || item.project_cost_max)
                    }
                    {item.project_duration && ` · ${item.project_duration}`}
                  </div>
                )}
                {item.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {item.tags.slice(0, 3).map(t => (
                      <span key={t} style={{
                        fontSize: 11, padding: '2px 7px',
                        background: 'var(--paper-tint)', border: '1px solid var(--hairline)',
                        borderRadius: 20, color: 'var(--ink-600)',
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{
                padding: '10px 14px', borderTop: '1px solid var(--hairline)',
                display: 'flex', gap: 8,
              }}>
                <button
                  className="btn ghost"
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => { setEditItem(item); setShowModal(true) }}
                >
                  <Icon name="edit" size={12} /> Edit
                </button>
                <button
                  className="btn ghost"
                  style={{ flex: 1, fontSize: 12, color: 'var(--rose)' }}
                  onClick={() => {
                    if (window.confirm('Delete this portfolio item?')) remove(item.id)
                  }}
                >
                  <Icon name="trash" size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PortfolioItemModal
          item={editItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}