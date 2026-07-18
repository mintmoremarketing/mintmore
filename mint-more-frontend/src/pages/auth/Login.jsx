import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

export default function Login() {
	const navigate = useNavigate()
	const setAuth = useAuthStore((s) => s.setAuth)
	const isMobile = useIsMobile()

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPw, setShowPw] = useState(false)
	const [error, setError] = useState('')

	const { mutate, isPending } = useMutation({
		mutationFn: () => authApi.login(email, password),
		onSuccess: ({ data }) => {
			setAuth(data.data.user, data.data.accessToken, data.data.refreshToken)
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
		<div className={`auth-shell${isMobile ? ' mobile' : ''}`}>
			<aside className="auth-aside">
				<Link to="/" className="auth-brand-link" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<img src="/logo-dark.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
					<span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
				</Link>
				<div className="auth-mood-grid flex-1 w-full flex items-center">
					<div className="grid grid-cols-4 grid-rows-5 gap-2 md:gap-3 w-full h-full animate-in fade-in slide-in-from-bottom-8 duration-1000 opacity-90 hover:opacity-100 transition-opacity">
						{/* Row 1 & 2 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-2 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80" alt="Creative Freelancer" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80" alt="Photography" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=400&q=80" alt="UI/UX Design" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=400&q=80" alt="Graphic Design" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>

						{/* Row 3 & 4 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80" alt="Web Development" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80" alt="Filmmaking" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-2 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" alt="Creative Agency" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-2 group">
							<img src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80" alt="Brand Identity" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80" alt="Fashion & Styling" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>

						{/* Row 5 */}
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80" alt="Creative Studio" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80" alt="Digital Art" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
						<div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg col-span-1 row-span-1 group">
							<img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80" alt="Podcasting" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
						</div>
					</div>
				</div>
			</aside>
			<div className="auth-form-wrap overflow-y-auto h-full max-h-screen">
				<form className="auth-form" onSubmit={submit}>

					{isMobile && (
						<div style={{ textAlign: 'center', marginBottom: 32 }}>
							<Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
								<img src="/logo-light.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
								<span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
							</Link>
							<p style={{ 
								color: 'var(--ink-500)', fontSize: 13.5, lineHeight: 1.5, 
								maxWidth: 280, margin: '8px auto 0' 
							}}>
								Creative services for Indian businesses. Plan, request, review, and publish.
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

					<div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Welcome back</div>
					<h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">Sign in to your studio</h1>
					<p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">Pick up where you left off.</p>

					{error && (
						<div className="error-banner" style={{ marginBottom: 16 }}>
							<Icon name="shield" size={14} />
							<span className="2xl:text-lg">{error}</span>
						</div>
					)}

					<div className="field" style={{ marginBottom: 12 }}>
						<label className="field-label 2xl:text-base" htmlFor="login-email">Email</label>
						<input
							id="login-email"
							className="input 2xl:text-lg 2xl:p-4"
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
							<label className="field-label 2xl:text-base" htmlFor="login-password">Password</label>
						</div>
						<div style={{ position: 'relative' }}>
							<input
								id="login-password"
								className="input 2xl:text-lg 2xl:p-4"
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
								style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, color: 'var(--ink-500)', padding: 4 }}
							>
								<Icon name={showPw ? 'eyeOff' : 'eye'} />
							</button>
						</div>
					</div>

					<button type="submit" className="btn primary block lg 2xl:text-xl 2xl:h-14" style={{ marginTop: 22 }} disabled={isPending}>
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

					<div style={{ textAlign: 'center', marginTop: 16 }}>
						<button type="button" onClick={() => navigate('/auth/forgot-password')} style={{ background: 'transparent', border: 0, color: 'var(--ink-500)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 }}>
							Forgot password?
						</button>
					</div>

					<div className="relative my-6 2xl:my-8 text-center" style={{ margin: '24px 0', position: 'relative' }}>
						<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
							<div style={{ width: '100%', borderTop: '1px solid var(--ink-200)' }}></div>
						</div>
						<div style={{ position: 'relative' }}>
							<span style={{ padding: '0 8px', background: 'white', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Or continue with</span>
						</div>
					</div>

					<div style={{ marginBottom: 24 }}>
						<button 
							type="button" 
							className="btn outline block lg 2xl:text-lg 2xl:h-14" 
							onClick={() => authApi.socialLogin('google')} 
							style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', border: 'none', background: 'var(--ink-50)', color: 'var(--ink-700)', fontWeight: 500 }}
						>
							<svg width="20" height="20" viewBox="0 0 24 24">
								<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
								<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
								<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
								<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
							</svg>
							Sign in with Google
						</button>
					</div>

					<div className="2xl:text-base" style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
						New here?{' '}
						<Link to="/register" style={{ color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline' }}>
							Create an account
						</Link>
					</div>
					<div className="2xl:text-base" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center' }}>
						<Link to="/" style={{ color: 'var(--ink-700)', fontWeight: 500, textDecoration: 'underline' }}>
							Back to landing page
						</Link>
					</div>
				</form>
			</div>
		</div>
	)
}
