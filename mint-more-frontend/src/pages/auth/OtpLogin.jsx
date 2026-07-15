import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../api/supabase'
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

export default function OtpLogin() {
    const navigate = useNavigate()
    const isMobile = useIsMobile()

    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState(1)
    const [error, setError] = useState('')
    const [isPending, setIsPending] = useState(false)

    async function sendOtp(e) {
        e.preventDefault()
        setError('')
        setIsPending(true)
        const { error } = await supabase.auth.signInWithOtp({
            email,
        })
        setIsPending(false)
        if (error) {
            setError(error.message)
        } else {
            setStep(2)
        }
    }

    async function verifyOtp(e) {
        e.preventDefault()
        setError('')
        setIsPending(true)
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email',
        })
        setIsPending(false)
        if (error) {
            setError(error.message)
        } else {
            // User is signed in
            navigate('/dashboard')
        }
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
                    <div className="relative overflow-hidden rounded-xl bg-ink-900 shadow-lg w-full h-full group p-12 flex flex-col">
                         <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" alt="Creative Agency" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-40" />
                         <div className="relative z-10 text-white mt-auto">
                            <h2 className="text-3xl font-bold mb-4">Fast & Secure</h2>
                            <p className="text-white/80">Login securely with a verification code sent directly to your email.</p>
                         </div>
                    </div>
                </div>
            </aside>

            <div className="auth-form-wrap overflow-y-auto h-full max-h-screen">
                <form className="auth-form" onSubmit={step === 1 ? sendOtp : verifyOtp}>
                    {isMobile && (
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <Link to="/" className="auth-brand-link light" aria-label="Back to CREATYV landing page">
                                CREAT<span>YV</span>
                            </Link>
                        </div>
                    )}

                    <div className="text-[11px] 2xl:text-[14px] font-bold tracking-wider uppercase text-mint-500 mb-2 2xl:mb-4">Secure Login</div>
                    <h1 className="text-3xl md:text-4xl 2xl:text-5xl font-display font-bold text-ink-900 tracking-tight m-0 pb-2 2xl:pb-4">
                        {step === 1 ? 'Enter email address' : 'Verify Code'}
                    </h1>
                    <p className="text-ink-500 text-sm md:text-base 2xl:text-lg mt-0 mb-8 2xl:mb-12">
                        {step === 1 ? 'We will send a verification code to your email.' : `Code sent to ${email}`}
                    </p>

                    {error && (
                        <div className="error-banner" style={{ marginBottom: 16 }}>
                            <Icon name="shield" size={14} />
                            <span className="2xl:text-lg">{error}</span>
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="field" style={{ marginBottom: 12 }}>
                            <label className="field-label 2xl:text-base">Email Address</label>
                            <input
                                className="input 2xl:text-lg 2xl:p-4"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                    ) : (
                        <div className="field" style={{ marginBottom: 12 }}>
                            <label className="field-label 2xl:text-base">One-Time Password</label>
                            <input
                                className="input 2xl:text-lg 2xl:p-4 text-center tracking-[0.5em]"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="000000"
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="btn primary block lg 2xl:text-xl 2xl:h-14" style={{ marginTop: 22 }} disabled={isPending}>
                        {isPending ? 'Please wait...' : (step === 1 ? 'Send OTP' : 'Verify & Sign In')}
                    </button>

                    <div className="2xl:text-base" style={{ marginTop: 22, fontSize: 13, color: 'var(--ink-500)', textAlign: 'center' }}>
                        <button type="button" onClick={() => navigate('/login')} style={{ background: 'transparent', border: 0, color: 'var(--ink-950)', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' }}>
                            Back to email login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
