const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');

const submitReview = async (clientId, {
	freelancer_id, job_id,
	rating_overall, rating_communication,
	rating_quality, rating_value,
	brief_adherence_rating, timeliness_rating,
	review_text,
	price_range_min, price_range_max, job_duration,
}) => {
	const briefAdherence = brief_adherence_rating || rating_value;
	const timeliness = timeliness_rating || rating_value;
	const ratings = [rating_overall, rating_communication, rating_quality, briefAdherence, timeliness];
	if (ratings.some((r) => !r || r < 1 || r > 5)) {
		throw new AppError('All ratings must be between 1 and 5', 400);
	}

	if (job_id) {
		const jobCheck = await query(
			`SELECT id FROM jobs
			 WHERE id = $1
				 AND client_id = $2
				 AND status = 'completed'`,
			[job_id, clientId]
		);
		if (!jobCheck.rows[0]) {
			throw new AppError('You can only review freelancers after a job is completed', 403);
		}
	}

	const dbClient = await getClient();
	try {
		await dbClient.query('BEGIN');

		const reviewResult = await dbClient.query(
			`INSERT INTO reviews
				 (freelancer_id, client_id, job_id,
					rating_overall, rating_communication, rating_quality, rating_value,
					brief_adherence_rating, timeliness_rating,
					review_text, price_range_min, price_range_max, job_duration)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			 ON CONFLICT (client_id, job_id) DO UPDATE SET
				 rating_overall       = EXCLUDED.rating_overall,
				 rating_communication = EXCLUDED.rating_communication,
				 rating_quality       = EXCLUDED.rating_quality,
				 rating_value         = EXCLUDED.rating_value,
				 brief_adherence_rating = EXCLUDED.brief_adherence_rating,
				 timeliness_rating    = EXCLUDED.timeliness_rating,
				 review_text          = EXCLUDED.review_text
			 RETURNING *`,
			[
				freelancer_id, clientId, job_id || null,
				rating_overall, rating_communication, rating_quality, rating_value || briefAdherence,
				briefAdherence, timeliness, review_text || null,
				price_range_min || null, price_range_max || null,
				job_duration || null,
			]
		);

		await dbClient.query(
			`UPDATE users u
			 SET
				 review_count        = (SELECT COUNT(*) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true),
				 review_avg_overall  = (SELECT COALESCE(AVG(rating_overall), 0) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true),
				 review_avg_comm     = (SELECT COALESCE(AVG(rating_communication), 0) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true),
				 review_avg_quality  = (SELECT COALESCE(AVG(rating_quality), 0) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true),
				 review_avg_value    = (SELECT COALESCE(AVG(rating_value), 0) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true),
				 average_rating      = (SELECT COALESCE(AVG(rating_overall), 0) FROM reviews r WHERE r.freelancer_id = u.id AND r.is_visible = true)
			 WHERE u.id = $1`,
			[freelancer_id]
		);

		await dbClient.query('COMMIT');

		logger.info('Review submitted', { clientId, freelancer_id, rating_overall });
		return reviewResult.rows[0];
	} catch (err) {
		await dbClient.query('ROLLBACK');
		throw err;
	} finally {
		dbClient.release();
	}
};

const getFreelancerReviews = async (freelancerId, { page = 1, limit = 10, sort = 'recent' } = {}) => {
	const offset   = (page - 1) * limit;
	const orderMap = {
		recent:   'r.created_at DESC',
		highest:  'r.rating_overall DESC',
		lowest:   'r.rating_overall ASC',
		relevant: 'r.rating_overall DESC, r.created_at DESC',
	};
	const orderBy = orderMap[sort] || orderMap.recent;

	const result = await query(
		`SELECT
			 r.*,
			 u.full_name  AS client_name,
			 u.avatar_url AS client_avatar,
			 u.country    AS client_country
		 FROM reviews r
		 JOIN users u ON u.id = r.client_id
		 WHERE r.freelancer_id = $1 AND r.is_visible = true
		 ORDER BY ${orderBy}
		 LIMIT $2 OFFSET $3`,
		[freelancerId, limit, offset]
	);

	const summary = await query(
		`SELECT
			 COUNT(*)                   AS total,
			 ROUND(AVG(rating_overall), 1)       AS avg_overall,
			 ROUND(AVG(rating_communication), 1) AS avg_communication,
			 ROUND(AVG(rating_quality), 1)       AS avg_quality,
			 ROUND(AVG(rating_value), 1)         AS avg_value,
			 COUNT(*) FILTER (WHERE rating_overall = 5) AS five_star,
			 COUNT(*) FILTER (WHERE rating_overall = 4) AS four_star,
			 COUNT(*) FILTER (WHERE rating_overall = 3) AS three_star,
			 COUNT(*) FILTER (WHERE rating_overall = 2) AS two_star,
			 COUNT(*) FILTER (WHERE rating_overall = 1) AS one_star
		 FROM reviews
		 WHERE freelancer_id = $1 AND is_visible = true`,
		[freelancerId]
	);

	return {
		reviews:  result.rows,
		summary:  summary.rows[0],
		pagination: {
			page, limit,
			total: parseInt(summary.rows[0].total, 10),
			pages: Math.ceil(summary.rows[0].total / limit),
		},
	};
};

module.exports = { submitReview, getFreelancerReviews };
