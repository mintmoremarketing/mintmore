import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { jobsApi } from '../../api/jobs'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { rupee } from '../../utils/format'

export default function PostJob() {
	const navigate = useNavigate()
	const { id } = useParams()
	const isEditMode = Boolean(id)
	const pushToast = useUIStore((s) => s.pushToast)
	const [step, setStep] = useState(1)
	const [data, setData] = useState({
		title: '',
		category_id: '',
		description: '',
		pricing_mode: 'budget',
		budget_type: 'fixed',
		budget_amount: 15000,
		deadline: '',
		required_skills: [],
		required_level: 'intermediate',
	})

	const { data: catData } = useQuery({
		queryKey: ['categories'],
		queryFn: () => jobsApi.categories().then((r) => r.data.data),
	})
	const categories = catData?.categories || []

	const { data: existingJob, isLoading: isJobLoading } = useQuery({
		queryKey: ['job', id],
		queryFn: async () => {
			const res = await jobsApi.get(id)
			return res.data?.data?.job ?? res.data?.data ?? null
		},
		enabled: isEditMode,
	})

	useEffect(() => {
		if (!existingJob) return

		setData({
			title: existingJob.title || '',
			category_id: existingJob.category_id || '',
			description: existingJob.description || '',
			pricing_mode: existingJob.pricing_mode || 'budget',
			budget_type: existingJob.budget_type || 'fixed',
			budget_amount: existingJob.budget_amount || 15000,
			deadline: existingJob.deadline ? existingJob.deadline.slice(0, 10) : '',
			required_skills: existingJob.required_skills || [],
			required_level: existingJob.required_level || 'intermediate',
		})
	}, [existingJob])

	const { mutate, isPending } = useMutation({
		mutationFn: async () => {
			if (!isEditMode) {
				return jobsApi.create({ ...data, status: 'open' })
			}

			await jobsApi.update(id, data)
			return jobsApi.publish(id)
		},
		onSuccess: () => {
			pushToast({
				title: isEditMode ? 'Brief updated!' : 'Brief posted!',
				body: 'Matching creatives now - ~6 min',
			})
			navigate(isEditMode ? `/jobs/${id}` : '/jobs')
		},
		onError: (err) => {
			pushToast({
				title: isEditMode ? 'Failed to update' : 'Failed to post',
				body: err.response?.data?.message || 'Try again',
				tone: 'amber',
			})
		},
	})

	function update(k, v) {
		setData((d) => ({ ...d, [k]: v }))
	}

	if (isEditMode && isJobLoading) {
		return (
			<div className="stack-6">
				<div className="card" style={{ padding: 28 }}>
					<div className="skeleton" style={{ width: '45%', height: 18, borderRadius: 6, marginBottom: 18 }} />
					<div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
				</div>
			</div>
		)
	}

	return (
		<div className="stack-6">
			<div className="reveal">
				<button className="btn link sm" onClick={() => navigate('/jobs')} style={{ padding: 0, color: 'var(--ink-500)', fontSize: 12 }}>
					<Icon name="arrowLeft" size={12} /> All jobs
				</button>
				<h1 className="h-display h-1" style={{ margin: '6px 0 0' }}>{isEditMode ? 'Edit brief' : 'Post a brief'}</h1>
				<p className="muted" style={{ marginTop: 6 }}>
					{isEditMode
						? 'Update the brief and restart matching when it looks right.'
						: "We'll match you with 2-4 creatives in around 6 minutes."}
				</p>
			</div>

			<div className="stepper">
				{['Basics', 'Requirements', 'Review'].map((s, i) => (
					<>
						<div key={s} className={`step ${step >= i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
							<span className="step-num">
								{step > i + 1 ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}
							</span>
							<span>{s}</span>
						</div>
						{i < 2 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} style={{ background: step > i + 1 ? 'var(--ink-950)' : 'var(--hairline)' }} />}
					</>
				))}
			</div>

			<div className="card" style={{ padding: 28 }}>
				{step === 1 && (
					<div className="stack" style={{ gap: 18 }}>
						<div className="field">
							<label className="field-label">Brief title</label>
							<input className="input" value={data.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Diwali campaign hero video" />
						</div>
						<div className="field">
							<label className="field-label">Category</label>
							<select className="select" value={data.category_id} onChange={(e) => update('category_id', e.target.value)}>
								<option value="">Select a category</option>
								{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
						</div>
						<div className="field">
							<label className="field-label">Brief description</label>
							<textarea className="textarea" value={data.description} onChange={(e) => update('description', e.target.value)} rows={6} placeholder="Describe what you need, tone, references, audience..." />
						</div>
					</div>
				)}

				{step === 2 && (
  <div className="stack" style={{ gap: 22 }}>
    <div>
      <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Pricing</label>
      <div className="grid-2" style={{ gap: 10 }}>
        {[
          { v: 'budget', icon: 'rupee',    title: 'I have a budget',  sub: 'Set a price; creatives can accept or counter.' },
          { v: 'expert', icon: 'sparkles', title: 'Let them quote',   sub: 'Expert pricing — best for complex briefs.' },
        ].map(p => (
          <button
            key={p.v}
            className={`role-card ${data.pricing_mode === p.v ? 'on' : ''}`}
            onClick={() => {
              update('pricing_mode', p.v)
              // budget_type is always 'fixed' for now — extend later for hourly
              update('budget_type', 'fixed')
            }}
          >
            <Icon name={p.icon} />
            <span className="role-title">{p.title}</span>
            <span className="role-sub">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="field">
      <div className="row between">
        <label className="field-label">Budget</label>
        <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{rupee(data.budget_amount)}</span>
      </div>
      <input
        className="slider"
        type="range"
        min="5000"
        max="200000"
        step="500"
        value={data.budget_amount}
        onChange={e => update('budget_amount', parseInt(e.target.value))}
      />
    </div>

    <div className="grid-2">
      <div className="field">
        <label className="field-label">Deadline</label>
        <input
          className="input"
          type="date"
          value={data.deadline}
          onChange={e => update('deadline', e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-label">Experience level</label>
        <select
          className="select"
          value={data.required_level}
          onChange={e => update('required_level', e.target.value)}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="experienced">Experienced</option>
        </select>
      </div>
    </div>
  </div>
)}

				{step === 3 && (
					<div className="stack" style={{ gap: 18 }}>
						<div>
							<span className="h-eyebrow" style={{ color: 'var(--mint-700)' }}>Ready to post</span>
							<h2 className="h-display h-2" style={{ margin: '6px 0 8px' }}>{data.title}</h2>
						</div>
						<div className="divider" />
						<div className="grid-2" style={{ gap: 18 }}>
							<div>
								<div className="h-eyebrow" style={{ marginBottom: 6 }}>Brief</div>
								<p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-700)', margin: 0 }}>{data.description}</p>
							</div>
							<div>
								<div className="h-eyebrow" style={{ marginBottom: 6 }}>At a glance</div>
								<div className="stack" style={{ gap: 8, fontSize: 13 }}>
									<div className="row between"><span className="muted">Budget</span><span className="mono">{rupee(data.budget_amount)}</span></div>
									<div className="row between"><span className="muted">Level</span><span style={{ textTransform: 'capitalize' }}>{data.required_level}</span></div>
									<div className="row between"><span className="muted">Pricing mode</span><span style={{ textTransform: 'capitalize' }}>{data.pricing_mode}</span></div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="row between">
				<button className="btn ghost" onClick={() => step > 1 ? setStep(step - 1) : navigate('/jobs')}>
					<Icon name="arrowLeft" /> {step > 1 ? 'Back' : 'Cancel'}
				</button>
				<button className="btn primary" onClick={() => step < 3 ? setStep(step + 1) : mutate()} disabled={isPending}>
					{isPending
						? (isEditMode ? 'Saving...' : 'Posting...')
						: step < 3
						? <>Continue <Icon name="arrowRight" /></>
						: <>{isEditMode ? 'Save & restart matching' : 'Post brief'} <Icon name="arrowRight" /></>}
C:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\JobDetail.jsx				</button>
			</div>
		</div>
	)
}
