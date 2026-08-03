import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creativeApi } from '../../api/creative'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusAccent } from '../../components/ui/statusMeta'
import StatusSelect from '../../components/ui/StatusSelect'

const today = () => new Date().toISOString().slice(0, 10)
const monthKey = (date = today()) => String(date || today()).slice(0, 7)

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink-600 uppercase tracking-widest">{label}</span>
      {children}
    </label>
  )
}

const buildTasksCsv = (rows) => {
  const headers = ['Title', 'Client', 'Status', 'Client status', 'Designer', 'Work slot', 'Due date', 'Source', 'Created at']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [
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
    priority: 'important',
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
      setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '', priority: 'important' })
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
        setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '', priority: 'important' })
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
      priority: event.priority || 'important',
    })
  }

  const clearEventForm = () => {
    setEditingEventId(null)
    setEventForm({ title: '', event_date: today(), asset_type: 'social_post', coin_cost: 1, description: '', tags: '', priority: 'important' })
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
          priority: event.priority || 'important',
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
    <div className="flex flex-col gap-8 md:gap-10 p-4 md:p-8 w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-ink-500 tracking-wide uppercase">Operations</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0">Internal creative production</h1>
          <p className="text-ink-600 font-medium">Manage calendar creatives, custom requests, and CREATYV team workload.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 rounded-full border border-ink-200 hover:bg-ink-50 text-ink-700 font-bold text-sm transition-colors flex items-center gap-2" onClick={() => openCsv(tasks)} disabled={!tasks.length}>
            <Icon name="eye" size={16} /> Open CSV
          </button>
          <button className="px-5 py-2.5 rounded-full border border-ink-200 hover:bg-ink-50 text-ink-700 font-bold text-sm transition-colors flex items-center gap-2" onClick={() => downloadCsv(tasks)} disabled={!tasks.length}>
            <Icon name="download" size={16} /> Export CSV
          </button>
          <button className="px-6 py-2.5 rounded-full bg-ink-950 hover:bg-ink-900 text-white font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50" onClick={() => syncSheet.mutate()} disabled={syncSheet.isPending || !tasks.length}>
            <Icon name="refresh" size={16} /> {syncSheet.isPending ? 'Syncing...' : 'Sync sheet'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Tasks', value: tasks.length, icon: 'briefcase' },
          { label: 'Custom review', value: requests.length, icon: 'edit' },
          { label: 'Calendar review', value: selections.filter(s => s.status === 'pending_review').length, icon: 'calendar' },
          { label: 'Designers', value: designers.length, icon: 'user' },
        ].map(stat => (
          <div key={stat.label} className="group relative overflow-hidden bg-ink-950 border border-ink-800 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col justify-between transition-all duration-500 hover:border-ink-700 hover:shadow-2xl hover:shadow-ink-900/20 hover:-translate-y-1">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[64px] opacity-30 transition-opacity duration-700 group-hover:opacity-60 bg-ink-400" />
            <div className="relative z-10 flex items-start justify-between mb-8">
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-ink-400">{stat.label}</div>
              <div className="w-10 h-10 rounded-2xl bg-ink-900 border border-ink-800 text-ink-400 flex items-center justify-center shadow-inner">
                <Icon name={stat.icon} size={18} />
              </div>
            </div>
            <div className="relative z-10 font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-none">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Designer Add */}
      <div className="bg-white border border-ink-200/60 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="max-w-xl">
            <div className="text-xs font-bold tracking-widest uppercase text-ink-400 mb-2">Design team</div>
            <h3 className="text-xl font-display font-bold text-ink-950 mb-2">Add CREATYV designer</h3>
            <p className="text-sm font-medium text-ink-600 leading-relaxed">
              Designers get their own login, see only assigned production tasks, and upload deliverables into client Mintbox folders.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <input className="input flex-1 min-w-[160px]" value={designerForm.full_name} onChange={e => setDesignerForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Designer name" />
            <input className="input flex-1 min-w-[200px]" value={designerForm.email} onChange={e => setDesignerForm(f => ({ ...f, email: e.target.value }))} placeholder="email@CREATYV..." />
            <input className="input flex-1 min-w-[150px]" type="password" value={designerForm.password} onChange={e => setDesignerForm(f => ({ ...f, password: e.target.value }))} placeholder="Temp password" autoComplete="new-password" />
            <button
              className="px-6 py-2.5 bg-ink-950 text-white font-bold rounded-full disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-2"
              disabled={createDesigner.isPending || !designerForm.full_name || !designerForm.email || designerForm.password.length < 8}
              onClick={() => createDesigner.mutate()}
            >
              <Icon name="plus" size={16} /> Add
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

      <div className="mt-4">
        {tab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 bg-white border border-ink-200/60 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="font-bold text-lg text-ink-950">{editingEventId ? 'Edit calendar event' : 'Publish calendar event'}</div>
                {editingEventId && <button className="text-sm font-bold text-ink-500 hover:text-ink-900 transition-colors" onClick={clearEventForm}>Cancel edit</button>}
              </div>
              <div className="flex flex-col gap-5">
                <Field label="Title"><input className="input" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Father's Day creative" /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date"><input className="input" type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} /></Field>

                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Asset type"><input className="input" value={eventForm.asset_type} onChange={e => setEventForm(f => ({ ...f, asset_type: e.target.value }))} placeholder="social_post" /></Field>
                  <Field label="Priority">
                    <select className="input" value={eventForm.priority} onChange={e => setEventForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="important">Important (Priority)</option>
                      <option value="regional">Regional (Optional)</option>
                    </select>
                  </Field>
                </div>
                <Field label="Description"><textarea className="textarea min-h-[100px]" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} /></Field>
                <Field label="Tags"><input className="input" value={eventForm.tags} onChange={e => setEventForm(f => ({ ...f, tags: e.target.value }))} placeholder="festival, offer, local" /></Field>
                <button className="w-full py-3 bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2" disabled={createEvent.isPending} onClick={() => createEvent.mutate()}>
                  <Icon name={editingEventId ? 'check' : 'plus'} size={18} /> {editingEventId ? 'Save changes' : 'Publish event'}
                </button>
              </div>
            </div>
            
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-white border border-mint-200/50 bg-gradient-to-br from-mint-50/50 to-white rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-mint-900 mb-2">
                      <Icon name="sparkles" size={18} className="text-mint-500" />
                      Google + AI suggestions
                    </div>
                    <p className="text-sm font-medium text-mint-700/80">
                      Pull important days for {monthKey(eventForm.event_date)} and add selected events at once.
                    </p>
                  </div>
                  <button className="px-5 py-2.5 bg-mint-100 hover:bg-mint-200 text-mint-800 font-bold text-sm rounded-full transition-colors whitespace-nowrap" disabled={suggestEvents.isPending} onClick={() => suggestEvents.mutate()}>
                    {suggestEvents.isPending ? 'Finding...' : 'Suggest'}
                  </button>
                </div>

                {suggestedEvents.length > 0 && (
                  <div className="mt-6 flex flex-col gap-3 border-t border-mint-100 pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-mint-600 uppercase tracking-wider">{selectedSuggestions.length} selected</span>
                      <button
                        className="px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white font-bold text-xs rounded-full disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        disabled={!selectedSuggestions.length || publishSuggestions.isPending}
                        onClick={() => publishSuggestions.mutate()}
                      >
                        <Icon name="check" size={14} /> Publish selected
                      </button>
                    </div>
                    {suggestedEvents.map((event, index) => {
                      const selected = selectedSuggestions.includes(index)
                      return (
                        <button
                          key={`${event.title}-${event.event_date}-${index}`}
                          type="button"
                          onClick={() => setSelectedSuggestions(prev => selected ? prev.filter(i => i !== index) : [...prev, index])}
                          className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all text-left ${selected ? 'bg-mint-50 border-mint-300' : 'bg-white border-ink-100 hover:border-mint-200'}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <strong className="text-ink-950 font-bold">{event.title}</strong>
                            <span className="px-2.5 py-1 bg-ink-100 text-ink-600 text-[10px] font-bold uppercase tracking-wider rounded-full">{event.source?.replace(/_/g, ' ') || 'suggested'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <DateBadge value={event.event_date} />
                            <select 
                              className="input px-2 py-1 h-auto text-xs bg-white text-ink-900 min-w-[120px]" 
                              value={event.priority || 'important'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const newPriority = e.target.value;
                                setSuggestedEvents(prev => prev.map((ev, i) => i === index ? { ...ev, priority: newPriority } : ev));
                              }}
                            >
                              <option value="important">Important</option>
                              <option value="regional">Regional</option>
                            </select>
                            <span className="text-sm font-medium text-ink-500">{event.description}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {events.map(event => (
                <div key={event.id} className="bg-white border border-ink-200/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <strong className="text-ink-950 font-bold text-lg">{event.title}</strong>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <DateBadge value={event.event_date} />
                      <span className="px-2.5 py-1 bg-ink-50 text-ink-600 text-xs font-bold rounded-md">{event.asset_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">

                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition-colors" onClick={() => startEditEvent(event)}>
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="w-10 h-10 rounded-full flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      disabled={deleteEvent.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove "${event.title}" from the calendar?`)) {
                          deleteEvent.mutate(event.id)
                        }
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="flex flex-col gap-4">
            {requests.length === 0 ? (
              <div className="bg-ink-50/50 border border-ink-100 rounded-3xl p-12 text-center">
                <h3 className="text-ink-500 font-bold text-lg m-0">No custom requests waiting</h3>
              </div>
            ) : requests.map(request => (
              <div key={request.id} className="bg-white border border-ink-200/60 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="text-xs font-bold tracking-widest uppercase text-ink-400 mb-2">{request.client_name}</div>
                    <h3 className="text-xl font-display font-bold text-ink-950 mb-2">{request.title}</h3>
                    <p className="text-sm font-medium text-ink-600">{request.description || 'No extra details.'}</p>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                    <button
                      className="px-6 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-full transition-colors disabled:opacity-50"
                      disabled={rejectRequest.isPending || approveRequest.isPending}
                      onClick={() => {
                        const note = window.prompt('Why are we rejecting this request?', 'Not suitable for this month')
                        if (note !== null) rejectRequest.mutate({ id: request.id, admin_note: note })
                      }}
                    >
                      Reject
                    </button>
                    <button 
                      className="px-6 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-colors flex items-center gap-2 disabled:opacity-50" 
                      disabled={approveRequest.isPending || rejectRequest.isPending} 
                      onClick={() => approveRequest.mutate({ id: request.id, coin_cost: request.coin_cost || 1 })}
                    >
                      <Icon name="check" size={16} /> Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="bg-white border border-ink-200/60 rounded-3xl p-8 text-ink-500 font-medium">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-ink-50/50 border border-ink-100 rounded-3xl p-12 text-center">
                <h3 className="text-ink-500 font-bold text-lg m-0">No tasks yet</h3>
              </div>
            ) : tasks.map(task => (
              <div key={task.id} className="bg-white border border-ink-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative" style={{ '--task-status-color': statusAccent(task.status) }}>
                {/* Accent line on left */}
                <div className="absolute top-0 left-0 w-1.5 h-full opacity-60" style={{ background: 'var(--task-status-color, var(--ink-200))' }} />
                
                <div className="flex flex-col lg:flex-row justify-between gap-8 pl-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2.5 mb-4">
                      <span className="px-2.5 py-1 bg-ink-50 text-ink-600 text-[10px] font-bold uppercase tracking-wider rounded-md">{task.source_type?.replace(/_/g, ' ')}</span>
                      <StatusBadge status={task.status} />
                      <span className="px-2.5 py-1 bg-ink-900 text-white text-xs font-bold rounded-md">{task.client_name}</span>
                      <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md ${task.work_slot ? 'bg-ink-100 text-ink-600' : 'border border-dashed border-rose-300 text-rose-500'}`}>
                        {task.work_slot || 'slot not set'}
                      </span>
                      <DateBadge value={task.due_date} fallback="no due date" />
                    </div>
                    <h3 className="text-lg font-bold text-ink-950 mb-2">{task.title}</h3>
                    <p className="text-sm font-medium text-ink-500 line-clamp-2">{task.description || task.client_status}</p>
                  </div>
                  
                  <div className="w-full lg:w-[480px] shrink-0 bg-ink-50/50 p-4 rounded-2xl border border-ink-100/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select className="input bg-white text-sm" value={task.assigned_to || ''} onChange={e => updateTask.mutate({ id: task.id, payload: { assigned_to: e.target.value || null } })}>
                        <option value="">Assign designer</option>
                        {designers.map(designer => <option key={designer.id} value={designer.id}>{designer.full_name}</option>)}
                      </select>
                      <StatusSelect
                        value={task.status || 'assigned'}
                        onChange={status => updateTask.mutate({ id: task.id, payload: { status } })}
                      />
                      <select className="input bg-white text-sm" value={task.work_slot || ''} onChange={e => updateTask.mutate({ id: task.id, payload: { work_slot: e.target.value || null } })}>
                        <option value="">Set work slot</option>
                        {workSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                      </select>
                      <input
                        className="input bg-white text-sm"
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
          <div className="flex flex-col gap-4">
            {selections.length === 0 ? (
              <div className="bg-ink-50/50 border border-ink-100 rounded-3xl p-12 text-center">
                <h3 className="text-ink-500 font-bold text-lg m-0">No selections yet</h3>
              </div>
            ) : selections.map(selection => (
              <div key={selection.id} className="bg-white border border-ink-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <strong className="text-lg font-bold text-ink-950 block mb-3">{selection.title}</strong>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-ink-900 text-white text-xs font-bold rounded-md">{selection.client_name}</span>
                      <DateBadge value={selection.event_date} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {selection.status === 'delivered'
                      ? <StatusBadge status="delivered" />
                      : selection.status === 'in_production'
                        ? <StatusBadge status="in_progress">In production</StatusBadge>
                        : selection.status === 'revision'
                          ? <StatusBadge status="revision" />
                          : <span className="px-3 py-1 bg-ink-100 text-ink-600 text-xs font-bold uppercase tracking-wider rounded-md">{selection.status?.replace(/_/g, ' ')}</span>}
                    
                    {selection.status === 'pending_review' && (
                      <>
                        <button
                          className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm rounded-full transition-colors disabled:opacity-50"
                          disabled={rejectSelection.isPending}
                          onClick={() => rejectSelection.mutate({ id: selection.id })}
                        >
                          Reject
                        </button>
                        <button
                          className="px-5 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-bold text-sm rounded-full transition-colors flex items-center gap-2 disabled:opacity-50"
                          disabled={approveSelection.isPending}
                          onClick={() => approveSelection.mutate({ id: selection.id, coin_cost: selection.coin_cost || 1 })}
                        >
                          <Icon name="check" size={16} /> Approve
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
    </div>
  )
}
