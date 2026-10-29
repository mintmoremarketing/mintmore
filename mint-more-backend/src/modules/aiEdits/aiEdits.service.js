const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const services = require('../services/services.service');
const notificationService = require('../notifications/notification.service');
const { getAiEditSettings, aiPrice, usageCost } = require('./aiEdits.pricing');

/**
 * "Make with AI": the client buys AI edits of a storefront service. The edit itself runs in the
 * Creatyv helper on their computer, driven from the AI edit page. Paying creates one unlock per
 * video; the page hands the helper that video's token (or a code is redeemed for it), and the
 * token is the only way to reach our AI and licence proxies.
 */

const money = (value) => Math.round(Number(value) * 100) / 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// No 0/O or 1/I/L, so a code read off the screen is typed right the first time.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const newCode = () => {
  const chars = Array.from(crypto.randomBytes(12), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
};
const normalizeCode = (code) => {
  const chars = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return chars.length === 12 ? `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}` : null;
};

// ── Client ────────────────────────────────────────────────────────────────────

const publicAiEdit = (edit, unlocks = []) => ({
  id: edit.id,
  title: edit.title,
  template_slug: edit.template_slug || null,
  cover_url: edit.cover_url || null,
  option_label: edit.option_label,
  pack_size: edit.pack_size,
  quantity: edit.quantity,
  videos: edit.videos,
  unit_price: Number(edit.unit_price),
  subtotal: Number(edit.subtotal),
  gst_amount: Number(edit.gst_amount),
  total: Number(edit.total),
  status: edit.status,
  paid_at: edit.paid_at,
  created_at: edit.created_at,
  used: unlocks.filter((u) => u.redeemed_at).length,
  // A code stays visible until the app has used it; after that only its state is shown.
  unlocks: unlocks.map((u) => ({
    video_number: u.video_number,
    code: u.redeemed_at ? null : u.code,
    redeemed_at: u.redeemed_at,
    app_state: u.app_state,
    app_state_at: u.app_state_at,
  })),
});

const EDIT_SQL = `
  SELECT e.*, t.slug AS template_slug, t.cover_url
  FROM ai_edits e
  LEFT JOIN service_templates t ON t.id = e.template_id`;

const unlocksFor = async (editIds) => {
  if (!editIds.length) return new Map();
  const result = await query(
    `SELECT ai_edit_id, video_number, code, redeemed_at, app_state, app_state_at
     FROM ai_edit_unlocks WHERE ai_edit_id = ANY($1) ORDER BY video_number`,
    [editIds]
  );
  const byEdit = new Map();
  result.rows.forEach((row) => byEdit.set(row.ai_edit_id, [...(byEdit.get(row.ai_edit_id) || []), row]));
  return byEdit;
};

