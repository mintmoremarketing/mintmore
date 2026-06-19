const { Router } = require('express');
const controller = require('./public.controller');

const router = Router();

router.post('/ask', controller.ask);

module.exports = router;