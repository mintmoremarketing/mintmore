const crypto = require('crypto');
const path = require('path');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const storage = require('../storage/mintbox-storage.provider');
const notificationService = require('../notifications/notification.service');
const { writeAudit } = require('../audit/audit.service');
const { assertNoContactInfo } = require('../../utils/contactGuard');
const { getProfileCompletion } = require('../profile/profile.service');

// Steps that must be done before a freelancer can take an assessment.
// "services" is left out on purpose: passing an assessment is how you earn them.
const REQUIRED_STEPS = ['basic', 'tools', 'posts', 'kyc'];
const DOWNLOAD_TTL_SECONDS = 60 * 60;

const ASSESSMENT_COLUMNS = `
  a.id, a.slug, a.title, a.summary, a.task_brief, a.task_guide, a.deliverables, a.expected_outcome,
  a.level, a.level_name, a.duration_minutes, a.max_attempts, a.retry_cooldown_days,
  a.allowed_formats, a.max_files, a.max_file_size_mb, a.required_items, a.evaluation_criteria,
  a.required_tools, a.languages, a.assets, a.unlock_slugs, a.is_active,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug`;

const ATTEMPT_COLUMNS = `
  t.id, t.assessment_id, t.freelancer_id, t.status, t.started_at, t.deadline_at, t.submitted_at,
  t.is_late, t.notes, t.score, t.criteria_scores, t.review_note, t.reviewed_at, t.created_at`;

const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86_400_000);

const profileGate = async (userId) => {
  const completion = await getProfileCompletion(userId);
  const missing = completion.steps.filter((step) => REQUIRED_STEPS.includes(step.key) && !step.done).map((step) => step.key);
  return { ready: missing.length === 0, missing };
};

/**
 * The single button state for one level, in priority order:
 * held → in_progress → submitted → profile_required → busy → cooldown → no_attempts_left → available.
 */
const deriveState = ({ assessment, attempts, openAttempt, gate }) => {
  const latest = attempts[0] || null;
  const used = attempts.length;
  if (attempts.some((attempt) => attempt.status === 'passed')) return { state: 'held', latest };
  if (latest?.status === 'in_progress') return { state: 'in_progress', latest };
  if (latest?.status === 'submitted') return { state: 'submitted', latest };
  if (!gate.ready) return { state: 'profile_required', latest };
  if (openAttempt && openAttempt.assessment_id !== assessment.id) return { state: 'busy', latest };
  if (used >= assessment.max_attempts) return { state: 'no_attempts_left', latest };
  if (latest && ['failed', 'closed'].includes(latest.status)) {
    const until = addDays(latest.reviewed_at || latest.submitted_at || latest.created_at, assessment.retry_cooldown_days);
    if (until > new Date()) return { state: 'cooldown', latest, cooldownUntil: until.toISOString() };
  }
  return { state: 'available', latest };
};

const loadAttemptsFor = async (userId) => {
  const result = await query(
    `SELECT ${ATTEMPT_COLUMNS} FROM assessment_attempts t
     WHERE t.freelancer_id = $1 ORDER BY t.created_at DESC`,
    [userId]
  );
  return result.rows;
};

const shapeLevel = (assessment, attempts, openAttempt, gate) => {
  const mine = attempts.filter((attempt) => attempt.assessment_id === assessment.id);
  const { state, latest, cooldownUntil } = deriveState({ assessment, attempts: mine, openAttempt, gate });
  return {
    ...assessment,
    state,
    attempts_used: mine.length,
    attempts_left: Math.max(0, assessment.max_attempts - mine.length),
    cooldown_until: cooldownUntil || null,
    latest_attempt: latest ? {
      id: latest.id, status: latest.status, started_at: latest.started_at, deadline_at: latest.deadline_at,
      submitted_at: latest.submitted_at, reviewed_at: latest.reviewed_at, score: latest.score,
    } : null,
  };
};

