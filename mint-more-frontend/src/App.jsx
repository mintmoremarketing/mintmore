import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useEntitlements } from './hooks/useEntitlements'

// Auth
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'
import OtpLogin from './pages/auth/OtpLogin'
import ForgotPassword from './pages/auth/ForgotPassword'

// Shell
import AppShell from './components/layout/AppShell'

// Client pages
import ClientDashboard   from './pages/client/Dashboard'
import ClientCalendar    from './pages/client/Calendar'
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
import Landing           from './pages/public/Landing'
import Membership        from './pages/client/Membership'
import Onboarding        from './pages/client/Onboarding'
import Disputes          from './pages/shared/Disputes'
import Support           from './pages/shared/Support'
import Privacy           from './pages/public/Privacy'
import Terms             from './pages/public/Terms'
import RefundCancellation from './pages/public/RefundCancellation'
import ContactSupportPolicy from './pages/public/ContactSupportPolicy'

// Freelancer pages
import FreelancerDashboard  from './pages/freelancer/Dashboard'
import FreelancerJobs       from './pages/freelancer/Jobs'
import FreelancerJobDetail  from './pages/freelancer/JobDetail'
import FreelancerWallet     from './pages/freelancer/Wallet'
import MarketplaceProfile   from './pages/freelancer/MarketplaceProfile'
import Packages             from './pages/freelancer/Packages'
import Portfolio            from './pages/freelancer/Portfolio'
import Inquiries            from './pages/freelancer/Inquiries'
import DesignerTasks        from './pages/designer/Tasks'

// Admin pages
import AdminDashboard    from './pages/admin/Dashboard'
import AdminUsers        from './pages/admin/Users'
import AdminNegotiations from './pages/admin/Negotiations'
import AdminWallet       from './pages/admin/Wallet'
import AdminAIPanel      from './pages/admin/AIPanel'
import AdminPricing      from './pages/admin/Pricing'
import AdminCommerce     from './pages/admin/Commerce'
import AdminAudit        from './pages/admin/Audit'
import AdminOperations   from './pages/admin/Operations'
import AdminTiers        from './pages/admin/Tiers'
import AdminBrands       from './pages/admin/Brands'

// ── Role-aware route wrappers ─────────────────────────────────────────────────

function RoleDashboard() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'designer') return <DesignerTasks />
  if (role === 'freelancer') return <FreelancerDashboard />
  if (role === 'admin')      return <Navigate to="/admin" replace />
  return <ClientDashboard />
}

function RoleJobs() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'designer') return <DesignerTasks />
  if (role === 'freelancer') return <FreelancerJobs />
  return <Jobs />
}

function RoleJobDetail() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'freelancer') return <FreelancerJobDetail />
  if (role === 'client') {
    return (
      <ClientFeature flag="negotiation">
        <ClientJobDetail />
      </ClientFeature>
    )
  }
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
  if (isLoading || !access) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted">Loading admin access...</p>
        </div>
      </div>
    )
  }
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

const DEFAULT_FEATURE_FLAGS = {
  calendar_creatives: true,
  internal_ops: true,
  custom_requests: true,
  mintbox: true,
  chat: true,
  social_insights: true,
  mint_ai: true,
  wallet_ui: false,
  marketplace: false,
  freelancer_portal: false,
  freelancer_matching: false,
  negotiation: false,
}

function ClientFeature({ flag, children }) {
  const role = useAuthStore(s => s.user?.role)
  const { data: access, isLoading } = useEntitlements()
  if (role !== 'client') return children
  if (isLoading) return null
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...(access?.feature_flags || {}) }
  if (flag && flags[flag] === false) return <Navigate to="/dashboard" replace />
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
  if (!isAuthed) return <Landing />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'designer') return <Navigate to="/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

