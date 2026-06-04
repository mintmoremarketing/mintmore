const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');

// Public

const getActivePlans = async () => {
	const result = await query(
		`SELECT * FROM addon_plans
		 WHERE is_active = true
		 ORDER BY sort_order ASC, price ASC`
	);
	return result.rows;
};

const getMyAddons = async (userId) => {
	const result = await query(
		`SELECT
			 ca.*, 
			 ap.name        AS plan_name,
			 ap.description AS plan_description,
			 GREATEST(0, EXTRACT(DAY FROM (ca.expires_at - NOW()))::INTEGER) AS days_remaining
		 FROM client_addons ca
		 JOIN addon_plans ap ON ap.id = ca.addon_plan_id
		 WHERE ca.user_id = $1
		 ORDER BY ca.expires_at DESC`,
		[userId]
	);
	return result.rows;
};

const checkAddon = async (userId, feature) => {
	const result = await query(
		`SELECT * FROM client_addons
		 WHERE user_id   = $1
			 AND is_active = true
			 AND expires_at > NOW()
			 AND $2 = ANY(features)
		 ORDER BY expires_at DESC
		 LIMIT 1`,
		[userId, feature]
	);
	return result.rows[0] || null;
};

// Purchase

const purchaseAddon = async (userId, planId) => {
	const dbClient = await getClient();
	try {
		await dbClient.query('BEGIN');

		const planResult = await dbClient.query(
			'SELECT * FROM addon_plans WHERE id = $1 AND is_active = true',
			[planId]
		);
		const plan = planResult.rows[0];
		if (!plan) throw new AppError('Plan not found or inactive', 404);

		const walletResult = await dbClient.query(
			'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
			[userId]
		);
		const wallet = walletResult.rows[0];
		if (!wallet) throw new AppError('Wallet not found', 404);

		if (parseFloat(wallet.balance) < parseFloat(plan.price)) {
			throw new AppError(
				`Insufficient wallet balance. Plan costs \u20b9${plan.price.toLocaleString('en-IN')}. Your balance: \u20b9${parseFloat(wallet.balance).toLocaleString('en-IN')}. Please top up your wallet first.`,
				402
			);
		}

		const newBalance = parseFloat(wallet.balance) - parseFloat(plan.price);
		await dbClient.query(
			'UPDATE wallets SET balance = $1 WHERE id = $2',
			[newBalance, wallet.id]
		);

		const txResult = await dbClient.query(
			`INSERT INTO transactions
				 (wallet_id, user_id, type, amount, currency,
					balance_after, escrow_after,
					reference_id, reference_type, description)
			 VALUES ($1,$2,'adjustment',$3,'INR',$4,$5,$6,'addon_plan',$7)
			 RETURNING id`,
			[
				wallet.id, userId,
				-parseFloat(plan.price),
				newBalance,
				parseFloat(wallet.escrow_balance),
				planId,
				`Add-on purchase: ${plan.name}`,
			]
		);
		const transactionId = txResult.rows[0].id;

		const existingResult = await dbClient.query(
			`SELECT id, expires_at FROM client_addons
			 WHERE user_id = $1
				 AND is_active = true
				 AND expires_at > NOW()
				 AND features @> $2::addon_feature[]
			 ORDER BY expires_at DESC
			 LIMIT 1`,
			[userId, plan.features]
		);

		let startsAt, expiresAt;

		if (existingResult.rows[0]) {
			startsAt  = new Date();
			expiresAt = new Date(existingResult.rows[0].expires_at);
			expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
		} else {
			startsAt  = new Date();
			expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
		}

		const addonResult = await dbClient.query(
			`INSERT INTO client_addons
				 (user_id, addon_plan_id, price_paid, duration_days,
					features, starts_at, expires_at, transaction_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 RETURNING *`,
			[
				userId, planId,
				plan.price, plan.duration_days,
				plan.features,
				startsAt, expiresAt,
				transactionId,
			]
		);

		await dbClient.query('COMMIT');

		logger.info('Addon purchased', {
			userId, planId,
			plan: plan.name,
			price: plan.price,
			expiresAt,
		});

		return {
			addon:       addonResult.rows[0],
			plan,
			expires_at:  expiresAt,
			days_added:  plan.duration_days,
			price_paid:  plan.price,
			new_balance: newBalance,
		};
	} catch (err) {
		await dbClient.query('ROLLBACK');
		throw err;
	} finally {
		dbClient.release();
	}
};

// Admin

const adminGetAllPlans = async (includeInactive = false) => {
	const result = await query(
		`SELECT
			 ap.*,
			 COUNT(ca.id)::INTEGER AS total_purchases,
			 COUNT(ca.id) FILTER (WHERE ca.expires_at > NOW() AND ca.is_active = true)::INTEGER
				 AS active_subscribers
		 FROM addon_plans ap
		 LEFT JOIN client_addons ca ON ca.addon_plan_id = ap.id
		 ${includeInactive ? '' : 'WHERE ap.is_active = true'}
		 GROUP BY ap.id
		 ORDER BY ap.sort_order ASC`
	);
	return result.rows;
};

const adminCreatePlan = async (adminId, {
	name, description, price, duration_days,
	features, is_featured, sort_order, storage_gb,
}) => {
	if (!name || !price || !duration_days || !features?.length) {
		throw new AppError('name, price, duration_days, and features are required', 400);
	}

	const result = await query(
		`INSERT INTO addon_plans
			 (name, description, price, duration_days,
				features, storage_gb, is_featured, sort_order, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING *`,
		[
			name, description || null,
			parseFloat(price), parseInt(duration_days, 10),
			features, parseInt(storage_gb || 0, 10),
			is_featured || false, sort_order || 0, adminId,
		]
	);

	logger.info('Addon plan created', { adminId, name, price });
	return result.rows[0];
};

const adminUpdatePlan = async (planId, updates) => {
	const allowed = [
		'name', 'description', 'price', 'duration_days',
		'features', 'storage_gb', 'is_featured', 'is_active', 'sort_order',
	];
	const fields  = Object.keys(updates).filter((k) => allowed.includes(k));
	if (!fields.length) throw new AppError('No valid fields to update', 400);

	const setClauses = fields.map((f, i) => `${f} = $${i + 2}`);
	const values     = fields.map((f) => updates[f]);

	const result = await query(
		`UPDATE addon_plans SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
		[planId, ...values]
	);
	if (!result.rows[0]) throw new AppError('Plan not found', 404);
	return result.rows[0];
};

const adminGetSubscribers = async (planId, { page = 1, limit = 20 } = {}) => {
	const offset = (page - 1) * limit;
	const result = await query(
		`SELECT
			 ca.*,
			 u.full_name, u.email, u.role,
			 GREATEST(0, EXTRACT(DAY FROM (ca.expires_at - NOW()))::INTEGER) AS days_remaining
		 FROM client_addons ca
		 JOIN users u ON u.id = ca.user_id
		 WHERE ca.addon_plan_id = $1
		 ORDER BY ca.created_at DESC
		 LIMIT $2 OFFSET $3`,
		[planId, limit, offset]
	);
	const count = await query(
		'SELECT COUNT(*) FROM client_addons WHERE addon_plan_id = $1',
		[planId]
	);
	return {
		subscribers: result.rows,
		pagination: {
			page, limit,
			total: parseInt(count.rows[0].count, 10),
			pages: Math.ceil(count.rows[0].count / limit),
		},
	};
};

module.exports = {
	getActivePlans,
	getMyAddons,
	checkAddon,
	purchaseAddon,
	adminGetAllPlans,
	adminCreatePlan,
	adminUpdatePlan,
	adminGetSubscribers,
};