/** Every active assessment, grouped by category, with this freelancer's state per level. */
const listForFreelancer = async (userId) => {
  const [rows, attempts, gate] = await Promise.all([
    query(
      `SELECT ${ASSESSMENT_COLUMNS} FROM assessments a JOIN categories c ON c.id = a.category_id
       WHERE a.is_active ORDER BY c.sort_order, c.name, a.level`
    ),
    loadAttemptsFor(userId),
    profileGate(userId),
  ]);
  const openAttempt = attempts.find((attempt) => attempt.status === 'in_progress') || null;
  const categories = [];
  for (const row of rows.rows) {
    let category = categories.find((item) => item.id === row.category_id);
    if (!category) {
      category = { id: row.category_id, name: row.category_name, slug: row.category_slug, levels: [] };
      categories.push(category);
    }
    const level = shapeLevel(row, attempts, openAttempt, gate);
    category.levels.push({
      id: level.id, slug: level.slug, level: level.level, level_name: level.level_name, summary: level.summary,
      duration_minutes: level.duration_minutes, state: level.state, attempts_left: level.attempts_left,
      cooldown_until: level.cooldown_until, latest_attempt: level.latest_attempt,
    });
  }
  return { categories, profile: gate, open_attempt_id: openAttempt?.id || null };
};

const getAssessmentRow = async (slug, db = { query }) => {
  const result = await db.query(
    `SELECT ${ASSESSMENT_COLUMNS} FROM assessments a JOIN categories c ON c.id = a.category_id WHERE a.slug = $1`,
    [slug]
  );
  if (!result.rows[0] || !result.rows[0].is_active) throw new AppError('Assessment not found', 404);
  return result.rows[0];
};

const resolveUnlocks = async (slugs) => {
  if (!slugs?.length) return [];
  const result = await query(
    `SELECT slug, title, cover_url FROM service_templates WHERE slug = ANY($1) AND is_active`,
    [slugs]
  );
  return slugs.map((slug) => result.rows.find((row) => row.slug === slug)).filter(Boolean);
};

const getForFreelancer = async (slug, userId) => {
  const [assessment, attempts, gate] = await Promise.all([getAssessmentRow(slug), loadAttemptsFor(userId), profileGate(userId)]);
  const openAttempt = attempts.find((attempt) => attempt.status === 'in_progress') || null;
  const unlocks = await resolveUnlocks(assessment.unlock_slugs);
  return { ...shapeLevel(assessment, attempts, openAttempt, gate), unlocks, profile: gate };
};

const startAttempt = async (slug, userId) => {
  const detail = await getForFreelancer(slug, userId);
  if (detail.state === 'in_progress') return { attempt_id: detail.latest_attempt.id, resumed: true };
  const blocked = {
    held: 'You already hold this level',
    submitted: 'Your last attempt is still under review',
    profile_required: 'Complete your basic details, tools, posts and KYC first',
    busy: 'Finish the assessment you already started first',
    no_attempts_left: 'No attempts left for this level',
    cooldown: 'You can retake this level once the waiting period ends',
  }[detail.state];
  if (blocked) throw new AppError(blocked, 409);

  try {
    const result = await query(
      `INSERT INTO assessment_attempts (assessment_id, freelancer_id, deadline_at)
       VALUES ($1, $2, NOW() + make_interval(mins => $3))
       RETURNING id`,
      [detail.id, userId, detail.duration_minutes]
    );
    return { attempt_id: result.rows[0].id, resumed: false };
  } catch (err) {
    // assessment_attempts_one_open: a second tab started one a moment earlier.
    if (err.code === '23505') throw new AppError('Finish the assessment you already started first', 409);
    throw err;
  }
};

const signItems = async (items) => Promise.all(items.map(async (item) => {
  if (item.kind !== 'file' || item.status !== 'ready') return { ...item, storage_path: undefined };
  const url = await storage.createDownloadUrl(item.storage_path, DOWNLOAD_TTL_SECONDS).catch(() => null);
  return { ...item, url, storage_path: undefined };
}));

