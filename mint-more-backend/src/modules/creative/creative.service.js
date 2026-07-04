const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const axios = require('axios');
const { google } = require('googleapis');
const env = require('../../config/env');
const { recordCreditTransaction, getCreditAccount } = require('../commerce/credits.service');
const { getSetting } = require('../commerce/settings.service');
const notificationService = require('../notifications/notification.service');
const { writeAudit } = require('../audit/audit.service');
const chatService = require('../chat/chat.service');

const DEFAULT_CALENDAR_SETTINGS = {
  monthly_mintcoins: 10,
  default_event_coin_cost: 1,
  carry_forward: true,
};

const DEFAULT_CUSTOM_REQUEST_SETTINGS = {
  default_coin_cost: 1,
  requires_ops_review: true,
};

const monthKeyFor = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const normalizeTags = (tags) => (
  Array.isArray(tags)
    ? tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 12)
    : []
);

const normalizeEventTitle = (title) => String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();

const calendarDuplicateKey = ({ title, month_key, event_date, asset_type = 'social_post' }) => (
  `${month_key || monthKeyFor(event_date)}|${String(asset_type || 'social_post').trim().toLowerCase()}|${normalizeEventTitle(title)}`
);

const parseIcsDate = (value) => {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const fallbackOccasions = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const fixedByMonth = {
    1: [['New Year Creative', 1], ['Republic Day Creative', 26]],
    2: [['Valentine Offer Creative', 14]],
    3: [['Women\'s Day Creative', 8], ['Holi Creative', 14]],
    4: [['Financial Year Kickoff Creative', 1], ['Earth Day Creative', 22]],
    5: [['Mother\'s Day Creative', 11]],
    6: [['Environment Day Creative', 5], ['Father\'s Day Creative', 21], ['Yoga Day Creative', 21]],
    7: [['Monsoon Offer Creative', 1]],
    8: [['Friendship Day Creative', 2], ['Independence Day Creative', 15]],
    9: [['Teacher\'s Day Creative', 5]],
    10: [['Festive Sale Creative', 1], ['Gandhi Jayanti Creative', 2]],
    11: [['Diwali Campaign Creative', 1], ['Children\'s Day Creative', 14]],
    12: [['Christmas Creative', 25], ['Year-end Sale Creative', 28]],
  };
  return (fixedByMonth[month] || []).map(([title, day]) => ({
    title,
    description: `${title.replace(' Creative', '').toLowerCase()} post`,
    event_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    asset_type: 'social_post',
    coin_cost: 1,
    tags: ['seasonal', 'marketing'],
    source: 'mintmore_suggested',
  }));
};

const inferFileExtension = (name = '') => {
  const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
};

const validateBriefAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((attachment) => {
    const name = String(attachment?.name || attachment?.original_name || '').trim();
    const type = String(attachment?.type || attachment?.mime_type || 'application/octet-stream').trim();
    const extension = inferFileExtension(name);
    const allowedByType = env.upload.mintboxAllowedFileTypes.includes(type);
    const allowedByExtension = env.upload.mintboxAllowedExtensions.includes(extension);
    if (!allowedByType && !allowedByExtension) {
      throw new AppError(`File type is not allowed: ${type || extension || 'unknown file type'}`, 415);
    }
    return attachment;
  });
};

const fetchGoogleHolidaySuggestions = async (monthKey) => {
  const url = 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Google calendar returned ${response.status}`);
    const ics = await response.text();
    return ics
      .split('BEGIN:VEVENT')
      .slice(1)
      .map(block => {
        const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
        const rawDate = block.match(/DTSTART(?:;VALUE=DATE)?:([^\r\n]+)/)?.[1]?.trim();
        const eventDate = parseIcsDate(rawDate);
        if (!summary || !eventDate || monthKeyFor(eventDate) !== monthKey) return null;
        return {
          title: `${summary.replace(/\\,/g, ',')} Creative`,
          description: `Calendar creative for ${summary.replace(/\\,/g, ',')}.`,
          event_date: eventDate,
          asset_type: 'social_post',
          coin_cost: 1,
          tags: ['holiday', 'google-calendar'],
          source: 'google_india_holidays',
        };
      })
      .filter(Boolean);
  } catch (error) {
    logger.warn('Google holiday calendar suggestions failed', { error: error.message, monthKey });
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const getClientInfo = async (clientId, dbClient = null) => {
  const executor = dbClient || { query };
  const result = await executor.query(
    `SELECT id, full_name, email, role, is_active
     FROM users WHERE id = $1 AND role = 'client'`,
    [clientId]
  );
  if (!result.rows[0]) throw new AppError('Client not found', 404);
  if (!result.rows[0].is_active) throw new AppError('Client account is inactive', 403);
  return result.rows[0];
};

const ensureMonthlyMintCoins = async (clientId, dbClient = null) => {
  const executor = dbClient || { query };
  const settings = {
    ...DEFAULT_CALENDAR_SETTINGS,
    ...(await getSetting('calendar_creatives', DEFAULT_CALENDAR_SETTINGS, dbClient) || {}),
  };
  const amount = Number(settings.monthly_mintcoins || 0);
  if (amount <= 0) return null;

  const key = monthKeyFor();
  const existing = await executor.query(
    `SELECT id FROM mint_credit_transactions
     WHERE user_id = $1
       AND idempotency_key = $2`,
    [clientId, `monthly-mintcoins:${clientId}:${key}`]
  );
  if (existing.rows[0]) return null;

  return recordCreditTransaction(executor, {
    userId: clientId,
    type: 'admin_grant',
    amount,
    referenceType: 'monthly_calendar_pack',
    idempotencyKey: `monthly-mintcoins:${clientId}:${key}`,
    description: `Monthly MintCoins for ${key}`,
    metadata: { month_key: key, carry_forward: Boolean(settings.carry_forward) },
  });
};

const createInternalJob = async (dbClient, clientId, {
  title,
  description,
  categoryId = null,
  deadline = null,
  metadata = {},
}) => {
  const result = await dbClient.query(
    `INSERT INTO jobs
     (client_id, category_id, title, description, requirements,
        attachments, budget_type, budget_amount, currency, pricing_mode,
        required_level, required_skills, deadline, metadata, status)
     VALUES ($1,$2,$3,$4,NULL,ARRAY[]::TEXT[],'fixed',NULL,'INR','budget',
        NULL,ARRAY[]::TEXT[],$5,$6,'pending_admin_approval')
     RETURNING *`,
    [
      clientId,
      categoryId,
      String(title || 'CREATYV creative request').trim(),
      String(description || 'Internal CREATYV creative request').trim(),
      deadline || null,
      JSON.stringify({
        ...metadata,
        fulfillment_provider: 'mintmore_internal',
        matching_disabled: true,
      }),
    ]
  );
  return result.rows[0];
};

const ensureMintboxFolder = async (dbClient, job) => {
  const existing = await dbClient.query(
    'SELECT * FROM mintbox_folders WHERE job_id = $1',
    [job.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  const token = require('crypto').randomBytes(24).toString('base64url');
  const created = await dbClient.query(
    `INSERT INTO mintbox_folders
       (client_id, job_id, name, share_token, storage_prefix)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      job.client_id,
      job.id,
      job.title || 'Project folder',
      token,
      `mintbox/${job.client_id}/${job.id}`,
    ]
  );
  return created.rows[0];
};

