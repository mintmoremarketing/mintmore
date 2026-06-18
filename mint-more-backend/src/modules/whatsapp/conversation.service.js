const { query, getClient } = require('../../config/database');
const { sendTextMessage, sendWelcomeTemplate } = require('../chat/whatsapp.service');
const { createChatRoom } = require('../chat/chat.service');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const env = require('../../config/env');

// ── Constants ─────────────────────────────────────────────────────────────────

const HANDOFF_TOKEN_PREFIX  = 'MMSTART-';
const HANDOFF_EXPIRY_MINS   = 30;

/**
 * Service menu — what gets sent to client on main number.
 * Keys are what the client must type to select.
 */
const SERVICE_MENU = {
  '1': { label: 'Video Editing',      slug: 'video-editing' },
  '2': { label: 'Graphic Design',     slug: 'graphic-design' },
  '3': { label: 'Content Writing',    slug: 'content-writing' },
  '4': { label: 'Social Media',       slug: 'social-media' },
  '5': { label: 'Reels Editing',      slug: 'video-editing' },
  '6': { label: 'Creative Shoot',     slug: 'photography' },
};

const WELCOME_MESSAGE = `👋 Welcome to *Mint More*!

We connect you with top creative freelancers.

*What do you need help with?*

1️⃣ Video Editing
2️⃣ Graphic Design
3️⃣ Content Writing
4️⃣ Social Media Management
5️⃣ Reels Editing
6️⃣ Creative Shoot / Photography

Reply with a *number* (1–6) to get started.`;

const INVALID_MENU_REPLY = `Please reply with a number from *1 to 6* to select a service.

1️⃣ Video Editing
2️⃣ Graphic Design
3️⃣ Content Writing
4️⃣ Social Media Management
5️⃣ Reels Editing
6️⃣ Creative Shoot / Photography`;

const BRIEF_PROMPT = (serviceName) =>
  `Great choice! 🎯 You selected *${serviceName}*.

Please describe your project in a few lines:
- What do you need done?
- Any deadline?
- Which styles or references do you like?
- Anything the creative should avoid?

Just type it out naturally — our team will review it.`;

const TRANSFER_MESSAGE = (categoryName, waLink) =>
  `✅ Got it! We're matching you with our *${categoryName}* team.

Continue your project conversation here:
👉 ${waLink}

_(This link is valid for 30 minutes)_`;

const PROCESSING_MESSAGE =
  `⏳ Your request is already being processed.

Please use the link we sent you to continue, or type *RESTART* to start over.`;

const CATEGORY_BLOCKED_MESSAGE = (mainNumber) =>
  `Hi! This channel is for active project conversations only.

To start a new project, please message our main number first:
👉 https://wa.me/${mainNumber.replace('+', '')}`;

const EXPIRED_TOKEN_MESSAGE = (mainNumber) =>
  `This link has expired or is invalid.

Please start again from our main number:
👉 https://wa.me/${mainNumber.replace('+', '')}`;

const JOB_COMPLETED_MESSAGE = (mainNumber) =>
  `🎉 This project has been completed!

To start a new project, message us here:
👉 https://wa.me/${mainNumber.replace('+', '')}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateHandoffToken = () =>
  `${HANDOFF_TOKEN_PREFIX}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Get or create a session for a client on a specific MM number.
 */
