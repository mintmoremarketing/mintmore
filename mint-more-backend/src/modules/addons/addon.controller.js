const addonService = require('./addon.service');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

// Client

const getPlans = async (req, res, next) => {
	try {
		const plans = await addonService.getActivePlans();
		return sendSuccess(res, { data: { plans } });
	} catch (err) { next(err); }
};

const getMyAddons = async (req, res, next) => {
	try {
		const addons = await addonService.getMyAddons(req.user.sub);
		return sendSuccess(res, { data: { addons } });
	} catch (err) { next(err); }
};

const purchaseAddon = async (req, res, next) => {
	try {
		const { plan_id } = req.body;
		if (!plan_id) throw new AppError('plan_id is required', 400);

		const result = await addonService.purchaseAddon(req.user.sub, plan_id);
		const isStorage = result.plan.features?.includes('mintbox_storage');
		return sendSuccess(res, {
			data:       result,
			message:    isStorage
				? `${result.plan.name} activated! Your Mintbox storage has been upgraded.`
				: `${result.plan.name} activated! You now have ${result.days_added} days of browse access.`,
			statusCode: 201,
		});
	} catch (err) { next(err); }
};

const checkFeature = async (req, res, next) => {
	try {
		const { feature } = req.params;
		const addon = await addonService.checkAddon(req.user.sub, feature);
		return sendSuccess(res, {
			data: {
				has_access:  !!addon,
				expires_at:  addon?.expires_at || null,
				days_remaining: addon
					? Math.max(0, Math.ceil((new Date(addon.expires_at) - new Date()) / 86400000))
					: 0,
			},
		});
	} catch (err) { next(err); }
};

// Admin

const adminGetPlans = async (req, res, next) => {
	try {
		const plans = await addonService.adminGetAllPlans(
			req.query.include_inactive === 'true'
		);
		return sendSuccess(res, { data: { plans } });
	} catch (err) { next(err); }
};

const adminCreatePlan = async (req, res, next) => {
	try {
		const plan = await addonService.adminCreatePlan(req.user.sub, req.body);
		return sendSuccess(res, {
			data:       { plan },
			message:    'Add-on plan created',
			statusCode: 201,
		});
	} catch (err) { next(err); }
};

const adminUpdatePlan = async (req, res, next) => {
	try {
		const plan = await addonService.adminUpdatePlan(req.params.planId, req.body);
		return sendSuccess(res, { data: { plan }, message: 'Plan updated' });
	} catch (err) { next(err); }
};

const adminGetSubscribers = async (req, res, next) => {
	try {
		const { page, limit } = req.query;
		const result = await addonService.adminGetSubscribers(req.params.planId, {
			page:  parseInt(page, 10)  || 1,
			limit: parseInt(limit, 10) || 20,
		});
		return sendSuccess(res, { data: result });
	} catch (err) { next(err); }
};

module.exports = {
	getPlans,
	getMyAddons,
	purchaseAddon,
	checkFeature,
	adminGetPlans,
	adminCreatePlan,
	adminUpdatePlan,
	adminGetSubscribers,
};
