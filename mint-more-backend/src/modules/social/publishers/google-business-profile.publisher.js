const { google } = require('googleapis');
const axios      = require('axios');
const env        = require('../../../config/env');
const logger     = require('../../../utils/logger');

const getGoogleClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    env.social.googleBusinessProfile.clientId,
    env.social.googleBusinessProfile.clientSecret,
    env.social.googleBusinessProfile.redirectUri
  );
  auth.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });
  return auth;
};

/**
 * Publish a LocalPost to Google Business Profile.
 * Supports: updates (STANDARD), offers (OFFER), and events (EVENT).
 */
const publishToGoogleBusinessProfile = async (account, post, media) => {
  try {
    const auth = getGoogleClient(account.access_token, account.refresh_token);
    const credentials = await auth.getAccessToken();
    const token = credentials.token;

    if (!token) {
      throw new Error('Could not retrieve access token');
    }

    // Google resource path is stored in platform_user_id: e.g. "accounts/{accountId}/locations/{locationId}"
    const locationPath = account.platform_user_id;
    const url = `https://mybusinesspublishing.googleapis.com/v1/${locationPath}/localPosts`;

    const summary = post.caption || '';
    const postType = post.metadata?.gbp_post_type || 'STANDARD'; // STANDARD, EVENT, OFFER
    
    // Construct localPost request body
    const requestBody = {
      languageCode: 'en-US',
      summary,
      postType,
    };

    // Format media attachments
    if (media && media.length > 0) {
      requestBody.media = media.map((item) => ({
        mediaFormat: item.media_type === 'video' ? 'VIDEO' : 'PHOTO',
        sourceUrl: item.media_url,
      }));
    }

    // Support optional Call to Action (CTA) button
    if (post.metadata?.gbp_cta_type && post.metadata?.gbp_cta_url) {
      requestBody.callToAction = {
        actionType: post.metadata.gbp_cta_type, // BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL
        url: post.metadata.gbp_cta_url,
      };
    }

    // Support Offer details if postType is OFFER
    if (postType === 'OFFER' && post.metadata?.gbp_offer) {
      requestBody.offer = {
        couponCode: post.metadata.gbp_offer.coupon_code,
        redeemOnlineUrl: post.metadata.gbp_offer.redeem_url,
        termsConditions: post.metadata.gbp_offer.terms,
      };
    }

    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const localPost = response.data;
    const localPostId = localPost.name; // e.g. "accounts/{accountId}/locations/{locationId}/localPosts/{postId}"
    const searchUrl = localPost.searchUrl || `https://business.google.com/dashboard/l/${locationPath.split('/')[3]}`;

    logger.info('Google Business Profile publish success', { localPostId });
    return {
      platform_post_id:  localPostId,
      platform_post_url: searchUrl,
      platform_title:    post.title || summary.slice(0, 100),
    };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Google Business Profile publish failed', { error: msg });
    throw new Error(`Google Business Profile: ${msg}`);
  }
};

/**
 * Refresh Google Business Profile OAuth access token.
 */
const refreshGBPToken = async (account) => {
  try {
    const auth = new google.auth.OAuth2(
      env.social.googleBusinessProfile.clientId,
      env.social.googleBusinessProfile.clientSecret,
      env.social.googleBusinessProfile.redirectUri
    );
    auth.setCredentials({ refresh_token: account.refresh_token });

    const { credentials } = await auth.refreshAccessToken();
    return {
      access_token:     credentials.access_token,
      token_expires_at: new Date(credentials.expiry_date),
    };
  } catch (err) {
    logger.error('Google Business Profile token refresh failed', { error: err.message });
    return null;
  }
};

module.exports = { publishToGoogleBusinessProfile, refreshGBPToken };
