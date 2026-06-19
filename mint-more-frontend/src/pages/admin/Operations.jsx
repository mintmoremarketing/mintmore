import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creativeApi } from '../../api/creative'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge, statusAccent } from '../../components/ui/StatusBadge'
import StatusSelect from '../../components/ui/StatusSelect'

const today = () => new Date().toISOString().slice(0, 10)
const monthKey = (date = today()) => String(date || today()).slice(0, 7)

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)' }}>{label}</span>
      {children}
    </label>
  )
}

const downloadCsv = (rows) => {
  const headers = ['Title', 'Client', 'Status', 'Client status', 'Designer', 'Work slot', 'Due date', 'Source', 'Created at']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.join(','),
    ...rows.map(task => [
      task.title,
      task.client_name,
      task.status,
      task.client_status,
      task.assigned_to_name,
      task.work_slot,
      task.due_date,
      task.source_type,
      task.created_at,
    ].map(escape).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CREATYV-production-tasks-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminOperations() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [tab, setTab] = useState('tasks')
  const [eventForm, setEventForm] = useState({
    title: '',
    event_date: today(),
    asset_type: 'social_post',
    coin_cost: 1,
    description: '',
    tags: '',
  })
  const [editingEventId, setEditingEventId] = useState(null)
  const [suggestedEvents, setSuggestedEvents] = useState([])
  const [selectedSuggestions, setSelectedSuggestions] = useState([])
  const [designerForm, setDesignerForm] = useState({ full_name: '', email: '', password: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-creative-overview'],
    queryFn: () => creativeApi.adminOverview().then(r => r.data.data),
  })

  const createEvent = useMutation({
    mutationFn: () => {
      const payload = {
        ...eventForm,
        coin_cost: Number(eventForm.coin_cost || 1),
        tags: eventForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        status: 'published',
      }
      return editingEventId
        ? creativeApi.updateEvent(editingEventId, payload)
        : creativeApi.createEvent(payload)
    },
    onSuccess: (res) => {
      const duplicate = Boolean(res.data?.data?.event?.duplicate)
      pushToast({
        title: duplicate ? 'Duplicate skipped' : editingEventId ? 'Calendar event updated' : 'Calendar event published',
        body: duplicate ? 'An event with this name already exists for this month.' : undefined,
      })
      setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '' })
      setEditingEventId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const deleteEvent = useMutation({
    mutationFn: eventId => creativeApi.deleteEvent(eventId),
    onSuccess: () => {
      pushToast({ title: 'Calendar event removed' })
      if (editingEventId) {
        setEditingEventId(null)
        setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '' })
      }
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Could not remove event', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const startEditEvent = (event) => {
    setEditingEventId(event.id)
    setEventForm({
      title: event.title || '',
      event_date: String(event.event_date || today()).slice(0, 10),
      asset_type: event.asset_type || 'social_post',
      coin_cost: Number(event.coin_cost || 1),
      description: event.description || '',
      tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
    })
  }

  const clearEventForm = () => {
    setEditingEventId(null)
    setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '' })
  }

  const suggestEvents = useMutation({
    mutationFn: () => creativeApi.eventSuggestions({ month: monthKey(eventForm.event_date) }),
    onSuccess: (res) => {
      const suggestions = res.data?.data?.suggestions || []
      setSuggestedEvents(suggestions)
      setSelectedSuggestions(suggestions.map((_, index) => index))
      pushToast({
        title: suggestions.length ? 'Suggestions ready' : 'No new suggestions found',
        body: suggestions.length ? 'Review and publish the ones you want.' : 'This month may already be covered.',
      })
    },
    onError: err => pushToast({ title: 'Could not fetch suggestions', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const publishSuggestions = useMutation({
    mutationFn: async () => {
      const picked = suggestedEvents.filter((_, index) => selectedSuggestions.includes(index))
      const result = { created: 0, skipped: 0 }
      for (const event of picked) {
        const res = await creativeApi.createEvent({
          title: event.title,
          event_date: event.event_date,
          asset_type: event.asset_type || 'social_post',
          coin_cost: Number(event.coin_cost || 1),
          description: event.description || '',
          tags: event.tags || [],
          status: 'published',
          metadata: { source: event.source || 'suggested' },
        })
        if (res.data?.data?.event?.duplicate) result.skipped += 1
        else result.created += 1
      }
      return result
    },
    onSuccess: ({ created, skipped }) => {
      pushToast({
        title: `${created} calendar event${created === 1 ? '' : 's'} published`,
        body: skipped ? `${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.` : undefined,
      })
      setSuggestedEvents([])
      setSelectedSuggestions([])
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Could not publish suggestions', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const approveRequest = useMutation({
    mutationFn: ({ id, coin_cost }) => creativeApi.approveRequest(id, { coin_cost }),
    onSuccess: (res) => {
      pushToast({
        title: res.data?.data?.insufficient_balance ? 'Still needs review' : 'Request approved',
        body: res.data?.message,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const rejectRequest = useMutation({
    mutationFn: ({ id, admin_note }) => creativeApi.rejectRequest(id, { admin_note }),
    onSuccess: () => {
      pushToast({ title: 'Request rejected' })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const approveSelection = useMutation({
    mutationFn: ({ id, coin_cost }) => creativeApi.approveSelection(id, { coin_cost }),
    onSuccess: (res) => {
      pushToast({
        title: res.data?.data?.insufficient_balance ? 'Still needs review' : 'Selection approved',
        body: res.data?.message,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const rejectSelection = useMutation({
    mutationFn: ({ id }) => creativeApi.rejectSelection(id),
    onSuccess: () => {
      pushToast({ title: 'Selection rejected' })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, payload }) => creativeApi.updateTask(id, payload),
    onSuccess: () => {
      pushToast({ title: 'Task updated' })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const createDesigner = useMutation({
    mutationFn: () => api.post('/admin/users/designer', designerForm),
    onSuccess: () => {
      pushToast({ title: 'Designer added' })
      setDesignerForm({ full_name: '', email: '', password: '' })
      queryClient.invalidateQueries({ queryKey: ['admin-creative-overview'] })
    },
    onError: err => pushToast({ title: 'Could not add designer', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const syncSheet = useMutation({
    mutationFn: () => creativeApi.syncTaskSheet(),
    onSuccess: (res) => {
      const payload = res.data?.data || {}
      pushToast({
        title: payload.configured ? 'Task sheet synced' : 'Google Sheets not configured',
        body: payload.configured ? `${payload.rows_synced || 0} rows sent.` : 'Add ops_google_sheets webhook settings to enable live sync.',
        tone: payload.configured ? 'default' : 'amber',
      })
    },
    onError: err => pushToast({ title: 'Could not sync sheet', body: err.response?.data?.message || 'Try again', tone: 'amber' }),
  })

  const tasks = data?.tasks || []
  const requests = data?.requests || []
  const selections = data?.selections || []
  const events = data?.events || []
  const designers = data?.designers || []
  const workSlots = ['morning', 'evening', 'night']

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div>
            <div className="h-eyebrow" style={{ marginBottom: 4 }}>Operations</div>
            <h1 className="h-display h-1" style={{ margin: 0 }}>Internal creative production</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Manage calendar creatives, custom requests, and CREATYV team workload.
            </p>
          </div>
          <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => downloadCsv(tasks)} disabled={!tasks.length}>
              <Icon name="download" /> Export CSV
            </button>
            <button className="btn primary" onClick={() => syncSheet.mutate()} disabled={syncSheet.isPending || !tasks.length}>
              <Icon name="refresh" /> {syncSheet.isPending ? 'Syncing...' : 'Sync sheet'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Tasks', value: tasks.length, icon: 'briefcase' },
          { label: 'Custom review', value: requests.length, icon: 'edit' },
          { label: 'Calendar review', value: selections.filter(s => s.status === 'pending_review').length, icon: 'calendar' },
          { label: 'Designers', value: designers.length, icon: 'user' },
        ].map(stat => (
          <div className="card" key={stat.label} style={{ padding: 18 }}>
            <Icon name={stat.icon} size={16} />
            <div className="h-eyebrow" style={{ marginTop: 12 }}>{stat.label}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div>
            <div className="h-eyebrow">Design team</div>
            <h3 style={{ margin: '4px 0 4px' }}>Add CREATYV designer</h3>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Designers get their own login, see only assigned production tasks, and upload deliverables into client Mintbox folders.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 210px 150px auto', gap: 8, alignItems: 'center' }}>
            <input className="input" value={designerForm.full_name} onChange={e => setDesignerForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Designer name" />
            <input className="input" value={designerForm.email} onChange={e => setDesignerForm(f => ({ ...f, email: e.target.value }))} placeholder="email@CREATYV..." />
            <input className="input" type="password" value={designerForm.password} onChange={e => setDesignerForm(f => ({ ...f, password: e.target.value }))} placeholder="Temp password" autoComplete="new-password" />
            <button
              className="btn primary"
              disabled={createDesigner.isPending || !designerForm.full_name || !designerForm.email || designerForm.password.length < 8}
              onClick={() => createDesigner.mutate()}
            >
              <Icon name="plus" /> Add
            </button>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'tasks', label: 'Tasks', count: tasks.length },
          { value: 'requests', label: 'Custom requests', count: requests.length },
          { value: 'calendar', label: 'Calendar', count: events.length },
          { value: 'selections', label: 'Selections', count: selections.length },
        ]}
      />

      {tab === 'calendar' && (
        <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="h-eyebrow">{editingEventId ? 'Edit calendar event' : 'Publish calendar event'}</div>
              {editingEventId && <button className="btn ghost sm" onClick={clearEventForm}>Cancel edit</button>}
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <Field label="Title"><input className="input" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Father's Day creative" /></Field>
              <div className="grid-2" style={{ gap: 10 }}>
                <Field label="Date"><input className="input" type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} /></Field>
                <Field label="MintCoins"><input className="input" type="number" min="0" value={eventForm.coin_cost} onChange={e => setEventForm(f => ({ ...f, coin_cost: e.target.value }))} /></Field>
              </div>
              <Field label="Asset type"><input className="input" value={eventForm.asset_type} onChange={e => setEventForm(f => ({ ...f, asset_type: e.target.value }))} placeholder="social_post" /></Field>
              <Field label="Description"><textarea className="textarea" rows={4} value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} /></Field>
              <Field label="Tags"><input className="input" value={eventForm.tags} onChange={e => setEventForm(f => ({ ...f, tags: e.target.value }))} placeholder="festival, offer, local" /></Field>
              <button className="btn primary" disabled={createEvent.isPending} onClick={() => createEvent.mutate()}>
                <Icon name={editingEventId ? 'check' : 'plus'} /> {editingEventId ? 'Save changes' : 'Publish event'}
              </button>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="row between" style={{ gap: 12 }}>
                <div>
                  <div className="h-eyebrow">Google + AI suggestions</div>
                  <p className="muted" style={{ margin: '5px 0 0', fontSize: 12 }}>
                    Pull important days for {monthKey(eventForm.event_date)} and add selected events at once.
                  </p>
                </div>
                <button className="btn" disabled={suggestEvents.isPending} onClick={() => suggestEvents.mutate()}>
                  <Icon name="sparkles" /> {suggestEvents.isPending ? 'Finding...' : 'Suggest'}
                </button>
              </div>
              {suggestedEvents.length > 0 && (
                <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                  <div className="row between">
                    <span className="muted" style={{ fontSize: 12 }}>{selectedSuggestions.length} selected</span>
                    <button
                      className="btn primary small"
                      disabled={!selectedSuggestions.length || publishSuggestions.isPending}
                      onClick={() => publishSuggestions.mutate()}
                    >
                      <Icon name="check" /> Publish selected
                    </button>
                  </div>
                  {suggestedEvents.map((event, index) => {
                    const selected = selectedSuggestions.includes(index)
                    return (
                      <button
                        key={`${event.title}-${event.event_date}-${index}`}
                        type="button"
                        onClick={() => setSelectedSuggestions(prev => selected ? prev.filter(i => i !== index) : [...prev, index])}
                        style={{
                          textAlign: 'left',
                          padding: 12,
                          borderRadius: 10,
                          border: `1px solid ${selected ? 'var(--mint-300)' : 'var(--hairline)'}`,
                          background: selected ? 'var(--mint-50)' : 'var(--paper)',
                          cursor: 'pointer',
                        }}
                      >
                        <div className="row between" style={{ gap: 8 }}>
                          <strong>{event.title}</strong>
                          <span className="badge neutral">{event.source?.replace(/_/g, ' ') || 'suggested'}</span>
                        </div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                          <DateBadge value={event.event_date} />
                          <span className="muted" style={{ fontSize: 12 }}>{event.description}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {events.map(event => (
              <div key={event.id} className="card" style={{ padding: 14 }}>
                <div className="row between">
                  <div>
                    <strong>{event.title}</strong>
                    <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                      <DateBadge value={event.event_date} />
                      <span className="tag-slate">{event.asset_type}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge mint">{Number(event.coin_cost || 0)} coin</span>
                    <button className="btn ghost sm" onClick={() => startEditEvent(event)}>
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button
                      className="btn ghost sm"
                      disabled={deleteEvent.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove "${event.title}" from the calendar?`)) {
                          deleteEvent.mutate(event.id)
                        }
                      }}
                      style={{ color: '#be123c' }}
                    >
                      <Icon name="trash" size={12} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="stack" style={{ gap: 10 }}>
          {requests.length === 0 ? <div className="empty"><h3>No custom requests waiting</h3></div> : requests.map(request => (
            <div key={request.id} className="card" style={{ padding: 18 }}>
              <div className="row between" style={{ gap: 12 }}>
                <div>
                  <div className="h-eyebrow">{request.client_name}</div>
                  <h3 style={{ margin: '4px 0' }}>{request.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{request.description || 'No extra details.'}</p>
                </div>
                <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className="btn ghost"
                    disabled={rejectRequest.isPending || approveRequest.isPending}
                    onClick={() => {
                      const note = window.prompt('Why are we rejecting this request?', 'Not suitable for this month')
                      if (note !== null) rejectRequest.mutate({ id: request.id, admin_note: note })
                    }}
                    style={{ color: '#be123c' }}
                  >
                    Reject
                  </button>
                  <button className="btn primary" disabled={approveRequest.isPending || rejectRequest.isPending} onClick={() => approveRequest.mutate({ id: request.id, coin_cost: request.coin_cost || 1 })}>
                    <Icon name="check" /> Approve {Number(request.coin_cost || 1)} coin
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="stack" style={{ gap: 10 }}>
          {isLoading ? <div className="card" style={{ padding: 20 }}>Loading tasks...</div> : tasks.length === 0 ? <div className="empty"><h3>No tasks yet</h3></div> : tasks.map(task => (
            <div key={task.id} className="card task-card-shell" style={{ padding: 18, '--task-status-color': statusAccent(task.status) }}>
              <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                    <span className="tag-slate">{task.source_type?.replace(/_/g, ' ')}</span>
                    <StatusBadge status={task.status} />
                    <span className="task-client-line"><strong>{task.client_name}</strong></span>
                    <span className={task.work_slot ? 'badge neutral' : 'slot-missing'}>{task.work_slot || 'slot not set'}</span>
                    <DateBadge value={task.due_date} fallback="no due date" />
                  </div>
                  <h3 style={{ margin: '0 0 6px' }}>{task.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{task.description || task.client_status}</p>
                </div>
                <div style={{ minWidth: 480 }}>
                  <div className="grid-2" style={{ gap: 8 }}>
                    <select className="input" value={task.assigned_to || ''} onChange={e => updateTask.mutate({ id: task.id, payload: { assigned_to: e.target.value || null } })}>
                      <option value="">Assign designer</option>
                      {designers.map(designer => <option key={designer.id} value={designer.id}>{designer.full_name}</option>)}
                    </select>
                    <StatusSelect
                      value={task.status || 'assigned'}
                      onChange={status => updateTask.mutate({ id: task.id, payload: { status } })}
                    />
                    <select className="input" value={task.work_slot || ''} onChange={e => updateTask.mutate({ id: task.id, payload: { work_slot: e.target.value || null } })}>
                      <option value="">Set work slot</option>
                      {workSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                    <input
                      className="input"
                      type="date"
                      value={task.due_date ? String(task.due_date).slice(0, 10) : ''}
                      onChange={e => updateTask.mutate({ id: task.id, payload: { due_date: e.target.value || null } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'selections' && (
        <div className="stack" style={{ gap: 10 }}>
          {selections.map(selection => (
            <div key={selection.id} className="card" style={{ padding: 16 }}>
              <div className="row between">
                <div>
                  <strong>{selection.title}</strong>
                  <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
                    <span className="task-client-line"><strong>{selection.client_name}</strong></span>
                    <DateBadge value={selection.event_date} />
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {selection.status === 'delivered'
                    ? <StatusBadge status="delivered" />
                    : selection.status === 'in_production'
                      ? <StatusBadge status="in_progress">In production</StatusBadge>
                      : selection.status === 'revision'
                        ? <StatusBadge status="revision" />
                        : <span className="badge neutral">{selection.status?.replace(/_/g, ' ')}</span>}
                  {selection.status === 'pending_review' && (
                    <>
                      <button
                        className="btn small"
                        disabled={rejectSelection.isPending}
                        onClick={() => rejectSelection.mutate({ id: selection.id })}
                      >
                        Reject
                      </button>
                      <button
                        className="btn primary small"
                        disabled={approveSelection.isPending}
                        onClick={() => approveSelection.mutate({ id: selection.id, coin_cost: selection.coin_cost || 1 })}
                      >
                        <Icon name="check" /> Approve {Number(selection.coin_cost || 1)} coin
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