const createAiEdit = async (clientId, { variant_id: variantId, quantity: rawQuantity = 1 } = {}) => {
  if (!UUID_PATTERN.test(String(variantId || ''))) throw new AppError('Choose an option first', 422);
  const settings = await services.getServiceSettings();
  const quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(settings.max_quantity)) {
    throw new AppError(`Quantity must be between 1 and ${settings.max_quantity}`, 422);
  }
  const variantResult = await query(
    `SELECT v.*, t.title, t.ai_enabled
     FROM service_variants v
     JOIN service_templates t ON t.id = v.template_id
     WHERE v.id = $1 AND v.is_active AND t.is_active`,
    [variantId]
  );
  const variant = variantResult.rows[0];
  if (!variant) throw new AppError('That option is no longer available', 404);
  if (!variant.ai_enabled) throw new AppError('This service is not available with AI yet', 400);

  // Pressing Make with AI again opens the same unpaid edit instead of piling up drafts.
  const draft = await query(
    `SELECT id FROM ai_edits WHERE client_id = $1 AND variant_id = $2 AND quantity = $3 AND status = 'draft'
     ORDER BY created_at DESC LIMIT 1`,
    [clientId, variant.id, quantity]
  );
  if (draft.rows[0]) return getAiEdit(clientId, draft.rows[0].id);

  const aiSettings = await getAiEditSettings();
  const unitPrice = aiPrice(variant, aiSettings);
  const subtotal = money(unitPrice * quantity);
  const gstRate = Number(settings.gst_rate);
  const gstAmount = money((subtotal * gstRate) / 100);
  const result = await query(
    `INSERT INTO ai_edits
       (client_id, template_id, variant_id, title, option_label, pack_size, quantity, videos,
        unit_price, subtotal, gst_rate, gst_amount, total, budget_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [clientId, variant.template_id, variant.id, variant.title, variant.option_label, variant.pack_size,
      quantity, variant.pack_size * quantity, unitPrice, subtotal, gstRate, gstAmount,
      money(subtotal + gstAmount), aiSettings.budget_usd_per_video]
  );
  return getAiEdit(clientId, result.rows[0].id);
};

const listAiEdits = async (clientId) => {
  const result = await query(`${EDIT_SQL} WHERE e.client_id = $1 AND e.status <> 'cancelled' ORDER BY e.created_at DESC LIMIT 100`, [clientId]);
  const unlocks = await unlocksFor(result.rows.map((row) => row.id));
  return result.rows.map((row) => publicAiEdit(row, unlocks.get(row.id)));
};

const getAiEdit = async (clientId, id) => {
  if (!UUID_PATTERN.test(String(id || ''))) throw new AppError('AI edit not found', 404);
  const result = await query(`${EDIT_SQL} WHERE e.id = $1 AND e.client_id = $2`, [id, clientId]);
  if (!result.rows[0]) throw new AppError('AI edit not found', 404);
  const unlocks = await unlocksFor([id]);
  return publicAiEdit(result.rows[0], unlocks.get(id));
};

/** Mark paid and create one unlock per video. Idempotent: verify and the webhook may both call it. */
const finalizeAiEdit = async (id, paymentId) => {
  const dbClient = await getClient();
  let edit;
  try {
    await dbClient.query('BEGIN');
    edit = (await dbClient.query('SELECT * FROM ai_edits WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!edit) throw new AppError('AI edit not found', 404);
    if (edit.status === 'draft') {
      await dbClient.query(
        `UPDATE ai_edits SET status = 'paid', paid_at = NOW(), razorpay_payment_id = $2 WHERE id = $1`,
        [id, paymentId]
      );
      for (let video = 1; video <= edit.videos; video += 1) {
        await dbClient.query(
          `INSERT INTO ai_edit_unlocks (ai_edit_id, video_number, code, budget_usd)
           VALUES ($1,$2,$3,$4) ON CONFLICT (ai_edit_id, video_number) DO NOTHING`,
          [id, video, newCode(), edit.budget_usd]
        );
      }
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
  return getAiEdit(edit.client_id, id);
};

const payAiEdit = async (clientId, id) => {
  const edit = (await query('SELECT * FROM ai_edits WHERE id = $1 AND client_id = $2', [id, clientId])).rows[0];
  if (!edit) throw new AppError('AI edit not found', 404);
  if (edit.status === 'paid') return { checkout_mode: 'paid', ai_edit: await getAiEdit(clientId, id) };
  if (edit.status !== 'draft') throw new AppError('This AI edit can no longer be paid for', 400);

  if (await services.testCheckoutAllowed(clientId)) {
    await query(`UPDATE ai_edits SET payment_mode = 'mock' WHERE id = $1`, [id]);
    return { checkout_mode: 'mock', ai_edit: await finalizeAiEdit(id, `mock_${id.slice(0, 18)}`) };
  }

  const razorpay = services.getRazorpay();
  const order = await services.callRazorpay('orders.create', () => razorpay.orders.create({
    amount: Math.round(Number(edit.total) * 100),
    currency: 'INR',
    receipt: `aie_${id.slice(0, 30)}`,
    notes: { purpose: 'ai_edit', ai_edit_id: id, client_id: clientId },
  }));
  await query(`UPDATE ai_edits SET payment_mode = 'razorpay', razorpay_order_id = $2 WHERE id = $1`, [id, order.id]);
  return { checkout_mode: 'order', order_id: order.id, amount_paise: order.amount, currency: 'INR', key_id: env.razorpay.keyId };
};

const verifyAiEdit = async (clientId, id, payload = {}) => {
  const edit = (await query('SELECT * FROM ai_edits WHERE id = $1 AND client_id = $2', [id, clientId])).rows[0];
  if (!edit) throw new AppError('AI edit not found', 404);
  if (edit.status === 'paid') return getAiEdit(clientId, id);

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload;
  if (!orderId || !paymentId || !signature || orderId !== edit.razorpay_order_id) {
    throw new AppError('Payment details are missing or do not match this AI edit', 400);
  }
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  if (!services.signaturesMatch(expected, signature)) throw new AppError('Payment signature verification failed', 400);
  const payment = await services.callRazorpay('payments.fetch', () => services.getRazorpay().payments.fetch(paymentId));
  if (payment.status !== 'captured' || payment.order_id !== orderId) throw new AppError('Payment has not been captured yet', 400);
  if (Number(payment.amount) !== Math.round(Number(edit.total) * 100) || payment.currency !== 'INR') {
    throw new AppError('Captured amount does not match this AI edit', 400);
  }
  return finalizeAiEdit(id, paymentId);
};

/** Webhook entry point (through services.processCapturedServicePayment). */
const processCapturedAiEditPayment = async (orderId, paymentId, amountPaise) => {
  const edit = (await query('SELECT * FROM ai_edits WHERE razorpay_order_id = $1', [orderId])).rows[0];
  if (!edit) return false;
  if (Number(amountPaise) !== Math.round(Number(edit.total) * 100)) {
    logger.error('AI edit webhook amount mismatch', { aiEditId: edit.id, amountPaise });
    return true;
  }
  await finalizeAiEdit(edit.id, paymentId);
  return true;
};

// ── Desktop app ───────────────────────────────────────────────────────────────

/**
 * Swap an unlock code for the token the app uses. A code is tied to the first computer that uses
 * it; the same computer may redeem again (a reinstall), which replaces its old token.
 */
/** A fresh token for one paid video, tied to the computer that will edit it. */
const issueToken = async (unlock, deviceId) => {
  if (unlock.redeemed_at && unlock.device !== deviceId) throw new AppError('This video is already being edited on another computer.', 409);

  const settings = await getAiEditSettings();
  const token = `cak_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + Number(settings.token_days) * 86400000);
  await query(
    `UPDATE ai_edit_unlocks
     SET token_hash = $2, device = $3, redeemed_at = COALESCE(redeemed_at, NOW()), expires_at = $4
     WHERE id = $1`,
    [unlock.id, hash(token), deviceId, expiresAt]
  );
  return {
    token,
    ai_edit_id: unlock.ai_edit_id,
    title: unlock.title,
    video_number: unlock.video_number,
    budget_usd: money(Number(unlock.budget_usd) - Number(unlock.spent_usd)),
    expires_at: expiresAt.toISOString(),
  };
};

