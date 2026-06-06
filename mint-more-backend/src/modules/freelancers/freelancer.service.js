const { query } = require('../../config/database');
const { getFreelancerPackages } = require('../packages/package.service');
const { getFreelancerPortfolio } = require('../portfolio/portfolio.service');
const { getFreelancerReviews }   = require('../reviews/review.service');
const AppError = require('../../utils/AppError');

// Browse

const browseFreelancers = async ({
	page = 1, limit = 12,
	category_id, level, min_rating,
	min_price, max_price,
	search, sort = 'top_rated',
} = {}) => {
	const offset     = (page - 1) * limit;
	const params     = [];
	const conditions = [
		'u.marketplace_visible = true',
		'u.is_active = true',
		'u.is_approved = true',
		"u.role = 'freelancer'",
	];

	if (category_id) {
		params.push(category_id);
		conditions.push(`EXISTS (
			SELECT 1 FROM portfolio_items pi
			WHERE pi.freelancer_id = u.id AND pi.category_id = $${params.length}
		)`);
	}

	if (level) {
		params.push(level);
		conditions.push(`u.freelancer_level = $${params.length}`);
	}

	if (min_rating) {
		params.push(parseFloat(min_rating));
		conditions.push(`u.review_avg_overall >= $${params.length}`);
	}

	if (search) {
		params.push(`%${search}%`);
		conditions.push(`(
			u.full_name ILIKE $${params.length} OR
			u.tagline   ILIKE $${params.length} OR
			u.bio       ILIKE $${params.length} OR
			EXISTS (SELECT 1 FROM unnest(u.skills) s WHERE s ILIKE $${params.length})
		)`);
	}

	if (min_price || max_price) {
		if (min_price) {
			params.push(parseFloat(min_price));
			conditions.push(`EXISTS (
				SELECT 1 FROM freelancer_packages fp
				WHERE fp.freelancer_id = u.id AND fp.is_active = true
					AND fp.price >= $${params.length}
			)`);
		}
		if (max_price) {
			params.push(parseFloat(max_price));
			conditions.push(`EXISTS (
				SELECT 1 FROM freelancer_packages fp
				WHERE fp.freelancer_id = u.id AND fp.is_active = true
					AND fp.price <= $${params.length}
			)`);
		}
	}

	const sortMap = {
		top_rated:   'u.review_avg_overall DESC NULLS LAST, u.review_count DESC',
		most_reviews: 'u.review_count DESC',
		newest:      'u.created_at DESC',
		lowest_price: '(SELECT MIN(fp.price) FROM freelancer_packages fp WHERE fp.freelancer_id = u.id AND fp.is_active = true) ASC NULLS LAST',
	};
	const orderBy = sortMap[sort] || sortMap.top_rated;

	const whereClause = `WHERE ${conditions.join(' AND ')}`;
	params.push(limit, offset);

	const result = await query(
		`SELECT
			 u.id, u.full_name, u.avatar_url, u.tagline, u.bio,
			 u.freelancer_level, u.skills, u.languages,
			 u.review_count, u.review_avg_overall,
			 u.review_avg_comm, u.review_avg_quality, u.review_avg_value,
			 u.response_time_hours, u.hourly_rate,
			 u.kyc_status,
			 CASE WHEN up.is_online AND up.last_seen_at > NOW() - INTERVAL '2 minutes'
						THEN true ELSE false END AS is_online,
			 (SELECT MIN(fp.price) FROM freelancer_packages fp
				WHERE fp.freelancer_id = u.id AND fp.is_active = true) AS starting_price,
			 (SELECT COUNT(*) FROM freelancer_packages fp
				WHERE fp.freelancer_id = u.id AND fp.is_active = true)::INTEGER AS package_count,
			 (SELECT array_agg(cover_image_url ORDER BY sort_order ASC, created_at DESC)
				FROM (
					SELECT cover_image_url, sort_order, created_at
					FROM portfolio_items
					WHERE freelancer_id = u.id AND is_visible = true
					ORDER BY is_featured DESC, sort_order ASC
					LIMIT 3
				) pi) AS portfolio_preview
		 FROM users u
		 LEFT JOIN user_presence up ON up.user_id = u.id
		 ${whereClause}
		 ORDER BY ${orderBy}
		 LIMIT $${params.length - 1} OFFSET $${params.length}`,
		params
	);

	const countParams = params.slice(0, -2);
	const countResult = await query(
		`SELECT COUNT(*) FROM users u ${whereClause}`,
		countParams
	);

	return {
		freelancers: result.rows,
		pagination: {
			page, limit,
			total: parseInt(countResult.rows[0].count, 10),
			pages: Math.ceil(countResult.rows[0].count / limit),
		},
	};
};

