/**
 * Purchased items: what a multi-item cart line turns into after payment.
 * Each item waits for its own brief. Submitting a complete brief creates the item's
 * booking, job and (on assignment) chat, and starts matching for that item alone.
 * The item's money stays on the item, outside the client's wallet, until a freelancer
 * is assigned (see commitAssignment in services.service.js).
 */
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { writeAudit } = require('../audit/audit.service');
const { resolveBriefFields, validateBriefAnswers } = require('./briefFields');
const services = require('./services.service');

const { UUID_PATTERN } = services;
const money = (value) => Math.round(Number(value) * 100) / 100;

const ITEM_SELECT = `
  SELECT i.*, g.checkout_id, g.template_id, g.variant_id, g.item_count, g.snapshot,
         g.instructions AS shared_instructions, g.preferred_freelancer_id, g.paid_at,
         t.slug AS template_slug, t.title AS template_title, t.cover_url, t.brief_fields,
         c.slug AS category_slug,
         b.booking_number, b.job_id, b.assignment_status, b.matching_held_at, b.completed_at,
         j.status AS job_status, b.due_at, fu.full_name AS freelancer_name, room.id AS room_id
  FROM service_purchase_items i
  JOIN service_purchase_groups g ON g.id = i.group_id
  JOIN service_templates t ON t.id = g.template_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN service_bookings b ON b.id = i.booking_id
  LEFT JOIN jobs j ON j.id = b.job_id
  LEFT JOIN users fu ON fu.id = b.freelancer_id
  LEFT JOIN chat_rooms room ON room.job_id = b.job_id`;

/** Where an item is, in the words the client sees: needs a brief, matching, active, done. */
const itemStage = (row) => {
  if (row.status === 'refunding' || row.status === 'refunded') return 'refunded';
  if (row.status !== 'submitted') return 'needs_brief';
  if (row.assignment_status === 'cancelled' || row.job_status === 'cancelled') return 'cancelled';
  if (row.completed_at || row.job_status === 'completed') return 'completed';
  if (row.assignment_status === 'assigned') return 'active';
  return 'matching';
};

const shapeItem = (row) => ({
  id: row.id,
  group_id: row.group_id,
  item_index: row.item_index,
  item_count: row.item_count,
  stage: itemStage(row),
  has_draft: (Array.isArray(row.brief) ? row.brief : []).length > 0 || Boolean(row.instructions),
  brief: row.brief,
  instructions: row.instructions,
  subtotal: Number(row.subtotal),
  gst_amount: Number(row.gst_amount),
  booking_id: row.booking_id,
  booking_number: row.booking_number,
  job_id: row.job_id,
  room_id: row.room_id,
  freelancer_name: row.freelancer_name,
  due_at: row.due_at,
  submitted_at: row.submitted_at,
  refunded_at: row.refunded_at,
});

const shapeGroups = (rows) => {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.group_id)) {
      groups.set(row.group_id, {
        id: row.group_id,
        checkout_id: row.checkout_id,
        template_id: row.template_id,
        template_slug: row.template_slug,
        template_title: row.template_title,
        cover_url: row.cover_url,
        variant_id: row.variant_id,
        item_count: row.item_count,
        snapshot: row.snapshot,
        shared_instructions: row.shared_instructions,
        paid_at: row.paid_at,
        brief_fields: resolveBriefFields({ brief_fields: row.brief_fields, category_slug: row.category_slug }),
        items: [],
      });
    }
    groups.get(row.group_id).items.push(shapeItem(row));
  });
  return [...groups.values()];
};

const listClientPurchases = async (clientId) => {
  const result = await query(
    `${ITEM_SELECT}
     WHERE i.client_id = $1 AND g.paid_at IS NOT NULL
     ORDER BY g.paid_at DESC, g.id, i.item_index`,
    [clientId]
  );
  return shapeGroups(result.rows);
};

const getClientPurchase = async (clientId, groupId) => {
  if (!UUID_PATTERN.test(String(groupId))) throw new AppError('Purchase not found', 404);
  const result = await query(
    `${ITEM_SELECT}
     WHERE i.group_id = $1 AND i.client_id = $2 AND g.paid_at IS NOT NULL
     ORDER BY i.item_index`,
    [groupId, clientId]
  );
  if (!result.rows.length) throw new AppError('Purchase not found', 404);
  return shapeGroups(result.rows)[0];
};

/** Locks one of the client's items, with what its brief is checked against. */
const lockItem = async (dbClient, clientId, itemId) => {
  if (!UUID_PATTERN.test(String(itemId))) throw new AppError('Order not found', 404);
  const result = await dbClient.query(
    `SELECT i.*, g.checkout_id, g.template_id, g.variant_id, g.item_count, g.snapshot,
            g.instructions AS shared_instructions, g.preferred_freelancer_id, g.paid_at,
            t.title AS template_title, t.brief_fields, c.slug AS category_slug
     FROM service_purchase_items i
     JOIN service_purchase_groups g ON g.id = i.group_id
     JOIN service_templates t ON t.id = g.template_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE i.id = $1 AND i.client_id = $2
     FOR UPDATE OF i`,
    [itemId, clientId]
  );
  const item = result.rows[0];
  if (!item || !item.paid_at) throw new AppError('Order not found', 404);
  return item;
};

