const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { policyFor, quietUntil } = require('./channels.config');
const { getPreferences, capabilities } = require('./notification-preferences.service');
const { notificationLink } = require('./notification-link');
const channels = require('./notification-channels');

let timer;
let running;
const demoOnly = () => !env.isProd;

async function planNext(notificationId = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT n.*,u.email FROM notification_dispatch_jobs j
      JOIN notifications n ON n.id=j.notification_id JOIN users u ON u.id=n.user_id
      WHERE j.processed_at IS NULL AND ($1::boolean=false OR u.email LIKE '%@creatyv-demo.test')
      AND ($2::uuid IS NULL OR n.id=$2)
      ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`, [demoOnly(),notificationId]);
    const n = found.rows[0];
    if (!n) { await client.query('COMMIT'); return false; }
    const policy = policyFor(n);
    const actor = n.data?.actor_id || n.data?.sender_id;
    const suppressed = actor === n.user_id || (n.data?.expires_at && new Date(n.data.expires_at) <= new Date());
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`notification:${n.user_id}`]);
    let collapse = false;
    if (policy.chat) {
      const previous = await client.query(`SELECT 1 FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id
        WHERE d.user_id=$1 AND d.channel='push' AND d.status <> 'skipped' AND n.type=$2
        AND COALESCE(n.data->>'room_id',n.entity_id::text,'')=$3 AND d.created_at>NOW()-INTERVAL '5 minutes' LIMIT 1`,
      [n.user_id,n.type,String(n.data?.room_id || n.entity_id || '')]);
      collapse = previous.rows.length > 0;
    }
    if (!suppressed && !collapse) {
      for (const channel of ['push','email','whatsapp']) {
        if (!policy[channel]) continue;
        const targets = channel === 'push'
          ? (await client.query('SELECT id::text AS key FROM push_subscriptions WHERE user_id=$1', [n.user_id])).rows
          : [{ key:'' }];
        for (const target of targets) await client.query(`INSERT INTO notification_deliveries(notification_id,user_id,channel,target_key)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [n.id,n.user_id,channel,target.key]);
      }
    }
    await client.query('UPDATE notification_dispatch_jobs SET processed_at=NOW() WHERE notification_id=$1', [n.id]);
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function claimDeliveries(notificationId = null) {
  await query(`UPDATE notification_deliveries d SET status='failed',locked_at=NULL,error='Final delivery outcome unknown after worker restart'
    FROM users u WHERE u.id=d.user_id AND d.status='processing' AND d.attempts>=4
    AND d.locked_at<NOW()-INTERVAL '3 minutes' AND ($1::boolean=false OR u.email LIKE '%@creatyv-demo.test')
    AND ($2::uuid IS NULL OR d.notification_id=$2)`, [demoOnly(),notificationId]);
  const result = await query(`WITH picked AS (
    SELECT d.id FROM notification_deliveries d JOIN users u ON u.id=d.user_id
    WHERE ((d.status IN ('queued','failed') AND d.available_at<=NOW()) OR (d.status='processing' AND d.locked_at<NOW()-INTERVAL '3 minutes'))
    AND d.attempts<4 AND ($1::boolean=false OR u.email LIKE '%@creatyv-demo.test')
    AND ($2::uuid IS NULL OR d.notification_id=$2)
    ORDER BY d.available_at LIMIT 12 FOR UPDATE OF d SKIP LOCKED
  ) UPDATE notification_deliveries d SET status='processing',locked_at=NOW()
    FROM picked WHERE d.id=picked.id RETURNING d.*`, [demoOnly(),notificationId]);
  return result.rows;
}
async function skip(delivery, reason) {
  await query("UPDATE notification_deliveries SET status='skipped',error=$2,locked_at=NULL WHERE id=$1", [delivery.id,reason]);
}
async function deliver(delivery) {
  const found = await query(`SELECT n.*,u.email,u.role FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.id=$1`, [delivery.notification_id]);
  const n = found.rows[0];
  if (!n) return skip(delivery,'Notification unavailable');
  if (n.data?.expires_at && new Date(n.data.expires_at) <= new Date()) return skip(delivery,'Offer expired');
  const policy = policyFor(n);
  if (policy.chat && n.is_read) return skip(delivery,'Conversation already read');
  if (policy.chat && new Date(n.created_at).getTime() < Date.now()-30*60_000) return skip(delivery,'Chat alert expired');
  if (policy.chat && n.data?.message_id) {
    const read = await query(`SELECT 1 FROM messages m JOIN chat_rooms r ON r.id=m.room_id WHERE m.id=$1
      AND ((r.client_id=$2 AND m.read_by_client) OR (r.freelancer_id=$2 AND m.read_by_freelancer))`, [n.data.message_id,delivery.user_id]);
    if (read.rows.length) return skip(delivery,'Conversation already read');
  }
  const preferences = await getPreferences(delivery.user_id);
  if (!preferences[delivery.channel]) return skip(delivery,'Disabled in notification settings');
  if (!capabilities()[delivery.channel]) return skip(delivery,'Provider not configured');
  const until = !policy.urgent && delivery.channel !== 'email' ? quietUntil(preferences) : null;
  if (until) {
    await query("UPDATE notification_deliveries SET status='queued',available_at=$2,locked_at=NULL WHERE id=$1", [delivery.id,until]);
    return;
  }
  const link = notificationLink(n,n.role);
  let subscription;
  if (delivery.channel === 'push') {
    subscription = (await query('SELECT * FROM push_subscriptions WHERE id::text=$1 AND user_id=$2', [delivery.target_key,delivery.user_id])).rows[0];
    if (!subscription) return skip(delivery,'Device unsubscribed');
  }
  if (delivery.channel === 'whatsapp' && (!preferences.whatsapp_opt_in_at || !preferences.whatsapp_phone)) return skip(delivery,'WhatsApp consent or phone missing');
  await query('UPDATE notification_deliveries SET attempts=attempts+1 WHERE id=$1', [delivery.id]);
  try {
    const providerId = delivery.channel === 'push'
      ? await channels.sendPush(subscription,n,link,policy)
      : delivery.channel === 'email'
        ? await channels.sendEmail({id:delivery.user_id,email:n.email},n,link,delivery.id)
        : await channels.sendWhatsApp(preferences,n,link,policy);
    await query("UPDATE notification_deliveries SET status=CASE WHEN status IN ('delivered','read') THEN status ELSE 'sent' END,provider_id=$2,sent_at=COALESCE(sent_at,NOW()),error=NULL,locked_at=NULL WHERE id=$1", [delivery.id,providerId || null]);
    if (subscription) await query('UPDATE push_subscriptions SET last_used_at=NOW() WHERE id=$1', [subscription.id]);
  } catch (error) {
    if (subscription && [404,410].includes(error.statusCode)) {
      await query('DELETE FROM push_subscriptions WHERE id=$1', [subscription.id]);
      return skip(delivery,'Push subscription expired');
    }
    const attempt = Number(delivery.attempts) + 1;
    const delay = [60,300,1800][Math.min(attempt-1,2)];
    const reason = delivery.channel === 'push' ? `Push service error (${error.statusCode || 'network'})` : error.message.slice(0,250);
    await query("UPDATE notification_deliveries SET status='failed',error=$2,locked_at=NULL,available_at=NOW()+($3::int*INTERVAL '1 second') WHERE id=$1", [delivery.id,reason,delay]);
    logger.warn('External notification delivery failed', {deliveryId:delivery.id,channel:delivery.channel,attempt});
  }
}