const createTask = async (dbClient, {
  sourceType,
  sourceId,
  clientId,
  job,
  title,
  description,
  dueDate,
  coinCost,
  status = 'pending',
  clientStatus = 'Queued with CREATYV',
  metadata = {},
}) => {
  const folder = await ensureMintboxFolder(dbClient, job);
  const sourceLockKey = `creative_task:${sourceType}:${sourceId}`;
  await dbClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sourceLockKey]);

  const existing = await dbClient.query(
    `SELECT *
     FROM creative_tasks
     WHERE source_type = $1
       AND source_id = $2
       AND status <> 'cancelled'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE`,
    [sourceType, sourceId]
  );
  if (existing.rows[0]) {
    const task = existing.rows[0];
    if (!task.mintbox_folder_id && folder?.id) {
      const updated = await dbClient.query(
        `UPDATE creative_tasks
         SET mintbox_folder_id = $1
         WHERE id = $2
         RETURNING *`,
        [folder.id, task.id]
      );
      return updated.rows[0];
    }
    return task;
  }

  const result = await dbClient.query(
    `INSERT INTO creative_tasks
       (source_type, source_id, client_id, job_id, title, description,
        due_date, coin_cost, mintbox_folder_id, status, client_status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      sourceType,
      sourceId,
      clientId,
      job.id,
      title,
      description || null,
      dueDate || null,
      Number(coinCost || 0),
      folder.id,
      status,
      clientStatus,
      JSON.stringify(metadata || {}),
    ]
  );
  return result.rows[0];
};

const notifyAdminsAboutCustomRequest = async ({ request, job }) => {
  try {
    const admins = await query(
      `SELECT id
       FROM users
       WHERE role = 'admin'
         AND is_active = true`
    );

    await notificationService.createBulkNotifications(admins.rows.map(admin => ({
      userId: admin.id,
      type: 'system',
      title: 'New custom request',
      body: `${request.title} is waiting for CREATYV review.`,
      entityType: 'creative_request',
      entityId: request.id,
      data: {
        request_id: request.id,
        job_id: job?.id || request.job_id,
        client_id: request.client_id,
        route: '/admin/operations',
        tab: 'requests',
      },
    })));
  } catch (notificationError) {
    logger.error('Admin custom request notification failed', {
      requestId: request?.id,
      error: notificationError.message,
    });
  }
};

const spendMintCoins = async (dbClient, {
  clientId,
  amount,
  referenceId,
  referenceType,
  description,
  metadata = {},
}) => {
  const parsed = Number(amount || 0);
  if (parsed <= 0) return null;
  return recordCreditTransaction(dbClient, {
    userId: clientId,
    type: 'platform_spend',
    amount: -parsed,
    referenceId,
    referenceType,
    idempotencyKey: `${referenceType}:${referenceId}:mintcoin-reserve`,
    description,
    metadata,
  });
};

const refundMintCoins = async (dbClient, {
  clientId,
  amount,
  referenceId,
  referenceType,
  description,
  metadata = {},
}) => {
  const parsed = Number(amount || 0);
  if (parsed <= 0) return null;
  return recordCreditTransaction(dbClient, {
    userId: clientId,
    type: 'reversal',
    amount: parsed,
    referenceId,
    referenceType,
    idempotencyKey: `${referenceType}:${referenceId}:mintcoin-refund`,
    description,
    metadata,
    consumeLots: false,
  });
};

const refundTaskMintCoins = async (dbClient, task, adminId, reason = 'Task cancelled') => {
  const sourceTable = task.source_type === 'calendar_event'
    ? {
      table: 'client_event_selections',
      referenceType: 'calendar_selection',
      label: 'calendar selection',
    }
    : task.source_type === 'custom_request'
      ? {
        table: 'creative_requests',
        referenceType: 'custom_request',
        label: 'custom request',
      }
      : null;

  if (!sourceTable) return null;

  const sourceResult = await dbClient.query(
    `SELECT source.*, tx.amount AS reserved_amount
     FROM ${sourceTable.table} source
     LEFT JOIN mint_credit_transactions tx ON tx.id = source.credit_tx_id
     WHERE source.id = $1
     FOR UPDATE OF source`,
    [task.source_id]
  );
  const source = sourceResult.rows[0];
  if (!source?.credit_tx_id) return null;

  const reservedAmount = Math.abs(Number(source.reserved_amount || source.coin_cost || task.coin_cost || 0));
  const refundTx = await refundMintCoins(dbClient, {
    clientId: task.client_id,
    amount: reservedAmount,
    referenceId: source.id,
    referenceType: sourceTable.referenceType,
    description: `MintCoins returned for cancelled ${sourceTable.label}`,
    metadata: {
      task_id: task.id,
      job_id: task.job_id,
      cancelled_by: adminId,
      reason,
      original_credit_tx_id: source.credit_tx_id,
    },
  });

  await dbClient.query(
    `UPDATE ${sourceTable.table}
     SET status = 'cancelled',
         admin_note = COALESCE($1, admin_note),
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id = $3
       AND status NOT IN ('completed', 'cancelled')
     RETURNING *`,
    [
      reason || null,
      JSON.stringify({
        cancelled_by: adminId,
        cancelled_task_id: task.id,
        refund_tx_id: refundTx?.id || null,
        cancelled_at: new Date().toISOString(),
      }),
      source.id,
    ]
  );

  return refundTx;
};

const listCalendar = async (clientId, { month = monthKeyFor() } = {}) => {
  await getClientInfo(clientId);
  await ensureMonthlyMintCoins(clientId);

  const [events, selections, account] = await Promise.all([
    query(
      `SELECT event.*, category.name AS category_name
       FROM creative_events event
       LEFT JOIN categories category ON category.id = event.category_id
       WHERE event.month_key = $1 AND event.status = 'published'
       ORDER BY event.event_date ASC, event.created_at ASC`,
      [month]
    ),
    query(
      `SELECT selection.*, task.status AS task_status, task.client_status
       FROM client_event_selections selection
       LEFT JOIN creative_tasks task ON task.id = selection.task_id
       JOIN creative_events event ON event.id = selection.event_id
       WHERE selection.client_id = $1 AND event.month_key = $2
       ORDER BY selection.created_at DESC`,
      [clientId, month]
    ),
    getCreditAccount(clientId),
  ]);

  return {
    month,
    balance: Number(account.balance || 0),
    events: events.rows.map(event => ({
      ...event,
      selection: selections.rows.find(selection => selection.event_id === event.id) || null,
    })),
  };
};

const selectEvent = async (clientId, eventId, { client_note = '' } = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    await getClientInfo(clientId, dbClient);

    const eventResult = await dbClient.query(
      `SELECT * FROM creative_events
       WHERE id = $1 AND status = 'published'
       FOR UPDATE`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event) throw new AppError('Calendar creative not found', 404);

    const existing = await dbClient.query(
      `SELECT * FROM client_event_selections
       WHERE client_id = $1 AND event_id = $2`,
      [clientId, eventId]
    );
    if (existing.rows[0]) {
      await dbClient.query('COMMIT');
      return { selection: existing.rows[0], idempotent: true };
    }

    const account = await getCreditAccount(clientId, dbClient, true);
    const coinCost = Number(event.coin_cost || 0);
    const hasEnough = Number(account.balance || 0) >= coinCost;
    const selectionStatus = hasEnough ? 'approved' : 'pending_review';

    const selectionResult = await dbClient.query(
      `INSERT INTO client_event_selections
         (client_id, event_id, status, coin_cost, client_note, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        clientId,
        eventId,
        selectionStatus,
        coinCost,
        String(client_note || '').trim() || null,
        JSON.stringify({ balance_at_selection: Number(account.balance || 0) }),
      ]
    );
    const selection = selectionResult.rows[0];

    let job = null;
    let task = null;
    let creditTx = null;
    if (hasEnough) {
      creditTx = await spendMintCoins(dbClient, {
        clientId,
        amount: coinCost,
        referenceId: selection.id,
        referenceType: 'calendar_selection',
        description: `Reserved for ${event.title}`,
        metadata: { event_id: event.id },
      });
      job = await createInternalJob(dbClient, clientId, {
        title: event.title,
        description: event.description || `Creative for ${event.title}`,
        categoryId: event.category_id,
        deadline: event.event_date,
        metadata: {
          source_type: 'calendar_event',
          event_id: event.id,
          selection_id: selection.id,
          asset_type: event.asset_type,
          tags: event.tags || [],
        },
      });
      task = await createTask(dbClient, {
        sourceType: 'calendar_event',
        sourceId: selection.id,
        clientId,
        job,
        title: event.title,
        description: event.description,
        dueDate: event.event_date,
        coinCost,
        metadata: { event_id: event.id, selection_id: selection.id },
      });
      await dbClient.query(
        `UPDATE client_event_selections
         SET job_id = $1, task_id = $2, credit_tx_id = $3
         WHERE id = $4
         RETURNING *`,
        [task.job_id || job.id, task.id, creditTx?.id || null, selection.id]
      );
    }

    await dbClient.query('COMMIT');
    logger.info('[Creative] Calendar event selected', { clientId, eventId, status: selectionStatus });
    return { selection: { ...selection, job_id: job?.id || null, task_id: task?.id || null }, task };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const createCustomRequest = async (clientId, payload = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    await getClientInfo(clientId, dbClient);
    const settings = {
      ...DEFAULT_CUSTOM_REQUEST_SETTINGS,
      ...(await getSetting('custom_requests', DEFAULT_CUSTOM_REQUEST_SETTINGS, dbClient) || {}),
    };

    const title = String(payload.title || payload.job?.title || 'Custom design request').trim();
    const attachments = validateBriefAttachments(payload.attachments || []);
    if (title.length < 3) throw new AppError('A request title is required', 400);

    let job = null;
    if (payload.job_id) {
      const existingJob = await dbClient.query(
        `SELECT *
         FROM jobs
         WHERE id = $1 AND client_id = $2
         FOR UPDATE`,
        [payload.job_id, clientId]
      );
      job = existingJob.rows[0];
      if (!job) throw new AppError('Draft request not found', 404);

      const existingRequest = await dbClient.query(
        'SELECT * FROM creative_requests WHERE job_id = $1',
        [job.id]
      );
      if (existingRequest.rows[0]) {
        await dbClient.query('COMMIT');
        return { request: existingRequest.rows[0], job, idempotent: true };
      }

      const isDraft = job.status === 'draft';
      const isInternalPending = (
        job.status === 'pending_admin_approval' &&
        job.metadata?.fulfillment_provider === 'mintmore_internal' &&
        job.metadata?.matching_disabled === true
      );
      if (!isDraft && !isInternalPending) {
        throw new AppError('Only draft internal requests can be sent to CREATYV ops', 409);
      }

      job = (await dbClient.query(
        `UPDATE jobs
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify({ fulfillment_provider: 'mintmore_internal', matching_disabled: true }), job.id]
      )).rows[0];
    } else {
      job = await createInternalJob(dbClient, clientId, {
        title,
        description: payload.description || '',
        categoryId: payload.category_id || null,
        deadline: payload.deadline || null,
        metadata: {
          source_type: 'custom_request',
          request_type: payload.request_type || 'other',
          brief_context: payload.brief_context || {},
        },
      });
    }

    const folder = await ensureMintboxFolder(dbClient, job);

    const requestResult = await dbClient.query(
      `INSERT INTO creative_requests
         (client_id, job_id, request_type, title, description, deadline,
          attachments, status, coin_cost, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_ops_review',$8,$9)
       RETURNING *`,
      [
        clientId,
        job.id,
        payload.request_type || 'other',
        title,
        payload.description || job.description || null,
        payload.deadline || job.deadline || null,
        JSON.stringify(attachments),
        Number(settings.default_coin_cost || 1),
        JSON.stringify({
          ...(payload.metadata || {}),
          brief_context: payload.brief_context || payload.metadata?.brief_context || {},
          mintbox_folder_id: folder.id,
        }),
      ]
    );
    const request = requestResult.rows[0];

    await dbClient.query(
      `UPDATE jobs
       SET status = 'pending_admin_approval',
           metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          source_type: 'custom_request',
          creative_request_id: request.id,
          fulfillment_provider: 'mintmore_internal',
          matching_disabled: true,
        }),
        job.id,
      ]
    );

    await dbClient.query('COMMIT');
    logger.info('[Creative] Custom request created', { clientId, requestId: request.id, jobId: job.id });
    const updatedJob = { ...job, status: 'pending_admin_approval' };
    await notifyAdminsAboutCustomRequest({ request, job: updatedJob });
    return { request, job: updatedJob };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const cancelClientWorkItem = async (clientId, sourceType, sourceId, reason = 'Cancelled by client') => {
  if (!['custom_request', 'calendar_event'].includes(sourceType)) {
    throw new AppError('Unsupported creative item type', 400);
  }

  const table = sourceType === 'custom_request' ? 'creative_requests' : 'client_event_selections';
  const referenceType = sourceType === 'custom_request' ? 'custom_request' : 'calendar_selection';
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const sourceResult = await dbClient.query(
      `SELECT source.*, tx.amount AS reserved_amount
       FROM ${table} source
       LEFT JOIN mint_credit_transactions tx ON tx.id = source.credit_tx_id
       WHERE source.id = $1 AND source.client_id = $2
       FOR UPDATE OF source`,
      [sourceId, clientId]
    );
    const source = sourceResult.rows[0];
    if (!source) throw new AppError('Creative request not found', 404);
    if (['completed', 'cancelled', 'rejected'].includes(source.status)) {
      throw new AppError('This creative is already closed', 409);
    }

    const taskResult = await dbClient.query(
      `SELECT * FROM creative_tasks
       WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [sourceType, sourceId]
    );
    const task = taskResult.rows[0];
    if (task && !['pending', 'assigned', 'blocked'].includes(task.status)) {
      throw new AppError('CREATYV has already started this creative. Please raise a support ticket to cancel it.', 409);
    }

    let refundTx = null;
    if (source.credit_tx_id) {
      refundTx = await refundMintCoins(dbClient, {
        clientId,
        amount: Math.abs(Number(source.reserved_amount || source.coin_cost || task?.coin_cost || 0)),
        referenceId: source.id,
        referenceType,
        description: 'MintCoins returned for cancelled creative',
        metadata: {
          cancelled_by: clientId,
          task_id: task?.id || null,
          job_id: source.job_id || task?.job_id || null,
          reason,
          original_credit_tx_id: source.credit_tx_id,
        },
      });
    }

    const updatedSource = await dbClient.query(
      `UPDATE ${table}
       SET status = 'cancelled',
           admin_note = COALESCE(admin_note, $1),
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $3
       RETURNING *`,
      [
        reason,
        JSON.stringify({ cancelled_by_client_at: new Date().toISOString(), refund_tx_id: refundTx?.id || null }),
        source.id,
      ]
    );

    let updatedTask = null;
    if (task) {
      updatedTask = (await dbClient.query(
        `UPDATE creative_tasks
         SET status = 'cancelled',
             client_status = 'Cancelled by client',
             internal_notes = COALESCE(internal_notes, $1)
         WHERE id = $2
         RETURNING *`,
        [reason, task.id]
      )).rows[0];
    }

    if (source.job_id || task?.job_id) {
      await dbClient.query(
        `UPDATE jobs
         SET status = 'cancelled',
             metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify({ cancelled_by_client_at: new Date().toISOString(), cancellation_reason: reason }), source.job_id || task.job_id]
      );
    }

    await writeAudit({
      actorId: clientId,
      actorRole: 'client',
      action: `${referenceType}.cancelled_by_client`,
      entityType: table,
      entityId: source.id,
      beforeState: source,
      afterState: updatedSource.rows[0],
      metadata: {
        task_id: task?.id || null,
        refund_tx_id: refundTx?.id || null,
        reason,
      },
    }, dbClient);

    await dbClient.query('COMMIT');
    return { item: updatedSource.rows[0], task: updatedTask, refund: refundTx };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const listClientWork = async (clientId) => {
  await getClientInfo(clientId);
  await ensureMonthlyMintCoins(clientId);
  const [requests, selections, tasks, account] = await Promise.all([
    query(
      `SELECT request.*, job.title AS job_title
       FROM creative_requests request
       LEFT JOIN jobs job ON job.id = request.job_id
       WHERE request.client_id = $1
         AND request.task_id IS NULL
       ORDER BY request.created_at DESC`,
      [clientId]
    ),
    query(
      `SELECT selection.*, event.title, event.event_date, event.asset_type,
              task.status AS task_status, task.client_status
       FROM client_event_selections selection
       JOIN creative_events event ON event.id = selection.event_id
       LEFT JOIN creative_tasks task ON task.id = selection.task_id
       WHERE selection.client_id = $1
         AND event.status = 'published'
       ORDER BY selection.created_at DESC`,
      [clientId]
    ),
    query(
      `SELECT task.*, assignee.full_name AS assigned_to_name
       FROM creative_tasks task
       LEFT JOIN users assignee ON assignee.id = task.assigned_to
       WHERE task.client_id = $1
         AND task.status <> 'cancelled'
       ORDER BY task.created_at DESC`,
      [clientId]
    ),
    getCreditAccount(clientId),
  ]);

  return {
    balance: Number(account.balance || 0),
    requests: requests.rows,
    selections: selections.rows,
    tasks: tasks.rows,
  };
};

