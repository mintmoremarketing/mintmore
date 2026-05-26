import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import AppShell from './components/layout/AppShell'

import ClientDashboard from './pages/client/Dashboard'
import Jobs from './pages/client/Jobs'
import PostJob from './pages/client/PostJob'
import JobDetail from './pages/client/JobDetail'
import Wallet from './pages/client/Wallet'

function ComingSoon({ label }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ color: 'var(--ink-500)' }}>Coming in the next phase</div>
    </div>
  )
}

function PendingApproval() {
  return (
    <div className="auth-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--mint-100)',
            color: 'var(--mint-700)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1l5 2v5c0 3.5-2 5.5-5 7-3-1.5-5-3.5-5-7V3z" />
          </svg>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
          }}
        >
          Account under review
        </h1>
        <p style={{ color: 'var(--ink-600)', lineHeight: 1.6, marginBottom: 24 }}>
          We manually verify every account to keep the platform high-quality. You'll receive an email within 24 hours once approved.
        </p>
        <a href="/login" style={{ color: 'var(--mint-700)', textDecoration: 'underline', fontSize: 13 }}>
          Return to login
        </a>
      </div>
    </div>
  )
}

export default function App() {
  const isAuthed = useAuthStore((s) => s.isAuthed)
  const user = useAuthStore((s) => s.user)

  function RoleRedirect() {
    if (!isAuthed) return <Navigate to="/login" replace />
    if (user?.role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/" element={<RoleRedirect />} />

        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<PostJob />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/wallet" element={<Wallet />} />

          <Route path="/freelancers" element={<ComingSoon label="Marketplace" />} />
          <Route path="/freelancers/:id" element={<ComingSoon label="Freelancer Profile" />} />
          <Route path="/social" element={<ComingSoon label="Social Media" />} />
          <Route path="/ai" element={<ComingSoon label="Mint AI" />} />
          <Route path="/chat" element={<ComingSoon label="Messages" />} />
          <Route path="/profile-edit" element={<ComingSoon label="Marketplace Profile" />} />
          <Route path="/packages" element={<ComingSoon label="Packages" />} />
          <Route path="/portfolio" element={<ComingSoon label="Portfolio" />} />
          <Route path="/inquiries" element={<ComingSoon label="Inquiries" />} />
          <Route path="/settings" element={<ComingSoon label="Settings" />} />
          <Route path="/addons" element={<ComingSoon label="Add-On Plans" />} />

          <Route path="/admin" element={<ComingSoon label="Admin Dashboard" />} />
          <Route path="/admin/users" element={<ComingSoon label="Users" />} />
          <Route path="/admin/approvals" element={<ComingSoon label="Approvals" />} />
          <Route path="/admin/wallet" element={<ComingSoon label="Platform Wallet" />} />
          <Route path="/admin/ai" element={<ComingSoon label="AI Panel" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
