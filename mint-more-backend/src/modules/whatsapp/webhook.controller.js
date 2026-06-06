const crypto      = require('crypto');
const env         = require('../../config/env');
const chatService = require('../chat/chat.service');
const logger      = require('../../utils/logger');

/**
 * GET webhook — Meta verification handshake.
 * Meta sends hub.mode, hub.verify_token, hub.challenge.
 * We confirm our verify token and echo back the challenge.
 */
const verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification failed', { mode, token });
  return res.status(403).json({ message: 'Verification failed' });
};

/**
 * POST webhook — Incoming WhatsApp events.
 *
 * Meta sends all events here:
 *  - New messages (type: message)
 *  - Message status updates (type: status — sent/delivered/read/failed)
 *
 * We verify the X-Hub-Signature-256 header before processing.
 */
const handleWebhook = async (req, res) => {
  // ── Signature verification ───────────────────────────────────────────────────
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !env.whatsapp.appSecret) {
    logger.warn('WhatsApp webhook: missing signature or app secret');
    return res.status(401).json({ message: 'Missing signature' });
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', env.whatsapp.appSecret)
    .update(req.rawBody)
    .digest('hex')}`;

  if (expected !== signature) {
    logger.warn('WhatsApp webhook: signature mismatch');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  // ── Always respond 200 immediately ──────────────────────────────────────────
  // Meta will retry if we don't respond within 20 seconds
  res.status(200).json({ status: 'ok' });

  // After signature check, before processing

  // ── Process payload asynchronously ──────────────────────────────────────────
  try {
    const body = JSON.parse(req.rawBody);

    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const toPhoneNumberId = value.metadata?.phone_number_id;

        // ── Incoming messages ────────────────────────────────────────────────
        for (const msg of value.messages || []) {
          await processIncomingMessage(msg, toPhoneNumberId);
        }

        // ── Status updates (delivered / read / failed) ───────────────────────
        for (const status of value.statuses || []) {
          await processStatusUpdate(status);
        }
      }
    }
  } catch (err) {
    logger.error('WhatsApp webhook processing error', { 
      error:   err.message,
      stack:   err.stack,
      details: err,
    });
}
};

const { processMessage } = require('./conversation.service');

const processIncomingMessage = async (msg, toPhoneNumberId) => {
  const fromNumber  = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
  const waMessageId = msg.id;

  let content   = null;
  let mediaUrl  = null;
  let mediaType = null;

  if (msg.type === 'text') {
    content = msg.text?.body;
  } else if (['image', 'video', 'document', 'audio'].includes(msg.type)) {
    mediaType = msg.type;
    mediaUrl  = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${msg[msg.type]?.id}`;
    content   = msg[msg.type]?.caption || '';
  } else {
    logger.debug('Unsupported WA message type', { type: msg.type });
    return;
  }

  await processMessage({
    fromNumber,
    toPhoneNumberId,
    content,
    waMessageId,
    mediaUrl,
    mediaType,
  });
};

const processStatusUpdate = async (status) => {
  const { id: waMessageId, status: waStatus } = status;

  try {
    await require('../../config/database').query(
      `UPDATE messages SET wa_status = $1 WHERE wa_message_id = $2`,
      [waStatus, waMessageId]
    );
  } catch (err) {
    logger.warn('WA status update failed', { waMessageId, waStatus, error: err.message });
  }
};

module.exports = { verifyWebhook, handleWebhook };
