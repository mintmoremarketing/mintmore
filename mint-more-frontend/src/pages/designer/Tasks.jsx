import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { creativeApi } from '../../api/creative'
import Icon from '../../components/ui/Icon'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusAccent } from '../../components/ui/statusMeta'
import StatusSelect from '../../components/ui/StatusSelect'
import { useUIStore } from '../../store/ui'

const statusOptions = ['assigned', 'in_progress', 'delivered', 'revision', 'blocked']

const sourceLabel = (task) => task.source_type === 'calendar_event' ? 'Calendar creative' : 'Custom request'
const companyLabel = (task) => task.client_business_name || task.client_name || 'Client'
const brandLabel = (brand) => brand?.business_name || brand?.full_name || brand?.email || 'Brand'
const buildTasksCsv = (rows) => {
  const headers = ['Title', 'Client', 'Status', 'Client status', 'Work slot', 'Due date', 'Source', 'Brief', 'Created at']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [
    headers.join(','),
    ...rows.map(task => [
      task.title,
      companyLabel(task),
      task.status,
      task.client_status,
      task.work_slot,
      task.due_date,
      sourceLabel(task),
      task.description,
      task.created_at,
    ].map(escape).join(',')),
  ].join('\n')
}

const openCsv = (rows) => {
  const blob = new Blob([buildTasksCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const downloadCsv = (rows) => {
  const blob = new Blob([buildTasksCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CREATYV-my-tasks-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function TaskCard({ task, onStatus }) {
  const navigate = useNavigate()
  const slotMissing = !task.work_slot
  const clientDetail = [
    task.client_business_type,
    task.client_name && task.client_name !== companyLabel(task) ? task.client_name : null,
  ].filter(Boolean).join(' - ')

  return (
    <div className="designer-task-card task-card-shell" style={{ '--task-status-color': statusAccent(task.status) }}>
      <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row wrap designer-task-meta">
            <StatusBadge status={task.status} />
            <span className={slotMissing ? 'slot-missing' : 'badge neutral'}>{slotMissing ? 'Needs slot from ops' : `${task.work_slot} slot`}</span>
            <DateBadge value={task.due_date}>Due {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'}</DateBadge>
            <span className="tag-slate">{sourceLabel(task)}</span>
          </div>

          <div className="designer-client-block">
            <div className="designer-client-avatar">{companyLabel(task).slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="h-eyebrow">For</div>
              <strong>{companyLabel(task)}</strong>
              {clientDetail && <span>{clientDetail}</span>}
            </div>
          </div>

          <h3 style={{ margin: '14px 0 6px' }}>{task.title}</h3>
          <p className="designer-task-brief">{task.description || task.client_status || 'No brief details added yet.'}</p>
          {task.internal_notes && <p className="designer-task-note">Ops note: {task.internal_notes}</p>}
        </div>

        <div className="stack designer-task-actions">
          <StatusSelect
            value={task.status}
            options={statusOptions}
            onChange={status => onStatus(task.id, status)}
            disabled={task.status === 'completed'}
          />
          <button className="btn ghost" onClick={() => task.onBrandContext?.()}>
            <Icon name="layers" size={13} /> Brand context
          </button>
          <button className="btn primary" onClick={() => navigate(`/mintbox/jobs/${task.job_id}`)}>
            <Icon name="upload" size={13} /> Open Mintbox
          </button>
          <button className="btn ghost" onClick={() => navigate('/chat')}>
            <Icon name="chat" size={13} /> Messages
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DesignerTasks() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [brandTask, setBrandTask] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['designer-tasks'],
    queryFn: () => creativeApi.designerTasks().then(res => res.data.data),
    refetchInterval: 30_000,
  })
  const tasks = data?.tasks || []
  const active = tasks.filter(task => !['delivered', 'completed'].includes(task.status))
  const delivered = tasks.filter(task => ['delivered', 'completed'].includes(task.status))

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }) => creativeApi.updateDesignerTask(taskId, { status }),
    onSuccess: () => {
      pushToast({ title: 'Task updated' })
      queryClient.invalidateQueries({ queryKey: ['designer-tasks'] })
    },
    onError: err => pushToast({ title: 'Could not update task', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const onStatus = (taskId, status) => updateStatus.mutate({ taskId, status })

  const brandContextQuery = useQuery({
    queryKey: ['designer-brand-context', brandTask?.client_id || brandTask?.user_id || brandTask?.client?.id],
    queryFn: () => creativeApi.brandContext(brandTask?.client_id || brandTask?.user_id || brandTask?.client?.id).then((res) => res.data.data),
    enabled: Boolean(brandTask?.client_id || brandTask?.user_id || brandTask?.client?.id),
  })

  const brandContext = brandContextQuery.data || {}
  const brandProfile = brandContext.profile || {}
  const brandAssets = brandProfile.brand_assets || {}
  const brandLibrary = brandContext.brand_library || {}
  const googleBusiness = brandProfile.google_business || {}
  const postingPreferences = brandProfile.posting_preferences || {}

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div>
            <div className="h-eyebrow">CREATYV design team</div>
            <h1 className="h-display h-1" style={{ margin: '4px 0 0' }}>My production tasks</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              See what needs to be made, update progress, and upload finished work into each client Mintbox.
            </p>
          </div>
          <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => openCsv(tasks)} disabled={!tasks.length}>
              <Icon name="eye" /> Open CSV
            </button>
            <button className="btn ghost" onClick={() => downloadCsv(tasks)} disabled={!tasks.length}>
              <Icon name="download" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="designer-task-stats">
        {[
          ['Assigned', tasks.filter(t => t.status === 'assigned').length],
          ['In progress', tasks.filter(t => t.status === 'in_progress').length],
          ['Needs slot', tasks.filter(t => !t.work_slot && !['delivered', 'completed'].includes(t.status)).length],
          ['Delivered', delivered.length],
        ].map(([label, value]) => (
          <div key={label} className="card" style={{ padding: 18 }}>
            <div className="h-eyebrow">{label}</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 20 }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="briefcase" size={20} /></div>
          <h3>No assigned work yet</h3>
          <p>When ops assigns a creative task to you, it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="stack" style={{ gap: 10 }}>
            <div className="h-eyebrow">Active queue</div>
            {active.length ? active.map(task => <TaskCard key={task.id} task={{ ...task, onBrandContext: () => setBrandTask(task) }} onStatus={onStatus} />) : <div className="card" style={{ padding: 18 }}>No active tasks.</div>}
          </div>
          {delivered.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="h-eyebrow">Delivered</div>
              {delivered.map(task => <TaskCard key={task.id} task={{ ...task, onBrandContext: () => setBrandTask(task) }} onStatus={onStatus} />)}
            </div>
          )}
        </>
      )}

      {brandTask && (
        <div className="modal-backdrop" onClick={() => setBrandTask(null)}>
          <div className="modal-card" style={{ maxWidth: 1100, width: 'min(1100px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ gap: 12 }}>
              <div>
                <div className="h-eyebrow">Brand context</div>
                <h3 style={{ margin: '6px 0 0' }}>{brandLabel(brandProfile) || companyLabel(brandTask)}</h3>
              </div>
              <button className="icon-btn" onClick={() => setBrandTask(null)}><Icon name="x" size={16} /></button>
            </div>

            {brandContextQuery.isLoading ? (
              <div className="card" style={{ padding: 20, marginTop: 16 }}>Loading brand context...</div>
            ) : (
              <div className="stack" style={{ gap: 16, marginTop: 16 }}>
                <div className="grid-2" style={{ gap: 16 }}>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Profile</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{brandProfile.business_name || brandName(brandProfile)}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{brandProfile.business_type || 'Business profile'}</div>
                    <div className="muted" style={{ marginTop: 10 }}>{[brandProfile.address_line1, brandProfile.address_city, brandProfile.address_state, brandProfile.country].filter(Boolean).join(', ') || 'No address saved'}</div>
                  </div>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Google Business</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{googleBusiness.listing_name || 'Not connected yet'}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{googleBusiness.formatted_address || 'No listing details saved'}</div>
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 16 }}>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Brand assets</div>
                    <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                      {(brandAssets.palette || []).slice(0, 6).map((color) => (
                        <div key={color.id || color.hex} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--hairline)' }}>
                          <span style={{ width: 14, height: 14, borderRadius: 999, background: color.hex || '#111' }} />
                          <span className="mono" style={{ fontSize: 12 }}>{color.hex}</span>
                        </div>
                      ))}
                    </div>
                    <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                      {(brandAssets.logos || []).slice(0, 3).map((asset) => <img key={asset.id} src={asset.url} alt={asset.label || 'Logo'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />)}
                      {(brandAssets.references || []).slice(0, 3).map((asset) => <img key={asset.id} src={asset.url} alt={asset.label || 'Reference'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />)}
                      {(brandAssets.photos || []).slice(0, 3).map((asset) => <img key={asset.id} src={asset.url} alt={asset.label || 'Photo'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />)}
                      {!(brandAssets.logos || []).length && !(brandAssets.references || []).length && !(brandAssets.photos || []).length && <div className="muted">No uploaded assets yet.</div>}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Posting preferences</div>
                    <div className="stack" style={{ gap: 8, marginTop: 12, fontSize: 13 }}>
                      {Object.entries(postingPreferences).map(([key, value]) => (
                        <div key={key} className="row between">
                          <span className="muted" style={{ textTransform: 'capitalize' }}>{key.replaceAll('_', ' ')}</span>
                          <strong style={{ textTransform: 'capitalize' }}>{String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div className="h-eyebrow">Brand library</div>
                  <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                    <span className="badge mint">Folders {(brandLibrary.folders || []).length}</span>
                    <span className="badge mint">Files {(brandLibrary.files || []).length}</span>
                  </div>
                  <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                    {(brandLibrary.folders || []).length ? (
                      <div className="grid-2" style={{ gap: 10 }}>
                        {(brandLibrary.folders || []).slice(0, 4).map((folder) => (
                          <div key={folder.id} className="card" style={{ padding: 12 }}>
                            <div style={{ fontWeight: 700 }}>{folder.name}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {folder.description || 'Brand folder'} â€¢ {folder.file_count || 0} file{(folder.file_count || 0) === 1 ? '' : 's'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted">No brand library folders yet.</div>
                    )}
                    {(brandLibrary.files || []).length ? (
                      <div className="grid-2" style={{ gap: 10 }}>
                        {(brandLibrary.files || []).slice(0, 4).map((file) => (
                          <div key={file.id} className="card" style={{ padding: 12 }}>
                            <div style={{ fontWeight: 700 }}>{file.original_name || file.name}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {file.folder_name || 'Brand folder'} â€¢ {file.media_type || 'file'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 16 }}>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Calendar & requests</div>
                    <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                      {(brandContext.calendar || []).slice(0, 4).map((item) => (
                        <div key={item.id} className="card" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{item.category_name || 'Creative event'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 16 }}>
                    <div className="h-eyebrow">Mintbox and posts</div>
                    <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                      {(brandContext.posts?.posts || []).slice(0, 4).map((item) => (
                        <div key={item.id} className="card" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700 }}>{item.title || 'Published post'}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{item.content_type || 'text'} • {item.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