const redeem = async ({ code, device } = {}) => {
  const normalized = normalizeCode(code);
  const deviceId = String(device || '').slice(0, 64);
  if (!normalized) throw new AppError('That code is not valid. It looks like ABCD-EFGH-JKLM.', 422);
  if (!deviceId) throw new AppError('Update the Creatyv app and try again.', 422);
  const result = await query(
    `SELECT u.*, e.status AS edit_status, e.title
     FROM ai_edit_unlocks u JOIN ai_edits e ON e.id = u.ai_edit_id
     WHERE u.code = $1`,
    [normalized]
  );
  const unlock = result.rows[0];
  if (!unlock || unlock.edit_status !== 'paid') throw new AppError('That code is not valid.', 404);
  return issueToken(unlock, deviceId);
};

/**
 * The browser hands a paid video straight to the Creatyv helper on the client's computer: the
 * signed-in client asks for the token here and passes it on, so there is no code to copy.
 */
const connectVideo = async (clientId, id, { video_number: videoNumber, device } = {}) => {
  if (!UUID_PATTERN.test(String(id))) throw new AppError('AI edit not found.', 404);
  const deviceId = String(device || '').slice(0, 64);
  if (!deviceId) throw new AppError('Update the Creatyv helper and try again.', 422);
  const result = await query(
    `SELECT u.*, e.status AS edit_status, e.title
     FROM ai_edit_unlocks u JOIN ai_edits e ON e.id = u.ai_edit_id
     WHERE e.id = $1 AND e.client_id = $2 AND u.video_number = $3`,
    [id, clientId, Number(videoNumber) || 1]
  );
  const unlock = result.rows[0];
  if (!unlock || unlock.edit_status !== 'paid') throw new AppError('Pay for this AI edit first.', 402);
  return issueToken(unlock, deviceId);
};

