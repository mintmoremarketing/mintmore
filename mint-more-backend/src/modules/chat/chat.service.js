const { query, getClient } = require('../../config/database');
const { getRedis }         = require('../../config/redis');
const { sendTextMessage, sendMediaMessage, markAsRead } = require('./whatsapp.service');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const { assertNoContactInfo } = require('../../utils/contactGuard');
const { briefTitle } = require('../services/briefFields');

/** The sender's own messages in a room from the last hour, oldest first. */
const recentOwnMessages = async (roomId, senderId, { before = null } = {}) => {
  const result = await query(
    `SELECT content FROM messages
     WHERE room_id = $1 AND sender_id = $2 AND is_deleted = false AND content IS NOT NULL
       AND created_at > COALESCE($3::timestamptz, NOW()) - INTERVAL '60 minutes'
       AND ($3::timestamptz IS NULL OR created_at < $3::timestamptz)
     ORDER BY created_at DESC LIMIT 12`,
    [roomId, senderId, before]
  );
  return result.rows.map((row) => row.content).reverse();
};

// Redis keys
const PRESENCE_KEY  = (userId)  => `presence:${userId}`;
const PRESENCE_TTL  = 120;       // seconds — refreshed on every activity
const CHAT_CHANNEL  = (roomId)  => `chat:${roomId}`;

// ── Room Management ───────────────────────────────────────────────────────────

/**
 * Create a chat room when a job is assigned.
 * Called from negotiation.service.js after adminApproveDeal.
 */