const cleanBrief = (clientId, item, answers, instructions, { allowIncomplete }) => {
  const validated = validateBriefAnswers(resolveBriefFields(item), answers, item.template_title, { allowIncomplete });
  if (validated.errors.length) {
    const err = new AppError('Complete the required brief details', 422);
    err.errors = validated.errors;
    throw err;
  }
  const cleanInstructions = String(instructions || '').trim();
  if (cleanInstructions.length > 4000) throw new AppError('Additional instructions are too long', 422);
  services.assertBriefIsClean(clientId, [validated.brief], [{ instructions: cleanInstructions }]);
  return { brief: validated.brief, instructions: cleanInstructions || null };
};

/** Saves an unfinished brief so the client can come back to it. */
const saveItemDraft = async (clientId, itemId, { brief: answers, instructions } = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const item = await lockItem(dbClient, clientId, itemId);
    if (item.status !== 'ready') throw new AppError('This order already has its brief', 409);
    const cleaned = cleanBrief(clientId, item, answers, instructions, { allowIncomplete: true });
    // File answers are names of files picked in the browser; keep ones already saved.
    const savedFiles = (Array.isArray(item.brief) ? item.brief : []).filter((answer) => answer.type === 'files');
    const keys = new Set(cleaned.brief.map((answer) => answer.key));
    cleaned.brief.push(...savedFiles.filter((answer) => !keys.has(answer.key)));
    await dbClient.query(
      'UPDATE service_purchase_items SET brief = $2, instructions = $3 WHERE id = $1',
      [item.id, JSON.stringify(cleaned.brief), cleaned.instructions]
    );
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
  return { saved: true };
};

const bookingInstructions = (item, ownInstructions) => [
  ownInstructions,
  item.shared_instructions ? `Note for every order in this purchase:\n${item.shared_instructions}` : null,
].filter(Boolean).join('\n\n') || null;

/**
 * Submits a complete brief: creates the item's booking and job, then starts matching.
 * With files_pending the booking waits until the browser finishes uploading the brief
 * files (startItemMatching). Submitting again returns the same booking.
 */
