const { query, getClient } = require('../../config/database');
const { getRedis }         = require('../../config/redis');
const { sendTextMessage, sendMediaMessage, markAsRead } = require('./whatsapp.service');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');

// Redis keys
const PRESENCE_KEY  = (userId)  => `presence:${userId}`;
const PRESENCE_TTL  = 120;       // seconds — refreshed on every activity
const CHAT_CHANNEL  = (roomId)  => `chat:${roomId}`;

// ── Room Management ───────────────────────────────────────────────────────────

/**
 * Create a chat room when a job is assigned.
 * Called from negotiation.service.js after adminApproveDeal.
 */
const createChatRoom = async ({ jobId, clientId, freelancerId, clientWaNumber = null, mmWaNumberId = null }) => {
  const existing = await query(
    'SELECT * FROM chat_rooms WHERE job_id = $1',
    [jobId]
  );
  if (existing.rows[0]) {
    await query(`UPDATE wa_sessions SET state = 'active_job_chat' WHERE job_id = $1`, [jobId]);
    return existing.rows[0];
  }

  const result = await query(
    `INSERT INTO chat_rooms
       (job_id, client_id, freelancer_id, client_wa_number, mm_wa_number_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [jobId, clientId, freelancerId, clientWaNumber, mmWaNumberId]
  );

  logger.info('Chat room created', { jobId, clientId, freelancerId });
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
  const accessClause = role === 'admin'
    ? '($1::uuid IS NOT NULL)'
    : role === 'client'
      ? 'cr.client_id = $1'
      : 'cr.freelancer_id = $1';

  const result = await query(
    `SELECT
       cr.id, cr.job_id, cr.is_active,
       cr.last_message_at, cr.last_message_preview,
       j.title AS job_title, j.status AS job_status,
       u_c.full_name AS client_name,
       CASE WHEN $2 = 'client' THEN NULL ELSE u_f.full_name END AS freelancer_name,
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
     WHERE ${accessClause}
     ORDER BY cr.last_message_at DESC NULLS LAST`,
    [userId, role]
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
       m.created_at,
       -- Only reveal sender name to admin and the sender themselves
       CASE
         WHEN $3 = 'admin'      THEN u.full_name
         WHEN m.sender_role = 'client'     THEN u.full_name
         WHEN m.sender_role = 'freelancer' AND $3 = 'freelancer' THEN u.full_name
         WHEN m.sender_role = 'freelancer' AND $3 = 'client'     THEN 'CREATYV'
         WHEN m.sender_role = 'system'                           THEN 'CREATYV'
         ELSE 'CREATYV'
       END AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
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
           SET read_by_client = true, read_at_client = NOW()
           WHERE room_id = $1
             AND sender_role != 'client'
             AND read_by_client = false
           RETURNING id`,
          [roomId]
        );
      } else if (requesterRole === 'freelancer') {
        readResult = await query(
          `UPDATE messages
           SET read_by_freelancer = true, read_at_freelancer = NOW()
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
    `SELECT cr.*, wn.waba_phone_id
     FROM chat_rooms cr
     LEFT JOIN whatsapp_numbers wn ON wn.waba_phone_id = cr.mm_wa_number_id
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
      senderRole,
      content || '',
      attachment_url || null,
      attachment_type || null,
      senderRole === 'client',      // client messages are auto-read by client
      senderRole === 'freelancer',  // freelancer messages auto-read by freelancer
    ]
  );
  const message = msgResult.rows[0];

  // Update room preview
  await query(
    `UPDATE chat_rooms
     SET last_message_at      = NOW(),
         last_message_preview = $1
     WHERE id = $2`,
    [content ? content.slice(0, 100) : `[${attachment_type || 'attachment'}]`, roomId]
  );

  // Publish to Redis for web SSE
  await publishMessageToRoom(roomId, message, senderRole);

  // WhatsApp bridge — freelancer messages go to the client's WhatsApp through CREATYV.
  if (
    senderRole === 'freelancer' &&
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
  createChatRoom,
  getRoomById,
  getMyRooms,
  getMessages,
  sendMessage,
  appendSystemMessageByJob,
  receiveWhatsAppMessage,
  setOnline,
  setOffline,
  getPresence,
  getWhatsAppNumbers,
  upsertWhatsAppNumber,
};
