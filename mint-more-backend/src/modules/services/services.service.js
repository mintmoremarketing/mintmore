const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { getSetting } = require('../commerce/settings.service');
const { getWalletByUserId, recordTransaction, holdEscrow } = require('../wallet/wallet.service');
const { createChatRoom, appendSystemMessageByJob, appendSystemMessagesByJob, postClientMessagesByJob, postFileMessage } = require('../chat/chat.service');
const notificationService = require('../notifications/notification.service');
const { writeAudit } = require('../audit/audit.service');
const { rankFreelancers } = require('./fairMatch');
const { assertNoContactInfo, findContactInfo, CONTACT_BLOCKED_MESSAGE } = require('../../utils/contactGuard');
const { getAiEditSettings, aiPrice } = require('../aiEdits/aiEdits.pricing');
const { defaultBriefFields, resolveBriefFields, normalizeBriefFields, validateBriefAnswers, formatBrief } = require('./briefFields');
const { allocateItems } = require('./allocate');

const razorpay = env.payments.mockCheckout
  ? null
  : new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });

const DEFAULT_SERVICE_SETTINGS = { gst_rate: 18, max_quantity: 20 };
// Items one service selection (a variant, so an option and pack) can buy from freelancers.
// Two packs of three count as six. Above this, the storefront shows Hire a Pro instead.
const MAX_ITEMS_PER_SELECTION = 10;
const money = (value) => Math.round(Number(value) * 100) / 100;

const callRazorpay = async (operation, request) => {
  try {
    return await request();
  } catch (error) {
    logger.error('Razorpay request failed', {
      operation,
      providerStatus: Number(error.statusCode || error.status || 0),
      providerError: error.error?.description || error.message,
    });
    throw new AppError('Payment checkout is temporarily unavailable. Please try again shortly.', 502);
  }
};

const getServiceSettings = async (dbClient = null) => ({
  ...DEFAULT_SERVICE_SETTINGS,
  ...((await getSetting('services', DEFAULT_SERVICE_SETTINGS, dbClient)) || {}),
});

// ── Catalogue ─────────────────────────────────────────────────────────────────

const RATING_STATS_SQL = `
  SELECT b.template_id,
         ROUND(AVG(r.rating_overall)::numeric, 1) AS rating_avg,
         COUNT(r.id)::int AS rating_count
  FROM reviews r
  JOIN service_bookings b ON b.job_id = r.job_id
  WHERE r.is_visible IS DISTINCT FROM false
  GROUP BY b.template_id`;

const listCategories = async () => {
  const result = await query(
    `SELECT c.id, c.name, c.slug, COUNT(t.id)::int AS service_count
     FROM categories c
     JOIN service_templates t ON t.category_id = c.id AND t.is_active = true
     GROUP BY c.id
     ORDER BY MIN(t.sort_order), c.name`
  );
  return result.rows;
};

const listCatalog = async ({ category, q, slugs } = {}) => {
  const params = [];
  const where = ['t.is_active = true'];
  if (Array.isArray(slugs)) {
    params.push(slugs);
    where.push(`t.slug = ANY($${params.length})`);
  }
  if (category) {
    params.push(category);
    where.push(`c.slug = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    where.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(COALESCE(t.summary, '')) LIKE $${params.length}
                 OR LOWER(c.name) LIKE $${params.length} OR LOWER(COALESCE(sc.name, '')) LIKE $${params.length})`);
  }

  const result = await query(
    `SELECT t.id, t.slug, t.title, t.summary, t.unit_label, t.revisions, t.cover_url, t.badge,
            t.option_group_label, t.sort_order,
            c.name AS category_name, c.slug AS category_slug,
            sc.name AS subcategory_name, sc.slug AS subcategory_slug, sc.sort_order AS subcategory_sort,
            dv.id AS default_variant_id, dv.price, dv.mrp, dv.delivery_days, dv.option_label, dv.pack_size,
            (SELECT MIN(price) FROM service_variants WHERE template_id = t.id AND is_active) AS starting_price,
            stats.rating_avg, COALESCE(stats.rating_count, 0) AS rating_count
     FROM service_templates t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN service_subcategories sc ON sc.id = t.subcategory_id
     LEFT JOIN LATERAL (
       SELECT id, price, mrp, delivery_days, option_label, pack_size
       FROM service_variants
       WHERE template_id = t.id AND is_active
       ORDER BY is_default DESC, pack_size, sort_order, price
       LIMIT 1
     ) dv ON true
     LEFT JOIN (${RATING_STATS_SQL}) stats ON stats.template_id = t.id
     WHERE ${where.join(' AND ')}
     ORDER BY sc.sort_order NULLS LAST, t.sort_order, t.title`,
    params
  );
  return result.rows;
};

/** Homepage: category tiles, curated rows (admin-ordered slugs) and FAQs. */
const getStorefront = async () => {
  const settings = await getSetting('storefront', { category_tiles: [], rows: [], faqs: [] });
  const tileSlugs = settings?.category_tiles || [];
  const rowSlugs = [...new Set((settings?.rows || []).flatMap((row) => row.slugs || []))];
  const [categories, services] = await Promise.all([
    query(
      `SELECT c.id, c.name, c.slug, c.icon_url,
              (SELECT COUNT(*)::int FROM service_templates t WHERE t.category_id = c.id AND t.is_active) AS service_count
       FROM categories c
       WHERE c.slug = ANY($1) AND c.is_active`,
      [tileSlugs]
    ),
    listCatalog({ slugs: rowSlugs }),
  ]);
  const bySlug = new Map(services.map((service) => [service.slug, service]));
  return {
    categories: tileSlugs.map((slug) => categories.rows.find((c) => c.slug === slug)).filter(Boolean),
    rows: (settings?.rows || [])
      .map((row) => ({ title: row.title, services: (row.slugs || []).map((slug) => bySlug.get(slug)).filter(Boolean) }))
      .filter((row) => row.services.length),
    faqs: settings?.faqs || [],
  };
};

/** Category page: the category with its sections, each holding its services. */
const getCategoryPage = async (slug) => {
  const category = await query('SELECT id, name, slug, description FROM categories WHERE slug = $1 AND is_active', [slug]);
  if (!category.rows[0]) throw new AppError('Category not found', 404);
  const services = await listCatalog({ category: slug });
  const sections = [];
  for (const service of services) {
    const name = service.subcategory_name || 'More services';
    let section = sections.find((s) => s.name === name);
    if (!section) sections.push((section = { name, slug: service.subcategory_slug || 'more', services: [] }));
    section.services.push(service);
  }
  return { ...category.rows[0], sections };
};

