import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import Icon from '../../components/ui/Icon'

export default function Register() {
	const navigate = useNavigate()
	const [role, setRole] = useState('client')
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [agreed, setAgreed] = useState(false)
	const [error, setError] = useState('')

	const { mutate, isPending } = useMutation({
		mutationFn: () => authApi.register({ full_name: fullName, email, password, role }),
		onSuccess: () => {
			navigate('/pending-approval')
		},
		onError: (err) => {
			setError(err.response?.data?.message || 'Registration failed')
		},
	})

	function submit(e) {
		e.preventDefault()
		if (!agreed) {
			setError('Please accept the terms')
			return
		}
		setError('')
		mutate()
	}

	return (
		<div className="auth-shell">
			<aside className="auth-aside">
				<div>
					<div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
						Mint<span style={{ color: 'var(--mint-400)', fontStyle: 'italic', fontWeight: 500 }}>more</span>
					</div>
				</div>
				<div>
					<div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'white' }}>
						Join 2,400+{' '}
						<span style={{ color: 'var(--mint-400)', fontStyle: 'italic' }}>Indian creatives.</span>
					</div>
				</div>
				<div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5 }}>
					Free to join · Pay only when you commission work
				</div>
			</aside>

			<div className="auth-form-wrap">
				<form className="auth-form" onSubmit={submit}>
					<div className="h-eyebrow" style={{ marginBottom: 6 }}>Get started</div>
					<h1 className="h-display h-1" style={{ marginTop: 0, marginBottom: 6 }}>Create your account</h1>
					<p className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>Free to join. Pay only when you commission work.</p>

					{error && (
						<div className="error-banner" style={{ marginBottom: 16 }}>
							<Icon name="shield" size={14} />
							<span>{error}</span>
						</div>
					)}

					<div className="grid-2" style={{ marginBottom: 12 }}>
						<button type="button" className={`role-card ${role === 'client' ? 'on' : ''}`} onClick={() => setRole('client')}>
							<Icon name="shoppingBag" />
							<span className="role-title">I'm a client</span>
							<span className="role-sub">Hire creatives, run campaigns</span>
						</button>
						<button type="button" className={`role-card ${role === 'freelancer' ? 'on' : ''}`} onClick={() => setRole('freelancer')}>
							<Icon name="zap" />
							<span className="role-title">I'm a freelancer</span>
							<span className="role-sub">Get matched, get paid</span>
						</button>
					</div>

					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label">Full name</label>
						<input className="input" placeholder="Priya Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
					</div>

					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label">Email</label>
						<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
					</div>

					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label">Password</label>
						<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
					</div>

					<div className="row" style={{ gap: 8, alignItems: 'flex-start', marginTop: 8, marginBottom: 8 }}>
						<button
							type="button"
							className={`check ${agreed ? 'on' : ''}`}
							onClick={() => setAgreed(!agreed)}
						>
							{agreed && <Icon name="check" size={10} strokeWidth={3} />}
						</button>
						<span style={{ fontSize: 12, color: 'var(--ink-600)', lineHeight: 1.5 }}>
							I agree to the <a href="#" style={{ color: 'var(--ink-900)', textDecoration: 'underline' }}>Terms</a> and{' '}
							<a href="#" style={{ color: 'var(--ink-900)', textDecoration: 'underline' }}>Privacy Policy</a>.
						</span>
					</div>

					<button type="submit" className="btn primary block lg" style={{ marginTop: 16 }} disabled={isPending}>
						{isPending ? 'Creating account...' : <>Create account <Icon name="arrowRight" /></>}
					</button>

					<div style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
						Already with us?{' '}
						<Link to="/login" style={{ color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline' }}>
							Sign in
						</Link>
					</div>
				</form>
			</div>
		</div>
	)
}