const submitItemBrief = async (clientId, itemId, { brief: answers, instructions, files_pending: filesPending = false } = {}) => {
  const dbClient = await getClient();
  let booking;
  let created = false;
  try {
    await dbClient.query('BEGIN');
    const item = await lockItem(dbClient, clientId, itemId);
    if (item.status === 'submitted') {
      const existing = await dbClient.query('SELECT * FROM service_bookings WHERE id = $1', [item.booking_id]);
      booking = existing.rows[0];
    } else {
      if (item.status !== 'ready') throw new AppError('This order was refunded', 409);
      const cleaned = cleanBrief(clientId, item, answers, instructions, { allowIncomplete: false });
      const snapshot = {
        ...item.snapshot,
        pack_size: 1,
        purchase_item: { index: item.item_index, count: item.item_count, group_id: item.group_id },
      };
      const inserted = await dbClient.query(
        `INSERT INTO service_bookings
           (checkout_id, client_id, template_id, variant_id, quantity, snapshot, instructions,
            preferred_freelancer_id, unit_price, subtotal, gst_amount, freelancer_payout, platform_fee, brief,
            assignment_status, paid_at, purchase_item_id, matching_held_at)
         VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,$8,$9,$10,$11,$12,'unassigned',$13,$14,$15)
         RETURNING *`,
        [item.checkout_id, clientId, item.template_id, item.variant_id, JSON.stringify(snapshot),
          bookingInstructions(item, cleaned.instructions), item.preferred_freelancer_id,
          money(item.subtotal), money(item.gst_amount), money(item.freelancer_payout), money(item.platform_fee),
          JSON.stringify(cleaned.brief), item.paid_at, item.id, filesPending ? new Date() : null]
      );
      booking = inserted.rows[0];
      const jobId = await services.insertBookingJob(dbClient, booking);
      const updated = await dbClient.query('UPDATE service_bookings SET job_id = $2 WHERE id = $1 RETURNING *', [booking.id, jobId]);
      booking = updated.rows[0];
      await dbClient.query(
        `UPDATE service_purchase_items
         SET status = 'submitted', booking_id = $2, submitted_at = NOW(), brief = $3, instructions = $4
         WHERE id = $1`,
        [item.id, booking.id, JSON.stringify(cleaned.brief), cleaned.instructions]
      );
      created = true;
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  if (created) logger.info('Purchase item brief submitted', { itemId, bookingId: booking.id, filesPending: Boolean(filesPending) });
  if (!booking.matching_held_at && booking.assignment_status === 'unassigned') {
    await services.assignBooking(booking.id)
      .catch((err) => logger.error('Auto-assignment failed', { bookingId: booking.id, error: err.message }));
  }
  return { booking_id: booking.id, booking_number: booking.booking_number, job_id: booking.job_id, matching_held: Boolean(booking.matching_held_at) };
};

/** The brief files finished uploading (or failed): start matching the item's booking. */
const startItemMatching = async (clientId, itemId) => {
  if (!UUID_PATTERN.test(String(itemId))) throw new AppError('Order not found', 404);
  const result = await query(
    `UPDATE service_bookings b SET matching_held_at = NULL
     FROM service_purchase_items i
     WHERE i.id = $1 AND i.client_id = $2 AND b.id = i.booking_id
     RETURNING b.id, b.assignment_status`,
    [itemId, clientId]
  );
  const booking = result.rows[0];
  if (!booking) throw new AppError('Submit the brief first', 409);
  if (booking.assignment_status === 'unassigned') {
    await services.assignBooking(booking.id)
      .catch((err) => logger.error('Auto-assignment failed', { bookingId: booking.id, error: err.message }));
  }
  return { started: true };
};

// ── Admin ─────────────────────────────────────────────────────────────────────

/** Paid items still waiting for a brief, oldest first. Their money hasn't moved anywhere yet. */
const adminListUnusedItems = async () => {
  const result = await query(
    `SELECT i.id, i.item_index, i.subtotal, i.gst_amount, i.status, i.created_at,
            g.item_count, g.paid_at, g.snapshot->>'title' AS title, g.snapshot->>'option_label' AS option_label,
            u.full_name AS client_name, u.email AS client_email, ch.payment_mode
     FROM service_purchase_items i
     JOIN service_purchase_groups g ON g.id = i.group_id
     JOIN service_checkouts ch ON ch.id = g.checkout_id
     JOIN users u ON u.id = i.client_id
     WHERE i.status IN ('ready', 'refunding') AND g.paid_at IS NOT NULL
     ORDER BY g.paid_at, i.item_index
     LIMIT 300`
  );
  return result.rows.map((row) => ({ ...row, subtotal: Number(row.subtotal), gst_amount: Number(row.gst_amount) }));
};

/**
 * Refunds an unused item (subtotal + its GST) to the original payment. Test checkouts
 * moved no money, so only the record changes. The item is marked refunding before the
 * provider call so a second click can't refund it twice.
 */
const adminRefundItem = async (adminId, itemId, { note } = {}) => {
  if (!UUID_PATTERN.test(String(itemId))) throw new AppError('Order not found', 404);
  const dbClient = await getClient();
  let item;
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT i.*, ch.payment_mode, ch.razorpay_payment_id
       FROM service_purchase_items i
       JOIN service_purchase_groups g ON g.id = i.group_id
       JOIN service_checkouts ch ON ch.id = g.checkout_id
       WHERE i.id = $1 AND g.paid_at IS NOT NULL
       FOR UPDATE OF i`,
      [itemId]
    );
    item = result.rows[0];
    if (!item) throw new AppError('Order not found', 404);
    if (item.status !== 'ready') throw new AppError('Only items without a submitted brief can be refunded', 409);
    await dbClient.query(`UPDATE service_purchase_items SET status = 'refunding' WHERE id = $1`, [itemId]);
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  const amount = money(Number(item.subtotal) + Number(item.gst_amount));
  let reference = 'test-checkout';
  if (item.payment_mode === 'razorpay') {
    try {
      const refund = await services.callRazorpay('payments.refund', () => services.getRazorpay().payments.refund(item.razorpay_payment_id, {
        amount: Math.round(amount * 100),
        notes: { purpose: 'service_item_refund', purchase_item_id: item.id },
      }));
      reference = refund.id;
    } catch (err) {
      await query(`UPDATE service_purchase_items SET status = 'ready' WHERE id = $1 AND status = 'refunding'`, [itemId]);
      throw err;
    }
  }

  const cleanNote = String(note || '').trim().slice(0, 1000) || null;
  await query(
    `UPDATE service_purchase_items
     SET status = 'refunded', refunded_at = NOW(), refunded_by = $2, refund_reference = $3, refund_note = $4
     WHERE id = $1`,
    [itemId, adminId, reference, cleanNote]
  );
  await query(
    `INSERT INTO platform_financial_ledger
       (type, amount, reference_id, reference_type, idempotency_key, description, metadata)
     VALUES ('service_item_refunded', $1, $2, 'service_purchase_item', $3, 'Unused purchase item refunded', $4)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [amount, itemId, `service-item-refund:${itemId}`,
      JSON.stringify({ subtotal: Number(item.subtotal), gst_amount: Number(item.gst_amount), refund_reference: reference })]
  ).catch((err) => logger.error('Refund ledger entry failed', { itemId, error: err.message }));
  await writeAudit({
    actorId: adminId,
    action: 'service_purchase_item.refunded',
    entityType: 'service_purchase_item',
    entityId: itemId,
    metadata: { amount, refund_reference: reference, note: cleanNote },
  }).catch(() => null);
  return { refunded: true, amount, refund_reference: reference };
};

module.exports = {
  listClientPurchases,
  getClientPurchase,
  saveItemDraft,
  submitItemBrief,
  startItemMatching,
  adminListUnusedItems,
  adminRefundItem,
};
