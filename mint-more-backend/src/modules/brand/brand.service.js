const { query } = require('../../config/database');
const { createSignedDownloadUrl } = require('../storage/app-storage.provider');
const AppError = require('../../utils/AppError');

const DEFAULT_BRAND_ASSETS = {
  palette: [],
  logos: [],
  references: [],
  photos: [],
  files: [],
};

const DEFAULT_GOOGLE_BUSINESS = {
  listing_name: '',
  place_id: '',
  formatted_address: '',
  phone: '',
  website: '',
  maps_url: '',
};

const DEFAULT_POSTING_PREFERENCES = {
  festival_mode: 'manual',
  content_mode: 'admin_first',
  approval_mode: 'app_or_whatsapp',
  publish_mode: 'managed',
  cadence: 'monthly',
};

let userColumnsCache = null;

const normalizeJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return value && typeof value === 'object' ? value : fallback;
};

const normalizeBrandAssets = (value) => {
  const assets = normalizeJson(value, DEFAULT_BRAND_ASSETS);
  return {
    ...DEFAULT_BRAND_ASSETS,
    ...assets,
    palette: Array.isArray(assets.palette) ? assets.palette : [],
    logos: Array.isArray(assets.logos) ? assets.logos : [],
    references: Array.isArray(assets.references) ? assets.references : [],
    photos: Array.isArray(assets.photos) ? assets.photos : [],
    files: Array.isArray(assets.files) ? assets.files : [],
  };
};

const normalizeGoogleBusiness = (value) => ({
  ...DEFAULT_GOOGLE_BUSINESS,
  ...normalizeJson(value, DEFAULT_GOOGLE_BUSINESS),
});

const normalizePostingPreferences = (value) => ({
  ...DEFAULT_POSTING_PREFERENCES,
  ...normalizeJson(value, DEFAULT_POSTING_PREFERENCES),
});

const resolveBrandAssetUrl = async (asset) => {
  if (!asset || typeof asset !== 'object') return asset;
  const storageRef = asset.storage_ref
    || (asset.url && typeof asset.url === 'object' ? asset.url : null)
    || null;

  if (!storageRef?.bucket || !storageRef?.path) return asset;

  const signedUrl = await createSignedDownloadUrl(storageRef.bucket, storageRef.path, 7 * 24 * 60 * 60);
  return {
    ...asset,
    storage_ref: storageRef,
    storage_path: asset.storage_path || storageRef.path,
    preview_url: signedUrl || asset.preview_url || null,
    url: signedUrl || asset.url || null,
  };
};

const resolveBrandAssetCollection = async (brandAssets) => {
  const assets = normalizeBrandAssets(brandAssets);
  const resolveList = async (list) => Promise.all(list.map(resolveBrandAssetUrl));
  return {
    ...assets,
    logos: await resolveList(assets.logos),
    references: await resolveList(assets.references),
    photos: await resolveList(assets.photos),
    files: await resolveList(assets.files),
  };
};

const getUserColumns = async () => {
  if (userColumnsCache) return userColumnsCache;
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  userColumnsCache = new Set(result.rows.map((row) => row.column_name));
  return userColumnsCache;
};

const buildUserSelect = async (alias = 'u') => {
  const columns = await getUserColumns();
  const desired = [
    'id', 'email', 'full_name', 'role', 'avatar_url',
    'business_name', 'business_type', 'address_line1', 'address_city', 'address_state', 'country',
    'customer_profile', 'brand_assets', 'google_business', 'posting_preferences',
    'kyc_status', 'kyc_level', 'created_at', 'updated_at',
  ];
  const selected = desired.filter((column) => columns.has(column));
  return selected.map((column) => `${alias}.${column}`).join(', ');
};

const hydrateBrandProfile = async (row) => ({
  ...row,
  brand_assets: await resolveBrandAssetCollection(row?.brand_assets),
  google_business: normalizeGoogleBusiness(row?.google_business),
  posting_preferences: normalizePostingPreferences(row?.posting_preferences),
});

