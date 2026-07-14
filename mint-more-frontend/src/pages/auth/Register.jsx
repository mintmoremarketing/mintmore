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

export default function Register() {
    const navigate = useNavigate()
    const setAuth = useAuthStore((s) => s.setAuth)
    const isMobile = useIsMobile()

    const [role, setRole] = useState('client')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [error, setError] = useState('')
    const [errorList, setErrorList] = useState([])

    const { mutate, isPending } = useMutation({
        mutationFn: () => authApi.register({ full_name: fullName, email, password, role }),
        onSuccess: ({ data }) => {
            setAuth(data.data.user, data.data.accessToken, data.data.refreshToken)
            navigate(data.data.user.role === 'admin' ? '/admin' : '/dashboard')
        },
        onError: (err) => {
            const message = err.response?.data?.message || 'Registration failed'
            const errors = err.response?.data?.errors
            setError(message)
            setErrorList(Array.isArray(errors) ? errors : [])
        },
    })

    function submit(e) {
        e.preventDefault()
        if (!agreed) {
            setError('Please accept the terms')
            setErrorList([])
            return
        }
        setError('')
        setErrorList([])
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
                      <div style={{ marginBottom: 28, textAlign: 'center' }}>
                        <Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page">
                          CREAT<span>YV</span>
                        </Link>
                      </div>
                    )}

                    <div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Get started</div>
                    <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">Create your account</h1>
                    <p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">Free to join. Pay only when you commission work.</p>

                    {error && (
                        <div className="error-banner" style={{ marginBottom: 16 }}>
                            <Icon name="shield" size={14} />
                            <div>
                                <div className="2xl:text-lg">{error}</div>
                                {errorList.length > 0 && (
                                    <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'inherit' }}>
                                        {errorList.map((item) => (
                                            <li key={item} style={{ fontSize: 12 }} className="2xl:text-sm">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid-2" style={{ marginBottom: 12 }}>
                        <button type="button" className={`role-card ${role === 'client' ? 'on' : ''}`} onClick={() => setRole('client')}>
                            <Icon name="shoppingBag" />
                            <span className="role-title 2xl:text-base">I'm a client</span>
                            <span className="role-sub 2xl:text-sm">Hire creatives, run campaigns</span>
                        </button>
                        <button type="button" className={`role-card ${role === 'freelancer' ? 'on' : ''}`} onClick={() => setRole('freelancer')}>
                            <Icon name="zap" />
                            <span className="role-title 2xl:text-base">I'm a freelancer</span>
                            <span className="role-sub 2xl:text-sm">Get matched, get paid</span>
                        </button>
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                        <label className="field-label 2xl:text-base">Full name</label>
                        <input className="input 2xl:text-lg 2xl:p-4" placeholder="Priya Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                        <label className="field-label 2xl:text-base">Email</label>
                        <input className="input 2xl:text-lg 2xl:p-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                        <label className="field-label 2xl:text-base">Password</label>
                        <input className="input 2xl:text-lg 2xl:p-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                            At least 8 characters, 1 uppercase letter, and 1 number.
                        </div>
                    </div>

                    <div className="row" style={{ gap: 8, alignItems: 'flex-start', marginTop: 8, marginBottom: 8 }}>
                        <button
                            type="button"
                            className={`check ${agreed ? 'on' : ''} 2xl:w-6 2xl:h-6`}
                            onClick={() => setAgreed(!agreed)}
                        >
                            {agreed && <Icon name="check" size={14} strokeWidth={3} />}
                        </button>
                        <span style={{ color: 'var(--ink-600)', lineHeight: 1.5 }} className="text-xs 2xl:text-base">
                            I agree to the <a href="#" style={{ color: 'var(--ink-900)', textDecoration: 'underline' }}>Terms</a> and{' '}
                            <a href="#" style={{ color: 'var(--ink-900)', textDecoration: 'underline' }}>Privacy Policy</a>.
                        </span>
                    </div>

                    <button type="submit" className="btn primary block lg 2xl:text-xl 2xl:h-14" style={{ marginTop: 16 }} disabled={isPending}>
                        {isPending ? 'Creating account...' : <>Create account <Icon name="arrowRight" /></>}
                    </button>

                    <div className="2xl:text-base" style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
                        Already with us?{' '}
                        <Link to="/login" style={{ color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline' }}>
                            Sign in
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
