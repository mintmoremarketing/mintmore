const assert = require('node:assert/strict');
const { query,pool } = require('../src/config/database');
// This verification must never contact any external provider.
process.env.VAPID_PRIVATE_KEY='';
process.env.RESEND_API_KEY='';
process.env.META_WA_ACCESS_TOKEN='';
const { sweep,recordWhatsAppStatus } = require('../src/modules/notifications/notification-delivery.service');

async function main() {
  const user = (await query("SELECT id FROM users WHERE email LIKE '%@creatyv-demo.test' LIMIT 1")).rows[0];
  if (!user) throw new Error('No demo account available');
  const n = (await query("INSERT INTO notifications(user_id,type,title,body) VALUES($1,'work_delivered','Worker verification','No external sends; test rows are removed') RETURNING id",[user.id])).rows[0];
  try {
    await sweep({notificationId:n.id});
    const jobs = await query('SELECT processed_at FROM notification_dispatch_jobs WHERE notification_id=$1',[n.id]);
    assert.ok(jobs.rows[0].processed_at);
    const deliveries = (await query('SELECT status,attempts FROM notification_deliveries WHERE notification_id=$1',[n.id])).rows;
    assert.ok(deliveries.length >= 2);
    assert.ok(deliveries.every(d=>d.status==='skipped' && d.attempts===0));
    await sweep({notificationId:n.id});
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM notification_deliveries WHERE notification_id=$1',[n.id])).rows[0].count,deliveries.length);
    const receiptId=`worker-receipt-${n.id}`;
    await query("UPDATE notification_deliveries SET status='sent',provider_id=$2,attempts=1 WHERE notification_id=$1 AND channel='whatsapp'",[n.id,receiptId]);
    await recordWhatsAppStatus({id:receiptId,status:'failed'});
    assert.equal((await query('SELECT status FROM notification_deliveries WHERE provider_id=$1',[receiptId])).rows[0].status,'failed');
    await recordWhatsAppStatus({id:receiptId,status:'read'});
    await recordWhatsAppStatus({id:receiptId,status:'delivered'});
    assert.equal((await query('SELECT status FROM notification_deliveries WHERE provider_id=$1',[receiptId])).rows[0].status,'read');
    console.log('Verified worker SQL, channel dispatch, safe missing-provider handling, deduplication and WhatsApp receipt ordering. No external messages sent.');
  } finally {
    await query('DELETE FROM notification_deliveries WHERE notification_id=$1',[n.id]);
    await query('DELETE FROM notification_dispatch_jobs WHERE notification_id=$1',[n.id]);
    await query('DELETE FROM notifications WHERE id=$1 AND user_id=$2',[n.id,user.id]);
  }
}
main().then(()=>pool.end()).catch(async error=>{console.error('Worker verification failed:',error.message);await pool.end();process.exitCode=1;});
