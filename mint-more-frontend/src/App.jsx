import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'

// Auth
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'

// Shell
import AppShell from './components/layout/AppShell'

// Client pages
import ClientDashboard   from './pages/client/Dashboard'
import Jobs              from './pages/client/Jobs'
import PostJob           from './pages/client/PostJob'
import ClientJobDetail   from './pages/client/JobDetail'
import ClientWallet      from './pages/client/Wallet'
import Addons            from './pages/client/Addons'
import Freelancers       from './pages/client/Freelancers'
import FreelancerProfile from './pages/client/FreelancerProfile'
import Social            from './pages/client/Social'
import MintAI            from './pages/client/MintAI'
import Settings          from './pages/Settings'

// Freelancer pages
import FreelancerDashboard  from './pages/freelancer/Dashboard'
import FreelancerJobs       from './pages/freelancer/Jobs'
import FreelancerJobDetail  from './pages/freelancer/JobDetail'
import FreelancerWallet     from './pages/freelancer/Wallet'
import MarketplaceProfile   from './pages/freelancer/MarketplaceProfile'
import Packages             from './pages/freelancer/Packages'
import Portfolio            from './pages/freelancer/Portfolio'
import Inquiries            from './pages/freelancer/Inquiries'

// Admin pages
import AdminDashboard    from './pages/admin/Dashboard'
import AdminUsers        from './pages/admin/Users'
import AdminNegotiations from './pages/admin/Negotiations'
import AdminWallet       from './pages/admin/Wallet'
import AdminAIPanel      from './pages/admin/AIPanel'

// ── Role-aware route wrappers ─────────────────────────────────────────────────

function RoleDashboard() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'freelancer') return <FreelancerDashboard />
  if (role === 'admin')      return <Navigate to="/admin" replace />
  return <ClientDashboard />
}

function RoleJobs() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'freelancer') return <FreelancerJobs />
  return <Jobs />
}

function RoleJobDetail() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'freelancer') return <FreelancerJobDetail />
  return <ClientJobDetail />
}

function RoleWallet() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'freelancer') return <FreelancerWallet />
  return <ClientWallet />
}

// ── Guards ────────────────────────────────────────────────────────────────────

function AdminOnly({ children }) {
  const role = useAuthStore(s => s.user?.role)
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function ClientOnly({ children }) {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'admin') return <Navigate to="/admin" replace />
  return children
}

// ── Misc pages ────────────────────────────────────────────────────────────────

function PendingApproval() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--paper)',
    }}>
      <div style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'var(--mint-100)', color: 'var(--mint-700)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1l5 2v5c0 3.5-2 5.5-5 7-3-1.5-5-3.5-5-7V3z" />
          </svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
          Account under review
        </h1>
        <p style={{ color: 'var(--ink-600)', lineHeight: 1.6, marginBottom: 24 }}>
          We manually verify every account. You'll receive an email within 24 hours once approved.
        </p>
        <a href="/login" style={{ color: 'var(--mint-700)', textDecoration: 'underline', fontSize: 13 }}>
          Return to login
        </a>
      </div>
    </div>
  )
}

function ComingSoon({ label }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ color: 'var(--ink-500)', fontSize: 14 }}>Coming soon</div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const isAuthed = useAuthStore(s => s.isAuthed)
  const user     = useAuthStore(s => s.user)

  function RootRedirect() {
    if (!isAuthed)               return <Navigate to="/login" replace />
    if (user?.role === 'admin')  return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"            element={<Login />} />
        <Route path="/register"         element={<Register />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/"                 element={<RootRedirect />} />

        {/* Authenticated shell */}
        <Route element={<AppShell />}>

          {/* Role-aware shared routes */}
          <Route path="/dashboard" element={<RoleDashboard />} />
          <Route path="/jobs"      element={<RoleJobs />} />
          <Route path="/jobs/new"  element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id"  element={<RoleJobDetail />} />
          <Route path="/wallet"    element={<RoleWallet />} />

          {/* Client-only routes */}
          <Route path="/addons"            element={<ClientOnly><Addons /></ClientOnly>} />
          <Route path="/freelancers"       element={<ClientOnly><Freelancers /></ClientOnly>} />
          <Route path="/freelancers/:freelancerId" element={<ClientOnly><FreelancerProfile /></ClientOnly>} />
          <Route path="/social"            element={<ClientOnly><Social /></ClientOnly>} />
          <Route path="/ai"                element={<ClientOnly><MintAI /></ClientOnly>} />

          {/* Freelancer-only routes */}
          <Route path="/profile-edit" element={<MarketplaceProfile />} />
          <Route path="/packages"     element={<Packages />} />
          <Route path="/portfolio"    element={<Portfolio />} />
          <Route path="/inquiries"    element={<Inquiries />} />

          {/* Shared */}
          <Route path="/chat"     element={<ComingSoon label="Messages" />} />
          <Route path="/settings" element={<Settings />} />

          {/* Admin routes */}
          <Route path="/admin"            element={<AdminOnly><AdminDashboard /></AdminOnly>} />
          <Route path="/admin/users"      element={<AdminOnly><AdminUsers /></AdminOnly>} />
          <Route path="/admin/approvals"  element={<AdminOnly><AdminNegotiations /></AdminOnly>} />
          <Route path="/admin/wallet"     element={<AdminOnly><AdminWallet /></AdminOnly>} />
          <Route path="/admin/ai"         element={<AdminOnly><AdminAIPanel /></AdminOnly>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}