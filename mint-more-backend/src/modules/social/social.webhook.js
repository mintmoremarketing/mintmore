const crypto  = require('crypto');
const { query } = require('../../config/database');
const env     = require('../../config/env');
const logger  = require('../../utils/logger');

/**
 * Verify Facebook webhook signature.
 * Same pattern as WhatsApp webhook.
 */
const verifyFacebookWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', env.social.facebook.appSecret)
    .update(rawBody)
    .digest('hex')}`;
  return expected === signature;
};

/**
 * GET /api/v1/social/webhook/facebook
 * Meta verification handshake.
 */
const verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.social.facebook.webhookVerifyToken) {
    logger.info('Facebook social webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ message: 'Verification failed' });
};

/**
 * POST /api/v1/social/webhook/facebook
 * Receives FB/IG events:
 *   - Post published confirmation
 *   - Token invalidation (user revoked app)
 *   - Page removal
 */
const handleWebhook = async (req, res) => {
  // Always respond 200 immediately
  res.status(200).json({ status: 'ok' });

  const signature = req.headers['x-hub-signature-256'];
  if (!verifyFacebookWebhookSignature(req.rawBody, signature)) {
    logger.warn('Facebook social webhook: signature mismatch');
    return;
  }

  try {
    const body = JSON.parse(req.rawBody);

    for (const entry of body.entry || []) {
      // Handle token/permission revocation
      if (entry.permission) {
        await handlePermissionRevocation(entry);
        continue;
      }

      // Handle page feed changes
      for (const change of entry.changes || []) {
        if (change.field === 'feed') {
          await handleFeedChange(entry.id, change.value);
        }
        if (change.field === 'instagram') {
          await handleInstagramChange(entry.id, change.value);
        }
      }
    }
  } catch (err) {
    logger.error('Facebook social webhook processing error', { error: err.message });
  }
};

const handlePermissionRevocation = async (entry) => {
  const userId = entry.uid;
  logger.info('Facebook permission revoked', { userId });

  // Mark all accounts for this FB user as inactive
  await query(
    `UPDATE social_accounts
     SET is_active = false, last_error = 'Permission revoked by user'
     WHERE platform_user_id = $1 AND platform IN ('facebook','instagram')`,
    [userId]
  );
};

const handleFeedChange = async (pageId, value) => {
  if (value.verb === 'add' && value.post_id) {
    // Post was published — update our record
    await query(
      `UPDATE social_post_platforms
       SET platform_post_id = $1, status = 'published'
       WHERE platform_post_id = $1 OR platform_post_id IS NULL`,
      [value.post_id]
    );
  }
};

const handleInstagramChange = async (igAccountId, value) => {
  logger.info('Instagram change received', { igAccountId, value });
  // Future: handle comment events, mention events, etc.
};

module.exports = { verifyWebhook, handleWebhook };
