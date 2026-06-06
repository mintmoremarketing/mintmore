const freelancerService = require('./freelancer.service');
const { sendSuccess }   = require('../../utils/apiResponse');

const browse = async (req, res, next) => {
	try {
		const { page, limit, category_id, level, min_rating,
						min_price, max_price, search, sort } = req.query;
		const result = await freelancerService.browseFreelancers({
			page:       parseInt(page, 10)  || 1,
			limit:      parseInt(limit, 10) || 12,
			category_id, level, min_rating, min_price, max_price, search, sort,
		});
		return sendSuccess(res, { data: result });
	} catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
	try {
		const profile = await freelancerService.getFreelancerProfile(
			req.params.freelancerId,
			req.user.sub
		);
		return sendSuccess(res, { data: { profile } });
	} catch (err) { next(err); }
};

const setPreferred = async (req, res, next) => {
	try {
		const preference = await freelancerService.setPreferredCreator(
			req.user.sub,
			req.params.freelancerId,
			req.method === 'POST'
		);
		return sendSuccess(res, {
			data: { preference },
			message: preference.is_preferred_creator ? 'Creative saved' : 'Creative removed',
		});
	} catch (err) { next(err); }
};

const updateMarketplaceProfile = async (req, res, next) => {
	try {
		const profile = await freelancerService.updateMarketplaceProfile(
			req.user.sub, req.body
		);
		return sendSuccess(res, {
			data:    { profile },
			message: 'Marketplace profile updated',
		});
	} catch (err) { next(err); }
};

module.exports = { browse, getProfile, setPreferred, updateMarketplaceProfile };
