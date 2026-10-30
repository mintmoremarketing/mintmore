const webpush = require('web-push');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../config/env');
const { appOrigin } = require('./notification-link');

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unsubscribeSecret = crypto.createHmac('sha256', env.jwt.accessSecret).update('notification-email-unsubscribe-v1').digest('hex');
const unsubscribeToken = userId => jwt.sign({ sub: userId, purpose: 'notification-email-unsubscribe' }, unsubscribeSecret, { algorithm: 'HS256', expiresIn: '90d' });
function readUnsubscribeToken(token) {
  const data = jwt.verify(token, unsubscribeSecret, { algorithms: ['HS256'] });
  if (data.purpose !== 'notification-email-unsubscribe' || !data.sub) throw new Error('Invalid unsubscribe link');
  return data.sub;
}
async function providerRequest(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Provider rejected notification (HTTP ${response.status})`);
  return response.json();
}
async function sendPush(subscription, notification, link, policy) {
  const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify({ title: notification.title.slice(0,150), body: (notification.body || '').slice(0,500), url: link,
      tag: policy.chat ? `chat-${notification.data?.room_id || notification.entity_id}` : notification.id }), {
      vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
      TTL: notification.data?.expires_at ? Math.max(0, Math.min(86400, Math.floor((new Date(notification.data.expires_at) - Date.now()) / 1000))) : 86400,
      urgency: policy.urgent ? 'high' : 'normal', timeout: 20000,
    });
  return String(result.statusCode);
}
async function sendEmail(user, notification, link, deliveryId) {
  const apiOrigin = process.env.NOTIFICATIONS_API_URL || (env.isProd ? 'https://mintmore-production.up.railway.app' : `http://localhost:${env.port}`);
  const unsubscribe = `${apiOrigin}/api/v1/notifications/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`;
  const settings = `${appOrigin()}/settings?section=notifications`;
  const text = `${notification.title}\n\n${notification.body}\n\nOpen Creatyv: ${link}\nNotification settings: ${settings}\nUnsubscribe: ${unsubscribe}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#10151b"><p style="font-size:22px;font-weight:bold">CREATYV</p><h1 style="font-size:24px">${escapeHtml(notification.title)}</h1><p style="line-height:1.6">${escapeHtml(notification.body)}</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#10151b;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none">Open Creatyv</a></p><p style="font-size:13px"><a href="${escapeHtml(settings)}">Manage notifications</a> · <a href="${escapeHtml(unsubscribe)}">Unsubscribe from notification emails</a></p></div>`;
  const result = await providerRequest('https://api.resend.com/emails', { method:'POST', headers: {
    Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':deliveryId,
  }, body: JSON.stringify({ from:process.env.EMAIL_FROM, to:[user.email], subject:notification.title, html, text,
    headers:{ 'List-Unsubscribe':`<${unsubscribe}>`, 'List-Unsubscribe-Post':'List-Unsubscribe=One-Click' } }) });
  return result.id;
}
async function sendWhatsApp(preferences, notification, link, policy) {
  const templates = JSON.parse(process.env.META_WA_NOTIFICATION_TEMPLATES || '{}');
  const template = templates[policy.whatsapp];
  if (!template) throw new Error(`Approved WhatsApp template not configured: ${policy.whatsapp}`);
  // Templates use two body variables (title, message) and one dynamic URL button suffix.
  const suffix = new URL(link).pathname.slice(1) + new URL(link).search;
  const result = await providerRequest(`https://graph.facebook.com/${env.whatsapp.apiVersion}/${process.env.META_WA_NOTIFICATION_PHONE_ID}/messages`, {
    method:'POST', headers:{Authorization:`Bearer ${env.whatsapp.accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({ messaging_product:'whatsapp', to:preferences.whatsapp_phone.replace(/\D/g,''), type:'template', template:{
      name:template, language:{code:process.env.META_WA_NOTIFICATION_LANGUAGE || 'en'}, components:[
        {type:'body',parameters:[{type:'text',text:notification.title},{type:'text',text:notification.body}]},
        {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:suffix || 'notifications'}]},
      ],
    }}),
  });
  return result.messages?.[0]?.id;
}
module.exports = { sendPush, sendEmail, sendWhatsApp, unsubscribeToken, readUnsubscribeToken };