const getCatalogItem = async (slug) => {
  const templateResult = await query(
    `SELECT t.*, c.name AS category_name, c.slug AS category_slug,
            sc.name AS subcategory_name, sc.slug AS subcategory_slug,
            stats.rating_avg, COALESCE(stats.rating_count, 0) AS rating_count
     FROM service_templates t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN service_subcategories sc ON sc.id = t.subcategory_id
     LEFT JOIN (${RATING_STATS_SQL}) stats ON stats.template_id = t.id
     WHERE t.slug = $1 AND t.is_active = true`,
    [slug]
  );
  const template = templateResult.rows[0];
  if (!template) throw new AppError('Service not found', 404);

  const [variants, reviews] = await Promise.all([
    query(
      `SELECT id, option_label, pack_size, price, mrp, delivery_days, is_default, ai_price
       FROM service_variants
       WHERE template_id = $1 AND is_active
       ORDER BY sort_order, pack_size, price`,
      [template.id]
    ),
    query(
      `SELECT r.rating_overall, r.rating_quality, r.rating_communication, r.timeliness_rating,
              r.brief_adherence_rating, r.review_text, r.created_at, u.full_name AS client_name
       FROM reviews r
       JOIN service_bookings b ON b.job_id = r.job_id
       JOIN users u ON u.id = r.client_id
       WHERE b.template_id = $1 AND r.is_visible IS DISTINCT FROM false
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [template.id]
    ),
  ]);

  const aiSettings = template.ai_enabled ? await getAiEditSettings() : null;
  const variantRows = variants.rows.map(({ ai_price: aiPriceOverride, ...variant }) => ({
    ...variant,
    ai_price: aiSettings ? aiPrice({ ...variant, ai_price: aiPriceOverride }, aiSettings) : null,
  }));
  return { ...template, brief_fields: resolveBriefFields(template), variants: variantRows, reviews: reviews.rows };
};

// ── Checkout ──────────────────────────────────────────────────────────────────

const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateCheckoutInput = ({ items, gstin }, settings) => {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) errors.push('Add at least one service to your cart');
  if (Array.isArray(items) && items.length > 20) errors.push('A cart can hold at most 20 items');
  (items || []).forEach((item, index) => {
    if (!UUID_PATTERN.test(String(item?.variant_id || ''))) errors.push(`Item ${index + 1}: variant_id is invalid`);
    const qty = Number(item?.quantity ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > Number(settings.max_quantity)) {
      errors.push(`Item ${index + 1}: quantity must be between 1 and ${settings.max_quantity}`);
    }
    if (item?.instructions && String(item.instructions).length > 4000) errors.push(`Item ${index + 1}: instructions are too long`);
    if (item?.preferred_freelancer_id && !UUID_PATTERN.test(String(item.preferred_freelancer_id))) {
      errors.push(`Item ${index + 1}: preferred freelancer is invalid`);
    }
  });
  if (gstin && !GSTIN_PATTERN.test(String(gstin).toUpperCase())) errors.push('Enter a valid 15-character GSTIN');
  if (errors.length) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const checkoutResponse = (checkout, extra = {}) => ({
  checkout_id: checkout.id,
  subtotal: Number(checkout.subtotal),
  gst_amount: Number(checkout.gst_amount),
  total: Number(checkout.total),
  status: checkout.status,
  checkout_mode: checkout.payment_mode === 'mock' ? 'mock' : 'order',
  ...extra,
});

// Seeded demo accounts (only the seed script marks a @creatyv-demo.test email verified) pay
// with test checkout even on the live site, and are only ever matched with each other.
const TEST_ACCOUNT_SQL = (alias) => `(${alias}.email LIKE '%@creatyv-demo.test' AND ${alias}.is_email_verified = true)`;
const isTestAccount = async (userId) => {
  const result = await query(`SELECT ${TEST_ACCOUNT_SQL('u')} AS test FROM users u WHERE u.id = $1`, [userId]);
  return Boolean(result.rows[0]?.test);
};
// LAUNCH-TEMP: the site isn't public yet, so every storefront order uses test checkout and no
// money moves. Set to false to send real clients back through Razorpay.
const TEST_CHECKOUT_FOR_EVERYONE = true;
const testCheckoutAllowed = async (clientId) => TEST_CHECKOUT_FOR_EVERYONE || env.payments.mockCheckout || isTestAccount(clientId);

/**
 * The brief and instructions go straight into the order chat, so they get the same
 * contact check. Link fields ask for the client's site or references, so only links
 * that are themselves contact details (wa.me, mailto, a phone) are refused there.
 */
const assertBriefIsClean = (clientId, briefs, items) => {
  const guard = { userId: clientId, role: 'client' };
  briefs.flat().forEach((answer) => {
    const values = Array.isArray(answer.value) ? answer.value : [answer.value];
    values.forEach((value) => {
      if (answer.type !== 'link') return assertNoContactInfo(value, { ...guard, where: 'brief' });
      const { reasons } = findContactInfo(value, { role: 'client' });
      if (reasons.some((r) => !['link', 'handle'].includes(r))) {
        throw new AppError(`${answer.label}: ${CONTACT_BLOCKED_MESSAGE}`, 422, 'CONTACT_INFO_BLOCKED');
      }
    });
  });
  items.forEach((item) => { if (item?.instructions) assertNoContactInfo(String(item.instructions), { ...guard, where: 'instructions' }); });
};

/**
 * A multi-item line becomes a purchase group with one item per deliverable. The line's
 * note is shared context for every item; any brief given in the cart becomes item 1's draft.
 */
const insertPurchaseGroup = async (dbClient, { checkoutId, clientId, line, snapshot }) => {
  const { item, variant } = line;
  const group = await dbClient.query(
    `INSERT INTO service_purchase_groups
       (checkout_id, client_id, template_id, variant_id, quantity, item_count, snapshot, instructions,
        preferred_freelancer_id, subtotal, gst_amount, freelancer_payout, platform_fee)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [checkoutId, clientId, variant.template_id, variant.id, line.quantity, line.itemCount, JSON.stringify(snapshot),
      item.instructions ? String(item.instructions).trim() : null, item.preferred_freelancer_id || null,
      line.subtotal, line.gst, line.payout, line.platformFee]
  );
  const shares = allocateItems({ subtotal: line.subtotal, gst: line.gst, payout: line.payout }, line.itemCount);
  for (const [index, share] of shares.entries()) {
    await dbClient.query(
      `INSERT INTO service_purchase_items
         (group_id, client_id, item_index, subtotal, gst_amount, freelancer_payout, platform_fee, brief)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [group.rows[0].id, clientId, index + 1, share.subtotal, share.gst_amount, share.freelancer_payout,
        share.platform_fee, JSON.stringify(index === 0 ? line.brief : [])]
    );
  }
};

/** The jobs row behind a paid booking. Shared by checkout and by purchase items when their brief is submitted. */
const insertBookingJob = async (dbClient, booking) => {
  const snapshot = booking.snapshot || {};
  const optionText = snapshot.option_label && snapshot.option_label !== 'Standard' ? ` · ${snapshot.option_label}` : '';
  const packText = Number(snapshot.pack_size) > 1 ? ` · Pack of ${snapshot.pack_size}` : '';
  const qtyText = Number(booking.quantity) > 1 ? ` × ${booking.quantity}` : '';
  const itemText = snapshot.purchase_item ? ` · Order ${snapshot.purchase_item.index} of ${snapshot.purchase_item.count}` : '';
  const marginPercent = Number(booking.subtotal) > 0
    ? money((Number(booking.platform_fee) / Number(booking.subtotal)) * 100)
    : 0;
  const job = await dbClient.query(
    `INSERT INTO jobs
       (client_id, category_id, title, description, requirements, budget_type, budget_amount,
        currency, status, metadata, freelancer_payout, client_total, platform_margin_percent, brief_locked_at)
     VALUES ($1,$2,$3,$4,$5,'fixed',$6,'INR','matching',$7,$8,$9,$10,NOW())
     RETURNING id`,
    [
      booking.client_id,
      snapshot.category_id || null,
      `${snapshot.title}${optionText}${packText}${qtyText}${itemText}`.slice(0, 255),
      [formatBrief(booking.brief), booking.instructions].filter(Boolean).join('\n\n') || `Fixed-price service: ${snapshot.title}`,
      booking.instructions || null,
      booking.subtotal,
      JSON.stringify({
        source: 'service_booking',
        booking_id: booking.id,
        booking_number: booking.booking_number,
        template_id: booking.template_id,
        included_revisions: Number(snapshot.revisions ?? 0),
        ...(booking.purchase_item_id ? { purchase_item_id: booking.purchase_item_id } : {}),
      }),
      booking.freelancer_payout,
      money(Number(booking.subtotal) + Number(booking.gst_amount)),
      marginPercent,
    ]
  );
  return job.rows[0].id;
};

const createCheckout = async (clientId, { items, gstin, idempotency_key: idempotencyKey } = {}) => {
  const settings = await getServiceSettings();
  validateCheckoutInput({ items, gstin }, settings);

  if (idempotencyKey) {
    const existing = await query(
      'SELECT * FROM service_checkouts WHERE idempotency_key = $1 AND client_id = $2',
      [`${clientId}:${idempotencyKey}`, clientId]
    );
    if (existing.rows[0]) {
      const checkout = existing.rows[0];
      return checkoutResponse(checkout, checkout.razorpay_order_id ? {
        order_id: checkout.razorpay_order_id,
        amount_paise: Math.round(Number(checkout.total) * 100),
        currency: 'INR',
        key_id: env.razorpay.keyId,
      } : {});
    }
  }

  const variantIds = [...new Set(items.map((item) => item.variant_id))];
  const variantResult = await query(
    `SELECT v.*, t.slug, t.title, t.unit_label, t.option_group_label, t.revisions,
            t.includes, t.excludes, t.category_id, t.requirements_hint, t.brief_fields,
            c.slug AS category_slug
     FROM service_variants v
     JOIN service_templates t ON t.id = v.template_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE v.id = ANY($1::uuid[]) AND v.is_active AND t.is_active`,
    [variantIds]
  );
  const variants = new Map(variantResult.rows.map((row) => [row.id, row]));
  const missing = variantIds.filter((id) => !variants.has(id));
  if (missing.length) throw new AppError('One or more services in your cart are no longer available', 409);

  // Counted per variant across lines, so splitting a selection over several lines doesn't get past it.
  const itemsByVariant = new Map();
  items.forEach((item) => {
    const count = Number(item.quantity ?? 1) * Number(variants.get(item.variant_id).pack_size);
    itemsByVariant.set(item.variant_id, (itemsByVariant.get(item.variant_id) || 0) + count);
  });
  const overLimit = [...itemsByVariant.entries()].filter(([, count]) => count > MAX_ITEMS_PER_SELECTION);
  if (overLimit.length) {
    const err = new AppError(`You can place up to ${MAX_ITEMS_PER_SELECTION} orders of one service option at a time`, 422, 'ITEM_LIMIT');
    err.errors = overLimit.map(([id, count]) => `${variants.get(id).title}: ${count} orders. The limit is ${MAX_ITEMS_PER_SELECTION}.`);
    throw err;
  }

  // Checkout stays low-friction: accept blank or partial answers and let the client
  // send the full brief in the order chat after payment. Validate provided answers.
  const briefErrors = [];
  const briefs = items.map((item) => {
    const variant = variants.get(item.variant_id);
    const { brief, errors } = validateBriefAnswers(resolveBriefFields(variant), item.brief, variant.title, { allowIncomplete: true });
    briefErrors.push(...errors);
    return brief;
  });
  if (briefErrors.length) {
    const err = new AppError('Some brief details are invalid', 422);
    err.errors = briefErrors;
    throw err;
  }
  assertBriefIsClean(clientId, briefs, items);

  const gstRate = Number(settings.gst_rate);
  const lines = items.map((item, index) => {
    const variant = variants.get(item.variant_id);
    const quantity = Number(item.quantity ?? 1);
    const subtotal = money(Number(variant.price) * quantity);
    const payout = money(Number(variant.freelancer_payout) * quantity);
    return {
      item,
      variant,
      quantity,
      itemCount: quantity * Number(variant.pack_size),
      subtotal,
      payout,
      platformFee: money(subtotal - payout),
      gst: money((subtotal * gstRate) / 100),
      brief: briefs[index],
    };
  });
  const subtotal = money(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const gstAmount = money(lines.reduce((sum, line) => sum + line.gst, 0));
  const total = money(subtotal + gstAmount);
  const paymentMode = await testCheckoutAllowed(clientId) ? 'mock' : 'razorpay';

  const dbClient = await getClient();
  let checkout;
  try {
    await dbClient.query('BEGIN');
    const checkoutResult = await dbClient.query(
      `INSERT INTO service_checkouts
         (client_id, subtotal, gst_rate, gst_amount, total, gstin, payment_mode, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [clientId, subtotal, gstRate, gstAmount, total, gstin ? String(gstin).toUpperCase() : null,
        paymentMode, idempotencyKey ? `${clientId}:${idempotencyKey}` : null]
    );
    checkout = checkoutResult.rows[0];

    for (const line of lines) {
      const { variant } = line;
      const snapshot = {
        slug: variant.slug,
        title: variant.title,
        unit_label: variant.unit_label,
        option_group_label: variant.option_group_label,
        option_label: variant.option_label,
        pack_size: variant.pack_size,
        delivery_days: variant.delivery_days,
        revisions: variant.revisions,
        includes: variant.includes,
        excludes: variant.excludes,
        unit_price: Number(variant.price),
        mrp: variant.mrp === null ? null : Number(variant.mrp),
        category_id: variant.category_id,
        requirements_hint: variant.requirements_hint,
      };
      if (line.itemCount > 1) {
        await insertPurchaseGroup(dbClient, { checkoutId: checkout.id, clientId, line, snapshot });
        continue;
      }
      await dbClient.query(
        `INSERT INTO service_bookings
           (checkout_id, client_id, template_id, variant_id, quantity, snapshot, instructions,
            preferred_freelancer_id, unit_price, subtotal, gst_amount, freelancer_payout, platform_fee, brief)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [checkout.id, clientId, variant.template_id, variant.id, line.quantity, JSON.stringify(snapshot),
          line.item.instructions ? String(line.item.instructions).trim() : null,
          line.item.preferred_freelancer_id || null, Number(variant.price), line.subtotal, line.gst,
          line.payout, line.platformFee, JSON.stringify(line.brief)]
      );
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  if (paymentMode === 'mock') return checkoutResponse(checkout);

  const order = await callRazorpay('orders.create', () => razorpay.orders.create({
    amount: Math.round(total * 100),
    currency: 'INR',
    receipt: `svc_${checkout.id.slice(0, 30)}`,
    notes: { purpose: 'service_checkout', checkout_id: checkout.id, client_id: clientId },
  }));
  const updated = await query(
    'UPDATE service_checkouts SET razorpay_order_id = $1 WHERE id = $2 RETURNING *',
    [order.id, checkout.id]
  );
  return checkoutResponse(updated.rows[0], {
    order_id: order.id,
    amount_paise: order.amount,
    currency: 'INR',
    key_id: env.razorpay.keyId,
  });
};

const signaturesMatch = (expected, provided) => {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Marks a checkout paid and turns every booking into a backing job with the
 * client's payment parked in their wallet. Idempotent: verify and the webhook
 * may both call it.
 */
const finalizeCheckout = async (checkoutId, paymentId = null) => {
  const dbClient = await getClient();
  let bookings = [];
  let checkout;
  let alreadyPaid = false;
  let purchaseItemCount = 0;
  try {
    await dbClient.query('BEGIN');
    const checkoutResult = await dbClient.query(
      'SELECT * FROM service_checkouts WHERE id = $1 FOR UPDATE',
      [checkoutId]
    );
    checkout = checkoutResult.rows[0];
    if (!checkout) throw new AppError('Checkout not found', 404);

    if (checkout.status === 'paid') {
      alreadyPaid = true;
      await dbClient.query('COMMIT');
    } else {
      await dbClient.query(
        `UPDATE service_checkouts
         SET status = 'paid', paid_at = NOW(), razorpay_payment_id = COALESCE($2, razorpay_payment_id)
         WHERE id = $1`,
        [checkoutId, paymentId]
      );

      const bookingResult = await dbClient.query(
        `SELECT * FROM service_bookings WHERE checkout_id = $1 ORDER BY created_at FOR UPDATE`,
        [checkoutId]
      );
      const wallet = await getWalletByUserId(checkout.client_id, dbClient, true);

      for (const booking of bookingResult.rows) {
        const jobId = await insertBookingJob(dbClient, booking);

        // Payment lands in the client's wallet and is moved to escrow on assignment.
        await recordTransaction(dbClient, {
          walletId: wallet.id,
          userId: booking.client_id,
          type: 'topup',
          amount: Number(booking.subtotal),
          referenceId: booking.id,
          referenceType: 'service_booking',
          idempotencyKey: `service-topup:${booking.id}`,
          description: `Payment for ${booking.booking_number}`,
          metadata: { checkout_id: checkoutId, booking_id: booking.id, razorpay_payment_id: paymentId },
        });

        const updated = await dbClient.query(
          `UPDATE service_bookings
           SET job_id = $1, paid_at = NOW(), assignment_status = 'unassigned'
           WHERE id = $2
           RETURNING *`,
          [jobId, booking.id]
        );
        bookings.push(updated.rows[0]);
      }

      // Multi-item lines: each item waits for its brief. Its money stays on the item until assignment.
      const groupResult = await dbClient.query(
        'UPDATE service_purchase_groups SET paid_at = NOW() WHERE checkout_id = $1 RETURNING id, item_count',
        [checkoutId]
      );
      purchaseItemCount = groupResult.rows.reduce((sum, row) => sum + Number(row.item_count), 0);
      if (groupResult.rows.length) {
        await dbClient.query(
          `UPDATE service_purchase_items SET status = 'ready'
           WHERE group_id = ANY($1::uuid[]) AND status = 'pending_payment'`,
          [groupResult.rows.map((row) => row.id)]
        );
      }

      if (Number(checkout.gst_amount) > 0) {
        await dbClient.query(
          `INSERT INTO platform_financial_ledger
             (type, amount, reference_id, reference_type, idempotency_key, description, metadata)
           VALUES ('gst_collected', $1, $2, 'service_checkout', $3, 'GST collected on service checkout', $4)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [checkout.gst_amount, checkoutId, `service-gst:${checkoutId}`,
            JSON.stringify({ gst_rate: Number(checkout.gst_rate), gstin: checkout.gstin })]
        );
      }
      await dbClient.query('COMMIT');
    }
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  if (!alreadyPaid) {
    logger.info('Service checkout paid', { checkoutId, bookings: bookings.length, purchaseItems: purchaseItemCount });
    const placed = bookings.length + purchaseItemCount;
    notificationService.createNotification({
      userId: checkout.client_id,
      type: 'service_booked',
      title: placed > 1 ? `${placed} orders placed` : 'Order placed',
      body: purchaseItemCount
        ? 'Payment received. Write a brief for each order and we start matching a freelancer for it.'
        : 'Payment received. We are assigning a freelancer now.',
      entityType: 'service_booking',
      entityId: bookings[0]?.id || null,
      data: { checkout_id: checkoutId, booking_ids: bookings.map((b) => b.id) },
      dedupeKey: `service-booked:${checkoutId}`,
    });
    for (const booking of bookings) {
      try {
        await assignBooking(booking.id);
      } catch (err) {
        logger.error('Auto-assignment failed', { bookingId: booking.id, error: err.message });
      }
    }
  }

  const [bookingRows, groupRows] = await Promise.all([
    query(
      'SELECT id, job_id, variant_id FROM service_bookings WHERE checkout_id = $1 AND purchase_item_id IS NULL ORDER BY created_at',
      [checkoutId]
    ),
    query(
      `SELECT g.id, g.variant_id, g.item_count,
              (SELECT i.id FROM service_purchase_items i WHERE i.group_id = g.id AND i.item_index = 1) AS first_item_id
       FROM service_purchase_groups g WHERE g.checkout_id = $1 ORDER BY g.created_at`,
      [checkoutId]
    ),
  ]);
  return {
    checkout_id: checkoutId,
    status: 'paid',
    booking_ids: bookingRows.rows.map((row) => row.id),
    // Lets the browser upload the brief files it is holding into each order.
    bookings: bookingRows.rows,
    // Multi-item lines: the browser keeps their cart files for item 1's brief.
    purchase_groups: groupRows.rows,
  };
};

const verifyCheckout = async (clientId, checkoutId, payload = {}) => {
  const result = await query('SELECT * FROM service_checkouts WHERE id = $1 AND client_id = $2', [checkoutId, clientId]);
  const checkout = result.rows[0];
  if (!checkout) throw new AppError('Checkout not found', 404);
  if (checkout.status === 'paid') return finalizeCheckout(checkoutId);

  if (checkout.payment_mode === 'mock') {
    if (!await testCheckoutAllowed(clientId)) throw new AppError('Test checkout is disabled', 400);
    return finalizeCheckout(checkoutId, `mock_${checkoutId.slice(0, 18)}`);
  }

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload;
  if (!orderId || !paymentId || !signature || orderId !== checkout.razorpay_order_id) {
    throw new AppError('Payment details are missing or do not match this checkout', 400);
  }
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  if (!signaturesMatch(expected, signature)) throw new AppError('Payment signature verification failed', 400);

  const payment = await callRazorpay('payments.fetch', () => razorpay.payments.fetch(paymentId));
  if (payment.status !== 'captured') throw new AppError('Payment has not been captured yet', 400);
  if (payment.order_id !== orderId) throw new AppError('Payment does not belong to this checkout', 400);
  if (Number(payment.amount) !== Math.round(Number(checkout.total) * 100) || payment.currency !== 'INR') {
    throw new AppError('Captured amount does not match this checkout', 400);
  }
  return finalizeCheckout(checkoutId, paymentId);
};

/** Webhook entry point: returns true when the order belonged to a service checkout. */
const processCapturedServicePayment = async (orderId, paymentId, amountPaise) => {
  const result = await query('SELECT * FROM service_checkouts WHERE razorpay_order_id = $1', [orderId]);
  const checkout = result.rows[0];
  // Required here, not at the top: ai-edits uses this module's checkout helpers.
  if (!checkout) return require('../aiEdits/aiEdits.service').processCapturedAiEditPayment(orderId, paymentId, amountPaise);
  if (Number(amountPaise) !== Math.round(Number(checkout.total) * 100)) {
    logger.error('Service webhook amount mismatch', { checkoutId: checkout.id, amountPaise });
    return true;
  }
  await finalizeCheckout(checkout.id, paymentId);
  return true;
};

// ── Assignment ────────────────────────────────────────────────────────────────

const ELIGIBLE_FREELANCER_SQL = `
  u.role = 'freelancer'
  AND u.is_active = true
  AND COALESCE(u.is_available, true) = true
  AND u.kyc_status = 'verified'
  AND COALESCE(u.active_jobs_count, 0) < $2
  AND ${TEST_ACCOUNT_SQL('u')} = (SELECT ${TEST_ACCOUNT_SQL('client')} FROM users client WHERE client.id = $3)`;

const getSystemActorId = async (dbClient) => {
  const settings = await getServiceSettings(dbClient);
  if (settings.system_user_id) return settings.system_user_id;
  const admin = await dbClient.query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = true
     ORDER BY is_super_admin DESC, created_at ASC LIMIT 1`
  );
  if (!admin.rows[0]) throw new AppError('No admin account is available to record the assignment', 500);
  return admin.rows[0].id;
};

// Everything fairMatch needs to score a freelancer.
const CANDIDATE_FIELDS_SQL = `
  u.id, u.full_name, u.email, u.avatar_url, u.bio, u.skills,
  COALESCE(u.average_rating, 0) AS average_rating,
  COALESCE(u.jobs_completed_count, 0) AS jobs_completed_count,
  COALESCE(u.active_jobs_count, 0) AS active_jobs_count,
  EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.freelancer_id = u.id) AS has_portfolio,
  la.last_assigned_at,
  EXTRACT(DAY FROM NOW() - la.last_assigned_at)::int AS days_since_last_assignment`;
const LAST_ASSIGNED_JOIN_SQL = `
  LEFT JOIN LATERAL (
    SELECT MAX(ja.created_at) AS last_assigned_at FROM job_assignments ja
    WHERE ja.freelancer_id = u.id AND ja.status IN ('accepted', 'completed')
  ) la ON true`;

const OFFER_MINUTES = 30;
const MATCHING_HOLD_MINUTES = 15;

// Freelancers who already turned this order down (or let the offer lapse) aren't asked again.
const pickFreelancer = async (dbClient, booking, matching) => {
  // Lock every eligible opted-in freelancer so two orders can't both take someone's last slot.
  const result = await dbClient.query(
    `SELECT ${CANDIDATE_FIELDS_SQL}
     FROM freelancer_service_optins o
     JOIN users u ON u.id = o.freelancer_id
     ${LAST_ASSIGNED_JOIN_SQL}
     WHERE o.template_id = $1 AND o.is_active = true AND u.id <> $3
       AND ${ELIGIBLE_FREELANCER_SQL}
       AND NOT EXISTS (
         SELECT 1 FROM job_assignments ja
         WHERE ja.job_id = $4 AND ja.freelancer_id = u.id AND ja.status IN ('declined', 'cancelled')
       )
     FOR UPDATE OF u SKIP LOCKED`,
    [booking.template_id, Number(matching?.max_active_jobs || 5), booking.client_id, booking.job_id]
  );
  const [best] = rankFreelancers(result.rows, { preferredId: booking.preferred_freelancer_id, settings: matching });
  if (!best) return null;
  logger.info('Service booking matched', {
    bookingId: booking.id, freelancerId: best.id, candidates: result.rows.length,
    preferred: best.id === booking.preferred_freelancer_id, score: best.match.total, breakdown: best.match.breakdown,
  });
  return best.id;
};

const notifyAdminsUnassigned = async (booking) => {
  const admins = await query(`SELECT id FROM users WHERE role = 'admin' AND is_active = true`);
  await Promise.all(admins.rows.map((admin) => notificationService.createNotification({
    userId: admin.id,
    type: 'service_unassigned',
    title: `${booking.booking_number} needs a freelancer`,
    body: `No eligible freelancer took ${booking.snapshot?.title || 'a service order'}. Assign one manually.`,
    entityType: 'service_booking',
    entityId: booking.id,
    data: { booking_id: booking.id },
    dedupeKey: `service-unassigned:${booking.id}:${admin.id}`,
  })));
};

/** Closes an open offer on a locked booking: the freelancer declined, timed out, or an admin stepped in. */
const closeOffer = async (dbClient, booking, note) => {
  if (!booking.offered_freelancer_id) return;
  await dbClient.query(
    `UPDATE job_assignments
     SET status = 'declined', responded_at = NOW(), freelancer_note = $3
     WHERE job_id = $1 AND freelancer_id = $2 AND status = 'pending_acceptance'`,
    [booking.job_id, booking.offered_freelancer_id, note]
  );
  await dbClient.query(
    'UPDATE service_bookings SET offered_freelancer_id = NULL, offered_at = NULL, offer_expires_at = NULL WHERE id = $1',
    [booking.id]
  );
};

/**
 * Starts the work on a locked, paid booking: escrow, job, counters and the booking itself.
 * Runs inside the caller's transaction; startOrder() does the chat and notifications after commit.
 */
const commitAssignment = async (dbClient, booking, freelancerId, { assignedBy, method }) => {
  const deliveryDays = Number(booking.snapshot?.delivery_days || 1);
  // A purchase item's money was kept off the wallet until now, so nothing else could spend it.
  if (booking.purchase_item_id) {
    const wallet = await getWalletByUserId(booking.client_id, dbClient, true);
    await recordTransaction(dbClient, {
      walletId: wallet.id,
      userId: booking.client_id,
      type: 'topup',
      amount: Number(booking.subtotal),
      referenceId: booking.id,
      referenceType: 'service_booking',
      idempotencyKey: `service-topup:${booking.id}`,
      description: `Payment for ${booking.booking_number}`,
      metadata: { checkout_id: booking.checkout_id, booking_id: booking.id, purchase_item_id: booking.purchase_item_id },
    });
  }
  await holdEscrow({
    jobId: booking.job_id,
    clientId: booking.client_id,
    freelancerId,
    amount: Number(booking.subtotal),
    freelancerPayout: Number(booking.freelancer_payout),
    platformRevenue: Number(booking.platform_fee),
    marginPercent: Number(booking.subtotal) > 0 ? money((Number(booking.platform_fee) / Number(booking.subtotal)) * 100) : 0,
    dbClient,
  });

  // An offer being accepted becomes the assignment; anything else is recorded fresh.
  const accepted = await dbClient.query(
    `UPDATE job_assignments SET status = 'accepted', responded_at = NOW(), started_at = NOW()
     WHERE job_id = $1 AND freelancer_id = $2 AND status = 'pending_acceptance'
     RETURNING id`,
    [booking.job_id, freelancerId]
  );
  if (!accepted.rows[0]) {
    await dbClient.query(
      `INSERT INTO job_assignments (job_id, freelancer_id, assigned_by, status, responded_at, started_at)
       VALUES ($1, $2, $3, 'accepted', NOW(), NOW())`,
      [booking.job_id, freelancerId, assignedBy]
    );
  }
  await dbClient.query(
    `UPDATE job_assignments SET status = 'cancelled', responded_at = NOW()
     WHERE job_id = $1 AND freelancer_id <> $2 AND status = 'pending_acceptance'`,
    [booking.job_id, freelancerId]
  );
  await dbClient.query(
    `UPDATE jobs
     SET status = 'in_progress', active_freelancer_id = $2, assigned_by = $3, assigned_at = NOW(),
         matched_at = NOW(), match_method = $4, deadline = NOW() + ($5 || ' days')::interval
     WHERE id = $1`,
    [booking.job_id, freelancerId, assignedBy, method, String(deliveryDays)]
  );
  await dbClient.query(
    'UPDATE users SET active_jobs_count = COALESCE(active_jobs_count, 0) + 1 WHERE id = $1',
    [freelancerId]
  );
  const updated = await dbClient.query(
    `UPDATE service_bookings
     SET freelancer_id = $2, assignment_status = 'assigned', assigned_at = NOW(),
         due_at = NOW() + ($3 || ' days')::interval,
         offered_freelancer_id = NULL, offered_at = NULL, offer_expires_at = NULL
     WHERE id = $1
     RETURNING *`,
    [booking.id, freelancerId, String(deliveryDays)]
  );
  return updated.rows[0];
};

/** After an assignment commits: open the chat, post the brief and its files, tell both sides. */
const startOrder = async (booking, freelancerId) => {
  await createChatRoom({ jobId: booking.job_id, clientId: booking.client_id, freelancerId })
    .catch((err) => logger.warn('Service chat room creation failed', { bookingId: booking.id, error: err.message }));
  const snapshot = booking.snapshot || {};
  const header = [
    `Order ${booking.booking_number} started: ${snapshot.title}${snapshot.option_label ? ` (${snapshot.option_label})` : ''}`,
    Number(snapshot.pack_size) > 1 ? `Pack of ${snapshot.pack_size}` : null,
    Number(booking.quantity) > 1 ? `Quantity: ${booking.quantity}` : null,
    snapshot.purchase_item ? `Order ${snapshot.purchase_item.index} of ${snapshot.purchase_item.count} from one purchase` : null,
    `Delivery in ${snapshot.delivery_days} day${Number(snapshot.delivery_days) === 1 ? '' : 's'} · ${snapshot.revisions} revision${Number(snapshot.revisions) === 1 ? '' : 's'} included`,
  ].filter(Boolean).join('\n');
  const answers = Array.isArray(booking.brief) ? booking.brief : [];
  // The order details are from Creatyv; the brief shows as the client's own messages.
  const clientMessages = [
    ...answers.map((answer) => formatBrief([answer])).filter(Boolean),
    booking.instructions ? `Anything else:\n${booking.instructions}` : null,
  ];
  await appendSystemMessagesByJob(booking.job_id, [
    header,
    !answers.length && !booking.instructions ? 'Share your assets, references and instructions here so work can begin.' : null,
  ]).catch((err) => logger.warn('Service order message failed', { bookingId: booking.id, error: err.message }));
  await postClientMessagesByJob(booking.job_id, booking.client_id, clientMessages)
    .catch((err) => logger.warn('Service brief message failed', { bookingId: booking.id, error: err.message }));
  // Brief files that finished uploading before the chat existed go in right after the brief.
  // Later ones are posted by Mintbox when their upload completes.
  const earlyFiles = await query(
    `SELECT * FROM mintbox_files WHERE job_id = $1 AND purpose = 'brief' AND uploaded_by = $2 ORDER BY created_at`,
    [booking.job_id, booking.client_id]
  ).catch(() => ({ rows: [] }));
  for (const file of earlyFiles.rows) {
    await postFileMessage({ jobId: booking.job_id, senderId: booking.client_id, senderRole: 'client', file })
      .catch((err) => logger.warn('Brief file message failed', { bookingId: booking.id, error: err.message }));
  }

  await Promise.all([
    notificationService.createNotification({
      userId: freelancerId,
      type: 'service_assigned',
      title: `New order: ${snapshot.title}`,
      body: `${booking.booking_number} is yours. Due in ${snapshot.delivery_days} day${Number(snapshot.delivery_days) === 1 ? '' : 's'}.`,
      entityType: 'service_booking',
      entityId: booking.id,
      data: { booking_id: booking.id, job_id: booking.job_id, audience: 'freelancer' },
      dedupeKey: `service-assigned:${booking.id}:${freelancerId}`,
    }),
    notificationService.createNotification({
      userId: booking.client_id,
      type: 'service_assigned',
      title: 'Freelancer assigned',
      body: `A freelancer has started ${booking.booking_number}. Share your files and instructions in the order chat.`,
      entityType: 'service_booking',
      entityId: booking.id,
      data: { booking_id: booking.id, job_id: booking.job_id, audience: 'client' },
      dedupeKey: `service-assigned-client:${booking.id}:${freelancerId}`,
    }),
  ]);
};

/**
 * Finds a freelancer for a paid booking.
 * - Admin with a freelancerId: assigns them straight away (still eligibility-checked).
 * - Otherwise: offers it to the best-ranked freelancer, who has OFFER_MINUTES to accept.
 *   A decline or no answer passes it to the next one (see declineOffer / expireOffers).
 */
const assignBooking = async (bookingId, { freelancerId = null, actorId = null } = {}) => {
  const dbClient = await getClient();
  let booking;
  let chosen = null;
  let offered = null;
  try {
    await dbClient.query('BEGIN');
    const bookingResult = await dbClient.query('SELECT * FROM service_bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    booking = bookingResult.rows[0];
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.assignment_status === 'assigned') {
      await dbClient.query('COMMIT');
      return { assigned: true, already_assigned: true, freelancer_id: booking.freelancer_id };
    }
    if (booking.assignment_status !== 'unassigned' || !booking.job_id) {
      throw new AppError('Only paid, unassigned bookings can be assigned', 409);
    }
    // Brief files are still uploading. An admin can still assign by hand.
    if (booking.matching_held_at && !freelancerId) {
      await dbClient.query('COMMIT');
      return { assigned: false, held: true };
    }

    const matching = await getSetting('matching', { max_active_jobs: 5 }, dbClient);
    const maxActiveJobs = Number(matching?.max_active_jobs || 5);

    if (freelancerId) {
      const check = await dbClient.query(
        `SELECT u.id FROM users u WHERE u.id = $1 AND u.id <> $3 AND ${ELIGIBLE_FREELANCER_SQL} FOR UPDATE`,
        [freelancerId, maxActiveJobs, booking.client_id]
      );
      if (!check.rows[0]) {
        throw new AppError('That freelancer is not eligible (inactive, unavailable, KYC not verified or at capacity)', 400);
      }
      if (booking.offered_freelancer_id !== freelancerId) await closeOffer(dbClient, booking, 'Assigned by admin to someone else');
      chosen = freelancerId;
      booking = await commitAssignment(dbClient, booking, chosen, { assignedBy: actorId || await getSystemActorId(dbClient), method: 'manual' });
      if (actorId) {
        await writeAudit({
          actorId,
          action: 'service_booking.assigned',
          entityType: 'service_booking',
          entityId: booking.id,
          metadata: { freelancer_id: chosen },
        }, dbClient).catch(() => null);
      }
    } else if (booking.offered_freelancer_id && new Date(booking.offer_expires_at) > new Date()) {
      // Someone is already looking at it.
      await dbClient.query('COMMIT');
      return { assigned: false, offered: true, freelancer_id: booking.offered_freelancer_id, expires_at: booking.offer_expires_at };
    } else {
      await closeOffer(dbClient, booking, 'Offer expired');
      offered = await pickFreelancer(dbClient, booking, matching);
      if (offered) {
        await dbClient.query(
          `INSERT INTO job_assignments (job_id, freelancer_id, assigned_by, status)
           VALUES ($1, $2, $3, 'pending_acceptance')`,
          [booking.job_id, offered, await getSystemActorId(dbClient)]
        );
        const updated = await dbClient.query(
          `UPDATE service_bookings
           SET offered_freelancer_id = $2, offered_at = NOW(), offer_expires_at = NOW() + ($3 || ' minutes')::interval
           WHERE id = $1 RETURNING *`,
          [booking.id, offered, String(OFFER_MINUTES)]
        );
        booking = updated.rows[0];
      }
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  if (chosen) {
    await startOrder(booking, chosen);
    logger.info('Service booking assigned', { bookingId: booking.id, freelancerId: chosen, manual: true });
    return { assigned: true, freelancer_id: chosen };
  }
  if (offered) {
    const snapshot = booking.snapshot || {};
    await notificationService.createNotification({
      userId: offered,
      type: 'service_offer',
      title: `New order offer: ${snapshot.title}`,
      body: `Accept ${booking.booking_number} within ${OFFER_MINUTES} minutes or it goes to another freelancer.`,
      entityType: 'service_booking',
      entityId: booking.id,
      data: { booking_id: booking.id, audience: 'freelancer', expires_at: booking.offer_expires_at },
      dedupeKey: `service-offer:${booking.id}:${offered}`,
    });
    logger.info('Service booking offered', { bookingId: booking.id, freelancerId: offered, expiresAt: booking.offer_expires_at });
    return { assigned: false, offered: true, freelancer_id: offered, expires_at: booking.offer_expires_at };
  }
  await notifyAdminsUnassigned(booking);
  return { assigned: false };
};

/** The offered freelancer takes the order. Capacity is checked again, since offers can stack. */
const acceptOffer = async (freelancerId, bookingId) => {
  const dbClient = await getClient();
  let booking;
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query('SELECT * FROM service_bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    booking = result.rows[0];
    if (!booking || booking.offered_freelancer_id !== freelancerId) throw new AppError('This offer is no longer open to you', 409);
    if (new Date(booking.offer_expires_at) <= new Date()) throw new AppError('This offer has expired and went to another freelancer', 410);
    const matching = await getSetting('matching', { max_active_jobs: 5 }, dbClient);
    const check = await dbClient.query(
      `SELECT u.id FROM users u WHERE u.id = $1 AND u.id <> $3 AND ${ELIGIBLE_FREELANCER_SQL} FOR UPDATE`,
      [freelancerId, Number(matching?.max_active_jobs || 5), booking.client_id]
    );
    if (!check.rows[0]) throw new AppError('You are at your active-order limit or booking is off. Finish an order or switch booking on first.', 409);
    booking = await commitAssignment(dbClient, booking, freelancerId, { assignedBy: await getSystemActorId(dbClient), method: 'auto' });
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
  await startOrder(booking, freelancerId);
  logger.info('Service offer accepted', { bookingId, freelancerId });
  return { assigned: true, booking_id: bookingId };
};

/** Passes an open offer on: the freelancer declined, or it lapsed. Then offers the next one. */
const passOffer = async (bookingId, { freelancerId = null, note }) => {
  const dbClient = await getClient();
  let passed = false;
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query('SELECT * FROM service_bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const booking = result.rows[0];
    const stillOpen = booking?.assignment_status === 'unassigned' && booking.offered_freelancer_id
      && (!freelancerId || booking.offered_freelancer_id === freelancerId);
    if (stillOpen) {
      await closeOffer(dbClient, booking, note);
      passed = booking.offered_freelancer_id;
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
  if (!passed) {
    if (freelancerId) throw new AppError('This offer is no longer open to you', 409);
    return null;
  }
  return assignBooking(bookingId);
};

const declineOffer = (freelancerId, bookingId) => passOffer(bookingId, { freelancerId, note: 'Declined by freelancer' });

/**
 * One running tally per stretch away instead of a notification per missed order:
 * misses since the freelancer was last active update the same unread notification.
 */
const noteMissedOffer = async (freelancerId) => {
  const user = await query('SELECT last_active_at, is_available FROM users WHERE id = $1', [freelancerId]);
  const { last_active_at: lastActive, is_available: available } = user.rows[0] || {};
  const open = await query(
    `SELECT id, data FROM notifications
     WHERE user_id = $1 AND type = 'service_offers_missed' AND is_read = false
       AND created_at > COALESCE($2::timestamptz, 'epoch')
     ORDER BY created_at DESC LIMIT 1`,
    [freelancerId, lastActive || null]
  );
  const count = (Number(open.rows[0]?.data?.count) || 0) + 1;
  const title = count === 1 ? 'You missed an order' : `You missed ${count} orders`;
  const body = `${count === 1 ? 'An order was' : `${count} orders were`} offered to you while you were away and went to someone else. `
    + (available ? `Accept within ${OFFER_MINUTES} minutes to keep the next one.` : "Switch booking on when you're ready for more.");
  const data = { count, audience: 'freelancer' };
  if (open.rows[0]) {
    await query(
      'UPDATE notifications SET title = $2, body = $3, data = $4, created_at = NOW() WHERE id = $1',
      [open.rows[0].id, title, body, JSON.stringify(data)]
    );
    return;
  }
  await notificationService.createNotification({
    userId: freelancerId, type: 'service_offers_missed', title, body, entityType: 'user', entityId: freelancerId, data,
  });
};

/** Offers that ran out: tell the freelancer and move to the next one. Run by the scheduler. */
const expireOffers = async () => {
  const due = await query(
    `SELECT id, offered_freelancer_id, booking_number FROM service_bookings
     WHERE assignment_status = 'unassigned' AND offered_freelancer_id IS NOT NULL AND offer_expires_at <= NOW()
     ORDER BY offer_expires_at LIMIT 50`
  );
  for (const row of due.rows) {
    try {
      await passOffer(row.id, { note: `No answer within ${OFFER_MINUTES} minutes` });
      await noteMissedOffer(row.offered_freelancer_id)
        .catch((err) => logger.warn('Missed-order notification failed', { userId: row.offered_freelancer_id, error: err.message }));
    } catch (err) {
      logger.error('Could not pass on expired offer', { bookingId: row.id, error: err.message });
    }
  }
  return due.rows.length;
};

/** Paid orders that found nobody earlier get another try, e.g. after someone switches booking on. */
const retryUnassigned = async () => {
  // A client who left mid-upload can still send files in the chat; don't hold their order back.
  await query(
    `UPDATE service_bookings SET matching_held_at = NULL
     WHERE matching_held_at < NOW() - ($1 || ' minutes')::interval AND assignment_status = 'unassigned'`,
    [String(MATCHING_HOLD_MINUTES)]
  );
  const waiting = await query(
    `SELECT id FROM service_bookings
     WHERE assignment_status = 'unassigned' AND job_id IS NOT NULL AND offered_freelancer_id IS NULL
       AND matching_held_at IS NULL
     ORDER BY paid_at LIMIT 25`
  );
  for (const row of waiting.rows) {
    await assignBooking(row.id).catch((err) => logger.warn('Retrying assignment failed', { bookingId: row.id, error: err.message }));
  }
  return waiting.rows.length;
};

/** Open offers for a freelancer, soonest to expire first. */
const listMyOffers = async (freelancerId) => {
  const result = await query(
    `${BOOKING_SELECT}
     WHERE b.offered_freelancer_id = $1 AND b.assignment_status = 'unassigned' AND b.offer_expires_at > NOW()
     ORDER BY b.offer_expires_at`,
    [freelancerId]
  );
  return result.rows.map((row) => shapeBooking(row, 'freelancer'));
};

// ── Booking reads ─────────────────────────────────────────────────────────────

const BOOKING_SELECT = `
  SELECT b.*, t.slug AS template_slug, t.title AS template_title, t.cover_url,
         t.brief_fields, c.name AS category_name, c.slug AS category_slug,
         j.status AS job_status, j.deadline,
         fu.full_name AS freelancer_name, fu.avatar_url AS freelancer_avatar,
         fu.average_rating AS freelancer_rating,
         cu.full_name AS client_name, cu.avatar_url AS client_avatar,
         room.id AS room_id,
         latest.status AS latest_delivery_status,
         latest.created_at AS latest_delivery_at,
         EXISTS (
           SELECT 1 FROM mintbox_revision_rounds rr
           WHERE rr.job_id = b.job_id AND rr.status IN ('feedback_open', 'awaiting_delivery')
         ) AS has_open_revision,
         (SELECT COUNT(*)::int FROM mintbox_revision_rounds rr WHERE rr.job_id = b.job_id) AS revisions_used,
         (SELECT COUNT(*)::int FROM mintbox_files f
            WHERE f.job_id = b.job_id AND f.purpose = 'delivery' AND f.deleted_by_client_at IS NULL) AS delivery_count,
         EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = b.job_id) AS is_reviewed
  FROM service_bookings b
  JOIN service_templates t ON t.id = b.template_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN jobs j ON j.id = b.job_id
  LEFT JOIN users fu ON fu.id = b.freelancer_id
  LEFT JOIN users cu ON cu.id = b.client_id
  LEFT JOIN chat_rooms room ON room.job_id = b.job_id
  LEFT JOIN LATERAL (
    SELECT f.status, f.created_at FROM mintbox_files f
    WHERE f.job_id = b.job_id AND f.purpose = 'delivery' AND f.deleted_by_client_at IS NULL
    ORDER BY f.created_at DESC LIMIT 1
  ) latest ON true`;

const deriveStage = (row) => {
  if (row.assignment_status === 'pending_payment') return 'awaiting_payment';
  if (row.assignment_status === 'cancelled' || row.job_status === 'cancelled') return 'cancelled';
  if (row.completed_at || row.job_status === 'completed') return 'completed';
  if (row.assignment_status === 'unassigned') return 'finding_freelancer';
  if (row.has_open_revision) return 'revision_requested';
  if (row.latest_delivery_status === 'submitted') return 'delivered';
  if (row.latest_delivery_status === 'approved') return 'approved';
  return 'in_progress';
};

const STAGE_GROUPS = {
  active: ['finding_freelancer', 'in_progress', 'revision_requested'],
  delivered: ['delivered', 'approved'],
  completed: ['completed'],
};

const shapeBooking = (row, audience) => {
  const stage = deriveStage(row);
  const revisionsIncluded = Number(row.snapshot?.revisions ?? 0);
  const savedAnswers = Object.fromEntries((Array.isArray(row.brief) ? row.brief : []).map((answer) => [answer.key, answer.value]));
  const briefComplete = validateBriefAnswers(
    resolveBriefFields({ brief_fields: row.brief_fields, category_slug: row.category_slug }),
    savedAnswers,
    row.template_title || 'This service'
  ).errors.length === 0;
  const shaped = {
    ...row,
    stage,
    brief_complete: briefComplete,
    revisions_included: revisionsIncluded,
    revisions_left: Math.max(0, revisionsIncluded - Number(row.revisions_used || 0)),
  };
  if (audience === 'client') {
    delete shaped.freelancer_payout;
    delete shaped.platform_fee;
  }
  if (audience === 'freelancer') {
    delete shaped.unit_price;
    delete shaped.subtotal;
    delete shaped.gst_amount;
    delete shaped.platform_fee;
    delete shaped.preferred_freelancer_id;
    delete shaped.checkout_id;
  }
  return shaped;
};

const filterByGroup = (rows, filter) => (STAGE_GROUPS[filter] ? rows.filter((row) => STAGE_GROUPS[filter].includes(row.stage)) : rows);

const listClientBookings = async (clientId, { filter } = {}) => {
  const result = await query(
    `${BOOKING_SELECT}
     WHERE b.client_id = $1 AND b.assignment_status <> 'pending_payment'
     ORDER BY b.created_at DESC`,
    [clientId]
  );
  return filterByGroup(result.rows.map((row) => shapeBooking(row, 'client')), filter);
};

const getClientBooking = async (clientId, bookingId) => {
  if (!UUID_PATTERN.test(String(bookingId))) throw new AppError('Order not found', 404);
  const result = await query(`${BOOKING_SELECT} WHERE (b.id = $1 OR b.job_id = $1) AND b.client_id = $2`, [bookingId, clientId]);
  if (!result.rows[0]) throw new AppError('Order not found', 404);
  return shapeBooking(result.rows[0], 'client');
};

const updateClientBookingBrief = async (clientId, bookingId, { brief: answers, instructions, draft = false } = {}) => {
  if (!UUID_PATTERN.test(String(bookingId))) throw new AppError('Order not found', 404);
  const dbClient = await getClient();
  let booking;
  let cleanedBrief;
  let cleanInstructions;
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT b.*, t.title AS template_title, t.brief_fields, c.slug AS category_slug, j.status AS job_status
       FROM service_bookings b
       JOIN service_templates t ON t.id = b.template_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN jobs j ON j.id = b.job_id
       WHERE b.id = $1 AND b.client_id = $2
       FOR UPDATE OF b`,
      [bookingId, clientId]
    );
    booking = result.rows[0];
    if (!booking) throw new AppError('Order not found', 404);
    if (booking.assignment_status === 'pending_payment' || booking.assignment_status === 'cancelled'
      || booking.completed_at || ['completed', 'cancelled'].includes(booking.job_status)) {
      throw new AppError('The brief can no longer be changed for this order', 409);
    }

    const validated = validateBriefAnswers(resolveBriefFields(booking), answers, booking.template_title, { allowIncomplete: Boolean(draft) });
    if (validated.errors.length) {
      const err = new AppError('Complete the required brief details', 422);
      err.errors = validated.errors;
      throw err;
    }
    cleanedBrief = validated.brief;
    if (draft) {
      const savedFiles = (Array.isArray(booking.brief) ? booking.brief : []).filter((answer) => answer.type === 'files');
      const includedKeys = new Set(cleanedBrief.map((answer) => answer.key));
      cleanedBrief.push(...savedFiles.filter((answer) => !includedKeys.has(answer.key)));
    }
    cleanInstructions = String(instructions || '').trim();
    if (cleanInstructions.length > 4000) throw new AppError('Additional instructions are too long', 422);
    assertBriefIsClean(clientId, [cleanedBrief], [{ instructions: cleanInstructions }]);

    const description = [formatBrief(cleanedBrief), cleanInstructions].filter(Boolean).join('\n\n')
      || `Fixed-price service: ${booking.template_title}`;
    await dbClient.query(
      'UPDATE service_bookings SET brief = $2, instructions = $3 WHERE id = $1',
      [bookingId, JSON.stringify(cleanedBrief), cleanInstructions || null]
    );
    if (booking.job_id) {
      await dbClient.query(
        'UPDATE jobs SET description = $2, requirements = $3 WHERE id = $1',
        [booking.job_id, description, cleanInstructions || null]
      );
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  if (booking.job_id && !draft) {
    const updateMessages = [
      ...cleanedBrief.map((answer) => formatBrief([answer])).filter(Boolean),
      cleanInstructions ? `Anything else:\n${cleanInstructions}` : null,
    ];
    await postClientMessagesByJob(booking.job_id, clientId, updateMessages)
      .catch((err) => logger.warn('Updated service brief message failed', { bookingId, error: err.message }));
  }
  return getClientBooking(clientId, bookingId);
};

const listFreelancerWork = async (freelancerId, { filter } = {}) => {
  const result = await query(
    `${BOOKING_SELECT}
     WHERE b.freelancer_id = $1 AND b.assignment_status = 'assigned'
     ORDER BY b.due_at ASC NULLS LAST`,
    [freelancerId]
  );
  return filterByGroup(result.rows.map((row) => shapeBooking(row, 'freelancer')), filter);
};

const getFreelancerWork = async (freelancerId, bookingId) => {
  if (!UUID_PATTERN.test(String(bookingId))) throw new AppError('Order not found', 404);
  const result = await query(
    `${BOOKING_SELECT} WHERE (b.id = $1 OR b.job_id = $1) AND b.freelancer_id = $2 AND b.assignment_status = 'assigned'`,
    [bookingId, freelancerId]
  );
  if (!result.rows[0]) throw new AppError('Order not found', 404);
  return shapeBooking(result.rows[0], 'freelancer');
};

const listPastFreelancers = async (clientId, { template_id: templateId } = {}) => {
  const result = await query(
    `SELECT DISTINCT ON (u.id) u.id, u.full_name, u.avatar_url, u.average_rating,
            b.snapshot->>'title' AS last_service, b.completed_at,
            EXISTS (
              SELECT 1 FROM freelancer_service_optins o
              WHERE o.freelancer_id = u.id AND o.is_active AND ($2::uuid IS NULL OR o.template_id = $2::uuid)
            ) AS offers_service
     FROM service_bookings b
     JOIN users u ON u.id = b.freelancer_id
     WHERE b.client_id = $1 AND b.completed_at IS NOT NULL AND u.is_active
     ORDER BY u.id, b.completed_at DESC`,
    [clientId, templateId && UUID_PATTERN.test(templateId) ? templateId : null]
  );
  return result.rows;
};

// ── Freelancer opt-ins ────────────────────────────────────────────────────────

const listTemplatesForFreelancer = async (freelancerId) => {
  const [templates, user] = await Promise.all([
    query(
      `SELECT t.id, t.slug, t.title, t.summary, t.unit_label, t.revisions, t.tools,
              c.name AS category_name, c.slug AS category_slug,
              COALESCE(o.is_active, false) AS opted_in,
              (SELECT COUNT(*)::int FROM freelancer_service_optins x WHERE x.template_id = t.id AND x.is_active) AS freelancer_count,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', v.id, 'option_label', v.option_label, 'pack_size', v.pack_size,
                  'freelancer_payout', v.freelancer_payout, 'delivery_days', v.delivery_days
                ) ORDER BY v.sort_order, v.pack_size)
                FROM service_variants v WHERE v.template_id = t.id AND v.is_active
              ), '[]'::jsonb) AS variants
       FROM service_templates t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN freelancer_service_optins o ON o.template_id = t.id AND o.freelancer_id = $1
       WHERE t.is_active
       ORDER BY t.sort_order, t.title`,
      [freelancerId]
    ),
    query('SELECT kyc_status, is_available, is_active FROM users WHERE id = $1', [freelancerId]),
  ]);
  return { templates: templates.rows, eligibility: user.rows[0] || null };
};

const setOptIn = async (freelancerId, templateId, optedIn) => {
  if (!UUID_PATTERN.test(String(templateId))) throw new AppError('Service not found', 404);
  const template = await query('SELECT id FROM service_templates WHERE id = $1 AND is_active', [templateId]);
  if (!template.rows[0]) throw new AppError('Service not found', 404);
  const result = await query(
    `INSERT INTO freelancer_service_optins (freelancer_id, template_id, is_active)
     VALUES ($1, $2, $3)
     ON CONFLICT (freelancer_id, template_id) DO UPDATE SET is_active = EXCLUDED.is_active
     RETURNING *`,
    [freelancerId, templateId, optedIn]
  );
  return result.rows[0];
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const TEMPLATE_FIELDS = [
  'slug', 'category_id', 'title', 'summary', 'description', 'unit_label', 'option_group_label',
  'revisions', 'includes', 'excludes', 'tools', 'faqs', 'requirements_hint', 'cover_url', 'gallery',
  'is_active', 'sort_order', 'brief_fields',
];
const JSON_FIELDS = new Set(['includes', 'excludes', 'faqs', 'gallery', 'brief_fields']);

const adminListTemplates = async () => {
  const result = await query(
    `SELECT t.*, c.name AS category_name, c.slug AS category_slug,
            (SELECT COUNT(*)::int FROM freelancer_service_optins o WHERE o.template_id = t.id AND o.is_active) AS freelancer_count,
            (SELECT COUNT(*)::int FROM service_bookings b WHERE b.template_id = t.id AND b.assignment_status <> 'pending_payment') AS order_count,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order, v.pack_size)
              FROM service_variants v WHERE v.template_id = t.id
            ), '[]'::jsonb) AS variants
     FROM service_templates t
     LEFT JOIN categories c ON c.id = t.category_id
     ORDER BY t.sort_order, t.title`
  );
  return result.rows;
};

const validateVariants = (variants) => {
  const errors = [];
  if (!Array.isArray(variants) || !variants.some((variant) => variant.is_active !== false)) {
    errors.push('At least one active price option is required');
  }
  (variants || []).forEach((variant, index) => {
    const price = Number(variant.price);
    const payout = Number(variant.freelancer_payout);
    if (!String(variant.option_label || '').trim()) errors.push(`Option ${index + 1}: label is required`);
    if (!(price > 0)) errors.push(`Option ${index + 1}: price must be greater than 0`);
    if (!(payout >= 0) || payout > price) errors.push(`Option ${index + 1}: payout must be between 0 and the price`);
    if (variant.mrp !== null && variant.mrp !== undefined && variant.mrp !== '' && Number(variant.mrp) < price) {
      errors.push(`Option ${index + 1}: MRP cannot be below the price`);
    }
    if (!Number.isInteger(Number(variant.pack_size)) || Number(variant.pack_size) < 1) errors.push(`Option ${index + 1}: pack size must be 1 or more`);
    if (!Number.isInteger(Number(variant.delivery_days)) || Number(variant.delivery_days) < 1) errors.push(`Option ${index + 1}: delivery days must be 1 or more`);
  });
  if (errors.length) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const saveTemplate = async (adminId, templateId, payload = {}) => {
  const { variants } = payload;
  if (!templateId && (!payload.title || !payload.slug)) throw new AppError('Title and slug are required', 422);
  if (payload.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    throw new AppError('Slug may only contain lowercase letters, numbers and hyphens', 422);
  }
  if (variants !== undefined) validateVariants(variants);
  if (payload.brief_fields !== undefined) payload = { ...payload, brief_fields: normalizeBriefFields(payload.brief_fields) };

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const fields = TEMPLATE_FIELDS.filter((field) => payload[field] !== undefined);
    const values = fields.map((field) => {
      // No custom questions = NULL, so the category default applies.
      if (field === 'brief_fields') return payload.brief_fields ? JSON.stringify(payload.brief_fields) : null;
      return JSON_FIELDS.has(field) ? JSON.stringify(payload[field] || []) : payload[field];
    });
    let id = templateId;

    if (!templateId) {
      const inserted = await dbClient.query(
        `INSERT INTO service_templates (${fields.join(', ')})
         VALUES (${fields.map((field, i) => (JSON_FIELDS.has(field) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')})
         RETURNING id`,
        values
      );
      id = inserted.rows[0].id;
    } else if (fields.length) {
      const updated = await dbClient.query(
        `UPDATE service_templates
         SET ${fields.map((field, i) => `${field} = $${i + 2}${JSON_FIELDS.has(field) ? '::jsonb' : ''}`).join(', ')}
         WHERE id = $1 RETURNING id`,
        [templateId, ...values]
      );
      if (!updated.rows[0]) throw new AppError('Service not found', 404);
    }

    if (variants !== undefined) {
      const keepIds = [];
      for (const [index, variant] of variants.entries()) {
        const params = [
          String(variant.option_label).trim(), Number(variant.pack_size), Number(variant.price),
          variant.mrp === '' || variant.mrp === undefined ? null : variant.mrp,
          Number(variant.freelancer_payout), Number(variant.delivery_days), !!variant.is_default,
          variant.is_active !== false, index,
        ];
        const saved = variant.id
          ? await dbClient.query(
              `UPDATE service_variants
               SET option_label=$2, pack_size=$3, price=$4, mrp=$5, freelancer_payout=$6,
                   delivery_days=$7, is_default=$8, is_active=$9, sort_order=$10
               WHERE id = $1 AND template_id = $11 RETURNING id`,
              [variant.id, ...params, id]
            )
          : await dbClient.query(
              `INSERT INTO service_variants
                 (template_id, option_label, pack_size, price, mrp, freelancer_payout, delivery_days, is_default, is_active, sort_order)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (template_id, option_label, pack_size) DO UPDATE SET
                 price = EXCLUDED.price, mrp = EXCLUDED.mrp, freelancer_payout = EXCLUDED.freelancer_payout,
                 delivery_days = EXCLUDED.delivery_days, is_default = EXCLUDED.is_default,
                 is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order
               RETURNING id`,
              [id, ...params]
            );
        if (saved.rows[0]) keepIds.push(saved.rows[0].id);
      }
      // Variants referenced by past orders cannot be deleted, so retire them instead.
      await dbClient.query(
        'UPDATE service_variants SET is_active = false WHERE template_id = $1 AND NOT (id = ANY($2::uuid[]))',
        [id, keepIds]
      );
    }

    await writeAudit({
      actorId: adminId,
      action: templateId ? 'service_template.updated' : 'service_template.created',
      entityType: 'service_template',
      entityId: id,
      metadata: { fields },
    }, dbClient).catch(() => null);
    await dbClient.query('COMMIT');
    return (await adminListTemplates()).find((template) => template.id === id);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    if (err.code === '23505') throw new AppError('A service with that slug or option already exists', 409);
    throw err;
  } finally {
    dbClient.release();
  }
};

const adminListBookings = async ({ status } = {}) => {
  const params = [];
  let where = `b.assignment_status <> 'pending_payment'`;
  if (status === 'unassigned') where += ` AND b.assignment_status = 'unassigned'`;
  const result = await query(`${BOOKING_SELECT} WHERE ${where} ORDER BY b.created_at DESC LIMIT 200`, params);
  return result.rows.map((row) => shapeBooking(row, 'admin'));
};

const adminEligibleFreelancers = async (bookingId) => {
  const booking = await query('SELECT template_id, client_id FROM service_bookings WHERE id = $1', [bookingId]);
  if (!booking.rows[0]) throw new AppError('Booking not found', 404);
  const matching = await getSetting('matching', { max_active_jobs: 5 });
  const result = await query(
    `SELECT ${CANDIDATE_FIELDS_SQL},
            EXISTS (
              SELECT 1 FROM freelancer_service_optins o
              WHERE o.freelancer_id = u.id AND o.template_id = $1 AND o.is_active
            ) AS opted_in
     FROM users u
     ${LAST_ASSIGNED_JOIN_SQL}
     WHERE u.id <> $3 AND ${ELIGIBLE_FREELANCER_SQL}
     LIMIT 300`,
    [booking.rows[0].template_id, Number(matching?.max_active_jobs || 5), booking.rows[0].client_id]
  );
  // Same order auto-assign would use, with freelancers who offer this service first.
  return rankFreelancers(result.rows, { settings: matching })
    .sort((a, b) => b.opted_in - a.opted_in)
    .slice(0, 100)
    .map(({ match, bio, skills, avatar_url, last_assigned_at, days_since_last_assignment, has_portfolio, ...f }) => ({
      ...f,
      match_score: match.total,
    }));
};

/** Default brief questions per category, so the admin editor can show what applies. */
const adminBriefDefaults = async () => {
  const categories = await query('SELECT id, slug FROM categories');
  return {
    by_category: Object.fromEntries(categories.rows.map((c) => [c.id, defaultBriefFields(c.slug)])),
    general: defaultBriefFields(null),
  };
};

module.exports = {
  // Shared with ai-edits, which sells AI edits of the same services through the same checkout rules.
  testCheckoutAllowed,
  getServiceSettings,
  callRazorpay,
  signaturesMatch,
  getRazorpay: () => razorpay,
  // Shared with purchase items, which turn into bookings when their brief is submitted.
  MAX_ITEMS_PER_SELECTION,
  BOOKING_SELECT,
  shapeBooking,
  assertBriefIsClean,
  insertBookingJob,
  UUID_PATTERN,
  adminBriefDefaults,
  listCategories,
  listCatalog,
  getStorefront,
  getCategoryPage,
  getCatalogItem,
  createCheckout,
  verifyCheckout,
  finalizeCheckout,
  processCapturedServicePayment,
  assignBooking,
  acceptOffer,
  declineOffer,
  expireOffers,
  retryUnassigned,
  listMyOffers,
  listClientBookings,
  getClientBooking,
  updateClientBookingBrief,
  listFreelancerWork,
  getFreelancerWork,
  listPastFreelancers,
  listTemplatesForFreelancer,
  setOptIn,
  adminListTemplates,
  saveTemplate,
  adminListBookings,
  adminEligibleFreelancers,
};
