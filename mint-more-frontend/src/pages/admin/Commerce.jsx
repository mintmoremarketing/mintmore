import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

function SettingEditor({ setting }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [value, setValue] = useState(JSON.stringify(setting.value, null, 2))
  useEffect(() => setValue(JSON.stringify(setting.value, null, 2)), [setting.value])
  const save = useMutation({
    mutationFn: () => commerceApi.updateSetting(setting.key, JSON.parse(value)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commerce-settings'] })
      pushToast({ title: 'Commercial rule saved', icon: 'check' })
    },
    onError: err => pushToast({ title: 'Could not save', body: err.message, tone: 'amber', icon: 'x' }),
  })
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row between" style={{ gap: 12 }}>
        <div>
          <strong>{setting.key}</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{setting.description}</div>
        </div>
        <button className="btn ghost sm" onClick={() => save.mutate()} disabled={save.isPending}><Icon name="check" size={12} /> Save</button>
      </div>
      <textarea className="textarea mono" rows={8} value={value} onChange={e => setValue(e.target.value)} style={{ marginTop: 12, fontSize: 12 }} />
    </div>
  )
}

export default function AdminCommerce() {
  const { data, isLoading } = useQuery({
    queryKey: ['commerce-settings'],
    queryFn: () => commerceApi.adminSettings().then(res => res.data.data),
  })
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow">Admin</div>
        <h1 className="h-display h-1" style={{ margin: '5px 0 0' }}>Commercial controls</h1>
        <p className="muted">Membership, credits, margins, commissions, revisions, passes, and payout rules.</p>
      </div>
      {isLoading ? <div className="muted">Loading controls...</div> : (
        <div className="grid-2" style={{ gap: 12 }}>
          {(data?.settings || []).map(setting => <SettingEditor key={setting.key} setting={setting} />)}
        </div>
      )}
    </div>
  )
}