const createChatRoom = async ({ jobId, clientId, freelancerId, designerId, clientWaNumber = null, mmWaNumberId = null }) => {
  const creativeParticipantId = freelancerId || designerId;
  if (!creativeParticipantId) throw new AppError('A designer or freelancer is required for project chat', 400);
  const existing = await query(
    'SELECT * FROM chat_rooms WHERE job_id = $1',
    [jobId]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].freelancer_id !== creativeParticipantId) {
      const updated = await query(
        `UPDATE chat_rooms
         SET freelancer_id = $2, is_active = true
         WHERE job_id = $1
         RETURNING *`,
        [jobId, creativeParticipantId]
      );
      await query(`UPDATE wa_sessions SET state = 'active_job_chat' WHERE job_id = $1`, [jobId]);
      return updated.rows[0];
    }
    await query(`UPDATE wa_sessions SET state = 'active_job_chat' WHERE job_id = $1`, [jobId]);
    return existing.rows[0];
  }

  const result = await query(
    `INSERT INTO chat_rooms
       (job_id, client_id, freelancer_id, client_wa_number, mm_wa_number_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [jobId, clientId, creativeParticipantId, clientWaNumber, mmWaNumberId]
  );

  logger.info('Chat room created', { jobId, clientId, creativeParticipantId });
  await query(`UPDATE wa_sessions SET state = 'active_job_chat' WHERE job_id = $1`, [jobId]);
  return result.rows[0];
};

/**
 * Get a room by ID — validates the requester is a participant.
 */
const getRoomById = async (roomId, requesterId, requesterRole) => {
  const result = await query(
    `SELECT
       cr.*,
       j.title AS job_title, j.status AS job_status,
       u_c.full_name AS client_name,
       u_f.full_name AS freelancer_display_name,
       wn.display_name AS mm_channel_name
     FROM chat_rooms cr
     JOIN jobs j ON j.id = cr.job_id
     JOIN users u_c ON u_c.id = cr.client_id
     JOIN users u_f ON u_f.id = cr.freelancer_id
     LEFT JOIN whatsapp_numbers wn ON wn.waba_phone_id = cr.mm_wa_number_id
     WHERE cr.id = $1`,
    [roomId]
  );

  const room = result.rows[0];
  if (!room) throw new AppError('Chat room not found', 404);

  if (requesterRole !== 'admin') {
    if (room.client_id !== requesterId && room.freelancer_id !== requesterId) {
      throw new AppError('You are not a participant in this chat room', 403);
    }
  }

  // Mask freelancer identity from client — client always sees the managed CREATYV channel.
  if (requesterRole === 'client') {
    delete room.freelancer_id;
    delete room.freelancer_display_name;
    room.other_party_name = room.mm_channel_name || 'CREATYV';
  }

  return room;
};

/**
 * Get all chat rooms for the current user.
 */
const getMyRooms = async (userId, role) => {
  // Loading the room list means the app received what's waiting (second grey tick).
  markDelivered(userId, role).catch((err) => logger.warn('markDelivered failed', { userId, error: err.message }));
  const accessClause = role === 'admin'
    ? '($1::uuid IS NOT NULL)'
    : role === 'client'
      ? 'cr.client_id = $1'
      : ['freelancer', 'designer'].includes(role)
        ? 'cr.freelancer_id = $1'
        : 'false';

  const result = await query(
    `SELECT
       cr.id, cr.job_id, cr.is_active,
       cr.last_message_at, cr.last_message_preview,
       j.title AS job_title, j.status AS job_status,
       sb.id AS booking_id, sb.brief,
       u_c.full_name AS client_name,
       CASE WHEN $2 = 'client' THEN NULL ELSE u_f.full_name END AS freelancer_name,
       -- The other person's photo: the freelancer's for a client, the client's for everyone else.
       CASE WHEN $2 = 'client' THEN u_f.avatar_url ELSE u_c.avatar_url END AS counterpart_avatar,
       wn.display_name AS mm_channel_name,
       -- Unread count for this user
       (SELECT COUNT(*) FROM messages m
        WHERE m.room_id = cr.id
          AND m.is_deleted = false
          AND CASE WHEN $2 = 'admin' THEN false
                   WHEN $2 = 'client'
                   THEN m.read_by_client = false AND m.sender_role != 'client'
                   ELSE m.read_by_freelancer = false AND m.sender_role != 'freelancer'
              END
       ) AS unread_count
     FROM chat_rooms cr
     JOIN jobs j ON j.id = cr.job_id
     JOIN users u_c ON u_c.id = cr.client_id
     JOIN users u_f ON u_f.id = cr.freelancer_id
     LEFT JOIN whatsapp_numbers wn ON wn.waba_phone_id = cr.mm_wa_number_id
     LEFT JOIN LATERAL (
       SELECT b.id, b.brief FROM service_bookings b WHERE b.job_id = cr.job_id LIMIT 1
     ) sb ON true
     WHERE ${accessClause}
     ORDER BY cr.last_message_at DESC NULLS LAST`,
    [userId, role]
  );

  // Rooms are named after what the client asked for, not the service or the person.
  return result.rows.map(({ brief, ...row }) => ({ ...row, brief_title: briefTitle(brief) }));
};

const searchMessages = async (userId, role, term, roomId = null) => {
  const needle = String(term || '').trim();
  if (needle.length < 2) return [];
  const accessClause = role === 'admin'
    ? '($1::uuid IS NOT NULL)'
    : role === 'client'
      ? 'cr.client_id = $1'
      : ['freelancer', 'designer'].includes(role)
        ? 'cr.freelancer_id = $1'
        : 'false';
  const result = await query(
    `SELECT m.id, m.room_id, m.content, m.sender_role, m.created_at,
            j.title AS job_title, cr.last_message_at
     FROM messages m
     JOIN chat_rooms cr ON cr.id = m.room_id
     JOIN jobs j ON j.id = cr.job_id
     WHERE ${accessClause}
       AND ($2::uuid IS NULL OR cr.id = $2)
       AND m.is_deleted = false
       AND m.content ILIKE $3
     ORDER BY m.created_at DESC
     LIMIT 100`,
    [userId, roomId || null, `%${needle.replace(/[\\%_]/g, '\\$&')}%`]
  );
  return result.rows;
};

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Get paginated messages for a room.
 */
const getMessages = async (roomId, requesterId, requesterRole, { page = 1, limit = 50 } = {}) => {
  // Validate access
  await getRoomById(roomId, requesterId, requesterRole);

  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT
       m.id, m.room_id, m.sender_role, m.content, m.channel,
       m.attachment_url, m.attachment_type,
       m.wa_status, m.is_deleted,
       m.read_by_client, m.read_by_freelancer,
       m.read_at_client, m.read_at_freelancer,
       m.delivered_at_client, m.delivered_at_freelancer,
       m.created_at, m.edited_at,
       m.file_id,
       mf.original_name AS file_name, mf.mime_type AS file_mime, mf.size_bytes AS file_size,
       mf.purpose AS file_purpose, mf.status AS file_status, mf.revision_round AS file_revision_round,
       CASE WHEN mf.share_revoked_at IS NULL THEN mf.share_token END AS file_token,
       -- Only reveal sender name to admin and the sender themselves
       CASE
         WHEN $3 = 'admin'      THEN u.full_name
         WHEN m.sender_role = 'client'     THEN u.full_name
         WHEN m.sender_role = 'freelancer' AND $3 IN ('freelancer', 'designer') THEN u.full_name
         WHEN m.sender_role = 'freelancer' AND $3 = 'client'     THEN 'CREATYV'
         WHEN m.sender_role = 'system'                           THEN 'CREATYV'
         ELSE 'CREATYV'
       END AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN mintbox_files mf ON mf.id = m.file_id
     WHERE m.room_id = $1 AND m.is_deleted = false
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $4`,
    [roomId, limit, requesterRole, offset]
  );

  // Mark messages as read
  setImmediate(async () => {
    try {
      let readResult = { rows: [] };
      if (requesterRole === 'client') {
        readResult = await query(
          `UPDATE messages
           SET read_by_client = true, read_at_client = NOW(),
               delivered_at_client = COALESCE(delivered_at_client, NOW())
           WHERE room_id = $1
             AND sender_role != 'client'
             AND read_by_client = false
           RETURNING id`,
          [roomId]
        );
      } else if (['freelancer', 'designer'].includes(requesterRole)) {
        readResult = await query(
          `UPDATE messages
           SET read_by_freelancer = true, read_at_freelancer = NOW(),
               delivered_at_freelancer = COALESCE(delivered_at_freelancer, NOW())
           WHERE room_id = $1
             AND sender_role != 'freelancer'
             AND read_by_freelancer = false
           RETURNING id`,
          [roomId]
        );
      }
      if (readResult.rows.length) {
        await publishRoomEvent(roomId, 'chat_read', {
          readerRole: requesterRole,
          messageIds: readResult.rows.map((row) => row.id),
        });
      }
    } catch (err) {
      logger.warn('Failed to mark messages as read', { roomId, error: err.message });
    }
  });

  return {
    messages: result.rows.reverse(), // return chronological order
    pagination: {
      page, limit,
    },
  };
};