const approveCalendarSelection = async (adminId, selectionId, payload = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT selection.*, event.title, event.description, event.event_date,
              event.category_id, event.asset_type, event.tags
       FROM client_event_selections selection
       JOIN creative_events event ON event.id = selection.event_id
       WHERE selection.id = $1
       FOR UPDATE`,
      [selectionId]
    );
    const selection = result.rows[0];
    if (!selection) throw new AppError('Calendar selection not found', 404);
    if (selection.task_id) {
      await dbClient.query('COMMIT');
      return { selection, idempotent: true };
    }

    const coinCost = Number(payload.coin_cost ?? selection.coin_cost ?? 1);
    if (!Number.isFinite(coinCost) || coinCost < 0) {
      throw new AppError('coin_cost must be a non-negative number', 400);
    }

    const account = await getCreditAccount(selection.client_id, dbClient, true);
    if (Number(account.balance || 0) < coinCost) {
      const updated = await dbClient.query(
        `UPDATE client_event_selections
         SET status = 'pending_review',
             coin_cost = $1,
             admin_note = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $4
         RETURNING *`,
        [
          coinCost,
          payload.admin_note || 'Waiting for MintCoin approval',
          JSON.stringify({ reviewed_by: adminId, insufficient_balance: true }),
          selection.id,
        ]
      );
      await dbClient.query('COMMIT');
      return { selection: updated.rows[0], insufficient_balance: true };
    }

    const creditTx = await spendMintCoins(dbClient, {
      clientId: selection.client_id,
      amount: coinCost,
      referenceId: selection.id,
      referenceType: 'calendar_selection',
      description: `Reserved for ${selection.title}`,
      metadata: { event_id: selection.event_id, approved_by: adminId },
    });
    const job = await createInternalJob(dbClient, selection.client_id, {
      title: selection.title,
      description: selection.description || `Creative for ${selection.title}`,
      categoryId: selection.category_id,
      deadline: selection.event_date,
      metadata: {
        source_type: 'calendar_event',
        event_id: selection.event_id,
        selection_id: selection.id,
        asset_type: selection.asset_type,
        tags: selection.tags || [],
      },
    });
    const task = await createTask(dbClient, {
      sourceType: 'calendar_event',
      sourceId: selection.id,
      clientId: selection.client_id,
      job,
      title: selection.title,
      description: selection.description,
      dueDate: payload.due_date || selection.event_date,
      coinCost,
      metadata: { event_id: selection.event_id, selection_id: selection.id },
    });
    const updated = await dbClient.query(
      `UPDATE client_event_selections
       SET status = 'approved',
           coin_cost = $1,
           job_id = $2,
           task_id = $3,
           credit_tx_id = $4,
           admin_note = $5,
           metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb
       WHERE id = $7
       RETURNING *`,
      [
        coinCost,
        task.job_id || job.id,
        task.id,
        creditTx?.id || null,
        payload.admin_note || null,
        JSON.stringify({ reviewed_by: adminId }),
        selection.id,
      ]
    );

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'calendar_selection.approved',
      entityType: 'client_event_selection',
      entityId: selection.id,
      beforeState: selection,
      afterState: updated.rows[0],
      metadata: {
        title: selection.title,
        client_id: selection.client_id,
        event_id: selection.event_id,
        coin_cost: coinCost,
        task_id: task.id,
      },
    }, dbClient);

    await dbClient.query('COMMIT');
    return { selection: updated.rows[0], task };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const rejectCalendarSelection = async (adminId, selectionId, payload = {}) => {
  const beforeResult = await query('SELECT * FROM client_event_selections WHERE id = $1', [selectionId]);
  const before = beforeResult.rows[0];
  const result = await query(
    `UPDATE client_event_selections selection
     SET status = 'rejected',
         admin_note = $1,
         metadata = COALESCE(selection.metadata, '{}'::jsonb) || $2::jsonb
     FROM creative_events event
     WHERE selection.id = $3
       AND selection.event_id = event.id
       AND selection.task_id IS NULL
     RETURNING selection.*, event.title, event.event_date`,
    [
      payload.admin_note || 'Rejected by CREATYV ops',
      JSON.stringify({ reviewed_by: adminId }),
      selectionId,
    ]
  );
  if (!result.rows[0]) throw new AppError('Calendar selection not found or already queued', 404);
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'calendar_selection.rejected',
    entityType: 'client_event_selection',
    entityId: selectionId,
    beforeState: before,
    afterState: result.rows[0],
    metadata: {
      title: result.rows[0].title,
      client_id: result.rows[0].client_id,
      event_id: result.rows[0].event_id,
      reason: payload.admin_note || 'Rejected by CREATYV ops',
    },
  });
  return { selection: result.rows[0] };
};

const adminOverview = async () => {
  const [tasks, requests, selections, designers, events] = await Promise.all([
    query(
      `SELECT task.*, client.full_name AS client_name, assignee.full_name AS assigned_to_name
       FROM creative_tasks task
       JOIN users client ON client.id = task.client_id
       LEFT JOIN users assignee ON assignee.id = task.assigned_to
       WHERE task.status <> 'cancelled'
       ORDER BY task.created_at DESC
       LIMIT 100`
    ),
    query(
      `SELECT request.*, client.full_name AS client_name, client.email AS client_email
       FROM creative_requests request
       JOIN users client ON client.id = request.client_id
       WHERE request.status = 'pending_ops_review'
         AND request.task_id IS NULL
       ORDER BY request.created_at DESC
       LIMIT 100`
    ),
    query(
      `SELECT selection.*, event.title, event.event_date, client.full_name AS client_name
       FROM client_event_selections selection
       JOIN creative_events event ON event.id = selection.event_id
       JOIN users client ON client.id = selection.client_id
       WHERE selection.status IN ('pending_review','approved','in_production')
       ORDER BY selection.created_at DESC
       LIMIT 100`
    ),
    query(
      `SELECT id, full_name, email, role, admin_permissions
       FROM users
       WHERE role = 'designer' AND is_active = true
       ORDER BY full_name ASC`
    ),
    query(
      `SELECT * FROM creative_events
       WHERE month_key >= $1
         AND status <> 'archived'
       ORDER BY event_date ASC
       LIMIT 60`,
      [monthKeyFor()]
    ),
  ]);

  return {
    tasks: tasks.rows,
    requests: requests.rows,
    selections: selections.rows,
    designers: designers.rows,
    events: events.rows,
  };
};

const listDesignerTasks = async (designerId) => {
  const result = await query(
    `SELECT task.*,
            client.full_name AS client_name,
            client.business_name AS client_business_name,
            client.business_type AS client_business_type,
            client.email AS client_email,
            folder.share_token AS folder_share_token
     FROM creative_tasks task
     JOIN users client ON client.id = task.client_id
     LEFT JOIN mintbox_folders folder ON folder.id = task.mintbox_folder_id
     WHERE task.assigned_to = $1
       AND task.status <> 'cancelled'
     ORDER BY
       CASE task.status
         WHEN 'assigned' THEN 1
         WHEN 'in_progress' THEN 2
         WHEN 'revision' THEN 3
         WHEN 'delivered' THEN 4
         WHEN 'completed' THEN 5
         ELSE 6
       END,
       task.due_date NULLS LAST,
       task.created_at DESC`,
    [designerId]
  );
  return { tasks: result.rows };
};

const getTaskSheetRows = async () => {
  const result = await query(
    `SELECT task.id, task.title, task.description, task.status, task.client_status,
            task.source_type, task.work_slot, task.due_date, task.coin_cost,
            task.created_at, task.updated_at,
            client.full_name AS client_name,
            client.business_name AS client_business_name,
            client.business_type AS client_business_type,
            designer.full_name AS designer_name
     FROM creative_tasks task
     JOIN users client ON client.id = task.client_id
     LEFT JOIN users designer ON designer.id = task.assigned_to
     WHERE task.status <> 'cancelled'
     ORDER BY task.due_date NULLS LAST, task.created_at DESC`
  );

  return result.rows.map((task) => ({
    id: task.id,
    title: task.title,
    client: task.client_business_name || task.client_name,
    client_name: task.client_name,
    business_type: task.client_business_type,
    designer: task.designer_name || '',
    status: task.status,
    client_status: task.client_status,
    source: task.source_type,
    work_slot: task.work_slot || '',
    due_date: task.due_date,
    coin_cost: Number(task.coin_cost || 0),
    created_at: task.created_at,
    updated_at: task.updated_at,
  }));
};

const parseGoogleServiceAccount = () => {
  if (!env.googleSheets?.serviceAccountJson) return null;

  try {
    const credentials = JSON.parse(env.googleSheets.serviceAccountJson);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    return credentials;
  } catch (error) {
    logger.error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON', { error: error.message });
    throw new AppError('Google Sheets service account JSON is invalid', 500);
  }
};

const syncTaskSheetDirect = async ({ rows, adminId, sheetName }) => {
  const spreadsheetId = env.googleSheets?.spreadsheetId;
  const credentials = parseGoogleServiceAccount();

  if (!spreadsheetId || !credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const safeSheetName = sheetName || 'CREATYV tasks';

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === safeSheetName);
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: safeSheetName } } }],
      },
    });
  }

  const values = [
    [
      'Task ID',
      'Title',
      'Client',
      'Client Name',
      'Business Type',
      'Designer',
      'Status',
      'Client Status',
      'Source',
      'Work Slot',
      'Due Date',
      'MintCoins',
      'Created At',
      'Updated At',
    ],
    ...rows.map((row) => [
      row.id,
      row.title,
      row.client,
      row.client_name,
      row.business_type,
      row.designer,
      row.status,
      row.client_status,
      row.source,
      row.work_slot,
      row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '',
      row.coin_cost,
      row.created_at ? new Date(row.created_at).toISOString() : '',
      row.updated_at ? new Date(row.updated_at).toISOString() : '',
    ]),
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${safeSheetName}'!A:Z`,
  });

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${safeSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'creative_tasks.sheet_synced',
    entityType: 'creative_task',
    entityId: 'sheet-sync',
    metadata: {
      provider: 'google_sheets',
      spreadsheet_id: spreadsheetId,
      sheet_name: safeSheetName,
      rows: rows.length,
      updated_cells: response.data.updatedCells || 0,
    },
  });

  return {
    configured: true,
    provider: 'google_sheets',
    rows_synced: rows.length,
    updated_cells: response.data.updatedCells || 0,
  };
};

