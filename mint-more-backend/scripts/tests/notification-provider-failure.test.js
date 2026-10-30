const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../../src/config/database');
const webpush = require('web-push');

test('a push provider failure is persisted for retry without rejecting the action', async () => {
  const originalQuery = database.query;
  const originalSend = webpush.sendNotification;
  const originalKeys = [process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY,process.env.VAPID_SUBJECT];
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY=keys.publicKey;
  process.env.VAPID_PRIVATE_KEY=keys.privateKey;
  process.env.VAPID_SUBJECT='https://mintmore.vercel.app';
  const writes=[];
  database.query = async (sql,params) => {
    if (sql.includes('SELECT n.*')) return {rows:[{id:'demo-notification',user_id:'demo',email:'worker@creatyv-demo.test',role:'client',type:'work_delivered',title:'Ready',body:'Review delivery',data:{},created_at:new Date()}]};
    if (sql.includes('SELECT * FROM notification_preferences')) return {rows:[]};
    if (sql.includes('SELECT * FROM push_subscriptions')) return {rows:[{id:'device',endpoint:'https://fcm.googleapis.com/test',p256dh:'test',auth:'test'}]};
    writes.push({sql,params}); return {rows:[]};
  };
  webpush.sendNotification = async () => {const error=new Error('Simulated provider failure');error.statusCode=503;throw error;};
  try {
    const { deliverNotification } = require('../../src/modules/notifications/notification-delivery.service');
    await assert.doesNotReject(()=>deliverNotification({id:'delivery',notification_id:'demo-notification',user_id:'demo',channel:'push',target_key:'device',attempts:0}));
    assert.ok(writes.some(row=>row.sql.includes("status='failed'") && row.params[2]===60));
    assert.ok(!writes.some(row=>row.sql.includes("status='sent'")));
  } finally {
    database.query=originalQuery;webpush.sendNotification=originalSend;
    ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'].forEach((key,index)=>{if(originalKeys[index]===undefined)delete process.env[key];else process.env[key]=originalKeys[index];});
    await database.pool.end();
  }
});