// ── Misc pages ────────────────────────────────────────────────────────────────

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public */}
        <Route path="/login"            element={<Login />} />
        <Route path="/register"         element={<Register />} />
        <Route path="/auth/otp"         element={<OtpLogin />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/privacy"          element={<Privacy />} />
        <Route path="/terms"            element={<Terms />} />
        <Route path="/refund-cancellation-policy" element={<RefundCancellation />} />
        <Route path="/contact-support-policy" element={<ContactSupportPolicy />} />
        <Route path="/mintbox/share/:token" element={<Mintbox />} />
        <Route path="/mintbox/share-category/:categoryToken" element={<Mintbox />} />
        <Route path="/mintbox/file/:token" element={<SharedFile />} />
        <Route path="/"                 element={<RootRedirect />} />

        {/* Authenticated shell */}
        <Route element={<AppShell />}>

          {/* Role-aware shared routes */}
          <Route path="/dashboard" element={<RoleDashboard />} />
          <Route path="/calendar"  element={<ClientOnly><ClientFeature flag="calendar_creatives"><ClientCalendar /></ClientFeature></ClientOnly>} />
          <Route path="/jobs"      element={<ClientFeature flag="custom_requests"><RoleJobs /></ClientFeature>} />
          <Route path="/requests"  element={<ClientOnly><ClientFeature flag="custom_requests"><Jobs /></ClientFeature></ClientOnly>} />
          <Route path="/jobs/new"  element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id/edit" element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id"  element={<RoleJobDetail />} />
          <Route path="/wallet"    element={<ClientFeature flag="wallet_ui"><RoleWallet /></ClientFeature>} />

          {/* Client-only routes */}
          <Route path="/addons"            element={<ClientOnly><ClientFeature flag="wallet_ui"><Addons /></ClientFeature></ClientOnly>} />
          <Route path="/membership"        element={<ClientOnly><Membership /></ClientOnly>} />
          <Route path="/onboarding"        element={<ClientOnly><Onboarding /></ClientOnly>} />
          <Route path="/freelancers"       element={<ClientOnly><ClientFeature flag="marketplace"><Freelancers /></ClientFeature></ClientOnly>} />
          <Route path="/freelancers/:freelancerId" element={<ClientOnly><ClientFeature flag="marketplace"><FreelancerProfile /></ClientFeature></ClientOnly>} />
          <Route path="/social"            element={<ClientOnly><ClientFeature flag="social_insights"><Social /></ClientFeature></ClientOnly>} />
          <Route path="/insights"          element={<ClientOnly><ClientFeature flag="social_insights"><Social /></ClientFeature></ClientOnly>} />
          <Route path="/posts"             element={<ClientOnly><ClientFeature flag="social_insights"><Social /></ClientFeature></ClientOnly>} />
          <Route path="/ai"                element={<ClientOnly><ClientFeature flag="mint_ai"><MintAI /></ClientFeature></ClientOnly>} />

          {/* Freelancer-only routes */}
          <Route path="/profile-edit" element={<FreelancerOnly><MarketplaceProfile /></FreelancerOnly>} />
          <Route path="/packages"     element={<FreelancerOnly><Packages /></FreelancerOnly>} />
          <Route path="/portfolio"    element={<FreelancerOnly><Portfolio /></FreelancerOnly>} />
          <Route path="/inquiries"    element={<FreelancerOnly><Inquiries /></FreelancerOnly>} />

          {/* Shared */}
          <Route path="/chat"     element={<PermissionIfAdmin permission="support.manage"><Chat /></PermissionIfAdmin>} />
          <Route path="/messages" element={<PermissionIfAdmin permission="support.manage"><Chat /></PermissionIfAdmin>} />
          <Route path="/mintbox" element={<ClientOnly><ClientFeature flag="mintbox"><Mintbox /></ClientFeature></ClientOnly>} />
          <Route path="/mintbox/jobs/:jobId" element={<Mintbox />} />
          <Route path="/mintbox/library/:folderId" element={<Mintbox />} />
          <Route path="/notifications" element={<NotificationsInbox />} />
          <Route path="/support" element={<PermissionIfAdmin permission="support.manage"><Support /></PermissionIfAdmin>} />
          <Route path="/disputes" element={<PermissionIfAdmin permission="support.manage"><Disputes /></PermissionIfAdmin>} />
          <Route path="/settings" element={<Settings />} />

          {/* Admin routes */}
          <Route path="/admin"            element={<AdminOnly><AdminDashboard /></AdminOnly>} />
          <Route path="/admin/operations" element={<AdminOnly permission="ops.manage"><AdminOperations /></AdminOnly>} />
          <Route path="/admin/users"      element={<AdminOnly permission="users.manage"><AdminUsers /></AdminOnly>} />
          <Route path="/admin/approvals"  element={<AdminOnly permission="deals.approve"><AdminNegotiations /></AdminOnly>} />
          <Route path="/admin/pricing"    element={<AdminOnly permission="pricing.manage"><AdminPricing /></AdminOnly>} />
          <Route path="/admin/commerce"   element={<AdminOnly permission="pricing.manage"><AdminCommerce /></AdminOnly>} />
          <Route path="/admin/audit"      element={<AdminOnly permission="audit.read"><AdminAudit /></AdminOnly>} />
          <Route path="/admin/wallet"     element={<AdminOnly permission="payments.manage"><AdminWallet /></AdminOnly>} />
          <Route path="/admin/ai"         element={<AdminOnly permission="pricing.manage"><AdminAIPanel /></AdminOnly>} />
          <Route path="/admin/tiers"      element={<AdminOnly permission="pricing.manage"><AdminTiers /></AdminOnly>} />
          <Route path="/admin/brands"     element={<AdminOnly permission="users.manage"><AdminBrands /></AdminOnly>} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
