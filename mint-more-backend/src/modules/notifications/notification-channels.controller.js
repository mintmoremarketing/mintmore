const preferences = require('./notification-preferences.service');
const { readUnsubscribeToken } = require('./notification-channels');
const { query } = require('../../config/database');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');
const env = require('../../config/env');

const getPreferences = async (req,res,next) => {
  try { sendSuccess(res,{data:await preferences.getPreferences(req.user.sub)}); } catch(error) {next(error);}
};
const savePreferences = async (req,res,next) => {
  try { sendSuccess(res,{data:await preferences.savePreferences(req.user.sub,req.body),message:'Notification settings saved'}); } catch(error) {next(error);}
};
const subscribe = async (req,res,next) => {
  try { await preferences.subscribe(req.user.sub,req.body,req.headers['user-agent']); sendSuccess(res,{data:{subscribed:true}}); } catch(error) {next(error);}
};
const unsubscribe = async (req,res,next) => {
  try {
    if (typeof req.body?.endpoint !== 'string') throw new AppError('Device endpoint is required',422);
    await preferences.unsubscribe(req.user.sub,req.body.endpoint);
    sendSuccess(res,{data:{subscribed:false}});
  } catch(error) {next(error);}
};
const emailUnsubscribe = async (req,res) => {
  res.set('Cache-Control','no-store');
  try {
    const userId = readUnsubscribeToken(String(req.query.token || ''));
    if (req.method === 'POST') {
      await query('INSERT INTO notification_preferences(user_id,email) VALUES($1,false) ON CONFLICT(user_id) DO UPDATE SET email=false,updated_at=NOW()', [userId]);
      return res.type('html').send('<h1>Email notifications turned off</h1><p>You can enable them again in Creatyv notification settings.</p>');
    }
    return res.type('html').send('<h1>Turn off Creatyv notification emails?</h1><form method="post"><button type="submit">Unsubscribe</button></form>');
  } catch { return res.status(400).type('html').send('<h1>This unsubscribe link has expired</h1><p>Manage your notification preferences in Creatyv settings.</p>'); }
};
const deliveries = async (req,res,next) => {
  try {
    const result = await query(`SELECT d.id,d.channel,d.status,d.attempts,d.error,d.created_at,d.sent_at,n.title
      FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id ORDER BY d.created_at DESC LIMIT 100`);
    sendSuccess(res,{data:result.rows});
  } catch(error) {next(error);}
};
const testToMe = async (req,res,next) => {
  try {
    const user = (await query('SELECT email FROM users WHERE id=$1',[req.user.sub])).rows[0];
    if (!env.isProd && !user?.email.endsWith('@creatyv-demo.test')) throw new AppError('Local notification tests are limited to demo accounts',403);
    const notification = await require('./notification.service').createNotification({ userId:req.user.sub,type:'system',title:'Creatyv notification test',body:'This is a test from your notification settings.',data:{external_test:true} });
    if (!notification) throw new AppError('Could not queue the test notification',503);
    sendSuccess(res,{data:{notification_id:notification.id},message:'Test queued for your enabled channels'});
  } catch(error) {next(error);}
};
module.exports = {getPreferences,savePreferences,subscribe,unsubscribe,emailUnsubscribe,deliveries,testToMe};
