const portfolioService = require('./portfolio.service');
const { sendSuccess }  = require('../../utils/apiResponse');

const getFeed = async (req, res, next) => {
	try {
		const items = await portfolioService.getFeed({
			page: req.query.page,
			limit: req.query.limit,
			freelancerId: req.query.freelancer_id,
		});
		return sendSuccess(res, { data: { items } });
	} catch (err) { next(err); }
};

const getMyPortfolio = async (req, res, next) => {
	try {
		const items = await portfolioService.getMyPortfolio(req.user.sub);
		return sendSuccess(res, { data: { items } });
	} catch (err) { next(err); }
};

const createItem = async (req, res, next) => {
	try {
		const coverFile  = req.files?.cover_image?.[0] || null;
		const extraFiles = req.files?.media || [];
		const item = await portfolioService.createPortfolioItem(
			req.user.sub, req.body, coverFile, extraFiles
		);
		return sendSuccess(res, {
			data: { item }, message: 'Portfolio item added', statusCode: 201,
		});
	} catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
	try {
		const item = await portfolioService.updatePortfolioItem(
			req.user.sub, req.params.itemId, req.body
		);
		return sendSuccess(res, { data: { item }, message: 'Portfolio item updated' });
	} catch (err) { next(err); }
};

const deleteItem = async (req, res, next) => {
	try {
		await portfolioService.deletePortfolioItem(req.user.sub, req.params.itemId);
		return sendSuccess(res, { message: 'Portfolio item deleted' });
	} catch (err) { next(err); }
};

module.exports = {
	getFeed, getMyPortfolio, createItem, updateItem, deleteItem };
