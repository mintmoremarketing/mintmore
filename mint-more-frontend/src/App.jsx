import { useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useEntitlements } from './hooks/useEntitlements'
import { withLaunchFlags } from './config/launch'
import { SkeletonCard } from './components/ui/Skeleton'

// Auth
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'
import OtpLogin from './pages/auth/OtpLogin'
import ForgotPassword from './pages/auth/ForgotPassword'

// Shell
import AppShell from './components/layout/AppShell'
import PublicOrShell from './components/layout/PublicOrShell'

// Fixed-price services
// LAUNCH-HIDDEN: replaced by the storefront pages below; kept for reference.
// import Services       from './pages/services/Services'
import StoreHome         from './pages/storefront/StoreHome'
import CategoryPage      from './pages/storefront/CategoryPage'
import SearchResults     from './pages/storefront/SearchResults'
import ServiceDetail     from './pages/services/ServiceDetail'
import Cart              from './pages/services/Cart'
import Orders            from './pages/services/Orders'
import OrderDetail       from './pages/services/OrderDetail'
import PostPaymentBrief from './pages/services/PostPaymentBrief'
import PurchasedItems    from './pages/services/PurchasedItems'
import ClientHome        from './pages/services/ClientHome'
import AiEdit            from './pages/services/AiEdit'
import MyServices        from './pages/services/MyServices'

// Client pages
import Jobs              from './pages/client/Jobs'
import PostJob           from './pages/client/PostJob'
import ClientJobDetail   from './pages/client/JobDetail'
import ClientWallet      from './pages/client/Wallet'
import Freelancers       from './pages/client/Freelancers'
import FreelancerProfile from './pages/client/FreelancerProfile'
import Settings          from './pages/Settings'
import NotificationsInbox from './pages/notifications/Inbox'
import Mintbox           from './pages/shared/Mintbox'
import ClientFiles       from './pages/client/Files'
import Chat              from './pages/shared/Chat'
import SharedFile        from './pages/public/SharedFile'
// LAUNCH-HIDDEN: agency landing page, replaced by the storefront at "/".
// import Landing        from './pages/public/Landing'
import Disputes          from './pages/shared/Disputes'
import Support           from './pages/shared/Support'
import Privacy           from './pages/public/Privacy'
import Terms             from './pages/public/Terms'
import RefundCancellation from './pages/public/RefundCancellation'
import ContactSupportPolicy from './pages/public/ContactSupportPolicy'

// Freelancer pages
import FreelancerJobs       from './pages/freelancer/Jobs'
import FreelancerJobDetail  from './pages/freelancer/JobDetail'
import FreelancerWallet     from './pages/freelancer/Wallet'
import MarketplaceProfile   from './pages/freelancer/MarketplaceProfile'
import ManageAccount from './pages/freelancer/ManageAccount'
import FreelancerExplore from './pages/freelancer/Explore'
import FreelancerHome    from './pages/freelancer/Home'
import FreelancerProfilePage from './pages/freelancer/Profile'
import FreelancerSettings from './pages/freelancer/FreelancerSettings'
import Upskill from './pages/freelancer/Upskill'
import Assessments from './pages/freelancer/Assessments'
import AssessmentDetail from './pages/freelancer/AssessmentDetail'
import AssessmentAttempt from './pages/freelancer/AssessmentAttempt'
import Packages             from './pages/freelancer/Packages'
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
import AdminServices     from './pages/admin/Services'
import AdminServiceOrders from './pages/admin/ServiceOrders'
import AdminAssessmentReviews from './pages/admin/AssessmentReviews'
import AdminFiles         from './pages/admin/Files'

// ── Role-aware route wrappers ─────────────────────────────────────────────────

function PortfolioRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/profile${search}`} replace />
}

function RoleDashboard() {
  const role = useAuthStore(s => s.user?.role)
  if (role === 'designer') return <DesignerTasks />
  if (role === 'freelancer') return <FreelancerExplore />
  if (role === 'admin')      return <Navigate to="/admin" replace />
  return <ClientHome />
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
  // A failed access check (the hook times out) falls through with the default flags.
  if (isLoading) return <div className="stack-6 p-4 md:p-8"><SkeletonCard /><SkeletonCard /></div>
  const flags = withLaunchFlags({ ...DEFAULT_FEATURE_FLAGS, ...(access?.feature_flags || {}) })
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
  // LAUNCH-HIDDEN: <Landing /> (agency marketing page). Logged-out visitors land on the storefront.
  if (!isAuthed) return <StoreHome />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'designer') return <Navigate to="/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

// ── Misc pages ────────────────────────────────────────────────────────────────

// New pages open at the top; back/forward keeps the browser's own restored position.
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash, navigationType])
  return null
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
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
        {/* Storefront, catalogue + cart: public, or inside the shell when signed in */}
        <Route element={<PublicOrShell />}>
          <Route path="/"               element={<RootRedirect />} />
          <Route path="/services"       element={<StoreHome />} />
          <Route path="/categories/:slug" element={<CategoryPage />} />
          <Route path="/search"         element={<SearchResults />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/cart"           element={<Cart />} />
        </Route>

        {/* Authenticated shell */}
        <Route element={<AppShell />}>

          {/* Role-aware shared routes */}
          <Route path="/dashboard" element={<RoleDashboard />} />
          <Route path="/jobs"      element={<ClientFeature flag="custom_requests"><RoleJobs /></ClientFeature>} />
          <Route path="/requests"  element={<ClientOnly><ClientFeature flag="custom_requests"><Jobs /></ClientFeature></ClientOnly>} />
          <Route path="/jobs/new"  element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id/edit" element={<ClientOnly><PostJob /></ClientOnly>} />
          <Route path="/jobs/:id"  element={<RoleJobDetail />} />
          <Route path="/wallet"    element={<ClientFeature flag="wallet_ui"><RoleWallet /></ClientFeature>} />

          {/* Service orders */}
          <Route path="/orders"      element={<ClientOnly><Orders audience="client" /></ClientOnly>} />
          <Route path="/orders/:id"  element={<ClientOnly><OrderDetail audience="client" /></ClientOnly>} />
          <Route path="/order-brief" element={<ClientOnly><PostPaymentBrief /></ClientOnly>} />
          <Route path="/purchases/:id" element={<ClientOnly><PurchasedItems /></ClientOnly>} />
          <Route path="/ai-edits/:id" element={<ClientOnly><AiEdit /></ClientOnly>} />
          <Route path="/home"        element={<FreelancerOnly><FreelancerHome /></FreelancerOnly>} />
          <Route path="/work"        element={<FreelancerOnly><Orders audience="freelancer" /></FreelancerOnly>} />
          <Route path="/work/:id"    element={<FreelancerOnly><OrderDetail audience="freelancer" /></FreelancerOnly>} />
          <Route path="/my-services" element={<FreelancerOnly><MyServices /></FreelancerOnly>} />

          {/* Hidden for launch (pages kept): social-agency features */}
          {['/calendar', '/membership', '/addons', '/onboarding/*', '/social', '/insights', '/posts', '/ai'].map(path => (
            <Route key={path} path={path} element={<Navigate to="/dashboard" replace />} />
          ))}

          {/* Client-only routes */}
          <Route path="/freelancers"       element={<ClientOnly><ClientFeature flag="marketplace"><Freelancers /></ClientFeature></ClientOnly>} />
          <Route path="/freelancers/:freelancerId" element={<ClientOnly><ClientFeature flag="marketplace"><FreelancerProfile /></ClientFeature></ClientOnly>} />

          {/* Freelancer-only routes */}
          <Route path="/profile-edit" element={<FreelancerOnly><MarketplaceProfile /></FreelancerOnly>} />
          <Route path="/profile/edit" element={<FreelancerOnly><ManageAccount /></FreelancerOnly>} />
          <Route path="/profile"      element={<FreelancerOnly><FreelancerProfilePage /></FreelancerOnly>} />
          <Route path="/settings/freelancer" element={<FreelancerOnly><FreelancerSettings /></FreelancerOnly>} />
          <Route path="/upskill"      element={<FreelancerOnly><Upskill /></FreelancerOnly>} />
          <Route path="/assessments"  element={<FreelancerOnly><Assessments /></FreelancerOnly>} />
          <Route path="/assessments/attempts/:attemptId" element={<FreelancerOnly><AssessmentAttempt /></FreelancerOnly>} />
          <Route path="/assessments/:slug" element={<FreelancerOnly><AssessmentDetail /></FreelancerOnly>} />
          <Route path="/packages"     element={<FreelancerOnly><Packages /></FreelancerOnly>} />
          {/* LAUNCH-HIDDEN: the standalone Portfolio page; posts now live on the profile (Posts tab). */}
          <Route path="/portfolio"    element={<FreelancerOnly><PortfolioRedirect /></FreelancerOnly>} />
          <Route path="/inquiries"    element={<FreelancerOnly><Inquiries /></FreelancerOnly>} />

          {/* Shared */}
          <Route path="/chat"     element={<PermissionIfAdmin permission="support.manage"><Chat /></PermissionIfAdmin>} />
          <Route path="/messages" element={<PermissionIfAdmin permission="support.manage"><Chat /></PermissionIfAdmin>} />
          <Route path="/mintbox" element={<ClientOnly><ClientFeature flag="mintbox"><ClientFiles /></ClientFeature></ClientOnly>} />
          {/* The per-order folders view, kept for direct links; Files shows everything by month. */}
          <Route path="/mintbox/folders" element={<ClientOnly><ClientFeature flag="mintbox"><Mintbox /></ClientFeature></ClientOnly>} />
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
          <Route path="/admin/services"   element={<AdminOnly permission="ops.manage"><AdminServices /></AdminOnly>} />
          <Route path="/admin/service-orders" element={<AdminOnly permission="ops.manage"><AdminServiceOrders /></AdminOnly>} />
          <Route path="/admin/assessments" element={<AdminOnly permission="ops.manage"><AdminAssessmentReviews /></AdminOnly>} />
          <Route path="/admin/files"      element={<AdminOnly permission="ops.manage"><AdminFiles /></AdminOnly>} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
