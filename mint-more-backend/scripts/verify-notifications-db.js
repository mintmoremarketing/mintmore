const { query, getClient, pool } = require('../src/config/database');
const crypto = require('crypto');

async function main() {
  const demo = await query("SELECT id FROM users WHERE email LIKE '%@creatyv-demo.test' LIMIT 1");
  if (!demo.rows[0]) throw new Error('No demo account available; no records changed');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const n = (await client.query("INSERT INTO notifications(user_id,type,title,body) VALUES($1,'system','Notification queue verification','Transaction will be rolled back') RETURNING id", [demo.rows[0].id])).rows[0];
    const job = await client.query('SELECT 1 FROM notification_dispatch_jobs WHERE notification_id=$1',[n.id]);
    if (job.rows.length !== 1) throw new Error('Transactional dispatch job missing');
    const subscription = crypto.randomUUID();
    for (let i=0;i<2;i++) await client.query("INSERT INTO notification_deliveries(notification_id,user_id,channel,target_key) VALUES($1,$2,'push',$3) ON CONFLICT DO NOTHING", [n.id,demo.rows[0].id,subscription]);
    const count = await client.query('SELECT COUNT(*)::int AS count FROM notification_deliveries WHERE notification_id=$1',[n.id]);
    if (count.rows[0].count !== 1) throw new Error('Delivery deduplication failed');
    const security = await client.query("SELECT COUNT(*)::int AS count FROM pg_class WHERE relname=ANY($1) AND relrowsecurity", [['notification_preferences','push_subscriptions','notification_dispatch_jobs','notification_deliveries']]);
    if (security.rows[0].count !== 4) throw new Error('RLS missing');
    console.log('Verified: transactional dispatch, per-device deduplication and RLS. All test rows rolled back.');
  } finally { await client.query('ROLLBACK'); client.release(); }
}
main().then(()=>pool.end()).catch(async error=>{console.error(error.message);await pool.end();process.exitCode=1;});