const syncTaskSheet = async (adminId) => {
  const rows = await getTaskSheetRows();
  const setting = await getSetting('ops_google_sheets', { enabled: false, webhook_url: null, sheet_name: 'CREATYV tasks' });
  const sheetName = setting?.sheet_name || 'CREATYV tasks';

  const directSync = await syncTaskSheetDirect({ rows, adminId, sheetName });
  if (directSync) return directSync;

  if (!setting?.enabled || !setting?.webhook_url) {
    return {
      configured: false,
      rows,
      message: 'Google Sheets sync is not configured. Export CSV is still available.',
    };
  }

  const response = await axios.post(setting.webhook_url, {
    sheet_name: sheetName,
    synced_by: adminId,
    synced_at: new Date().toISOString(),
    rows,
  }, { timeout: 15000 });

  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'creative_tasks.sheet_synced',
    entityType: 'creative_task',
    entityId: 'sheet-sync',
    metadata: {
      rows: rows.length,
      sheet_name: sheetName,
      status: response.status,
    },
  });

  return {
    configured: true,
    rows_synced: rows.length,
    provider_status: response.status,
  };
};

const updateDesignerTask = async (designerId, taskId, payload = {}) => {
  const allowedStatuses = ['assigned', 'in_progress', 'delivered', 'revision', 'blocked'];
  const nextStatus = payload.status;
  if (!allowedStatuses.includes(nextStatus)) throw new AppError('Invalid designer task status', 400);

  const beforeResult = await query(
    `SELECT * FROM creative_tasks
     WHERE id = $1 AND assigned_to = $2`,
    [taskId, designerId]
  );
  const before = beforeResult.rows[0];
  if (!before) throw new AppError('Assigned task not found', 404);
  if (['completed', 'cancelled'].includes(before.status)) {
    throw new AppError('Completed or cancelled tasks cannot be changed by designer', 409);
  }

  const result = await query(
    `UPDATE creative_tasks
     SET status = $1,
         client_status = $2,
         internal_notes = COALESCE($3, internal_notes)
     WHERE id = $4
       AND assigned_to = $5
     RETURNING *`,
    [
      nextStatus,
      payload.client_status || (
        nextStatus === 'in_progress' ? 'CREATYV is designing this creative'
        : nextStatus === 'delivered' ? 'Delivered for review'
        : nextStatus === 'blocked' ? 'Blocked - CREATYV is reviewing'
        : before.client_status
      ),
      payload.internal_notes || null,
      taskId,
      designerId,
    ]
  );

  await writeAudit({
    actorId: designerId,
    actorRole: 'designer',
    action: 'designer_task.updated',
    entityType: 'creative_task',
    entityId: taskId,
    beforeState: before,
    afterState: result.rows[0],
    metadata: {
      title: result.rows[0].title,
      status: result.rows[0].status,
      client_id: result.rows[0].client_id,
    },
  });

  const task = result.rows[0];
  const clientNotificationByStatus = {
    delivered: {
      title: 'Creative delivered',
      body: `${task.title} is ready for your review.`,
    },
    blocked: {
      title: 'Creative needs attention',
      body: `${task.title} needs a quick review from the CREATYV team.`,
    },
    revision: {
      title: 'Revision in progress',
      body: `${task.title} has moved into revision.`,
    },
  };
  const clientNotification = clientNotificationByStatus[nextStatus];
  if (clientNotification && before.status !== nextStatus) {
    try {
      await notificationService.createNotification({
        userId: task.client_id,
        type: 'system',
        title: clientNotification.title,
        body: clientNotification.body,
        entityType: 'creative_task',
        entityId: task.id,
        data: {
          task_id: task.id,
          job_id: task.job_id,
          source_type: task.source_type,
          status: task.status,
        },
        dedupeKey: `creative-task-status:${task.id}:${before.status}:${nextStatus}`,
      });
    } catch (notificationError) {
      logger.error('Client creative task notification failed', {
        taskId: task.id,
        clientId: task.client_id,
        status: nextStatus,
        error: notificationError.message,
      });
    }
  }

  return task;
};

