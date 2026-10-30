const env = require('../../config/env');

function notificationPath(n, role) {
  const d = n.data || {};
  if (n.type?.startsWith('service_offer')) return '/work';
  if (n.entity_type === 'ai_edit') return `/ai-edits/${encodeURIComponent(n.entity_id)}`;
  if (n.entity_type === 'wallet' || d.notification_event === 'payout_released' || ['escrow_released', 'payment_received', 'withdrawal_processed'].includes(n.type)) return '/wallet';
  if (n.entity_type === 'dispute' || d.dispute_id) return `/disputes?id=${encodeURIComponent(d.dispute_id || n.entity_id)}`;
  if (d.room_id || d.roomId) return `/chat?room=${encodeURIComponent(d.room_id || d.roomId)}`;
  const job = d.job_id || d.jobId || (n.entity_type === 'job' ? n.entity_id : null);
  if (job && role !== 'admin') return `/chat?job=${encodeURIComponent(job)}`;
  if (n.entity_type === 'service_booking' || d.booking_id) return role === 'admin' ? '/admin/service-orders' : `/orders/${encodeURIComponent(d.booking_id || n.entity_id)}`;
  return role === 'admin' ? '/admin/operations?tab=notifications' : '/notifications';
}
const appOrigin = () => new URL(process.env.NOTIFICATIONS_APP_URL || (env.isProd ? 'https://mintmore.vercel.app' : process.env.FRONTEND_URL || 'http://localhost:5173')).origin;
const notificationLink = (n, role) => new URL(notificationPath(n, role), appOrigin()).href;
module.exports = { notificationPath, notificationLink, appOrigin };
