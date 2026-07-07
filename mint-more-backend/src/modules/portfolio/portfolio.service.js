const { query }  = require('../../config/database');
const { uploadFile } = require('../storage/app-storage.provider');
const AppError   = require('../../utils/AppError');
const logger     = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const getMyPortfolio = async (freelancerId) => {
	const result = await query(
		`SELECT pi.*, c.name AS category_name
		 FROM portfolio_items pi
		 LEFT JOIN categories c ON c.id = pi.category_id
		 WHERE pi.freelancer_id = $1
		 ORDER BY pi.sort_order ASC, pi.created_at DESC`,
		[freelancerId]
	);
	return result.rows;
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
	return result.rows;
};

const createPortfolioItem = async (freelancerId, data, coverFile, extraFiles = []) => {
	if (!data.title) throw new AppError('title is required', 400);
	if (!coverFile)  throw new AppError('cover_image is required', 400);

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
		const ext      = path.extname(file.originalname).toLowerCase() || '.jpg';
		const filePath = `portfolio/${freelancerId}/${uuidv4()}${ext}`;
		const url      = await uploadFile('job-attachments', filePath, file.buffer, file.mimetype);
		mediaUrls.push(url);
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
			coverUrl,
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
	return result.rows[0];
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
	getMyPortfolio,
	getFreelancerPortfolio,
	createPortfolioItem,
	updatePortfolioItem,
	deletePortfolioItem,
};