const suggestCalendarEvents = async ({ month = monthKeyFor() } = {}) => {
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new AppError('month must be YYYY-MM', 400);
  const [googleSuggestions, existing] = await Promise.all([
    fetchGoogleHolidaySuggestions(month),
    query(
      `SELECT title, event_date, month_key, asset_type
       FROM creative_events
       WHERE month_key = $1
         AND status <> 'archived'`,
      [month]
    ),
  ]);

  const existingKeys = new Set(existing.rows.map(event => calendarDuplicateKey(event)));
  const batchKeys = new Set();
  const suggestions = [...googleSuggestions, ...fallbackOccasions(month)]
    .filter((suggestion) => {
      const key = calendarDuplicateKey(suggestion);
      if (batchKeys.has(key) || existingKeys.has(key)) return false;
      batchKeys.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 30);

  return { month, suggestions };
};

const upsertEvent = async (adminId, payload = {}, eventId = null) => {
  const title = String(payload.title || '').trim();
  if (title.length < 3) throw new AppError('Event title is required', 400);
  if (!payload.event_date) throw new AppError('Event date is required', 400);
  const eventDate = new Date(payload.event_date);
  if (Number.isNaN(eventDate.getTime())) throw new AppError('Invalid event date', 400);
  const month = monthKeyFor(eventDate);
  const assetType = String(payload.asset_type || 'social_post').trim() || 'social_post';
  const coinCost = Number(payload.coin_cost ?? 1);
  if (!Number.isFinite(coinCost) || coinCost < 0) throw new AppError('coin_cost must be a non-negative number', 400);

  const duplicateResult = await query(
    `SELECT *
     FROM creative_events
     WHERE month_key = $1
       AND asset_type = $2
       AND LOWER(REGEXP_REPLACE(TRIM(title), '\\s+', ' ', 'g')) = $3
       AND status <> 'archived'
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     ORDER BY event_date DESC, created_at DESC
     LIMIT 1`,
    [month, assetType, normalizeEventTitle(title), eventId || null]
  );
  if (duplicateResult.rows[0]) {
    if (eventId) {
      throw new AppError(`A calendar event named "${title}" already exists for ${month}.`, 409);
    }
    return {
      ...duplicateResult.rows[0],
      duplicate: true,
    };
  }

  if (eventId) {
    const beforeResult = await query('SELECT * FROM creative_events WHERE id = $1', [eventId]);
    const before = beforeResult.rows[0];
    if (!before) throw new AppError('Creative event not found', 404);

    const result = await query(
      `UPDATE creative_events
       SET title=$1, description=$2, event_date=$3, month_key=$4,
           category_id=$5, asset_type=$6, coin_cost=$7, tags=$8,
           status=$9, updated_by=$10, metadata=$11
       WHERE id=$12
       RETURNING *`,
      [
        title,
        payload.description || null,
        payload.event_date,
        month,
        payload.category_id || null,
        assetType,
        coinCost,
        normalizeTags(payload.tags),
        payload.status || 'published',
        adminId,
        JSON.stringify(payload.metadata || {}),
        eventId,
      ]
    );
    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'creative_event.updated',
      entityType: 'creative_event',
      entityId: eventId,
      beforeState: before,
      afterState: result.rows[0],
      metadata: {
        title: result.rows[0].title,
        event_date: result.rows[0].event_date,
        asset_type: result.rows[0].asset_type,
      },
    });
    return result.rows[0];
  }

  const result = await query(
    `INSERT INTO creative_events
       (title, description, event_date, month_key, category_id, asset_type,
        coin_cost, tags, status, created_by, updated_by, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)
     RETURNING *`,
    [
      title,
      payload.description || null,
      payload.event_date,
      month,
      payload.category_id || null,
      assetType,
      coinCost,
      normalizeTags(payload.tags),
      payload.status || 'published',
      adminId,
      JSON.stringify(payload.metadata || {}),
    ]
  );
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'creative_event.created',
    entityType: 'creative_event',
    entityId: result.rows[0].id,
    afterState: result.rows[0],
    metadata: {
      title: result.rows[0].title,
      event_date: result.rows[0].event_date,
      asset_type: result.rows[0].asset_type,
      coin_cost: result.rows[0].coin_cost,
    },
  });
  return result.rows[0];
};

