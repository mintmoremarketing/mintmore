const assert = require('node:assert/strict');
const crypto = require('crypto');
const app = require('../src/app');
const { query,pool } = require('../src/config/database');
const { signAccessToken,verifyAccessToken } = require('../src/utils/jwt');
const { unsubscribeToken,readUnsubscribeToken } = require('../src/modules/notifications/notification-channels');

async function main() {
  const demos = (await query("SELECT id,role,email FROM users WHERE email LIKE '%@creatyv-demo.test' ORDER BY role='client' DESC LIMIT 2")).rows;
  if (demos.length !== 2) throw new Error('Two demo accounts are required');
  const endpoint = `https://fcm.googleapis.com/creatyv-verification-${crypto.randomUUID()}`;
  const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
  const subscription = {endpoint,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
  const tokens=demos.map(user=>signAccessToken({sub:user.id,role:user.role,email:user.email}));
  const originalPreferences=(await query('SELECT * FROM notification_preferences WHERE user_id=$1',[demos[0].id])).rows[0];
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/v1/notifications`;
  const call=(route,method='GET',body,token=tokens[0])=>fetch(`${base}${route}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try {
    assert.equal((await call('/preferences')).status,200);
    const saved=await call('/preferences','PATCH',{quiet_start:22,quiet_end:8,email:false});
    assert.equal(saved.status,200);
    const preferences=(await saved.json()).data;
    assert.equal(preferences.quiet_start,22);
    assert.equal(preferences.quiet_end,8);
    assert.equal(preferences.email,false);
    assert.equal((await call('/preferences','PATCH',{quiet_start:24,quiet_end:8})).status,422);
    assert.equal((await call('/preferences','PATCH',{whatsapp:true,whatsapp_phone:'+919999999999'})).status,422);
    assert.equal((await call('/push/subscribe','POST',{...subscription,endpoint:'https://127.0.0.1/private'})).status,422);
    assert.equal((await call('/push/subscribe','POST',subscription)).status,200);
    assert.equal((await call('/push/subscribe','DELETE',{endpoint},tokens[1])).status,200);
    assert.equal((await query('SELECT 1 FROM push_subscriptions WHERE endpoint=$1',[endpoint])).rows.length,1);
    assert.equal((await call('/push/subscribe','DELETE',{endpoint})).status,200);
    assert.equal((await query('SELECT 1 FROM push_subscriptions WHERE endpoint=$1',[endpoint])).rows.length,0);
    const token=unsubscribeToken(demos[0].id);
    assert.equal(readUnsubscribeToken(token),demos[0].id);
    assert.throws(()=>verifyAccessToken(token));
    assert.equal((await call('/admin/deliveries')).status,demos[0].role==='admin'?200:403);
    console.log('Verified notification APIs: preferences validation, explicit WhatsApp consent, push endpoint allowlist, device ownership, admin access and isolated unsubscribe tokens.');
  } finally {
    if (originalPreferences) {
      const p=originalPreferences;
      await query('UPDATE notification_preferences SET push=$2,email=$3,whatsapp=$4,whatsapp_phone=$5,whatsapp_opt_in_at=$6,quiet_start=$7,quiet_end=$8,updated_at=$9 WHERE user_id=$1',
        [demos[0].id,p.push,p.email,p.whatsapp,p.whatsapp_phone,p.whatsapp_opt_in_at,p.quiet_start,p.quiet_end,p.updated_at]);
    } else await query('DELETE FROM notification_preferences WHERE user_id=$1',[demos[0].id]);
    await query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2',[endpoint,demos[0].id]);
    await new Promise(resolve=>server.close(resolve));
  }
}
main().then(async()=>{await pool.end();process.exit(0);}).catch(async error=>{console.error('Notification API verification failed:',error.message);await pool.end();process.exit(1);});