/** One attempt with its assessment and submitted items. Freelancers see their own; admins see any. */
const getAttempt = async (attemptId, userId, role) => {
  const result = await query(
    `SELECT ${ATTEMPT_COLUMNS}, a.slug AS assessment_slug, u.full_name AS freelancer_name, u.email AS freelancer_email
     FROM assessment_attempts t
     JOIN assessments a ON a.id = t.assessment_id
     JOIN users u ON u.id = t.freelancer_id
     WHERE t.id = $1`,
    [attemptId]
  );
  const attempt = result.rows[0];
  if (!attempt || (role !== 'admin' && attempt.freelancer_id !== userId)) throw new AppError('Attempt not found', 404);
  const assessment = (await query(
    `SELECT ${ASSESSMENT_COLUMNS} FROM assessments a JOIN categories c ON c.id = a.category_id WHERE a.slug = $1`,
    [attempt.assessment_slug]
  )).rows[0];
  const items = await query(
    `SELECT id, kind, name, url, storage_path, mime_type, size_bytes, status, created_at
     FROM assessment_attempt_items WHERE attempt_id = $1 AND status = 'ready' ORDER BY created_at`,
    [attemptId]
  );
  const unlocks = attempt.status === 'passed' ? await resolveUnlocks(assessment.unlock_slugs) : [];
  const nextLevel = attempt.status === 'passed'
    ? (await query(
      `SELECT level, level_name, slug FROM assessments WHERE category_id = $1 AND level > $2 AND is_active ORDER BY level LIMIT 1`,
      [assessment.category_id, assessment.level]
    )).rows[0] || null
    : null;
  const attemptsUsed = (await query(
    'SELECT COUNT(*)::int AS n FROM assessment_attempts WHERE assessment_id = $1 AND freelancer_id = $2',
    [assessment.id, attempt.freelancer_id]
  )).rows[0].n;
  const retryAt = ['failed', 'closed'].includes(attempt.status)
    ? addDays(attempt.reviewed_at || attempt.submitted_at || attempt.created_at, assessment.retry_cooldown_days).toISOString()
    : null;
  return {
    ...attempt,
    items: await signItems(items.rows),
    assessment,
    unlocks,
    next_level: nextLevel,
    attempts_left: Math.max(0, assessment.max_attempts - attemptsUsed),
    retry_at: retryAt,
  };
};

// Inside a transaction (a pooled client) the row is locked so item counts and submit can't race.
const getOwnOpenAttempt = async (attemptId, userId, db = { query }) => {
  const result = await db.query(
    `SELECT t.id, t.status, t.freelancer_id, a.max_files, a.max_file_size_mb, a.allowed_formats, a.title
     FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id
     WHERE t.id = $1 ${db.release ? 'FOR UPDATE OF t' : ''}`,
    [attemptId]
  );
  const attempt = result.rows[0];
  if (!attempt || attempt.freelancer_id !== userId) throw new AppError('Attempt not found', 404);
  if (attempt.status !== 'in_progress') throw new AppError('This attempt is no longer open for changes', 409);
  return attempt;
};

// Pending uploads hold a slot for 2 hours, long enough for a large video on a slow line.
// The page releases the slot itself when an upload fails.
const countItems = async (attemptId, db = { query }) => Number((await db.query(
  `SELECT COUNT(*)::int AS n FROM assessment_attempt_items
   WHERE attempt_id = $1 AND (status = 'ready' OR created_at > NOW() - INTERVAL '2 hours')`,
  [attemptId]
)).rows[0].n);

const safeName = (name) => String(name || 'file').replace(/[^\w.\- ()]+/g, '_').slice(0, 200);

