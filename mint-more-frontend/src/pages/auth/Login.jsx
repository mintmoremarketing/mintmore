import { useState, useEffect } from 'react' // --- RECENTLY CHANGED PART --- Added useEffect
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'

// --- RECENTLY CHANGED PART ---
// Added the useIsMobile hook for responsive layout
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
// -----------------------------

export default function Login() {
	const navigate = useNavigate()
	const setAuth = useAuthStore((s) => s.setAuth)
	const isMobile = useIsMobile() // --- RECENTLY CHANGED PART --- Call the hook

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPw, setShowPw] = useState(false)
	const [error, setError] = useState('')

	const { mutate, isPending } = useMutation({
		mutationFn: () => authApi.login(email, password),
		onSuccess: ({ data }) => {
			// --- RECENTLY CHANGED PART ---
			// Restored accessToken and refreshToken to fix the routing loop!
			setAuth(data.data.user, data.data.accessToken, data.data.refreshToken)
			// -----------------------------
			const role = data.data.user.role
			navigate(role === 'admin' ? '/admin' : '/dashboard')
		},
		onError: (err) => {
			setError(err.response?.data?.message || 'Invalid email or password')
		},
	})

	function submit(e) {
		e.preventDefault()
		setError('')
		mutate()
	}

	return (
		// --- RECENTLY CHANGED PART ---
		// Dynamically append 'mobile' class
		<div className={`auth-shell${isMobile ? ' mobile' : ''}`}>
		{/* ----------------------------- */}
			<aside className="auth-aside">
				<div>
					<div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
						CREAT<span style={{ color: 'var(--mint-400)', fontWeight: 650 }}>YV</span>
					</div>
					<div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
						Creative services for Indian businesses
					</div>
				</div>
				<div>
					<div className="brand-cubes">
						{Array(9).fill(0).map((_, i) => (
							<div key={i} className={`cube ${[1, 3, 5, 7].includes(i) ? 'fill-mint' : i === 4 ? 'fill-white' : ''}`} />
						))}
					</div>
					<div
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 32,
							fontWeight: 500,
							lineHeight: 1.15,
							letterSpacing: '-0.02em',
							color: 'white',
							maxWidth: 420,
						}}
					>
						Post a brief.{' '}
						<span style={{ color: 'var(--mint-400)', fontStyle: 'italic' }}>We find the right creative.</span>
					</div>
					<p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5, lineHeight: 1.6, maxWidth: 380, marginTop: 14 }}>
						Matched video, photography, social and branding talent - vetted, with escrow protection.
					</p>
				</div>
				<div style={{ display: 'flex', gap: 14, alignItems: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11.5 }}>
					<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<Icon name="shield" size={12} /> Escrow-secured
					</span>
					<span>·</span>
					<span>2,400+ verified creatives</span>
				</div>
			</aside>

			<div className="auth-form-wrap">
				<form className="auth-form" onSubmit={submit}>

					{/* --- RECENTLY CHANGED PART --- */}
					{/* Expanded mobile-only branding */}
					{isMobile && (
						<div style={{ textAlign: 'center', marginBottom: 32 }}>
							<div style={{
								fontFamily: 'var(--font-display)', fontSize: 26,
								fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8
							}}>
								CREAT<span style={{ color: 'var(--mint-500)', fontWeight: 650 }}>YV</span>
							</div>
							<p style={{ 
								color: 'var(--ink-500)', fontSize: 13.5, lineHeight: 1.5, 
								maxWidth: 280, margin: '0 auto' 
							}}>
								Creative services for Indian businesses. We find the right talent for you.
							</p>
							<div style={{
								display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center',
								color: 'var(--ink-400)', fontSize: 12, marginTop: 16,
								padding: '10px', background: 'var(--ink-50)', borderRadius: '8px'
							}}>
								<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
									 200+ brands
								</span>
								<span>·</span>
								<span>2,400+ creatives</span>
							</div>
						</div>
					)}
					{/* ----------------------------- */}

					<div className="h-eyebrow" style={{ marginBottom: 6 }}>Welcome back</div>
					<h1 className="h-display h-1" style={{ marginTop: 0, marginBottom: 6 }}>Sign in to your studio</h1>
					<p className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>Pick up where you left off.</p>

					{error && (
						<div className="error-banner" style={{ marginBottom: 16 }}>
							<Icon name="shield" size={14} />
							<span>{error}</span>
						</div>
					)}

					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label">Email</label>
						<input
							className="input"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							placeholder="you@example.com"
							required
						/>
					</div>

					<div className="field" style={{ marginBottom: 6 }}>
						<div className="row between">
							<label className="field-label">Password</label>
						</div>
						<div style={{ position: 'relative' }}>
							<input
								className="input"
								type={showPw ? 'text' : 'password'}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								style={{ paddingRight: 38 }}
								required
							/>
							<button
								type="button"
								onClick={() => setShowPw(!showPw)}
								style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 0, color: 'var(--ink-500)', padding: 4 }}
							>
								<Icon name={showPw ? 'eyeOff' : 'eye'} />
							</button>
						</div>
					</div>

					<button type="submit" className="btn primary block lg" style={{ marginTop: 22 }} disabled={isPending}>
						{isPending ? (
							<>
								<span className="typing-dots" style={{ marginLeft: -4 }}>
									<span style={{ background: 'white' }} /><span style={{ background: 'white' }} /><span style={{ background: 'white' }} />
								</span>
								Signing you in
							</>
						) : (
							<>Sign in <Icon name="arrowRight" /></>
						)}
					</button>

					<div style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
						New here?{' '}
						<Link to="/register" style={{ color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline' }}>
							Create an account
						</Link>
					</div>
				</form>
			</div>
		</div>
	)
}
