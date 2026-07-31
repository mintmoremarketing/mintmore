import { useOnboardingContext } from './useOnboardingContext'

export default function ApprovalRulesPage() {
  const { form, updateField } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Configure approval policy</h1>
        <p className="muted" style={{ marginTop: 8 }}>Define the balance of control vs autonomy for Social Autopilot.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { id: 'every_post', name: 'Approve Every Post', desc: 'No post goes live without your explicit approval via WhatsApp or Dashboard.' },
          { id: 'autopilot', name: 'Full Autopilot', desc: 'General educational posts publish automatically. Festival greetings and promo offers demand approvals.' },
          { id: 'weekly_batch', name: 'Weekly Batch Review', desc: 'Recieve one notification on Mondays to review and approve all posts for the week.' },
        ].map(policy => (
          <label
            key={policy.id}
            style={{
              display: 'flex',
              gap: 12,
              padding: 16,
              border: '1px solid var(--hairline)',
              borderRadius: 14,
              cursor: 'pointer',
              background: form.approval_policy === policy.id ? 'var(--mint-50)' : 'transparent',
              borderColor: form.approval_policy === policy.id ? 'var(--mint-400)' : 'var(--hairline-strong)',
              transition: '.12s',
            }}
          >
            <input
              type="radio"
              name="approval_policy"
              checked={form.approval_policy === policy.id}
              onChange={() => updateField('approval_policy', policy.id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>{policy.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>{policy.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
