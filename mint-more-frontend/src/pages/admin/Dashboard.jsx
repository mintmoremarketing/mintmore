import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { servicesApi } from '../../api/services'
import { disputesApi } from '../../api/disputes'
import { mintboxApi } from '../../api/mintbox'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import KYCReviewModal from '../../components/admin/KYCReviewModal'
import StageBadge from '../../components/services/StageBadge'
import { AdminPage, EmptyState, PageHeader, Panel, SkeletonRows } from '../../components/admin/AdminUI'
import { dueText, inr } from '../../components/services/serviceUtils'
import { timeAgo } from '../../utils/format'

// LAUNCH-HIDDEN: the old Command Center also showed deal approvals (negotiations) and the
// social creative review queue. Both still live at /admin/approvals and /admin/operations.

const OPEN_STAGES = ['finding_freelancer', 'in_progress', 'revision_requested', 'delivered', 'approved']
const isOverdue = b => b.due_at && ['in_progress', 'revision_requested'].includes(b.stage) && new Date(b.due_at).getTime() < Date.now()
const listOf = (data, key) => (Array.isArray(data?.[key]) ? data[key] : Array.isArray(data) ? data : [])

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** One row of the attention queue: what it is, how many, where to act. */
function QueueRow({ icon, label, detail, count, to, urgent }) {
  const clear = !count
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50 md:px-5"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${clear ? 'bg-ink-50 text-ink-400' : urgent ? 'bg-mint-50 text-mint-600' : 'bg-ink-100 text-ink-700'}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${clear ? 'text-ink-500' : 'text-ink-900'}`}>{label}</span>
        <span className="block truncate text-xs text-ink-500">{clear ? 'Nothing waiting' : detail}</span>
      </span>
      <span className={`text-lg font-semibold tabular-nums ${clear ? 'text-ink-300' : urgent ? 'text-mint-600' : 'text-ink-900'}`}>{count || 0}</span>
      <Icon name="chevronRight" size={15} className="shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-500" />
    </Link>
  )
}

