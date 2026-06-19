import { useState, useEffect } from 'react' // ADDED: imported useEffect
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'

// --- RECENTLY CHANGED PART ---
// Added the useIsMobile hook to dynamically track screen size
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

export default function Register() {
    const navigate = useNavigate()
    const setAuth = useAuthStore((s) => s.setAuth)
    const isMobile = useIsMobile() // ADDED: call the hook

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
        // --- RECENTLY CHANGED PART ---
        // Dynamically add the 'mobile' class to the shell based on screen size
        <div className={`auth-shell${isMobile ? ' mobile' : ''}`}>
        {/* ----------------------------- */}
            <aside className="auth-aside">
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                        CREAT<span style={{ color: 'var(--mint-400)', fontWeight: 650 }}>YV</span>
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

                    {/* --- RECENTLY CHANGED PART --- */}
                    {/* Mobile-only logo */}
                    {isMobile && (
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: 22,
                        fontWeight: 600, letterSpacing: '-0.02em',
                        marginBottom: 28, textAlign: 'center',
                      }}>
                        CREAT<span style={{ color: 'var(--mint-500)', fontWeight: 650 }}>YV</span>
                      </div>
                    )}
                    {/* ----------------------------- */}

                    <div className="h-eyebrow" style={{ marginBottom: 6 }}>Get started</div>
                    <h1 className="h-display h-1" style={{ marginTop: 0, marginBottom: 6 }}>Create your account</h1>
                    <p className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>Free to join. Pay only when you commission work.</p>

                    {error && (
                        <div className="error-banner" style={{ marginBottom: 16 }}>
                            <Icon name="shield" size={14} />
                            <div>
                                <div>{error}</div>
                                {errorList.length > 0 && (
                                    <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'inherit' }}>
                                        {errorList.map((item) => (
                                            <li key={item} style={{ fontSize: 12 }}>
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
                        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                        <label className="field-label">Password</label>
                        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                            At least 8 characters, 1 uppercase letter, and 1 number.
                        </div>
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
