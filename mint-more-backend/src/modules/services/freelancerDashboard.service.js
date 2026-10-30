/**
 * The freelancer's dashboard: what they've earned and when it pays out, the orders that need
 * them, and the latest things their clients did.
 */
const { query } = require('../../config/database');
const { getSetting } = require('../commerce/settings.service');
const { getWalletByUserId } = require('../wallet/wallet.service');
const { briefTitle } = require('./briefFields');
const { listFreelancerWork } = require('./services.service');

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const OPEN_STAGES = ['in_progress', 'revision_requested'];
const IST_OFFSET_MS = 330 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The next weekly payout day, in India time. payouts.scheduled_weekday (0 = Sunday … 6 = Saturday)
 * sets the day; Friday until it's set. Today counts when today is the day.
 */
const nextPayoutDate = (weekday, now = new Date()) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const days = (weekday - ist.getUTCDay() + 7) % 7;
  const date = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days));
  return { date: date.toISOString().slice(0, 10), weekday: WEEKDAYS[weekday], days_away: days };
};

/** Client events worth a freelancer's attention: revisions, approvals, completions, views and messages. */
const clientUpdates = async (freelancerId, roomsByJob) => {
  const [events, messages] = await Promise.all([
    query(
      `SELECT id, type, title, body, created_at, is_read, COALESCE(data->>'job_id', entity_id::text) AS job_id
       FROM notifications
       WHERE user_id = $1 AND type IN ('revision_requested', 'delivery_approved', 'job_completed', 'mintbox_seen')
       ORDER BY created_at DESC LIMIT 12`,
      [freelancerId]
    ),
    // The latest unread message from each client, not every one of them.
    query(
      `SELECT DISTINCT ON (cr.id) m.id, m.content, m.attachment_type, m.created_at, cr.job_id
       FROM messages m
       JOIN chat_rooms cr ON cr.id = m.room_id
       WHERE cr.freelancer_id = $1 AND m.sender_role = 'client' AND m.read_by_freelancer = false AND m.is_deleted = false
       ORDER BY cr.id, m.created_at DESC`,
      [freelancerId]
    ),
  ]);
  const kindOf = { revision_requested: 'revision', delivery_approved: 'approved', job_completed: 'completed', mintbox_seen: 'viewed' };
  const rows = [
    ...events.rows.map((row) => ({
      id: `n-${row.id}`, kind: kindOf[row.type], title: row.title, body: row.body, at: row.created_at,
      unread: !row.is_read, job_id: row.job_id,
    })),
    ...messages.rows.map((row) => ({
      id: `m-${row.id}`, kind: 'message', title: 'New message',
      body: row.content || (row.attachment_type ? `Sent a ${row.attachment_type === 'image' ? 'photo' : row.attachment_type}` : ''),
      at: row.created_at, unread: true, job_id: row.job_id,
    })),
  ];
  return rows
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)
    .map((row) => ({ ...row, ...(roomsByJob.get(row.job_id) || {}) }));
};

const getFreelancerDashboard = async (freelancerId) => {
  const [work, wallet, payouts, pendingWithdrawals] = await Promise.all([
    listFreelancerWork(freelancerId),
    getWalletByUserId(freelancerId).catch(() => null),
    getSetting('payouts', {}),
    query(`SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE user_id = $1 AND status = 'pending'`, [freelancerId])
      .catch(() => ({ rows: [{ total: 0 }] })),
  ]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const completed = work.filter((row) => row.stage === 'completed');
  const open = work.filter((row) => OPEN_STAGES.includes(row.stage));
  const hoursLeft = (row) => (row.due_at ? (new Date(row.due_at) - now) / 3_600_000 : Infinity);
  const name = (row) => briefTitle(row.brief) || row.snapshot?.title || row.template_title;

  const roomsByJob = new Map(work.map((row) => [String(row.job_id), {
    order_title: name(row), booking_number: row.booking_number, room_id: row.room_id, booking_id: row.id,
  }]));
  const weekday = Number.isInteger(Number(payouts?.scheduled_weekday)) ? Number(payouts.scheduled_weekday) % 7 : 5;

  return {
    earnings: {
      available: money(wallet?.balance),
      in_withdrawal: money(pendingWithdrawals.rows[0]?.total),
      total_earned: money(completed.reduce((sum, row) => sum + Number(row.freelancer_payout), 0)),
      this_month: money(completed
        .filter((row) => new Date(row.completed_at || row.updated_at) >= monthStart)
        .reduce((sum, row) => sum + Number(row.freelancer_payout), 0)),
      // Paid by clients and held by Creatyv: released as each of these orders is completed.
      on_the_way: money(work
        .filter((row) => !['completed', 'cancelled'].includes(row.stage))
        .reduce((sum, row) => sum + Number(row.freelancer_payout), 0)),
    },
    next_payout: { ...nextPayoutDate(weekday, now), label: payouts?.scheduled_label || 'Weekly payout' },
    orders: {
      active: open.length,
      revisions: work.filter((row) => row.stage === 'revision_requested').length,
      awaiting_client: work.filter((row) => ['delivered', 'approved'].includes(row.stage)).length,
      overdue: open.filter((row) => hoursLeft(row) < 0).length,
      due_today: open.filter((row) => hoursLeft(row) >= 0 && hoursLeft(row) < 24).length,
      completed: completed.length,
      // Most urgent first: revisions, then the nearest due date.
      next_up: [...open]
        .sort((a, b) => (b.stage === 'revision_requested') - (a.stage === 'revision_requested') || hoursLeft(a) - hoursLeft(b))
        .slice(0, 5)
        .map((row) => ({
          id: row.id, title: name(row), service: row.snapshot?.title, booking_number: row.booking_number,
          stage: row.stage, due_at: row.due_at, payout: money(row.freelancer_payout), room_id: row.room_id,
        })),
    },
    updates: await clientUpdates(freelancerId, roomsByJob),
  };
};

module.exports = { getFreelancerDashboard, nextPayoutDate };
