import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { creativeApi } from '../../api/creative'
import Icon from '../../components/ui/Icon'
import DateBadge from '../../components/ui/DateBadge'
import { StatusBadge, statusAccent } from '../../components/ui/StatusBadge'
import StatusSelect from '../../components/ui/StatusSelect'
import { useUIStore } from '../../store/ui'

const statusOptions = ['assigned', 'in_progress', 'delivered', 'revision', 'blocked']

const sourceLabel = (task) => task.source_type === 'calendar_event' ? 'Calendar creative' : 'Custom request'
const companyLabel = (task) => task.client_business_name || task.client_name || 'Client'

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

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow">CREATYV design team</div>
        <h1 className="h-display h-1" style={{ margin: '4px 0 0' }}>My production tasks</h1>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          See what needs to be made, update progress, and upload finished work into each client Mintbox.
        </p>
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
            {active.length ? active.map(task => <TaskCard key={task.id} task={task} onStatus={onStatus} />) : <div className="card" style={{ padding: 18 }}>No active tasks.</div>}
          </div>
          {delivered.length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="h-eyebrow">Delivered</div>
              {delivered.map(task => <TaskCard key={task.id} task={task} onStatus={onStatus} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