/** Reserve a slot and hand back a signed upload, the same flow Mintbox uses. */
const prepareFileUpload = async (attemptId, userId, { name, size, type } = {}) => {
  if (!name || !Number(size)) throw new AppError('File name and size are required', 400);
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const attempt = await getOwnOpenAttempt(attemptId, userId, dbClient);
    const ext = path.extname(safeName(name)).replace('.', '').toUpperCase();
    if (attempt.allowed_formats?.length && !attempt.allowed_formats.includes(ext)) {
      throw new AppError(`Upload ${attempt.allowed_formats.join(', ')} files only`, 400);
    }
    const capMb = Math.min(attempt.max_file_size_mb, env.upload.mintboxMaxFileSizeMb);
    if (Number(size) > capMb * 1024 * 1024) throw new AppError(`Each file can be up to ${capMb >= 1024 ? `${+(capMb / 1024).toFixed(1)} GB` : `${capMb} MB`}`, 400);
    if (await countItems(attemptId, dbClient) >= attempt.max_files) {
      throw new AppError(`You can submit up to ${attempt.max_files} files or links`, 400);
    }
    const storagePath = `assessments/${userId}/${attemptId}/${Date.now()}-${crypto.randomUUID()}${ext ? `.${ext.toLowerCase()}` : ''}`;
    const contentType = (env.upload.mintboxAllowedFileTypes || []).includes(type) ? type : 'application/octet-stream';
    const signed = await storage.prepareResumableUpload(storagePath, { contentType, size: Number(size) });
    const item = await dbClient.query(
      `INSERT INTO assessment_attempt_items (attempt_id, kind, name, storage_path, mime_type, size_bytes, status)
       VALUES ($1, 'file', $2, $3, $4, $5, 'pending') RETURNING id`,
      [attemptId, safeName(name), storagePath, type || null, Number(size)]
    );
    await dbClient.query('COMMIT');
    return {
      item_id: item.rows[0].id,
      upload: { upload_id: item.rows[0].id, bucket: storage.getBucket(), storage_path: storagePath, content_type: contentType, ...signed },
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const completeFileUpload = async (attemptId, itemId, userId) => {
  await getOwnOpenAttempt(attemptId, userId);
  const item = (await query(
    `SELECT id, storage_path, status FROM assessment_attempt_items WHERE id = $1 AND attempt_id = $2 AND kind = 'file'`,
    [itemId, attemptId]
  )).rows[0];
  if (!item) throw new AppError('Upload not found', 404);
  if (item.status !== 'ready') {
    if (!await storage.objectExists(item.storage_path)) throw new AppError('Upload has not finished yet', 409);
    await query(`UPDATE assessment_attempt_items SET status = 'ready' WHERE id = $1`, [itemId]);
  }
  return { item_id: itemId };
};

const addLink = async (attemptId, userId, role, { url, name } = {}) => {
  let parsed;
  try { parsed = new URL(String(url || '').trim()); } catch { throw new AppError('Enter a full link starting with https://', 400); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new AppError('Enter a full link starting with https://', 400);
  const label = String(name || '').trim().slice(0, 200) || parsed.hostname;
  assertNoContactInfo(label, { userId, role, where: 'assessment_link' });
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const attempt = await getOwnOpenAttempt(attemptId, userId, dbClient);
    if (await countItems(attemptId, dbClient) >= attempt.max_files) {
      throw new AppError(`You can submit up to ${attempt.max_files} files or links`, 400);
    }
    const item = await dbClient.query(
      `INSERT INTO assessment_attempt_items (attempt_id, kind, name, url) VALUES ($1, 'link', $2, $3) RETURNING id`,
      [attemptId, label, parsed.toString()]
    );
    await dbClient.query('COMMIT');
    return { item_id: item.rows[0].id };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const removeItem = async (attemptId, itemId, userId) => {
  await getOwnOpenAttempt(attemptId, userId);
  const removed = await query(
    'DELETE FROM assessment_attempt_items WHERE id = $1 AND attempt_id = $2 RETURNING id',
    [itemId, attemptId]
  );
  if (!removed.rows[0]) throw new AppError('Item not found', 404);
  return { item_id: itemId };
};

const submitAttempt = async (attemptId, userId, role, { notes } = {}) => {
  const text = String(notes || '').trim().slice(0, 2000);
  if (text) assertNoContactInfo(text, { userId, role, where: 'assessment_notes' });
  const dbClient = await getClient();
  let submitted;
  try {
    await dbClient.query('BEGIN');
    await getOwnOpenAttempt(attemptId, userId, dbClient);
    const ready = Number((await dbClient.query(
      `SELECT COUNT(*)::int AS n FROM assessment_attempt_items WHERE attempt_id = $1 AND status = 'ready'`,
      [attemptId]
    )).rows[0].n);
    if (!ready) throw new AppError('Add at least one file or link before submitting', 400);
    submitted = (await dbClient.query(
      `UPDATE assessment_attempts
       SET status = 'submitted', submitted_at = NOW(), is_late = NOW() > deadline_at, notes = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_late`,
      [attemptId, text || null]
    )).rows[0];
    await dbClient.query(`DELETE FROM assessment_attempt_items WHERE attempt_id = $1 AND status = 'pending'`, [attemptId]);
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  const info = (await query(
    `SELECT a.title, u.full_name FROM assessment_attempts t
     JOIN assessments a ON a.id = t.assessment_id JOIN users u ON u.id = t.freelancer_id WHERE t.id = $1`,
    [attemptId]
  )).rows[0];
  const admins = await query(`SELECT id FROM users WHERE role = 'admin' AND is_active = true`);
  await Promise.all(admins.rows.map((admin) => notificationService.createNotification({
    userId: admin.id,
    type: 'assessment_submitted',
    title: `${info.title} submitted`,
    body: `${info.full_name} submitted an assessment${submitted.is_late ? ' after the deadline' : ''}. Review it to pass or fail.`,
    entityType: 'assessment_attempt',
    entityId: attemptId,
    data: { attempt_id: attemptId },
    dedupeKey: `assessment-submitted:${attemptId}:${admin.id}`,
  }).catch((err) => logger.warn('Assessment submit notification failed', { attemptId, error: err.message }))));
  return { attempt_id: attemptId, is_late: submitted.is_late };
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const adminListAttempts = async ({ status = 'submitted' } = {}) => {
  const params = [];
  let where = '';
  if (status !== 'all') {
    params.push(status);
    where = 'WHERE t.status = $1';
  }
  const result = await query(
    `SELECT ${ATTEMPT_COLUMNS}, a.title, a.level, a.slug AS assessment_slug, c.name AS category_name,
            u.full_name AS freelancer_name, u.email AS freelancer_email, u.avatar_url AS freelancer_avatar,
            (SELECT COUNT(*)::int FROM assessment_attempt_items i WHERE i.attempt_id = t.id AND i.status = 'ready') AS item_count
     FROM assessment_attempts t
     JOIN assessments a ON a.id = t.assessment_id
     JOIN categories c ON c.id = a.category_id
     JOIN users u ON u.id = t.freelancer_id
     ${where}
     ORDER BY COALESCE(t.submitted_at, t.created_at) ${status === 'submitted' ? 'ASC' : 'DESC'}
     LIMIT 200`,
    params
  );
  return result.rows;
};

const reviewAttempt = async (attemptId, admin, { decision, score, criteria_scores: criteriaScores, note } = {}) => {
  if (!['passed', 'failed'].includes(decision)) throw new AppError('Decision must be passed or failed', 400);
  const reviewNote = String(note || '').trim().slice(0, 4000);
  if (decision === 'failed' && !reviewNote) throw new AppError('Tell the freelancer why it was not approved', 400);
  const scores = Array.isArray(criteriaScores)
    ? criteriaScores
      .map((item) => ({ name: String(item?.name || '').slice(0, 120), score: Math.max(0, Math.min(100, Math.round(Number(item?.score) || 0))) }))
      .filter((item) => item.name)
    : [];
  const overall = score == null || score === ''
    ? (scores.length ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length) : null)
    : Math.max(0, Math.min(100, Math.round(Number(score))));

  const result = await query(
    `UPDATE assessment_attempts
     SET status = $2, score = $3, criteria_scores = $4::jsonb, review_note = $5,
         reviewed_by = $6, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'submitted'
     RETURNING id, freelancer_id, assessment_id`,
    [attemptId, decision, overall, JSON.stringify(scores), reviewNote || null, admin.id]
  );
  const attempt = result.rows[0];
  if (!attempt) throw new AppError('Only submitted attempts can be reviewed', 409);

  const assessment = (await query('SELECT title, level FROM assessments WHERE id = $1', [attempt.assessment_id])).rows[0];
  await writeAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: `assessment.${decision}`,
    entityType: 'assessment_attempt',
    entityId: attemptId,
    afterState: { decision, score: overall },
  }).catch((err) => logger.warn('Assessment audit failed', { attemptId, error: err.message }));
  await notificationService.createNotification({
    userId: attempt.freelancer_id,
    type: 'assessment_reviewed',
    title: decision === 'passed' ? `You passed ${assessment.title}` : `${assessment.title} was not approved`,
    body: decision === 'passed'
      ? `Level ${assessment.level} is now on your profile. Opt in to the services it covers to start getting orders.`
      : 'Open the result to see the reviewer’s feedback and when you can retake it.',
    entityType: 'assessment_attempt',
    entityId: attemptId,
    data: { attempt_id: attemptId },
    dedupeKey: `assessment-reviewed:${attemptId}`,
  }).catch((err) => logger.warn('Assessment review notification failed', { attemptId, error: err.message }));
  return { attempt_id: attemptId, status: decision, score: overall };
};

module.exports = {
  listForFreelancer,
  getForFreelancer,
  startAttempt,
  getAttempt,
  prepareFileUpload,
  completeFileUpload,
  addLink,
  removeItem,
  submitAttempt,
  adminListAttempts,
  reviewAttempt,
};
