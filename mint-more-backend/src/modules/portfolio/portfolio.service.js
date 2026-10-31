const { query }  = require('../../config/database');
const { uploadFile, createSignedDownloadUrl } = require('../storage/app-storage.provider');
const AppError   = require('../../utils/AppError');
const logger     = require('../../utils/logger');
const { assertNoContactInfo } = require('../../utils/contactGuard');

// Portfolio items are shown to clients, so their text can't carry contact details.
const assertCleanPortfolio = (freelancerId, data) => ['title', 'description', 'client_name']
	.filter((field) => data[field])
	.forEach((field) => assertNoContactInfo(String(data[field]), { userId: freelancerId, role: 'freelancer', where: `portfolio_${field}` }));
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Private-bucket uploads come back as { bucket, path }; keep that as JSON and sign on read.
const toStoredRef = (value) => (value && typeof value === 'object' ? JSON.stringify(value) : value);

const resolveStoredUrl = async (value) => {
	if (typeof value !== 'string' || !value.startsWith('{')) return value;
	try {
		const ref = JSON.parse(value);
		return await createSignedDownloadUrl(ref.bucket, ref.path, 7 * 24 * 60 * 60);
	} catch {
		return null;
	}
};

const withUrls = async (item) => ({
	...item,
	cover_image_url: await resolveStoredUrl(item.cover_image_url),
	media_urls: await Promise.all((item.media_urls || []).map(resolveStoredUrl)),
});

/** Explore feed: every visible post from active freelancers, newest first. */
const getFeed = async ({ page = 1, limit = 21, freelancerId } = {}) => {
	const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 21, 1), 60);
	const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;
	const params = [safeLimit, offset];
	let freelancerClause = '';
	if (freelancerId) {
		params.push(freelancerId);
		freelancerClause = `AND pi.freelancer_id = $${params.length}`;
	}
	const result = await query(
		`SELECT pi.id, pi.title, pi.description, pi.cover_image_url, pi.media_urls, pi.tools_used,
		        pi.created_at, c.name AS category_name,
		        u.id AS freelancer_id, u.full_name AS freelancer_name, u.username AS freelancer_username,
		        u.avatar_url AS freelancer_avatar
		 FROM portfolio_items pi
		 JOIN users u ON u.id = pi.freelancer_id AND u.is_active AND u.role = 'freelancer'
		 LEFT JOIN categories c ON c.id = pi.category_id
		 WHERE pi.is_visible IS NOT FALSE ${freelancerClause}
		 ORDER BY pi.created_at DESC
		 LIMIT $1 OFFSET $2`,
		params
	);
	return Promise.all(result.rows.map(withUrls));
};

const getMyPortfolio = async (freelancerId) => {
	const result = await query(
		`SELECT pi.*, c.name AS category_name
		 FROM portfolio_items pi
		 LEFT JOIN categories c ON c.id = pi.category_id
		 WHERE pi.freelancer_id = $1
		 ORDER BY pi.sort_order ASC, pi.created_at DESC`,
		[freelancerId]
	);
	return Promise.all(result.rows.map(withUrls));
};

const getFreelancerPortfolio = async (freelancerId) => {
	const result = await query(
		`SELECT pi.*, c.name AS category_name
		 FROM portfolio_items pi
		 LEFT JOIN categories c ON c.id = pi.category_id
		 WHERE pi.freelancer_id = $1 AND pi.is_visible = true
		 ORDER BY pi.is_featured DESC, pi.sort_order ASC, pi.created_at DESC`,
		[freelancerId]
	);
	return Promise.all(result.rows.map(withUrls));
};

const createPortfolioItem = async (freelancerId, data, coverFile, extraFiles = []) => {
	if (!data.title) throw new AppError('title is required', 400);
	assertCleanPortfolio(freelancerId, data);
	if (!coverFile)  throw new AppError('cover_image is required', 400);
	if (!String(coverFile.mimetype).startsWith('image/')) throw new AppError('The cover must be an image', 422);
	if (extraFiles.filter((file) => String(file.mimetype).startsWith('video/')).length > 1) {
		throw new AppError('Add one video per post', 422);
	}

	const coverExt  = path.extname(coverFile.originalname).toLowerCase() || '.jpg';
	const coverPath = `portfolio/${freelancerId}/${uuidv4()}${coverExt}`;
	const coverUrl  = await uploadFile(
		'job-attachments',
		coverPath,
		coverFile.buffer,
		coverFile.mimetype
	);

	const mediaUrls = [];
	for (const file of extraFiles) {
		const ext      = path.extname(file.originalname).toLowerCase() || (String(file.mimetype).startsWith('video/') ? '.mp4' : '.jpg');
		const filePath = `portfolio/${freelancerId}/${uuidv4()}${ext}`;
		const url      = await uploadFile('job-attachments', filePath, file.buffer, file.mimetype);
		mediaUrls.push(toStoredRef(url));
	}

	const result = await query(
		`INSERT INTO portfolio_items
			 (freelancer_id, title, description, category_id,
				cover_image_url, media_urls, tags, tools_used,
				project_cost_min, project_cost_max, project_duration,
				client_name, is_featured, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		 RETURNING *`,
		[
			freelancerId,
			data.title.trim(),
			data.description?.trim() || null,
			data.category_id || null,
			toStoredRef(coverUrl),
			mediaUrls,
			data.tags ? JSON.parse(data.tags) : [],
			data.tools_used ? JSON.parse(data.tools_used) : [],
			data.project_cost_min ? parseFloat(data.project_cost_min) : null,
			data.project_cost_max ? parseFloat(data.project_cost_max) : null,
			data.project_duration || null,
			data.client_name || null,
			data.is_featured === 'true' || data.is_featured === true,
			data.sort_order ? parseInt(data.sort_order, 10) : 0,
		]
	);

	logger.info('Portfolio item created', { freelancerId, title: data.title });
	return withUrls(result.rows[0]);
};

const updatePortfolioItem = async (freelancerId, itemId, updates) => {
	const allowed = [
		'title', 'description', 'category_id', 'tags',
		'tools_used', 'project_cost_min', 'project_cost_max',
		'project_duration', 'client_name',
		'is_featured', 'is_visible', 'sort_order',
	];
	const fields = Object.keys(updates).filter((k) => allowed.includes(k));
	if (!fields.length) throw new AppError('No valid fields to update', 400);
	assertCleanPortfolio(freelancerId, updates);

	const setClauses = fields.map((f, i) => `${f} = $${i + 3}`);
	const values     = fields.map((f) => updates[f]);

	const result = await query(
		`UPDATE portfolio_items
		 SET ${setClauses.join(', ')}
		 WHERE id = $1 AND freelancer_id = $2
		 RETURNING *`,
		[itemId, freelancerId, ...values]
	);
	if (!result.rows[0]) throw new AppError('Portfolio item not found', 404);
	return result.rows[0];
};

const deletePortfolioItem = async (freelancerId, itemId) => {
	const result = await query(
		`DELETE FROM portfolio_items
		 WHERE id = $1 AND freelancer_id = $2
		 RETURNING id`,
		[itemId, freelancerId]
	);
	if (!result.rows[0]) throw new AppError('Portfolio item not found', 404);
	return { deleted: true };
};

module.exports = {
	getFeed,
	getMyPortfolio,
	getFreelancerPortfolio,
	createPortfolioItem,
	updatePortfolioItem,
	deletePortfolioItem,
};