function Figure({ label, value, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 md:px-5">
      <dt className="text-sm text-ink-600">{label}{hint && <span className="block text-xs text-ink-400">{hint}</span>}</dt>
      <dd className="text-[15px] font-semibold tabular-nums text-ink-950">{value}</dd>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [selectedKyc, setSelectedKyc] = useState(null)

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(res => res.data?.data?.stats || res.data?.data || {}),
  })
  const { data: bookings = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-service-bookings', 'all'],
    queryFn: () => servicesApi.adminBookings({}).then(res => res.data.data || []),
    refetchInterval: 30_000,
  })
  const { data: kycData } = useQuery({
    queryKey: ['kyc-pending'],
    queryFn: () => api.get('/kyc/admin/pending').then(res => res.data.data),
  })
  const { data: wdData } = useQuery({
    queryKey: ['admin-withdrawals', 'pending'],
    queryFn: () => api.get('/wallet/admin/withdrawals?status=pending').then(res => res.data.data),
  })
  const { data: disputesData } = useQuery({
    queryKey: ['disputes', 'open'],
    queryFn: () => disputesApi.list({ status: 'open' }).then(res => res.data.data),
  })

  // Same query as Operations > First drafts, so approving there clears this row too.
  const { data: firstDrafts = [] } = useQuery({
    queryKey: ['admin-first-drafts'],
    queryFn: () => mintboxApi.adminFirstDrafts().then(response => response.data?.data?.drafts || []),
    refetchInterval: 30_000,
  })

  const kycs = listOf(kycData, 'submissions').length ? listOf(kycData, 'submissions') : listOf(kycData, 'kycs')
  const withdrawals = listOf(wdData, 'withdrawals')
  const disputes = listOf(disputesData, 'disputes')

  const orders = useMemo(() => {
    const open = bookings.filter(b => OPEN_STAGES.includes(b.stage))
    return {
      open,
      unassigned: bookings.filter(b => b.stage === 'finding_freelancer'),
      overdue: open.filter(isOverdue),
      revisions: bookings.filter(b => b.stage === 'revision_requested'),
      awaitingClient: bookings.filter(b => b.stage === 'delivered' || b.stage === 'approved'),
      openValue: open.reduce((sum, b) => sum + Number(b.subtotal || 0), 0),
    }
  }, [bookings])

  const withdrawalTotal = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0)
  const users = stats.users || {}

  const queue = [
    { icon: 'video', label: 'First drafts to review', detail: 'Watch and approve before the client can see them.', count: firstDrafts.length, to: '/admin/operations?tab=first-drafts', urgent: true },
    { icon: 'requests', label: 'Orders without a freelancer', detail: 'Auto-assign found nobody. Pick one by hand.', count: orders.unassigned.length, to: '/admin/service-orders', urgent: true },
    { icon: 'clock', label: 'Overdue orders', detail: 'Past the due date and not delivered yet.', count: orders.overdue.length, to: '/admin/service-orders?view=all', urgent: true },
    { icon: 'disputes', label: 'Open disputes', detail: 'Escrow is frozen until you decide.', count: disputes.length, to: '/disputes', urgent: true },
    { icon: 'platform_wallet', label: 'Withdrawals to pay', detail: `${inr(withdrawalTotal)} requested by freelancers.`, count: withdrawals.length, to: '/admin/wallet' },
    { icon: 'shield', label: 'KYC to review', detail: 'Freelancers cannot be assigned work until approved.', count: kycs.length, to: '/admin/users' },
    { icon: 'refresh', label: 'Revisions in progress', detail: 'Clients asked for changes. Freelancer is on it.', count: orders.revisions.length, to: '/admin/service-orders?view=all' },
    { icon: 'checkCircle', label: 'Waiting on the client', detail: 'Delivered or approved, not yet completed and rated.', count: orders.awaitingClient.length, to: '/admin/service-orders?view=all' },
  ]
  const needsYou = queue.filter(row => row.urgent || row.label.startsWith('Withdrawals') || row.label.startsWith('KYC')).reduce((sum, row) => sum + (row.count || 0), 0)
  const recent = bookings.slice(0, 6)

  return (
    <AdminPage>
      <PageHeader
        title={`${greeting()}, ${(user?.full_name || 'admin').split(' ')[0]}`}
        description={needsYou ? `${needsYou} item${needsYou === 1 ? '' : 's'} need a decision from you. Start at the top of the list.` : 'Nothing is waiting on you. New orders are being assigned automatically.'}
        actions={<>
          <button type="button" className="btn ghost" onClick={() => navigate('/admin/services')}>Edit catalogue</button>
          <button type="button" className="btn primary" onClick={() => navigate('/admin/service-orders?view=all')}>All orders</button>
        </>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Needs attention" description="Sorted by what blocks money or delivery first.">
            {ordersLoading ? <SkeletonRows rows={5} /> : (
              <div className="divide-y divide-ink-100">
                {queue.map(row => <QueueRow key={row.label} {...row} />)}
              </div>
            )}
          </Panel>

          <Panel
            title="Recent orders"
            actions={<Link to="/admin/service-orders?view=all" className="text-sm font-medium text-mint-600 hover:text-mint-700">View all</Link>}
          >
            {ordersLoading ? <SkeletonRows rows={4} /> : recent.length === 0 ? (
              <EmptyState title="No orders yet" body="Paid orders from the storefront show up here, with who is working on them." />
            ) : (
              <div className="divide-y divide-ink-100">
                {recent.map(row => (
                  <Link key={row.id} to="/admin/service-orders?view=all" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50 md:px-5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                      {row.cover_url && <img src={row.cover_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-900">{row.snapshot?.title || row.template_title}</div>
                      <div className="truncate text-xs text-ink-500">
                        {row.booking_number} · {row.client_name} → {row.freelancer_name || 'unassigned'}
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <StageBadge stage={row.stage} />
                      <div className="mt-0.5 text-[11px] text-ink-400">{row.stage === 'completed' ? `Done ${timeAgo(row.completed_at)}` : dueText(row.due_at)}</div>
                    </div>
                    <div className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-900">{inr(row.subtotal)}</div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Money">
            <dl className="divide-y divide-ink-100">
              <Figure label="Held in escrow" hint="Released when clients complete" value={statsLoading ? '…' : inr(stats.total_escrow ?? stats.escrow ?? 0)} />
              <Figure label="Open order value" hint={`${orders.open.length} open order${orders.open.length === 1 ? '' : 's'}, before GST`} value={inr(orders.openValue)} />
              <Figure label="Withdrawals pending" value={inr(withdrawalTotal)} />
            </dl>
          </Panel>

          <Panel title="People" actions={<Link to="/admin/users" className="text-sm font-medium text-mint-600 hover:text-mint-700">Users</Link>}>
            <dl className="divide-y divide-ink-100">
              <Figure label="Clients" value={Number(users.total_clients || 0)} />
              <Figure label="Freelancers" value={Number(users.total_freelancers || 0)} />
              <Figure label="Joined this week" value={Number(users.new_this_week || 0)} />
            </dl>
          </Panel>

          {kycs.length > 0 && (
            <Panel title="KYC waiting" description="Approve to let them take orders.">
              <div className="divide-y divide-ink-100">
                {kycs.slice(0, 4).map(k => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <Avatar name={k.full_name || 'U'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-900">{k.full_name}</div>
                      <div className="truncate text-xs capitalize text-ink-500">{k.level} · {timeAgo(k.created_at)}</div>
                    </div>
                    <button type="button" className="btn sm" onClick={() => setSelectedKyc(k)}>Review</button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {selectedKyc && <KYCReviewModal submission={selectedKyc} onClose={() => setSelectedKyc(null)} />}
    </AdminPage>
  )
}
