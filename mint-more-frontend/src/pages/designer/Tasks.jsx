import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { creativeApi } from '../../api/creative'
import Icon from '../../components/ui/Icon'
import { useUIStore } from '../../store/ui'

const statusOptions = ['assigned', 'in_progress', 'delivered', 'revision', 'blocked']

const fmtDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'No due date'

function TaskCard({ task, onStatus }) {
  const navigate = useNavigate()
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row between" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
            <span className="badge mint">{String(task.status || '').replace(/_/g, ' ')}</span>
            <span className="badge neutral">{task.work_slot || 'slot not set'}</span>
            <span className="badge neutral">{fmtDate(task.due_date)}</span>
          </div>
          <h3 style={{ margin: 0 }}>{task.title}</h3>
          <p className="muted" style={{ margin: '6px 0 0' }}>{task.description || task.client_status}</p>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Client: {task.client_name || 'Client'} · {task.source_type?.replace(/_/g, ' ')}
          </div>
        </div>
        <div className="stack" style={{ gap: 8, minWidth: 220 }}>
          <select
            className="input"
            value={task.status}
            onChange={e => onStatus(task.id, e.target.value)}
            disabled={task.status === 'completed'}
          >
            {statusOptions.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
          <button className="btn primary" onClick={() => navigate(`/mintbox/jobs/${task.job_id}`)}>
            <Icon name="upload" size={13} /> Open Mintbox
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
        <div className="h-eyebrow">Mint More design team</div>
        <h1 className="h-display h-1" style={{ margin: '4px 0 0' }}>My production tasks</h1>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          See what needs to be made, update progress, and upload finished work into each client Mintbox.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          ['Assigned', tasks.filter(t => t.status === 'assigned').length],
          ['In progress', tasks.filter(t => t.status === 'in_progress').length],
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