/**
 * Send a message from the web app.
 * If the sender is the freelancer and the room has a client WA number,
 * the message is also bridged to WhatsApp through the managed CREATYV channel.
 */
const sendMessage = async (roomId, senderId, senderRole, { content, attachment_url, attachment_type }) => {
  if (senderRole === 'admin') throw new AppError('Admins can view chats but cannot send participant messages', 403);
  if (!content && !attachment_url) {
    throw new AppError('content or attachment is required', 400);
  }
  if (attachment_url && !String(attachment_url).includes('/mintbox/file/')) {
    throw new AppError('Chat attachments must use a Mintbox file share link', 400);
  }

  // Fetch room
  const roomResult = await query(
    `SELECT cr.*, wn.waba_phone_id, j.metadata AS job_metadata
     FROM chat_rooms cr
     LEFT JOIN whatsapp_numbers wn ON wn.waba_phone_id = cr.mm_wa_number_id
     JOIN jobs j ON j.id = cr.job_id
     WHERE cr.id = $1`,
    [roomId]
  );
  const room = roomResult.rows[0];
  if (!room) throw new AppError('Chat room not found', 404);
  if (!room.is_active) throw new AppError('This chat room is no longer active', 400);

  // Validate participant
  if (senderRole !== 'admin') {
    if (room.client_id !== senderId && room.freelancer_id !== senderId) {
      throw new AppError('You are not a participant in this room', 403);
    }
  }
  const persistedSenderRole = senderRole === 'designer' ? 'freelancer' : senderRole;

  if (attachment_url && persistedSenderRole === 'freelancer') {
    throw new AppError('Use Send first draft to submit MP4 work for moderation', 403);
  }

  if (content) {
    // The sender's recent messages too, so a number can't go out a few digits at a time.
    const previous = await recentOwnMessages(roomId, senderId);
    assertNoContactInfo(content, { userId: senderId, role: senderRole, where: 'chat', previous });
  }

  // Insert message
  const msgResult = await query(
    `INSERT INTO messages
       (room_id, sender_id, sender_role, content, channel,
        attachment_url, attachment_type,
        read_by_client, read_by_freelancer)
     VALUES ($1, $2, $3, $4, 'web', $5, $6, $7, $8)
     RETURNING *`,
    [
      roomId,
      senderId,
      persistedSenderRole,
      content || '',
      attachment_url || null,
      attachment_type || null,
      persistedSenderRole === 'client',
      persistedSenderRole === 'freelancer',
    ]
  );
  const message = msgResult.rows[0];

  await require('../notifications/notification.service').createNotification({
    userId: senderId === room.client_id ? room.freelancer_id : room.client_id,
    type: 'system', title: 'New message on Creatyv',
    body: 'Open your order conversation to read the latest message.',
    entityType: 'job', entityId: room.job_id,
    data: { notification_event: 'chat_message', room_id: roomId, job_id: room.job_id, message_id: message.id, actor_id: senderId },
    dedupeKey: `chat-message:${message.id}`,
  });

  // Update room preview
  await query(
    `UPDATE chat_rooms
     SET last_message_at      = NOW(),
         last_message_preview = $1
     WHERE id = $2`,
    [content ? content.slice(0, 100) : `[${attachment_type || 'attachment'}]`, roomId]
  );

  // Publish to Redis for web SSE
  await publishMessageToRoom(roomId, message, persistedSenderRole);

  // WhatsApp bridge — freelancer messages go to the client's WhatsApp through CREATYV.
  if (
    persistedSenderRole === 'freelancer' &&
    room.client_wa_number &&
    room.mm_wa_number_id
  ) {
    setImmediate(async () => {
      try {
        if (attachment_url && attachment_type) {
          await sendMediaMessage(
            room.mm_wa_number_id,
            room.client_wa_number,
            attachment_url,
            attachment_type,
            content || ''
          );
        } else {
          await sendTextMessage(
            room.mm_wa_number_id,
            room.client_wa_number,
            content,
            room.whatsapp_thread_id
          );
        }
      } catch (err) {
        logger.error('WhatsApp bridge failed (web→WA)', {
          roomId, error: err.message,
        });
      }
    });
  }

  return message;
};

