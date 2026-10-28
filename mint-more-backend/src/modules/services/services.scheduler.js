/**
 * Background upkeep for storefront orders.
 * - Every minute: offers nobody accepted in time go to the next freelancer.
 * - Every 10 minutes: paid orders still waiting get another try, and freelancers who have
 *   been inactive for 24 hours have booking switched off.
 * A Postgres advisory lock keeps this to one runner when several API instances are up.
 */
const { getClient, query } = require('../../config/database');
const logger = require('../../utils/logger');
const notificationService = require('../notifications/notification.service');
const { expireOffers, retryUnassigned } = require('./services.service');

const OFFER_TICK_MS = 60 * 1000;
const UPKEEP_TICK_MS = 10 * 60 * 1000;
const INACTIVE_HOURS = 24;
const LOCK_KEY = 'creatyv-services-scheduler';

let offerTimer = null;
let upkeepTimer = null;

const withLock = async (name, task) => {
  const client = await getClient();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [`${LOCK_KEY}:${name}`]);
    if (!lock.rows[0]?.ok) return;
    try {
      await task();
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`${LOCK_KEY}:${name}`]);
    }
  } catch (err) {
    logger.error(`[Services] ${name} failed`, { error: err.message });
  } finally {
    client.release();
  }
};

/** Booking off for freelancers with no activity in 24 hours. They can switch it back on any time. */
const switchOffInactiveFreelancers = async () => {
  const result = await query(
    `UPDATE users SET is_available = false
     WHERE role = 'freelancer' AND is_available = true
       AND COALESCE(last_active_at, last_login_at, created_at) < NOW() - ($1 || ' hours')::interval
     RETURNING id`,
    [String(INACTIVE_HOURS)]
  );
  for (const row of result.rows) {
    await notificationService.createNotification({
      userId: row.id,
      type: 'booking_auto_off',
      title: 'Booking switched off',
      body: `You haven't been active for ${INACTIVE_HOURS} hours, so new orders are paused. Switch booking on when you're ready.`,
      entityType: 'user',
      entityId: row.id,
      data: { audience: 'freelancer' },
    }).catch((err) => logger.warn('Booking-off notification failed', { userId: row.id, error: err.message }));
  }
  if (result.rows.length) logger.info('[Services] Booking switched off for inactive freelancers', { count: result.rows.length });
};

const runOffers = () => withLock('offers', async () => {
  const passed = await expireOffers();
  if (passed) logger.info('[Services] Expired offers passed on', { count: passed });
});

const runUpkeep = () => withLock('upkeep', async () => {
  await switchOffInactiveFreelancers();
  await retryUnassigned();
});

const startServicesScheduler = () => {
  if (offerTimer) return;
  offerTimer = setInterval(runOffers, OFFER_TICK_MS);
  upkeepTimer = setInterval(runUpkeep, UPKEEP_TICK_MS);
  offerTimer.unref?.();
  upkeepTimer.unref?.();
  void runOffers();
  void runUpkeep();
  logger.info('[Services] Scheduler started');
};

const closeServicesScheduler = async () => {
  clearInterval(offerTimer);
  clearInterval(upkeepTimer);
  offerTimer = null;
  upkeepTimer = null;
};

module.exports = { startServicesScheduler, closeServicesScheduler, switchOffInactiveFreelancers };