const getBrandSummaryCounts = async (userId) => {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM social_accounts sa WHERE sa.user_id = $1 AND sa.is_active = true) AS connected_social_accounts,
       (SELECT COUNT(*) FROM social_posts sp WHERE sp.user_id = $1 AND sp.status = 'published') AS published_posts,
       (SELECT COUNT(*) FROM social_posts sp WHERE sp.user_id = $1) AS total_posts,
       (SELECT COUNT(*) FROM creative_tasks task WHERE task.client_id = $1 AND task.status <> 'cancelled') AS creative_tasks,
       (SELECT COUNT(*) FROM creative_events event WHERE event.status <> 'archived') AS calendar_items,
       (SELECT COUNT(*) FROM creative_requests request WHERE request.client_id = $1) AS requests,
       (SELECT COUNT(*) FROM mintbox_folders folder
          JOIN jobs job ON job.id = folder.job_id
         WHERE job.client_id = $1) AS mintbox_folders,
       (SELECT COUNT(*) FROM mintbox_files file
          JOIN mintbox_folders folder ON folder.id = file.folder_id
          JOIN jobs job ON job.id = folder.job_id
         WHERE job.client_id = $1) AS mintbox_files,
       (SELECT COUNT(*) FROM mintbox_brand_folders WHERE client_id = $1) AS brand_library_folders,
       (SELECT COUNT(*) FROM mintbox_brand_files WHERE client_id = $1 AND deleted_at IS NULL) AS brand_library_files,
       (SELECT COUNT(*) FROM social_post_platforms spp
          JOIN social_posts sp ON sp.id = spp.post_id
         WHERE sp.user_id = $1) AS platform_posts
     `,
    [userId]
  );
  return result.rows[0] || {};
};

const getBrandLibrary = async (clientId) => {
  const foldersResult = await query(
    `SELECT
       bf.id, bf.client_id, bf.name, bf.description, bf.storage_prefix, bf.storage_used,
       bf.created_at, bf.updated_at,
       COUNT(files.id)::INT AS file_count,
       MAX(files.created_at) AS last_file_at
     FROM mintbox_brand_folders bf
     LEFT JOIN mintbox_brand_files files ON files.folder_id = bf.id AND files.deleted_at IS NULL
     WHERE bf.client_id = $1
     GROUP BY bf.id
     ORDER BY bf.updated_at DESC, bf.created_at DESC`,
    [clientId]
  );

  const recentFiles = await query(
    `SELECT
       bf.id, bf.folder_id, bf.client_id, bf.original_name, bf.storage_bucket,
       bf.storage_path, bf.mime_type, bf.size_bytes, bf.media_type, bf.created_at,
       folder.name AS folder_name
     FROM mintbox_brand_files bf
     JOIN mintbox_brand_folders folder ON folder.id = bf.folder_id
     WHERE bf.client_id = $1 AND bf.deleted_at IS NULL
     ORDER BY bf.created_at DESC
     LIMIT 48`,
    [clientId]
  );

  const files = await Promise.all(recentFiles.rows.map(async (row) => {
    const previewUrl = row.storage_bucket && row.storage_path
      ? await createSignedDownloadUrl(row.storage_bucket, row.storage_path, 7 * 24 * 60 * 60)
      : null;
    return {
      ...row,
      preview_url: previewUrl,
      url: previewUrl,
      storage_ref: row.storage_bucket && row.storage_path
        ? { bucket: row.storage_bucket, path: row.storage_path }
        : null,
    };
  }));

  return {
    folders: foldersResult.rows,
    files,
  };
};

const listBrandWorkspaces = async ({ limit = 100, search = '' } = {}) => {
  const select = await buildUserSelect('u');
  const params = [limit];
  const searchClause = search
    ? `AND (u.full_name ILIKE $2 OR u.email ILIKE $2 OR u.business_name ILIKE $2)`
    : '';
  if (search) params.push(`%${search}%`);

  const result = await query(
    `SELECT
       ${select},
       (SELECT COUNT(*) FROM social_accounts sa WHERE sa.user_id = u.id AND sa.is_active = true) AS connected_social_accounts,
       (SELECT COUNT(*) FROM social_posts sp WHERE sp.user_id = u.id AND sp.status = 'published') AS published_posts,
       (SELECT COUNT(*) FROM creative_tasks task WHERE task.client_id = u.id AND task.status <> 'cancelled') AS creative_tasks,
       (SELECT COUNT(*) FROM mintbox_folders folder
          JOIN jobs job ON job.id = folder.job_id
         WHERE job.client_id = u.id) AS mintbox_folders,
       (SELECT COUNT(*) FROM mintbox_files file
          JOIN mintbox_folders folder ON folder.id = file.folder_id
          JOIN jobs job ON job.id = folder.job_id
         WHERE job.client_id = u.id) AS mintbox_files,
       (SELECT COUNT(*) FROM mintbox_brand_folders WHERE client_id = u.id) AS brand_library_folders,
       (SELECT COUNT(*) FROM mintbox_brand_files WHERE client_id = u.id AND deleted_at IS NULL) AS brand_library_files
     FROM users u
     WHERE u.role = 'client'
     ${searchClause}
     ORDER BY COALESCE(NULLIF(u.business_name, ''), u.full_name, u.email) ASC, u.created_at DESC
     LIMIT $1`,
    params
  );

  return {
    brands: await Promise.all(result.rows.map(async (row) => ({
      ...(await hydrateBrandProfile(row)),
      counts: {
        connected_social_accounts: Number(row.connected_social_accounts || 0),
        published_posts: Number(row.published_posts || 0),
        creative_tasks: Number(row.creative_tasks || 0),
        mintbox_folders: Number(row.mintbox_folders || 0),
        mintbox_files: Number(row.mintbox_files || 0),
        brand_library_folders: Number(row.brand_library_folders || 0),
        brand_library_files: Number(row.brand_library_files || 0),
      },
    }))),
  };
};

const getBrandWorkspace = async (userId) => {
  const select = await buildUserSelect('u');
  const [profileResult, socialAccounts, channelHistory, tasks, events, requests, folders, files, brandLibrary, posts, platformSummary, summaryCounts] = await Promise.all([
    query(`SELECT ${select} FROM users u WHERE u.id = $1 AND u.role = 'client'`, [userId]),
    query(
      `SELECT
         id, platform, platform_user_id, platform_username, platform_name, platform_avatar_url,
         page_id, page_name, instagram_account_id,
         is_active, last_used_at, last_error,
         token_expires_at, token_scope, created_at, updated_at,
         GREATEST(0, EXTRACT(DAY FROM (token_expires_at - NOW()))::INTEGER) AS token_days_remaining,
         CASE
           WHEN token_expires_at IS NULL THEN 'unknown'
           WHEN token_expires_at < NOW() THEN 'expired'
           WHEN token_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
           ELSE 'valid'
         END AS token_status
       FROM social_accounts
       WHERE user_id = $1
       ORDER BY platform ASC, platform_name ASC, created_at DESC`,
      [userId]
    ),
    query(
      `SELECT
         sa.id AS social_account_id,
         sa.platform,
         sa.platform_username,
         sa.platform_name,
         sa.platform_avatar_url,
         sa.page_id,
         sa.page_name,
         sa.instagram_account_id,
         sa.is_active,
         sa.last_used_at,
         sa.last_error,
         sa.token_expires_at,
         sa.token_scope,
         GREATEST(0, EXTRACT(DAY FROM (sa.token_expires_at - NOW()))::INTEGER) AS token_days_remaining,
         CASE
           WHEN sa.token_expires_at IS NULL THEN 'unknown'
           WHEN sa.token_expires_at < NOW() THEN 'expired'
           WHEN sa.token_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
           ELSE 'valid'
         END AS token_status,
         COUNT(spp.id) AS total_posts,
         COUNT(*) FILTER (WHERE spp.status = 'published') AS published_posts,
         COUNT(*) FILTER (WHERE spp.status = 'failed') AS failed_posts,
         MAX(COALESCE(spp.published_at, sp.publish_at, sp.created_at)) AS latest_activity_at,
         (array_agg(sp.id ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_post_id,
         (array_agg(sp.title ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_post_title,
         (array_agg(sp.caption ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_post_caption,
         (array_agg(sp.content_type ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_post_type,
         (array_agg(spp.platform_post_url ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_post_url,
         (array_agg(spp.views_count ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_views_count,
         (array_agg(spp.likes_count ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_likes_count,
         (array_agg(spp.comments_count ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_comments_count,
         (array_agg(spp.shares_count ORDER BY COALESCE(spp.published_at, sp.publish_at, sp.created_at) DESC NULLS LAST))[1] AS latest_shares_count
       FROM social_accounts sa
       LEFT JOIN social_post_platforms spp ON spp.social_account_id = sa.id
       LEFT JOIN social_posts sp ON sp.id = spp.post_id
       WHERE sa.user_id = $1
       GROUP BY sa.id
       ORDER BY sa.platform ASC, sa.platform_name ASC, sa.created_at DESC`,
      [userId]
    ),
    query(
      `SELECT
         task.*,
         job.title AS job_title,
         job.status AS job_status,
         job.deadline AS job_deadline,
         assignee.full_name AS assigned_to_name,
         folder.name AS folder_name,
         folder.share_token AS folder_share_token
       FROM creative_tasks task
       LEFT JOIN jobs job ON job.id = task.job_id
       LEFT JOIN users assignee ON assignee.id = task.assigned_to
       LEFT JOIN mintbox_folders folder ON folder.id = task.mintbox_folder_id
       WHERE task.client_id = $1
       ORDER BY task.created_at DESC
       LIMIT 30`,
      [userId]
    ),
    query(
      `SELECT
         event.*,
         category.name AS category_name,
         selection.id AS selection_id,
         selection.status AS selection_status,
         selection.task_id AS selection_task_id,
         task.status AS task_status,
         task.client_status
       FROM creative_events event
       LEFT JOIN categories category ON category.id = event.category_id
       LEFT JOIN client_event_selections selection
         ON selection.event_id = event.id AND selection.client_id = $1
       LEFT JOIN creative_tasks task ON task.id = selection.task_id
       WHERE event.status <> 'archived'
       ORDER BY event.event_date DESC, event.created_at DESC
       LIMIT 24`,
      [userId]
    ),
    query(
      `SELECT
         request.*,
         job.title AS job_title,
         job.status AS job_status,
         task.status AS task_status,
         task.client_status
       FROM creative_requests request
       LEFT JOIN jobs job ON job.id = request.job_id
       LEFT JOIN creative_tasks task ON task.id = request.task_id
       WHERE request.client_id = $1
       ORDER BY request.created_at DESC
       LIMIT 24`,
      [userId]
    ),
    query(
      `SELECT
         folder.id, folder.name, folder.parent_folder_id, folder.job_id,
         folder.share_token, folder.visibility, folder.status,
         folder.created_at, folder.updated_at,
         job.title AS job_title,
         job.status AS job_status
       FROM mintbox_folders folder
       JOIN jobs job ON job.id = folder.job_id
       WHERE job.client_id = $1
       ORDER BY folder.updated_at DESC, folder.created_at DESC
       LIMIT 24`,
      [userId]
    ),
    query(
      `SELECT
         file.id, file.name, file.original_name, file.storage_path, file.file_size_bytes,
         file.mime_type, file.media_type, file.status, file.purpose, file.created_at,
         folder.id AS folder_id,
         folder.name AS folder_name,
         folder.share_token AS folder_share_token,
         job.id AS job_id,
         job.title AS job_title,
         job.status AS job_status
       FROM mintbox_files file
       JOIN mintbox_folders folder ON folder.id = file.folder_id
       JOIN jobs job ON job.id = folder.job_id
       WHERE job.client_id = $1
       ORDER BY file.created_at DESC
       LIMIT 48`,
      [userId]
    ),
    getBrandLibrary(userId),
    query(
      `SELECT
         sp.id, sp.title, sp.caption, sp.content_type, sp.status,
         sp.publish_at, sp.published_at, sp.target_platforms,
         sp.queue_job_id, sp.source_job_id, sp.metadata,
         sp.created_at, sp.updated_at,
         (SELECT COUNT(*) FROM social_post_media media WHERE media.post_id = sp.id) AS media_count,
         (SELECT media.media_url
          FROM social_post_media media
          WHERE media.post_id = sp.id
          ORDER BY media.sort_order ASC, media.created_at ASC
          LIMIT 1) AS preview_media_url
       FROM social_posts sp
       WHERE sp.user_id = $1
       ORDER BY COALESCE(sp.published_at, sp.publish_at, sp.created_at) DESC
       LIMIT 24`,
      [userId]
    ),
    query(
      `SELECT
         spp.platform,
         COUNT(*) AS total_posts,
         COUNT(*) FILTER (WHERE spp.status = 'published') AS published_posts,
         COUNT(*) FILTER (WHERE spp.status = 'failed') AS failed_posts
       FROM social_post_platforms spp
       JOIN social_posts sp ON sp.id = spp.post_id
       WHERE sp.user_id = $1
       GROUP BY spp.platform
       ORDER BY spp.platform ASC`,
      [userId]
    ),
    getBrandSummaryCounts(userId),
  ]);

  const profile = profileResult.rows[0];
  if (!profile) throw new AppError('Brand not found', 404);

  return {
    profile: await hydrateBrandProfile(profile),
    counts: {
      connected_social_accounts: Number(summaryCounts.connected_social_accounts || 0),
      published_posts: Number(summaryCounts.published_posts || 0),
      total_posts: Number(summaryCounts.total_posts || 0),
      creative_tasks: Number(summaryCounts.creative_tasks || 0),
      calendar_items: Number(summaryCounts.calendar_items || 0),
      requests: Number(summaryCounts.requests || 0),
      mintbox_folders: Number(summaryCounts.mintbox_folders || 0),
      mintbox_files: Number(summaryCounts.mintbox_files || 0),
      brand_library_folders: Number(summaryCounts.brand_library_folders || 0),
      brand_library_files: Number(summaryCounts.brand_library_files || 0),
      platform_posts: Number(summaryCounts.platform_posts || 0),
    },
    social_accounts: socialAccounts.rows,
    channel_history: channelHistory.rows,
    tasks: tasks.rows,
    calendar: events.rows,
    requests: requests.rows,
    mintbox: {
      folders: folders.rows,
      files: files.rows,
    },
    brand_library: brandLibrary,
    posts: {
      posts: posts.rows,
      platform_summary: platformSummary.rows,
    },
  };
};

module.exports = {
  listBrandWorkspaces,
  getBrandWorkspace,
  hydrateBrandProfile,
};