/** The unlock behind an app token, or a 401/402 the app can show. */
const unlockForToken = async (token) => {
  if (!token || !String(token).startsWith('cak_')) throw new AppError('This video is not unlocked.', 401);
  const result = await query(
    `SELECT u.* FROM ai_edit_unlocks u JOIN ai_edits e ON e.id = u.ai_edit_id
     WHERE u.token_hash = $1 AND e.status = 'paid'`,
    [hash(token)]
  );
  const unlock = result.rows[0];
  if (!unlock) throw new AppError('This video is not unlocked.', 401);
  if (unlock.expires_at && new Date(unlock.expires_at) < new Date()) throw new AppError('This video\'s unlock has expired. Open it on Creatyv to renew it.', 401);
  if (Number(unlock.spent_usd) >= Number(unlock.budget_usd)) throw new AppError('This video has used all of its AI budget.', 402);
  return unlock;
};

const recordUsage = async (unlockId, model, usage) => {
  const settings = await getAiEditSettings();
  const cost = usageCost(usage, model, settings);
  await query(
    `INSERT INTO ai_edit_usage (unlock_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [unlockId, model, usage.input_tokens || 0, usage.output_tokens || 0,
      usage.cache_read_input_tokens || 0, usage.cache_creation_input_tokens || 0, cost]
  );
  await query('UPDATE ai_edit_unlocks SET spent_usd = spent_usd + $2 WHERE id = $1', [unlockId, cost]);
  return cost;
};

const APP_STATES = ['draft', 'queued', 'planning', 'plan_ready', 'building', 'done', 'failed', 'stopped', 'interrupted'];
// The moments the client should hear about even with the tab closed: the outline is waiting on
// them (rendering before they answer would spend the budget on a wrong video), and the end.
const STATE_NOTICES = {
  plan_ready: (questions) => (questions > 0
    ? { title: 'Your AI edit has questions', body: `Answer ${questions === 1 ? '1 question' : `${questions} questions`} on the outline so the editor can render the reel.` }
    : { title: 'Your outline is ready', body: 'Check it and approve it to render the reel.' }),
  done: () => ({ title: 'Your AI reel is ready', body: 'Watch it on Creatyv. The file is saved on your computer.' }),
  failed: () => ({ title: 'Your AI edit needs attention', body: 'The editor stopped. Open the edit to see what happened.' }),
};

const setAppState = async (token, { state, questions } = {}) => {
  if (!APP_STATES.includes(state)) throw new AppError('Unknown state', 422);
  const unlock = await unlockForToken(token).catch((err) => {
    // A video that used its whole budget may still report that it finished.
    if (err.statusCode === 402) return query('SELECT * FROM ai_edit_unlocks WHERE token_hash = $1', [hash(token)]).then((r) => r.rows[0]);
    throw err;
  });
  await query('UPDATE ai_edit_unlocks SET app_state = $2, app_state_at = NOW() WHERE id = $1', [unlock.id, state]);

  const notice = STATE_NOTICES[state];
  if (notice && unlock.app_state !== state) {
    const edit = (await query('SELECT client_id, videos FROM ai_edits WHERE id = $1', [unlock.ai_edit_id])).rows[0];
    const { title, body } = notice(Math.max(0, Number(questions) || 0));
    if (edit) {
      notificationService.createNotification({
        userId: edit.client_id,
        type: 'ai_edit_update',
        title: edit.videos > 1 ? `${title} (video ${unlock.video_number})` : title,
        body,
        entityType: 'ai_edit',
        entityId: unlock.ai_edit_id,
        data: { ai_edit_id: unlock.ai_edit_id, video_number: unlock.video_number, state },
        // One per state change; a later revision that finishes again notifies again.
        dedupeKey: `ai-edit:${unlock.id}:${state}:${Date.now()}`,
      });
    }
  }
  return { ok: true };
};

module.exports = {
  connectVideo,
  createAiEdit,
  listAiEdits,
  getAiEdit,
  payAiEdit,
  verifyAiEdit,
  processCapturedAiEditPayment,
  redeem,
  unlockForToken,
  recordUsage,
  setAppState,
  normalizeCode,
};
