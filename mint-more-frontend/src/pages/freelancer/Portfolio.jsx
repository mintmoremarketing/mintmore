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
      maxWidth={600}
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button className="px-5 py-2.5 rounded-xl font-semibold text-ink-600 hover:bg-ink-100 transition-colors" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="px-5 py-2.5 rounded-xl font-semibold bg-ink-950 text-white hover:bg-ink-900 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => isEdit ? updateMutation.mutate() : createMutation.mutate()}
            disabled={isPending || !title || (!isEdit && !coverFile)}
          >
            {isPending ? 'Saving…' : isEdit ? 'Update item' : 'Add to portfolio'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-1">
        {/* Cover image */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">
            Cover image {!isEdit && <span className="text-rose-500">*</span>}
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`h-48 rounded-2xl border-2 border-dashed ${coverPreview ? 'border-transparent' : 'border-ink-200'} bg-ink-50/50 hover:bg-ink-50 flex items-center justify-center cursor-pointer overflow-hidden relative group transition-colors`}
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-ink-400 group-hover:text-ink-600 transition-colors">
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
                  <Icon name="upload" size={20} />
                </div>
                <div className="text-sm font-medium">Click to upload cover image</div>
              </div>
            )}
            {coverPreview && (
              <div className="absolute inset-0 bg-ink-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-semibold">Change image</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Title <span className="text-rose-500">*</span></label>
          <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Transport & Logistics Logo Design" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Description</label>
          <textarea className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all resize-y" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the project…" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink-900">Min cost (₹)</label>
            <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" type="number" value={costMin} onChange={e => setCostMin(e.target.value)} placeholder="e.g. 8000" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink-900">Max cost (₹)</label>
            <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" type="number" value={costMax} onChange={e => setCostMax(e.target.value)} placeholder="e.g. 16000" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Project duration</label>
          <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 1-7 days" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Tags (comma-separated)</label>
          <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Logo Design, Branding, Transport" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink-900">Tools used (comma-separated)</label>
          <input className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all" value={tools} onChange={e => setTools(e.target.value)} placeholder="e.g. Illustrator, Photoshop" />
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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <div className="text-sm font-semibold text-ink-500 mb-1 tracking-wide uppercase">Marketplace</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0 leading-tight">Portfolio</h1>
        </div>
        <button 
          className="px-6 py-3 bg-ink-950 hover:bg-ink-900 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2" 
          onClick={() => { setEditItem(null); setShowModal(true) }}
        >
          <Icon name="plus" size={18} /> Add item
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse bg-ink-100 aspect-square rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-ink-200 border-dashed rounded-3xl flex flex-col items-center justify-center p-16 text-center bg-ink-50/50 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-ink-400 mb-6">
            <Icon name="image" size={32} />
          </div>
          <h3 className="text-xl font-display font-bold text-ink-950 mb-2">No portfolio items yet</h3>
          <p className="text-base text-ink-500 max-w-md mb-8">Add your best work to attract the right clients and showcase your creative skills.</p>
          <button className="px-6 py-3 bg-ink-950 hover:bg-ink-900 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2" onClick={() => { setEditItem(null); setShowModal(true) }}>
            <Icon name="plus" size={18} /> Add first item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          {items.map(item => (
            <div
              key={item.id}
              className="group bg-white border border-ink-200/60 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1"
            >
              {/* Cover */}
              <div className="aspect-[4/3] bg-ink-100 overflow-hidden relative">
                {item.cover_image_url ? (
                  <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-ink-300">
                    <Icon name="image" size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Info */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-lg font-bold text-ink-950 mb-2 line-clamp-2">
                  {item.title}
                </div>
                {(item.project_cost_min || item.project_cost_max) && (
                  <div className="text-sm font-medium text-ink-600 mb-4 flex items-center gap-1.5">
                    <Icon name="rupee" size={14} className="text-ink-400" />
                    {item.project_cost_min && item.project_cost_max
                      ? `${item.project_cost_min}–${item.project_cost_max}`
                      : (item.project_cost_min || item.project_cost_max)
                    }
                    {item.project_duration && <span className="text-ink-400 font-normal">· {item.project_duration}</span>}
                  </div>
                )}
                {item.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    {item.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs font-medium px-2.5 py-1 bg-ink-50 border border-ink-100 rounded-lg text-ink-600">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-ink-100/50 flex items-center gap-3 bg-ink-50/30">
                <button
                  className="flex-1 px-4 py-2 bg-white border border-ink-200 hover:border-ink-300 rounded-xl text-sm font-medium text-ink-700 transition-colors flex items-center justify-center gap-2"
                  onClick={() => { setEditItem(item); setShowModal(true) }}
                >
                  <Icon name="edit" size={14} /> Edit
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-white border border-ink-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-sm font-medium text-ink-700 transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    if (window.confirm('Delete this portfolio item?')) remove(item.id)
                  }}
                >
                  <Icon name="trash" size={14} /> Delete
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