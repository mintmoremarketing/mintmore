const { Router } = require('express');
const controller = require('./public.controller');

const router = Router();

router.post('/ask', controller.ask);
router.get('/proxy-download', controller.proxyDownload);

module.exports = router;