const getOrCreateSession = async (clientWaNumber, mmPhoneId, sessionType = 'main') => {
  const existing = await query(
    `SELECT * FROM wa_sessions
     WHERE client_wa_number = $1 AND mm_phone_id = $2`,
    [clientWaNumber, mmPhoneId]
  );

  if (existing.rows[0]) return existing.rows[0];

  const result = await query(
    `INSERT INTO wa_sessions
       (client_wa_number, mm_phone_id, session_type, state)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      clientWaNumber,
      mmPhoneId,
      sessionType,
      sessionType === 'main' ? 'new_contact' : 'awaiting_activation',
    ]
  );

  return result.rows[0];
};

const updateSession = async (sessionId, updates) => {
  const fields  = Object.keys(updates);
  const values  = Object.values(updates);
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`);

  const result = await query(
    `UPDATE wa_sessions
     SET ${setClauses.join(', ')}, last_message_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId, ...values]
  );

  return result.rows[0];
};

const getMainNumber = async () => {
  // The "main" MM number — the one with no category_id
  const result = await query(
    `SELECT phone_number, waba_phone_id
     FROM whatsapp_numbers
     WHERE category_id IS NULL AND is_active = true
     LIMIT 1`
  );
  return result.rows[0] || null;
};

const getCategoryNumber = async (categorySlug) => {
  const result = await query(
    `SELECT wn.*, c.name AS category_name
     FROM whatsapp_numbers wn
     JOIN categories c ON c.id = wn.category_id
     WHERE c.slug = $1 AND wn.is_active = true
     LIMIT 1`,
    [categorySlug]
  );
  return result.rows[0] || null;
};

const getCategoryById = async (categorySlug) => {
  const result = await query(
    'SELECT * FROM categories WHERE slug = $1 AND is_active = true',
    [categorySlug]
  );
  return result.rows[0] || null;
};

// ── Main State Machine Entry Point ────────────────────────────────────────────

/**
 * Process an incoming WhatsApp message through the state machine.
 * Called from webhook.controller.js for every incoming message.
 *
 * @param {object} opts
 * @param {string} opts.fromNumber       - client's WA number (+91XXXXXXXXXX)
 * @param {string} opts.toPhoneNumberId  - MM number's phone_number_id
 * @param {string} opts.content          - text content of the message
 * @param {string} opts.waMessageId      - WA message ID
 * @param {string} opts.mediaUrl         - if message has media
 * @param {string} opts.mediaType        - image/video/document
 */
const processMessage = async ({
  fromNumber,
  toPhoneNumberId,
  content,
  waMessageId,
  mediaUrl,
  mediaType,
}) => {
  const trimmed = (content || '').trim().toUpperCase();

  // Find which MM number received this message
  const mmNumberResult = await query(
    `SELECT * FROM whatsapp_numbers WHERE waba_phone_id = $1`,
    [toPhoneNumberId]
  );
  const mmNumber = mmNumberResult.rows[0];

  if (!mmNumber) {
    logger.warn('Message received on unknown MM number', { toPhoneNumberId });
    return;
  }

  const isMainNumber    = !mmNumber.category_id;
  const isCategoryNumber = !!mmNumber.category_id;

  // ── CATEGORY NUMBER FLOW ──────────────────────────────────────────────────
  if (isCategoryNumber) {
    await handleCategoryMessage({
      fromNumber,
      toPhoneNumberId,
      mmNumber,
      content,
      trimmed,
      waMessageId,
      mediaUrl,
      mediaType,
    });
    return;
  }

  // ── MAIN NUMBER FLOW ──────────────────────────────────────────────────────
  if (isMainNumber) {
    await handleMainMessage({
      fromNumber,
      toPhoneNumberId,
      mmNumber,
      content,
      trimmed,
      waMessageId,
      mediaUrl,
      mediaType,
    });
    return;
  }
};

// ── Main Number Handler ───────────────────────────────────────────────────────

const handleMainMessage = async ({
  fromNumber, toPhoneNumberId, mmNumber,
  content, trimmed, waMessageId,
}) => {
  const session = await getOrCreateSession(fromNumber, toPhoneNumberId, 'main');

  logger.info('Main WA message', {
    from:    fromNumber,
    state:   session.state,
    content: content?.slice(0, 50),
  });

  // RESTART command — works in any state
  if (trimmed === 'RESTART' || trimmed === 'START' || trimmed === 'HI' || trimmed === 'HELLO' || trimmed === 'MENU') {
    await updateSession(session.id, { state: 'new_contact' });
    await sendTextMessage(toPhoneNumberId, fromNumber, WELCOME_MESSAGE);
    return;
  }

  switch (session.state) {

    // ── State: new_contact ────────────────────────────────────────────────
    case 'new_contact': {
      await updateSession(session.id, { state: 'awaiting_service' });
      await sendTextMessage(toPhoneNumberId, fromNumber, WELCOME_MESSAGE);
      break;
    }

    // ── State: awaiting_service ───────────────────────────────────────────
    case 'awaiting_service': {
      const choice = trimmed.replace(/[^1-6]/g, ''); // strip anything non-digit

      if (!SERVICE_MENU[choice]) {
        await sendTextMessage(toPhoneNumberId, fromNumber, INVALID_MENU_REPLY);
        break;
      }

      const service  = SERVICE_MENU[choice];
      const category = await getCategoryById(service.slug);

      await updateSession(session.id, {
        state:            'awaiting_brief',
        selected_service: choice,
        category_id:      category?.id || null,
      });

      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        BRIEF_PROMPT(service.label)
      );
      break;
    }

    // ── State: awaiting_brief ─────────────────────────────────────────────
    case 'awaiting_brief': {
      // Anything they type becomes the brief — including media captions
      // Minimum length guard
      if (!content || content.trim().length < 5) {
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          `Please describe your project in a bit more detail so we can find the right person for you. 😊`
        );
        break;
      }

      // Get the category number for their service
      const service       = SERVICE_MENU[session.selected_service];
      const categoryNumber = await getCategoryNumber(service.slug);

      if (!categoryNumber) {
        // No category number configured yet — save brief, tell them we'll reach out
        await updateSession(session.id, {
          state:         'completed_intake',
          project_brief: content.trim(),
        });
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          `✅ Thank you! We've received your brief and will connect you with the right person shortly. Please allow up to 2 hours during business hours.`
        );
        break;
      }

      // Generate handoff token
      const token     = generateHandoffToken();
      const expiresAt = new Date(Date.now() + HANDOFF_EXPIRY_MINS * 60 * 1000);
      const waLink    = `https://wa.me/${categoryNumber.phone_number.replace('+', '')}?text=${encodeURIComponent(token)}`;

      await updateSession(session.id, {
        state:              'transferring',
        project_brief:      content.trim(),
        handoff_token:      token,
        handoff_expires_at: expiresAt,
      });

      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        TRANSFER_MESSAGE(categoryNumber.display_name, waLink)
      );

      logger.info('Client brief collected — handoff token sent', {
        from:      fromNumber,
        service:   service.label,
        token,
        expiresAt,
      });
      break;
    }

    // ── State: transferring ───────────────────────────────────────────────
    case 'transferring': {
      // Client is typing on main number when they should be on category number
      // Check if token expired — if so, let them restart
      const tokenExpired = session.handoff_expires_at
        && new Date() > new Date(session.handoff_expires_at);

      if (tokenExpired || session.handoff_used) {
        // Token gone — let them restart cleanly
        await updateSession(session.id, { state: 'awaiting_service' });
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          `Your previous link has expired. Let's start again!\n\n${INVALID_MENU_REPLY}`
        );
      } else {
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          PROCESSING_MESSAGE
        );
      }
      break;
    }

    // ── State: completed_intake ───────────────────────────────────────────
    case 'completed_intake': {
      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        `Your project is already with our team! 🎉\n\nType *RESTART* to start a new project.`
      );
      break;
    }

    default: {
      // Unknown state — reset to start
      await updateSession(session.id, { state: 'new_contact' });
      await sendTextMessage(toPhoneNumberId, fromNumber, WELCOME_MESSAGE);
    }
  }
};

