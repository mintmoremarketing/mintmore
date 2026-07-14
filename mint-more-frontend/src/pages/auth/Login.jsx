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
				<div>
					<Link to="/" className="auth-brand-link" aria-label="Back to CREATYV landing page">
						CREAT<span>YV</span>
					</Link>
				</div>
				<div className="flex-1 w-full flex flex-col justify-center h-full">
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
							<Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page">
								CREAT<span>YV</span>
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
								style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 0, color: 'var(--ink-500)', padding: 4 }}
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
