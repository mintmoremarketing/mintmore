const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');

const normalisePhone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  const number = digits.length === 10 ? `91${digits}` : digits;
  if (!/^[1-9]\d{7,14}$/.test(number)) throw new AppError('Enter a valid phone number with its country code', 422);
  return `+${number}`;
};
const capabilities = () => ({
  push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
  email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  whatsapp: Boolean(process.env.META_WA_ACCESS_TOKEN && process.env.META_WA_API_VERSION && process.env.META_WA_NOTIFICATION_PHONE_ID && process.env.META_WA_NOTIFICATION_TEMPLATES),
});
async function getPreferences(userId) {
  const result = await query('SELECT * FROM notification_preferences WHERE user_id=$1', [userId]);
  return {
    push: true, email: true, whatsapp: false, quiet_start: null, quiet_end: null,
    whatsapp_phone: '', ...result.rows[0],
    capabilities: capabilities(), public_key: process.env.VAPID_PUBLIC_KEY || null,
  };
}
async function savePreferences(userId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Notification preferences must be an object',422);
  const existing = await getPreferences(userId);
  const next = { ...existing };
  for (const key of ['push', 'email', 'whatsapp']) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw new AppError(`${key} must be true or false`, 422);
      next[key] = input[key];
    }
  }
  for (const key of ['quiet_start', 'quiet_end']) {
    if (input[key] !== undefined) {
      if (input[key] !== null && (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 23)) throw new AppError('Quiet hours must be between 0 and 23', 422);
      next[key] = input[key];
    }
  }
  if ((next.quiet_start === null) !== (next.quiet_end === null) || (next.quiet_start !== null && next.quiet_start === next.quiet_end)) throw new AppError('Choose both quiet hours, with different start and end times', 422);
  if (input.whatsapp_phone !== undefined) {
    if (typeof input.whatsapp_phone !== 'string') throw new AppError('WhatsApp number must be text',422);
    next.whatsapp_phone = input.whatsapp_phone ? normalisePhone(input.whatsapp_phone) : '';
  }
  const phoneChanged = next.whatsapp_phone !== existing.whatsapp_phone;
  if (next.whatsapp && (!existing.whatsapp || phoneChanged) && input.whatsapp_consent !== true) throw new AppError('Confirm that you want Creatyv updates on WhatsApp', 422);
  if (next.whatsapp && !next.whatsapp_phone) throw new AppError('Add a WhatsApp number first', 422);
  await query(`INSERT INTO notification_preferences(user_id,push,email,whatsapp,whatsapp_phone,whatsapp_opt_in_at,quiet_start,quiet_end)
    VALUES($1,$2,$3,$4,$5,CASE WHEN $4 THEN NOW() ELSE NULL END,$6,$7)
    ON CONFLICT(user_id) DO UPDATE SET push=$2,email=$3,whatsapp=$4,whatsapp_phone=$5,
    whatsapp_opt_in_at=CASE WHEN $4 THEN CASE WHEN notification_preferences.whatsapp_phone IS DISTINCT FROM $5
      THEN NOW() ELSE COALESCE(notification_preferences.whatsapp_opt_in_at,NOW()) END ELSE NULL END,
    quiet_start=$6,quiet_end=$7,updated_at=NOW()`,
  [userId,next.push,next.email,next.whatsapp,next.whatsapp_phone || null,next.quiet_start,next.quiet_end]);
  return getPreferences(userId);
}
function validateSubscription(subscription) {
  let url;
  try { url = new URL(subscription?.endpoint); } catch { throw new AppError('Invalid push subscription', 422); }
  const hosts = ['fcm.googleapis.com','updates.push.services.mozilla.com','push.apple.com','notify.windows.com','push.microsoft.com'];
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new AppError('Unsupported push service', 422);
  const keys = subscription.keys;
  if (url.href.length > 4096 || !/^[A-Za-z0-9_-]{87}$/.test(keys?.p256dh || '') || !/^[A-Za-z0-9_-]{22}$/.test(keys?.auth || '')) throw new AppError('Invalid push subscription keys', 422);
}
async function subscribe(userId, subscription, userAgent) {
  validateSubscription(subscription);
  // An explicit permission action associates this device with the current signed-in account.
  await query(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4,user_agent=$5,last_used_at=NOW()`,
  [userId,subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,String(userAgent || '').slice(0,500)]);
}
const unsubscribe = (userId, endpoint) => query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [userId,endpoint]);
module.exports = { getPreferences, savePreferences, subscribe, unsubscribe, capabilities, normalisePhone };