const getFreelancerProfile = async (freelancerId, clientId = null) => {
	const result = await query(
		`SELECT
			 u.id, u.full_name, u.avatar_url, u.tagline, u.bio,
			 u.freelancer_level, u.skills, u.languages,
			 u.review_count, u.review_avg_overall,
			 u.review_avg_comm, u.review_avg_quality, u.review_avg_value,
			 u.response_time_hours, u.hourly_rate,
			 u.kyc_status, u.marketplace_visible,
			 u.address_city, u.address_state, u.country,
			 u.created_at,
			 CASE WHEN up.is_online AND up.last_seen_at > NOW() - INTERVAL '2 minutes'
						THEN true ELSE false END AS is_online,
			 up.last_seen_at
			 ,EXISTS(
				 SELECT 1 FROM preferred_creators pc
				 WHERE pc.client_id = $2 AND pc.freelancer_id = u.id
			 ) AS is_preferred_creator
		 FROM users u
		 LEFT JOIN user_presence up ON up.user_id = u.id
		 WHERE u.id = $1
			 AND u.role = 'freelancer'
			 AND u.is_active = true`,
		[freelancerId, clientId]
	);

	const freelancer = result.rows[0];
	if (!freelancer) throw new AppError('Freelancer not found', 404);
	if (!freelancer.marketplace_visible) throw new AppError('Freelancer not found', 404);

	const [packages, portfolio, reviewData] = await Promise.all([
		getFreelancerPackages(freelancerId),
		getFreelancerPortfolio(freelancerId),
		getFreelancerReviews(freelancerId, { page: 1, limit: 6 }),
	]);

	return {
		...freelancer,
		packages,
		portfolio,
		reviews:        reviewData.reviews,
		review_summary: reviewData.summary,
	};
};

const setPreferredCreator = async (clientId, freelancerId, preferred) => {
	const freelancer = await query(
		`SELECT id FROM users
		 WHERE id = $1 AND role = 'freelancer' AND is_active = true`,
		[freelancerId]
	);
	if (!freelancer.rows[0]) throw new AppError('Freelancer not found', 404);

	if (preferred) {
		await query(
			`INSERT INTO preferred_creators (client_id, freelancer_id)
			 VALUES ($1, $2)
			 ON CONFLICT (client_id, freelancer_id) DO NOTHING`,
			[clientId, freelancerId]
		);
	} else {
		await query(
			`DELETE FROM preferred_creators
			 WHERE client_id = $1 AND freelancer_id = $2`,
			[clientId, freelancerId]
		);
	}

	return { freelancer_id: freelancerId, is_preferred_creator: preferred };
};

const updateMarketplaceProfile = async (freelancerId, updates) => {
	const allowed = [
		'tagline', 'hourly_rate', 'response_time_hours',
		'languages', 'marketplace_visible',
	];
	const fields = Object.keys(updates).filter((k) => allowed.includes(k));
	if (!fields.length) throw new AppError('No valid fields to update', 400);

	const setClauses = fields.map((f, i) => `${f} = $${i + 2}`);
	const values     = fields.map((f) => updates[f]);

	const result = await query(
		`UPDATE users
		 SET ${setClauses.join(', ')}
		 WHERE id = $1
		 RETURNING id, tagline, hourly_rate, response_time_hours,
							 languages, marketplace_visible`,
		[freelancerId, ...values]
	);

	return result.rows[0];
};

module.exports = {
	browseFreelancers,
	getFreelancerProfile,
	setPreferredCreator,
	updateMarketplaceProfile,
};