// ── Category Number Handler ───────────────────────────────────────────────────

const handleCategoryMessage = async ({
  fromNumber, toPhoneNumberId, mmNumber,
  content, trimmed, waMessageId,
  mediaUrl, mediaType,
}) => {
  const session = await getOrCreateSession(fromNumber, toPhoneNumberId, 'category');

  logger.info('Category WA message', {
    from:    fromNumber,
    channel: mmNumber.display_name,
    state:   session.state,
  });

  const mainNumber = await getMainNumber();

  switch (session.state) {

    // ── State: awaiting_activation ────────────────────────────────────────
    case 'awaiting_activation': {
      // The ONLY valid input here is a handoff token from main number
      if (trimmed.startsWith(HANDOFF_TOKEN_PREFIX)) {
        await activateFromHandoff({
          token:           trimmed,
          fromNumber,
          toPhoneNumberId,
          mmNumber,
          session,
          mainNumber,
        });
      } else {
        // Anyone typing anything else → redirect to main
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          CATEGORY_BLOCKED_MESSAGE(mainNumber?.phone_number || '')
        );
      }
      break;
    }

    // ── State: active_job_chat ────────────────────────────────────────────
    case 'active_job_chat': {
      if (trimmed === 'APPROVE' || trimmed.startsWith('REVISION')) {
        const latestDelivery = await query(
          `SELECT id FROM mintbox_files
           WHERE job_id = $1 AND purpose = 'delivery' AND deleted_by_client_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [session.job_id]
        );
        if (!latestDelivery.rows[0] || !session.user_id) {
          await sendTextMessage(toPhoneNumberId, fromNumber, 'No delivery is ready for review yet.');
          break;
        }
        const action = trimmed === 'APPROVE' ? 'approve' : 'revision';
        const note = action === 'revision'
          ? String(content || '').replace(/^revision\s*:?\s*/i, '').trim()
          : null;
        if (action === 'revision' && !note) {
          await sendTextMessage(toPhoneNumberId, fromNumber, 'Reply with REVISION: followed by your complete feedback.');
          break;
        }
        const mintboxService = require('../mintbox/mintbox.service');
        await mintboxService.reviewFile(
          latestDelivery.rows[0].id,
          session.user_id,
          'client',
          { action, note }
        );
        await sendTextMessage(
          toPhoneNumberId,
          fromNumber,
          action === 'approve'
            ? 'Delivery approved. Open Mint More to request another revision or complete the project.'
            : 'Revision feedback submitted to your Mint More creative.'
        );
        break;
      }
      // Valid conversation — route to chat room
      const { receiveWhatsAppMessage } = require('../chat/chat.service');
      await receiveWhatsAppMessage({
        fromNumber,
        toPhoneNumberId,
        waMessageId,
        content,
        mediaUrl,
        mediaType,
      });
      break;
    }

    // ── State: job_completed ──────────────────────────────────────────────
    case 'completed_intake': {
      const draftUrl = session.job_id
        ? `${env.social.frontendUrl}/jobs/${session.job_id}/edit`
        : env.social.frontendUrl;
      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        `Your brief is saved as a draft. Review, verify, and publish it here: ${draftUrl}`
      );
      break;
    }

    case 'job_completed': {
      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        JOB_COMPLETED_MESSAGE(mainNumber?.phone_number || '')
      );
      break;
    }

    // ── Default — anyone who got here without a token ─────────────────────
    default: {
      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        CATEGORY_BLOCKED_MESSAGE(mainNumber?.phone_number || '')
      );
    }
  }
};

// ── Handoff Activation ────────────────────────────────────────────────────────

/**
 * Client sent the handoff token on the category number.
 * Validate it, pull their brief from the main session, create the job.
 */
const activateFromHandoff = async ({
  token, fromNumber, toPhoneNumberId,
  mmNumber, session, mainNumber,
}) => {
  // Find the main session with this token
  const mainSessionResult = await query(
    `SELECT * FROM wa_sessions
     WHERE handoff_token = $1
       AND handoff_used  = false
       AND handoff_expires_at > NOW()`,
    [token]
  );

  const mainSession = mainSessionResult.rows[0];

  if (!mainSession) {
    // Token invalid or expired
    await sendTextMessage(
      toPhoneNumberId,
      fromNumber,
      EXPIRED_TOKEN_MESSAGE(mainNumber?.phone_number || '')
    );
    return;
  }

  // Validate the client WA number matches
  if (mainSession.client_wa_number !== fromNumber) {
    await sendTextMessage(
      toPhoneNumberId,
      fromNumber,
      `This link was generated for a different number. Please start from our main number.`
    );
    return;
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Mark main session token as used + completed
    await dbClient.query(
      `UPDATE wa_sessions
       SET handoff_used = true, state = 'completed_intake'
       WHERE id = $1`,
      [mainSession.id]
    );

    // Activate category session
    await dbClient.query(
      `UPDATE wa_sessions
       SET state         = 'active_job_chat',
           category_id   = $1,
           project_brief = $2,
           user_id       = $3
       WHERE id = $4`,
      [
        mmNumber.category_id,
        mainSession.project_brief,
        mainSession.user_id,
        session.id,
      ]
    );

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  // Send confirmation to client
  await sendTextMessage(
    toPhoneNumberId,
    fromNumber,
    `✅ *You're connected to ${mmNumber.display_name}!*

Our team has received your brief and is preparing your draft.

You'll receive a link here to review the brief, complete verification, and publish it.`
  );

  // Auto-create a job draft from the brief + trigger matching
  setImmediate(async () => {
    try {
      const jobId = await createJobFromWhatsApp({
        fromNumber,
        mmNumber,
        brief:      mainSession.project_brief,
        categoryId: mmNumber.category_id,
        sessionId:  session.id,
      });
      await sendTextMessage(
        toPhoneNumberId,
        fromNumber,
        `Your Mint More brief is ready. Review and publish it here: ${env.social.frontendUrl}/jobs/${jobId}/edit`
      );
    } catch (err) {
      logger.error('Auto job creation from WhatsApp failed', { error: err.message });
    }
  });

  logger.info('WhatsApp handoff activated', {
    fromNumber,
    channel: mmNumber.display_name,
    brief:   mainSession.project_brief?.slice(0, 80),
  });
};

// ── Auto Job Creation from WhatsApp ──────────────────────────────────────────

/**
 * Creates a draft job from the WhatsApp brief.
 * Marks it as open → triggers matching engine automatically.
 *
 * If the client has a registered platform account linked to their WA number,
 * the job is created under their account.
 * If not, a placeholder "WA Client" entry is used and an admin is notified.
 */
const createJobFromWhatsApp = async ({ fromNumber, mmNumber, brief, categoryId, sessionId }) => {
  // Find if there's a registered user with this WA number
  const userResult = await query(
    `SELECT id FROM users WHERE whatsapp_number = $1 AND role = 'client'`,
    [fromNumber]
  );

  let clientId = userResult.rows[0]?.id;

  // If no registered user — find or create a WA-only placeholder user
  if (!clientId) {
    const placeholderResult = await query(
      `INSERT INTO users
         (email, password_hash, full_name, role, whatsapp_number, wa_verified, is_approved)
       VALUES ($1, 'WA_AUTH_PLACEHOLDER', $2, 'client', $3, true, true)
       ON CONFLICT (email) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number
       RETURNING id`,
      [
        `wa_${fromNumber.replace('+', '')}@mintmore.internal`,
        `WA Client ${fromNumber.slice(-4)}`,
        fromNumber,
      ]
    );
    clientId = placeholderResult.rows[0].id;

    // Auto-create wallet for placeholder user
    await query(
      `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [clientId]
    );
  }

  // Create the job
  const jobResult = await query(
    `INSERT INTO jobs
       (client_id, category_id, title, description, budget_type, pricing_mode, status, metadata)
     VALUES ($1, $2, $3, $4, 'fixed', 'budget', 'draft', $5)
     RETURNING id`,
    [
      clientId,
      categoryId,
      `WhatsApp Project — ${mmNumber.display_name}`,
      brief,
      JSON.stringify({
        source:           'whatsapp',
        wa_number:        fromNumber,
        mm_channel:       mmNumber.display_name,
        wa_session_id:    sessionId,
      }),
    ]
  );

  const jobId = jobResult.rows[0].id;

  // Link job to session
  await query(
    'UPDATE wa_sessions SET job_id = $1, user_id = $2 WHERE id = $3',
    [jobId, clientId, sessionId]
  );

  // Project chat starts only after the paid order is assigned.
  await query(
    `UPDATE wa_sessions
     SET state = 'completed_intake'
     WHERE id = $1`,
    [sessionId]
  );

  logger.info('Job created from WhatsApp', {
    jobId, clientId, fromNumber,
    channel: mmNumber.display_name,
  });

  return jobId;
};

// ── Admin: mark category session as completed (called when job completes) ─────

const markSessionCompleted = async (jobId) => {
  await query(
    `UPDATE wa_sessions SET state = 'job_completed' WHERE job_id = $1`,
    [jobId]
  );
};

module.exports = {
  processMessage,
  markSessionCompleted,
  getOrCreateSession,
};