async function sweep({ notificationId = null } = {}) {
  for (let i=0;i<30;i++) if (!await planNext(notificationId)) break;
  const deliveries = await claimDeliveries(notificationId);
  for (let i=0;i<deliveries.length;i+=4) {
    const results = await Promise.allSettled(deliveries.slice(i,i+4).map(deliver));
    for (const result of results) if (result.status === 'rejected') logger.warn('Notification worker will recover delivery', {error:result.reason.message});
  }
}
function startNotificationWorker() {
  if (timer || process.env.NOTIFICATION_DELIVERY_ENABLED === 'false' || (!env.isProd && process.env.ENABLE_NOTIFICATION_WORKER !== 'true')) return;
  const tick = () => {
    if (running) return;
    running = sweep().catch(error => logger.warn('Notification sweep failed', {error:error.message})).finally(() => {running=null;});
  };
  timer = setInterval(tick,15000);
  timer.unref();
  tick();
}
async function closeNotificationWorker() {
  clearInterval(timer); timer=null;
  if (running) await running;
}
async function recordWhatsAppStatus(status) {
  if (!['sent','delivered','read','failed'].includes(status.status)) return;
  await query(`UPDATE notification_deliveries SET status=$2,
    error=CASE WHEN $2='failed' THEN 'WhatsApp delivery failed' ELSE NULL END
    , available_at=CASE WHEN $2='failed' THEN NOW() +
      ((CASE attempts WHEN 1 THEN 60 WHEN 2 THEN 300 ELSE 1800 END)*INTERVAL '1 second') ELSE available_at END
    WHERE provider_id=$1 AND channel='whatsapp'
    AND (($2='failed' AND status NOT IN ('delivered','read')) OR
      (CASE status WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END)
      <= (CASE $2 WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END))`, [status.id,status.status]);
}
module.exports = { startNotificationWorker, closeNotificationWorker, sweep, recordWhatsAppStatus, deliverNotification: deliver };
