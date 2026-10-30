const channels = {
  work_delivered: { push: true, email: true, whatsapp: 'delivery_ready' },
  revision_delivered: { push: true, email: true, whatsapp: 'delivery_ready' },
  delivery_approved: { push: true, email: true, whatsapp: 'delivery_approved' },
  service_offer: { push: true, whatsapp: 'new_offer', urgent: true },
  new_message: { push: true, chat: true },
  chat_message: { push: true, chat: true },
  escrow_released: { push: true, email: true, whatsapp: 'payout_released' },
  payment_received: { push: true, email: true, whatsapp: 'payout_released' },
  withdrawal_processed: { push: true, email: true, whatsapp: 'payout_released' },
};

function policyFor(notification) {
  const data = notification.data || {};
  if (data.notification_event === 'chat_message') return { push: true, chat: true };
  if (data.notification_event === 'payout_released') return { push: true, email: true, whatsapp: 'payout_released' };
  if (data.external_test === true) return { push: true, email: true, whatsapp: 'notification_test', urgent: true };
  if (notification.type === 'ai_edit_update') return {
    push: true,
    email: ['done', 'failed'].includes(data.state),
    whatsapp: ['plan_ready', 'done'].includes(data.state) ? 'ai_edit_ready' : false,
  };
  if (notification.entity_type === 'dispute') return { push: true, email: true };
  if (data.notification_event === 'draft_approved') return { push: true, whatsapp: 'draft_approved' };
  if (data.notification_event === 'draft_changes') return { push: true, whatsapp: 'draft_changes' };
  return channels[notification.type] || {};
}

function quietUntil(preferences, now = new Date()) {
  if (preferences.quiet_start == null || preferences.quiet_end == null) return null;
  const ist = new Date(now.getTime() + 330 * 60_000);
  const hour = ist.getUTCHours();
  const start = Number(preferences.quiet_start);
  const end = Number(preferences.quiet_end);
  const quiet = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  if (!quiet) return null;
  ist.setUTCHours(end, 0, 0, 0);
  let until = new Date(ist.getTime() - 330 * 60_000);
  if (until <= now) until = new Date(until.getTime() + 86400_000);
  return until;
}

module.exports = { policyFor, quietUntil };