// How long after sending a message its author can still change the text.
const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Edit the text of your own message (or a file's caption) within two hours
 * of sending it. The message keeps its time and gets an "Edited" mark.
 */
const editMessage = async (messageId, editorId, editorRole, { content }) => {
  const text = String(content || '').trim();
  if (!text) throw new AppError('Message text cannot be empty', 400);
  if (text.length > 4000) throw new AppError('Message is too long', 400);

  const found = await query(
    `SELECT m.id, m.room_id, m.sender_id, m.sender_role, m.content, m.created_at, m.is_deleted,
            (cr.last_message_at <= m.created_at) AS is_latest
     FROM messages m
     JOIN chat_rooms cr ON cr.id = m.room_id
     WHERE m.id = $1`,
    [messageId]
  );
  const message = found.rows[0];
  if (!message || message.is_deleted) throw new AppError('Message not found', 404);
  if (message.sender_id !== editorId || message.sender_role === 'system') {
    throw new AppError('You can only edit your own messages', 403);
  }
  if (Date.now() - new Date(message.created_at).getTime() > EDIT_WINDOW_MS) {
    throw new AppError('Messages can only be edited within 2 hours of sending', 409);
  }
  if (text === (message.content || '').trim()) return message;

  // An edit must not sneak in contact details the original send would have blocked.
  const previous = await recentOwnMessages(message.room_id, editorId, { before: message.created_at });
  assertNoContactInfo(text, { userId: editorId, role: editorRole, where: 'chat_edit', previous });

  const updated = await query(
    `UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *`,
    [text, messageId]
  );
  if (message.is_latest) {
    await query('UPDATE chat_rooms SET last_message_preview = $1 WHERE id = $2', [text.slice(0, 100), message.room_id]);
  }
  await publishMessageToRoom(message.room_id, updated.rows[0], message.sender_role);
  return updated.rows[0];
};

const appendSystemMessageByJob = async (jobId, content) => {
  const roomResult = await query(
    'SELECT id FROM chat_rooms WHERE job_id = $1 AND is_active = true',
    [jobId]
  );
  const room = roomResult.rows[0];
  if (!room) return null;
  const result = await query(
    `INSERT INTO messages
       (room_id, sender_id, sender_role, content, channel, read_by_client, read_by_freelancer)
     VALUES ($1, NULL, 'system', $2, 'web', false, false)
     RETURNING *`,
    [room.id, content]
  );
  await query(
    `UPDATE chat_rooms
     SET last_message_at = NOW(), last_message_preview = $1
     WHERE id = $2`,
    [content.slice(0, 100), room.id]
  );
  await publishMessageToRoom(room.id, result.rows[0], 'system');
  return result.rows[0];
};

// Keep long service briefs readable in chat by posting each section as its own bubble.
const appendSystemMessagesByJob = async (jobId, contents = []) => {
  const messages = contents.map((content) => String(content || '').trim()).filter(Boolean);
  if (!messages.length) return [];
  const roomResult = await query(
    'SELECT id FROM chat_rooms WHERE job_id = $1 AND is_active = true',
    [jobId]
  );
  const room = roomResult.rows[0];
  if (!room) return [];
  const inserted = [];
  for (const content of messages) {
    const result = await query(
      `INSERT INTO messages
         (room_id, sender_id, sender_role, content, channel, read_by_client, read_by_freelancer)
       VALUES ($1, NULL, 'system', $2, 'web', false, false)
       RETURNING *`,
      [room.id, content]
    );
    inserted.push(result.rows[0]);
    await publishMessageToRoom(room.id, result.rows[0], 'system');
  }
  const last = messages[messages.length - 1];
  await query(
    `UPDATE chat_rooms SET last_message_at = NOW(), last_message_preview = $1 WHERE id = $2`,
    [last.slice(0, 100), room.id]
  );
  return inserted;
};

/**
 * Posts text in the client's own name, one bubble each, as if they typed it: used for the brief
 * they wrote at checkout, which was already checked for contact details when they saved it.
 */
const postClientMessagesByJob = async (jobId, clientId, contents = []) => {
  const messages = contents.map((content) => String(content || '').trim()).filter(Boolean);
  if (!messages.length) return [];
  const roomResult = await query('SELECT id FROM chat_rooms WHERE job_id = $1 AND is_active = true LIMIT 1', [jobId]);
  const roomId = roomResult.rows[0]?.id;
  if (!roomId) return [];
  const inserted = [];
  for (const content of messages) {
    const result = await query(
      `INSERT INTO messages
         (room_id, sender_id, sender_role, content, channel, read_by_client, read_by_freelancer, delivered_at_client)
       VALUES ($1, $2, 'client', $3, 'web', true, false, NOW())
       RETURNING *`,
      [roomId, clientId, content]
    );
    inserted.push(result.rows[0]);
    await publishMessageToRoom(roomId, result.rows[0], 'client');
  }
  await query(
    'UPDATE chat_rooms SET last_message_at = NOW(), last_message_preview = $1 WHERE id = $2',
    [messages[messages.length - 1].slice(0, 100), roomId]
  );
  return inserted;
};

/**
 * Receive a message FROM WhatsApp (incoming webhook payload).
 * Routes to the correct room based on sender's WA number + MM number used.
 * Persists the message and pushes to web via Redis pub/sub.
 */
const receiveWhatsAppMessage = async ({
  fromNumber,       // client's WA number (E.164)
  toPhoneNumberId,  // MM number that received the message (waba_phone_id)
  waMessageId,
  content,
  mediaUrl,
  mediaType,
  timestamp,
}) => {
  // Find the chat room for this WA thread
  const roomResult = await query(
    `SELECT * FROM chat_rooms
     WHERE client_wa_number = $1
       AND mm_wa_number_id  = $2
       AND is_active         = true
     LIMIT 1`,
    [fromNumber, toPhoneNumberId]
  );

  let room = roomResult.rows[0];

  // If no room found — this is a new client reaching out via WhatsApp
  if (!room) {
    await handleNewWhatsAppContact(fromNumber, toPhoneNumberId, content);
    return { routed: false, reason: 'new_contact_flow_initiated' };
  }

  // Deduplicate — WA may deliver the same message twice
  const duplicate = await query(
    'SELECT id FROM messages WHERE wa_message_id = $1',
    [waMessageId]
  );
  if (duplicate.rows[0]) {
    logger.debug('WhatsApp duplicate message ignored', { waMessageId });
    return { routed: false, reason: 'duplicate' };
  }

  // Insert message
  const msgResult = await query(
    `INSERT INTO messages
       (room_id, sender_id, sender_role, content, channel,
        attachment_url, attachment_type,
        wa_message_id, wa_status,
        read_by_client, read_by_freelancer)
     VALUES ($1, $2, 'client', $3, 'whatsapp', $4, $5, $6, 'delivered', true, false)
     RETURNING *`,
    [
      room.id,
      room.client_id,
      content || '',
      mediaUrl || null,
      mediaType || null,
      waMessageId,
    ]
  );
  const message = msgResult.rows[0];

  // Update room
  await query(
    `UPDATE chat_rooms
     SET last_message_at      = NOW(),
         last_message_preview = $1,
         whatsapp_thread_id   = $2
     WHERE id = $3`,
    [
      content ? content.slice(0, 100) : `[${mediaType || 'media'}]`,
      waMessageId,
      room.id,
    ]
  );

  // Mark WA message as read (send read receipt back to client)
  setImmediate(() => markAsRead(toPhoneNumberId, waMessageId));

  // Push to web app via Redis pub/sub
  await publishMessageToRoom(room.id, message, 'client');

  return { routed: true, room_id: room.id, message_id: message.id };
};

/**
 * Handle a new WhatsApp contact — someone messaged a MM number for the first time.
 * This is out-of-job-context messaging — we log it and can later build
 * an onboarding flow here (Phase 8+).
 *
 * For now: save the contact and send a welcome message.
 */
const handleNewWhatsAppContact = async (fromNumber, toPhoneNumberId, firstMessage) => {
  // Find which MM channel they messaged
  const channelResult = await query(
    `SELECT * FROM whatsapp_numbers WHERE waba_phone_id = $1`,
    [toPhoneNumberId]
  );
  const channel = channelResult.rows[0];
  if (!channel) return;

  // Check if user exists with this WA number
  const userResult = await query(
    `SELECT id, full_name FROM users WHERE whatsapp_number = $1`,
    [fromNumber]
  );
  const user = userResult.rows[0];

  const { sendWelcomeTemplate } = require('./whatsapp.service');
  await sendWelcomeTemplate(
    toPhoneNumberId,
    fromNumber,
    user?.full_name || 'there',
    channel.display_name
  );

  logger.info('New WhatsApp contact — welcome sent', {
    fromNumber,
    channel: channel.display_name,
    isRegistered: !!user,
  });
};

// ── Receipts & file messages ──────────────────────────────────────────────────

/**
 * Marks every message waiting for this user as delivered (second grey tick).
 * Called whenever their app checks in, whether or not the chat is open.
 */
const markDelivered = async (userId, role) => {
  const side = role === 'client' ? 'client' : ['freelancer', 'designer'].includes(role) ? 'freelancer' : null;
  if (!side) return 0;
  const result = await query(
    `UPDATE messages m
     SET delivered_at_${side} = NOW()
     FROM chat_rooms cr
     WHERE cr.id = m.room_id
       AND cr.${side}_id = $1
       AND m.sender_role <> $2
       AND m.delivered_at_${side} IS NULL
       AND m.is_deleted = false`,
    [userId, side]
  );
  return result.rowCount;
};

const attachmentKind = (mime = '') => {
  const type = String(mime).split('/')[0];
  return ['image', 'video', 'audio'].includes(type) ? type : 'document';
};

/**
 * Posts a participant message carrying a Mintbox file (a delivery or a client
 * reference), so the file sits in the conversation with its caption.
 */
const postFileMessage = async ({ jobId, senderId, senderRole, file, caption = '' }) => {
  const roomResult = await query('SELECT id FROM chat_rooms WHERE job_id = $1 AND is_active = true LIMIT 1', [jobId]);
  const roomId = roomResult.rows[0]?.id;
  if (!roomId) return null;
  const role = senderRole === 'designer' ? 'freelancer' : senderRole;
  const text = String(caption || '').trim();
  const kind = attachmentKind(file.mime_type);
  const now = new Date();
  const inserted = await query(
    `INSERT INTO messages
       (room_id, sender_id, sender_role, content, channel, attachment_url, attachment_type, file_id,
        read_by_client, read_by_freelancer, delivered_at_client, delivered_at_freelancer)
     VALUES ($1, $2, $3, $4, 'web', $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      roomId, senderId, role, text,
      file.share_token ? `/mintbox/file/${file.share_token}` : null,
      kind, file.id,
      role === 'client', role === 'freelancer',
      role === 'client' ? now : null, role === 'freelancer' ? now : null,
    ]
  );
  const message = inserted.rows[0];
  const preview = text || (kind === 'document' ? `📎 ${file.original_name}` : `📎 ${kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'Audio'}`);
  await query('UPDATE chat_rooms SET last_message_at = NOW(), last_message_preview = $1 WHERE id = $2', [preview.slice(0, 100), roomId]);
  await publishMessageToRoom(roomId, message, role);
  return message;
};

// ── Presence ──────────────────────────────────────────────────────────────────

const setOnline = async (userId) => {
  try {
    const redis = getRedis();
    await redis.set(PRESENCE_KEY(userId), '1', 'EX', PRESENCE_TTL);
    await query(
      `UPDATE user_presence SET is_online = true, last_seen_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  } catch (err) {
    logger.warn('setOnline failed', { userId, error: err.message });
  }
};

const setOffline = async (userId) => {
  try {
    const redis = getRedis();
    await redis.del(PRESENCE_KEY(userId));
    await query(
      `UPDATE user_presence SET is_online = false, last_seen_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  } catch (err) {
    logger.warn('setOffline failed', { userId, error: err.message });
  }
};

const getPresence = async (userId) => {
  try {
    const redis = getRedis();
    const live  = await redis.get(PRESENCE_KEY(userId));
    if (live) return { is_online: true };

    const result = await query(
      'SELECT is_online, last_seen_at FROM user_presence WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || { is_online: false, last_seen_at: null };
  } catch (err) {
    return { is_online: false };
  }
};

// ── Redis pub/sub for web real-time ───────────────────────────────────────────

const CHAT_REDIS_CHANNEL = 'mint_more:chat';

const publishRoomEvent = async (roomId, eventType, payload = {}) => {
  try {
    const recipients = await query(
      `SELECT client_id AS user_id FROM chat_rooms WHERE id = $1
       UNION
       SELECT freelancer_id AS user_id FROM chat_rooms WHERE id = $1
       UNION
       SELECT id AS user_id FROM users WHERE role = 'admin' AND is_active = true`,
      [roomId]
    );
    const redis = getRedis();
    await redis.publish(
      CHAT_REDIS_CHANNEL,
      JSON.stringify({ eventType, roomId, ...payload, recipientIds: recipients.rows.map((row) => row.user_id) })
    );
  } catch (err) {
    logger.warn('Chat Redis publish failed', { roomId, error: err.message });
  }
};

const publishMessageToRoom = (roomId, message, senderRole) =>
  publishRoomEvent(roomId, 'chat_message', { message, senderRole });

// ── Admin: seed WhatsApp numbers ──────────────────────────────────────────────

const getWhatsAppNumbers = async () => {
  const result = await query(
    `SELECT wn.*, c.name AS category_name
     FROM whatsapp_numbers wn
     LEFT JOIN categories c ON c.id = wn.category_id
     ORDER BY wn.display_name ASC`
  );
  return result.rows;
};

const upsertWhatsAppNumber = async ({ categoryId, displayName, phoneNumber, wabaPhoneId }) => {
  const result = await query(
    `INSERT INTO whatsapp_numbers
       (category_id, display_name, phone_number, waba_phone_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (waba_phone_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       phone_number = EXCLUDED.phone_number,
       category_id  = EXCLUDED.category_id
     RETURNING *`,
    [categoryId || null, displayName, phoneNumber, wabaPhoneId]
  );
  return result.rows[0];
};

module.exports = {
  CHAT_REDIS_CHANNEL,
  markDelivered,
  postFileMessage,
  createChatRoom,
  getRoomById,
  getMyRooms,
  searchMessages,
  getMessages,
  sendMessage,
  editMessage,
  appendSystemMessageByJob,
  appendSystemMessagesByJob,
  postClientMessagesByJob,
  receiveWhatsAppMessage,
  setOnline,
  setOffline,
  getPresence,
  getWhatsAppNumbers,
  upsertWhatsAppNumber,
};
