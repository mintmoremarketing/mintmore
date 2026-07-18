import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { supabase } from '../../api/supabase'
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
    const [showPassword, setShowPassword] = useState(false)
    const [agreed, setAgreed] = useState(false)
    const [error, setError] = useState('')
    const [errorList, setErrorList] = useState([])
    
    const [step, setStep] = useState(1)
    const [otp, setOtp] = useState('')
    const [isOtpPending, setIsOtpPending] = useState(false)

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

    async function submit(e) {
        e.preventDefault()
        if (!agreed) {
            setError('Please accept the terms')
            setErrorList([])
            return
        }
        setError('')
        setErrorList([])
        
        setIsOtpPending(true)
        const { error } = await supabase.auth.signInWithOtp({
            email,
        })
        setIsOtpPending(false)
        if (error) {
            setError(error.message)
        } else {
            setStep(2)
        }
    }

    async function verifyAndRegister(e) {
        e.preventDefault()
        setError('')
        setErrorList([])
        
        setIsOtpPending(true)
        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
        })
        setIsOtpPending(false)
        if (error) {
            setError(error.message)
        } else {
            // OTP is valid, now register the user in the backend
            mutate()
        }
    }

    return (
        <div className={`auth-shell${isMobile ? ' mobile' : ''}`}>
            <aside className="auth-aside">
                <div>
                    <Link to="/" className="auth-brand-link" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="/logo-dark.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
                        <span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
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
                <form className="auth-form" onSubmit={step === 1 ? submit : verifyAndRegister}>
                    {isMobile && (
                      <div style={{ marginBottom: 28, textAlign: 'center' }}>
                        <Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <img src="/logo-light.png" alt="CREATYV Logo" className="w-8 h-8 object-contain rounded" />
                          <span>CREAT<span className="text-mint-500 font-bold">YV</span></span>
                        </Link>
                      </div>
                    )}

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

                    {step === 1 ? (
                        <>
                            <div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Get started</div>
                            <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">Create your account</h1>
                            <p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">Free to join. Pay only when you commission work.</p>

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
                                <div className="relative">
                                    <input className="input 2xl:text-lg 2xl:p-4 w-full pr-10" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, color: 'var(--ink-500)', padding: 4 }}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                                    </button>
                                </div>
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

                            <button type="submit" className="btn primary block lg 2xl:text-xl 2xl:h-14" style={{ marginTop: 16 }} disabled={isOtpPending}>
                                {isOtpPending ? 'Sending Code...' : <>Create account <Icon name="arrowRight" /></>}
                            </button>

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
                                    Sign up with Google
                                </button>
                            </div>

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
                        </>
                    ) : (
                        <>
                            <div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Verification</div>
                            <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">Enter verification code</h1>
                            <p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">We sent a verification code to {email}.</p>
                            
                            <div className="field" style={{ marginBottom: 12 }}>
                                <label className="field-label 2xl:text-base">Verification Code</label>
                                <input className="input 2xl:text-lg 2xl:p-4 text-center tracking-[0.5em]" type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="00000000" required />
                            </div>
                            
                            <button type="submit" className="btn primary block lg 2xl:text-xl 2xl:h-14" style={{ marginTop: 16 }} disabled={isOtpPending || isPending}>
                                {isOtpPending || isPending ? 'Verifying...' : 'Verify & Complete'}
                            </button>
                            
                            <div className="2xl:text-base" style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
                                <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', border: 0, color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' }}>
                                    Back
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    )
}
