import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useEntitlements } from './hooks/useEntitlements'

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
import NotificationsInbox from './pages/notifications/Inbox'
import Mintbox           from './pages/shared/Mintbox'
import Chat              from './pages/shared/Chat'
import SharedFile        from './pages/public/SharedFile'
import Membership        from './pages/client/Membership'
import Onboarding        from './pages/client/Onboarding'
import Disputes          from './pages/shared/Disputes'

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
import AdminPricing      from './pages/admin/Pricing'
import AdminCommerce     from './pages/admin/Commerce'
import AdminAudit        from './pages/admin/Audit'

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

function AdminOnly({ children, permission }) {
  const role = useAuthStore(s => s.user?.role)
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return <AdminPermissionGate permission={permission}>{children}</AdminPermissionGate>
}

function AdminPermissionGate({ children, permission }) {
  const { data: access, isLoading } = useEntitlements()
  if (!permission) return children
  if (isLoading) return null
  const permissions = access?.admin_permissions || []
  if (!access?.is_super_admin && !permissions.includes('*') && !permissions.includes(permission)) {
    return <Navigate to="/admin" replace />
  }
  return children
}

function PermissionIfAdmin({ children, permission }) {
  const role = useAuthStore(s => s.user?.role)
  if (role !== 'admin') return children
  return <AdminPermissionGate permission={permission}>{children}</AdminPermissionGate>
}

function ClientOnly({ children }) {
  const role = useAuthStore(s => s.user?.role)
  if (role !== 'client') return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />
  return children
}

function FreelancerOnly({ children }) {
  const role = useAuthStore(s => s.user?.role)
  if (role !== 'freelancer') return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />
  return children
}

function RootRedirect() {
  const isAuthed = useAuthStore(s => s.isAuthed)
  const user = useAuthStore(s => s.user)
  if (!isAuthed) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

// ── Misc pages ────────────────────────────────────────────────────────────────

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"            element={<Login />} />
        <Route path="/register"         element={<Register />} />
        <Route path="/mintbox/share/:token" element={<Mintbox />} />
        <Route path="/mintbox/share-category/:categoryToken" element={<Mintbox />} />
        <Route path="/mintbox/file/:token" element={<SharedFile />} />
        <Route path="/"                 element={<RootRedirect />} />

        {/* Authenticated shell */}
        <Route element={<AppShell />}>

          {/* Role-aware shared routes */}
          <Route path="/dashboard" element={<RoleDashboard />} />
          <Route path="/jobs"      element={<RoleJobs />} />
          <Route path="/jobs/new"  element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id/edit" element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id"  element={<RoleJobDetail />} />
          <Route path="/wallet"    element={<RoleWallet />} />

          {/* Client-only routes */}
          <Route path="/addons"            element={<ClientOnly><Addons /></ClientOnly>} />
          <Route path="/membership"        element={<ClientOnly><Membership /></ClientOnly>} />
          <Route path="/onboarding"        element={<ClientOnly><Onboarding /></ClientOnly>} />
          <Route path="/freelancers"       element={<ClientOnly><Freelancers /></ClientOnly>} />
          <Route path="/freelancers/:freelancerId" element={<ClientOnly><FreelancerProfile /></ClientOnly>} />
          <Route path="/social"            element={<ClientOnly><Social /></ClientOnly>} />
          <Route path="/ai"                element={<ClientOnly><MintAI /></ClientOnly>} />

          {/* Freelancer-only routes */}
          <Route path="/profile-edit" element={<FreelancerOnly><MarketplaceProfile /></FreelancerOnly>} />
          <Route path="/packages"     element={<FreelancerOnly><Packages /></FreelancerOnly>} />
          <Route path="/portfolio"    element={<FreelancerOnly><Portfolio /></FreelancerOnly>} />
          <Route path="/inquiries"    element={<FreelancerOnly><Inquiries /></FreelancerOnly>} />

          {/* Shared */}
          <Route path="/chat"     element={<PermissionIfAdmin permission="support.manage"><Chat /></PermissionIfAdmin>} />
          <Route path="/mintbox" element={<ClientOnly><Mintbox /></ClientOnly>} />
          <Route path="/mintbox/jobs/:jobId" element={<Mintbox />} />
          <Route path="/notifications" element={<NotificationsInbox />} />
          <Route path="/disputes" element={<PermissionIfAdmin permission="support.manage"><Disputes /></PermissionIfAdmin>} />
          <Route path="/settings" element={<Settings />} />

          {/* Admin routes */}
          <Route path="/admin"            element={<AdminOnly><AdminDashboard /></AdminOnly>} />
          <Route path="/admin/users"      element={<AdminOnly permission="users.manage"><AdminUsers /></AdminOnly>} />
          <Route path="/admin/approvals"  element={<AdminOnly permission="deals.approve"><AdminNegotiations /></AdminOnly>} />
          <Route path="/admin/pricing"    element={<AdminOnly permission="pricing.manage"><AdminPricing /></AdminOnly>} />
          <Route path="/admin/commerce"   element={<AdminOnly permission="pricing.manage"><AdminCommerce /></AdminOnly>} />
          <Route path="/admin/audit"      element={<AdminOnly permission="audit.read"><AdminAudit /></AdminOnly>} />
          <Route path="/admin/wallet"     element={<AdminOnly permission="payments.manage"><AdminWallet /></AdminOnly>} />
          <Route path="/admin/ai"         element={<AdminOnly permission="pricing.manage"><AdminAIPanel /></AdminOnly>} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