const archiveEvent = async (adminId, eventId) => {
  const beforeResult = await query(
    `SELECT *
     FROM creative_events
     WHERE id = $1
       AND status <> 'archived'`,
    [eventId]
  );
  const before = beforeResult.rows[0];
  if (!before) throw new AppError('Creative event not found or already removed', 404);

  const result = await query(
    `UPDATE creative_events
     SET status = 'archived',
         updated_by = $1,
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id = $3
     RETURNING *`,
    [
      adminId,
      JSON.stringify({ archived_reason: 'admin_removed', archived_by: adminId, archived_at: new Date().toISOString() }),
      eventId,
    ]
  );

  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'creative_event.archived',
    entityType: 'creative_event',
    entityId: eventId,
    beforeState: before,
    afterState: result.rows[0],
    metadata: {
      title: before.title,
      event_date: before.event_date,
      asset_type: before.asset_type,
    },
  });

  return result.rows[0];
};

const updateTask = async (adminId, taskId, payload = {}) => {
  const normalizedPayload = {
    ...payload,
    assigned_to: payload.assigned_to ?? payload.assigned_designer_id,
  };
  const dbClient = await getClient();
  let committed = false;
  try {
    await dbClient.query('BEGIN');

    const beforeResult = await dbClient.query(
      'SELECT * FROM creative_tasks WHERE id = $1 FOR UPDATE',
      [taskId]
    );
    const before = beforeResult.rows[0];
    if (!before) throw new AppError('Creative task not found', 404);
    if (before.status === 'completed' && normalizedPayload.status === 'cancelled') {
      throw new AppError('Completed tasks cannot be cancelled. Use a correction workflow instead.', 409);
    }

    const allowed = ['status', 'client_status', 'assigned_to', 'work_slot', 'due_date', 'internal_notes'];
    const fields = [];
    const values = [];
    let idx = 1;
    for (const key of allowed) {
      if (normalizedPayload[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(normalizedPayload[key] || null);
        idx += 1;
      }
    }
    if (normalizedPayload.assigned_to && normalizedPayload.status === undefined && before.status === 'pending') {
      fields.push(`status = $${idx}`);
      values.push('assigned');
      idx += 1;
      fields.push(`client_status = $${idx}`);
      values.push('Assigned to CREATYV design team');
      idx += 1;
    }
    if (!fields.length) throw new AppError('No valid task fields provided', 400);
    if (normalizedPayload.assigned_to) {
      const designer = await dbClient.query(
        `SELECT id FROM users
         WHERE id = $1 AND role = 'designer' AND is_active = true`,
        [normalizedPayload.assigned_to]
      );
      if (!designer.rows[0]) throw new AppError('Assigned user must be an active CREATYV designer', 400);
    }
    fields.push(`created_by_admin = COALESCE(created_by_admin, $${idx})`);
    values.push(adminId);
    values.push(taskId);
    const result = await dbClient.query(
      `UPDATE creative_tasks
       SET ${fields.join(', ')}
       WHERE id = $${idx + 1}
       RETURNING *`,
      values
    );
    const task = result.rows[0];
    let refundTx = null;
    if (normalizedPayload.status === 'cancelled' && before.status !== 'cancelled') {
      refundTx = await refundTaskMintCoins(
        dbClient,
        task,
        adminId,
        normalizedPayload.internal_notes || normalizedPayload.admin_note || 'Task cancelled'
      );
    }

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'creative_task.updated',
      entityType: 'creative_task',
      entityId: taskId,
      beforeState: before,
      afterState: task,
      metadata: {
        title: task.title,
        status: task.status,
        assigned_to: task.assigned_to,
        work_slot: task.work_slot,
        refund_tx_id: refundTx?.id || null,
      },
    }, dbClient);

    await dbClient.query('COMMIT');
    committed = true;

    if (normalizedPayload.assigned_to) {
      if (task.job_id) {
        try {
          await chatService.createChatRoom({
            jobId: task.job_id,
            clientId: task.client_id,
            designerId: normalizedPayload.assigned_to,
          });
          await chatService.appendSystemMessageByJob(task.job_id, `${task.title} is now assigned to the CREATYV design team.`);
        } catch (chatError) {
          logger.error('Project chat creation failed for assigned designer', {
            taskId: task.id,
            jobId: task.job_id,
            designerId: normalizedPayload.assigned_to,
            error: chatError.message,
          });
        }
      }
      try {
        await notificationService.createNotification({
          userId: normalizedPayload.assigned_to,
          type: 'system',
          title: 'New creative task assigned',
          body: `${task.title} is now assigned to you.`,
          entityType: 'creative_task',
          entityId: task.id,
          data: { task_id: task.id, job_id: task.job_id, source_type: task.source_type },
          dedupeKey: `creative-task-assigned:${task.id}:${normalizedPayload.assigned_to}`,
        });
      } catch (notificationError) {
        logger.error('Designer task assignment notification failed', {
          taskId: task.id,
          designerId: normalizedPayload.assigned_to,
          error: notificationError.message,
        });
      }
    }
    return task;
  } catch (error) {
    if (!committed) await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const approveCustomRequest = async (adminId, requestId, payload = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT cr.*, job.title AS job_title, job.description AS job_description, job.deadline AS job_deadline
       FROM creative_requests cr
       LEFT JOIN jobs job ON job.id = cr.job_id
       WHERE cr.id = $1
       FOR UPDATE OF cr`,
      [requestId]
    );
    const request = result.rows[0];
    if (!request) throw new AppError('Custom request not found', 404);
    if (request.task_id) {
      await dbClient.query('COMMIT');
      return { request, idempotent: true };
    }

    const coinCost = Number(payload.coin_cost ?? request.coin_cost ?? 1);
    const account = await getCreditAccount(request.client_id, dbClient, true);
    const hasEnough = Number(account.balance || 0) >= coinCost;
    if (!hasEnough) {
      const updated = await dbClient.query(
        `UPDATE creative_requests
         SET status='pending_ops_review', coin_cost=$1, admin_note=$2
         WHERE id=$3 RETURNING *`,
        [coinCost, payload.admin_note || 'Waiting for MintCoin approval', request.id]
      );
      await dbClient.query('COMMIT');
      return { request: updated.rows[0], insufficient_balance: true };
    }

    const job = request.job_id
      ? (await dbClient.query('SELECT * FROM jobs WHERE id=$1', [request.job_id])).rows[0]
      : await createInternalJob(dbClient, request.client_id, {
        title: request.title,
        description: request.description,
        deadline: request.deadline,
        metadata: { source_type: 'custom_request', creative_request_id: request.id },
      });
    const creditTx = await spendMintCoins(dbClient, {
      clientId: request.client_id,
      amount: coinCost,
      referenceId: request.id,
      referenceType: 'custom_request',
      description: `Reserved for ${request.title}`,
      metadata: { approved_by: adminId },
    });
    const task = await createTask(dbClient, {
      sourceType: 'custom_request',
      sourceId: request.id,
      clientId: request.client_id,
      job,
      title: request.title,
      description: request.description,
      dueDate: payload.due_date || request.deadline,
      coinCost,
      status: 'pending',
      metadata: { request_id: request.id },
    });
    const updated = await dbClient.query(
      `UPDATE creative_requests
       SET status='approved', coin_cost=$1, credit_tx_id=$2, task_id=$3,
           job_id=$4, admin_note=$5
       WHERE id=$6
       RETURNING *`,
      [coinCost, creditTx?.id || null, task.id, task.job_id || job.id, payload.admin_note || null, request.id]
    );
    await dbClient.query(
      `UPDATE jobs
       SET status='pending_admin_approval',
           metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
       WHERE id=$2`,
      [JSON.stringify({ creative_task_id: task.id }), task.job_id || job.id]
    );

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'creative_request.approved',
      entityType: 'creative_request',
      entityId: request.id,
      beforeState: request,
      afterState: updated.rows[0],
      metadata: {
        title: request.title,
        client_id: request.client_id,
        coin_cost: coinCost,
        task_id: task.id,
      },
    }, dbClient);

    await dbClient.query('COMMIT');
    return { request: updated.rows[0], task };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const rejectCustomRequest = async (adminId, requestId, payload = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const beforeResult = await dbClient.query(
      `SELECT *
       FROM creative_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    const before = beforeResult.rows[0];
    if (!before) throw new AppError('Custom request not found', 404);
    if (before.task_id) {
      throw new AppError('Request is already queued. Cancel the production task instead.', 409);
    }
    if (['rejected', 'cancelled'].includes(before.status)) {
      await dbClient.query('COMMIT');
      return { request: before, idempotent: true };
    }
    if (['delivered', 'completed'].includes(before.status)) {
      throw new AppError('Delivered or completed requests cannot be rejected.', 409);
    }

    let refundTx = null;
    if (before.credit_tx_id) {
      const txResult = await dbClient.query(
        'SELECT amount FROM mint_credit_transactions WHERE id = $1',
        [before.credit_tx_id]
      );
      const reservedAmount = Math.abs(Number(txResult.rows[0]?.amount || before.coin_cost || 0));
      refundTx = await refundMintCoins(dbClient, {
        clientId: before.client_id,
        amount: reservedAmount,
        referenceId: before.id,
        referenceType: 'custom_request',
        description: 'MintCoins returned for rejected custom request',
        metadata: {
          rejected_by: adminId,
          reason: payload.admin_note || payload.reason || 'Rejected by CREATYV ops',
          original_credit_tx_id: before.credit_tx_id,
        },
      });
    }

    const result = await dbClient.query(
      `UPDATE creative_requests
       SET status = 'rejected',
           admin_note = $1,
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $3
       RETURNING *`,
      [
        payload.admin_note || payload.reason || 'Rejected by CREATYV ops',
        JSON.stringify({
          rejected_by: adminId,
          refund_tx_id: refundTx?.id || null,
          rejected_at: new Date().toISOString(),
        }),
        before.id,
      ]
    );

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'creative_request.rejected',
      entityType: 'creative_request',
      entityId: before.id,
      beforeState: before,
      afterState: result.rows[0],
      metadata: {
        title: before.title,
        client_id: before.client_id,
        coin_cost: before.coin_cost,
        refund_tx_id: refundTx?.id || null,
        reason: payload.admin_note || payload.reason || 'Rejected by CREATYV ops',
      },
    }, dbClient);

    await dbClient.query('COMMIT');
    return { request: result.rows[0], refund: refundTx };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  listCalendar,
  selectEvent,
  createCustomRequest,
  listClientWork,
  adminOverview,
  listDesignerTasks,
  updateDesignerTask,
  cancelClientWorkItem,
  syncTaskSheet,
  suggestCalendarEvents,
  upsertEvent,
  archiveEvent,
  updateTask,
  approveCustomRequest,
  rejectCustomRequest,
  approveCalendarSelection,
  rejectCalendarSelection,
};
