const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { policyFor, quietUntil } = require('../../src/modules/notifications/channels.config');

test('quiet hours use IST and defer overnight until the next end time', () => {
  const prefs = {quiet_start:22,quiet_end:8};
  assert.equal(quietUntil(prefs,new Date('2026-10-30T17:30:00Z')).toISOString(),'2026-10-31T02:30:00.000Z');
  assert.equal(quietUntil(prefs,new Date('2026-10-31T01:00:00Z')).toISOString(),'2026-10-31T02:30:00.000Z');
  assert.equal(quietUntil(prefs,new Date('2026-10-31T02:30:00Z')),null);
  assert.equal(quietUntil({quiet_start:9,quiet_end:17},new Date('2026-10-30T05:00:00Z')).toISOString(),'2026-10-30T11:30:00.000Z');
});
test('important policy events and AI states choose the intended channels', () => {
  assert.equal(policyFor({type:'service_offer'}).urgent,true);
  assert.equal(policyFor({type:'system',data:{notification_event:'payout_released'}}).email,true);
  assert.equal(policyFor({type:'system',data:{notification_event:'chat_message'}}).whatsapp,undefined);
  assert.equal(policyFor({type:'ai_edit_update',data:{state:'planning'}}).email,false);
  assert.equal(policyFor({type:'ai_edit_update',data:{state:'done'}}).email,true);
  assert.equal(policyFor({type:'ai_edit_update',data:{state:'plan_ready'}}).whatsapp,'ai_edit_ready');
  assert.deepEqual(policyFor({type:'unknown'}),{});
});
test('service worker displays push without a page and restricts notification links to Creatyv', async () => {
  const handlers = {};
  let displayed;
  const self = {location:{origin:'https://mintmore.vercel.app'},addEventListener:(event,callback)=>{handlers[event]=callback;},
    registration:{showNotification:async(title,options)=>{displayed={title,...options};}},clients:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../../mint-more-frontend/public/sw.js'),'utf8'),{self,URL});
  let pending;
  handlers.push({data:{json:()=>({title:'Delivery ready',body:'Review it',url:'https://evil.example/token'})},waitUntil:promise=>{pending=promise;}});
  await pending;
  assert.equal(displayed.data.url,'https://mintmore.vercel.app/notifications');
  handlers.push({data:{json:()=>({url:'/chat?job=demo'})},waitUntil:promise=>{pending=promise;}});
  await pending;
  assert.equal(displayed.data.url,'https://mintmore.vercel.app/chat?job=demo');
});
test('notification click focuses and navigates an existing app window', async () => {
  const handlers = {};
  const actions = [];
  const self = {location:{origin:'https://mintmore.vercel.app'},addEventListener:(name,fn)=>{handlers[name]=fn;},
    clients:{matchAll:async()=>[{url:'https://mintmore.vercel.app/dashboard',navigate:async url=>actions.push(url),focus:async()=>actions.push('focused')}],openWindow:async()=>actions.push('opened')}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../../mint-more-frontend/public/sw.js'),'utf8'),{self,URL});
  let pending;
  handlers.notificationclick({notification:{data:{url:'/wallet'},close:()=>{}},waitUntil:p=>{pending=p;}});
  await pending;
  assert.deepEqual(actions,['https://mintmore.vercel.app/wallet','focused']);
});
