const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { globalRateLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { rawBody } = require('./middleware/rawBody');

const healthRouter       = require('./modules/health/health.routes');
const authRouter         = require('./modules/auth/auth.routes');
const profileRouter      = require('./modules/profile/profile.routes');
const kycRouter          = require('./modules/kyc/kyc.routes');
const adminRouter        = require('./modules/admin/admin.routes');
const categoryRouter     = require('./modules/categories/category.routes');
const jobRouter          = require('./modules/jobs/job.routes');
const proposalRouter     = require('./modules/proposals/proposal.routes');
const matchingRouter     = require('./modules/matching/matching.routes');
const negotiationRouter  = require('./modules/negotiation/negotiation.routes');
const notificationRouter = require('./modules/notifications/notification.routes');
const walletRouter       = require('./modules/wallet/wallet.routes');
const paymentRouter      = require('./modules/payments/payment.routes');
const paymentController  = require('./modules/payments/payment.controller');
const chatRouter         = require('./modules/chat/chat.routes');
const whatsappRouter     = require('./modules/whatsapp/webhook.routes');
const socialRouter       = require('./modules/social/social.routes');
const { verifyWebhook: fbVerify, handleWebhook: fbWebhook } = require('./modules/social/social.webhook');
const aiRouter           = require('./modules/ai/ai.routes');
const addonRouter        = require('./modules/addons/addon.routes');
const freelancerRouter   = require('./modules/freelancers/freelancer.routes');
const packageRouter      = require('./modules/packages/package.routes');
const portfolioRouter    = require('./modules/portfolio/portfolio.routes');
const reviewRouter       = require('./modules/reviews/review.routes');
const inquiryRouter      = require('./modules/inquiries/inquiry.routes');
const mintboxRouter      = require('./modules/mintbox/mintbox.routes');
const commerceRouter     = require('./modules/commerce/commerce.routes');
const disputeRouter      = require('./modules/disputes/dispute.routes');
const creativeRouter     = require('./modules/creative/creative.routes');
const supportRouter      = require('./modules/support/support.routes');
const publicRouter       = require('./modules/public/public.routes');

const app = express();
app.set('etag', false);

if (env.node_env === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());

const isAllowedCorsOrigin = (origin) => {
  if (!origin) return true;
  if (env.security.corsOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    if (isLoopback && ['http:', 'https:'].includes(protocol)) return true;
    return false;
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
}));

// ── Raw body routes BEFORE express.json() ────────────────────────────────────
app.post(`/api/${env.apiVersion}/payments/webhook/razorpay`, rawBody, paymentController.razorpayWebhook);
app.use(`/api/${env.apiVersion}/whatsapp`,  whatsappRouter);

// Social webhooks also need raw body
app.get(`/api/${env.apiVersion}/social/webhook/facebook`, fbVerify);
app.post(`/api/${env.apiVersion}/social/webhook/facebook`, rawBody, fbWebhook);

// ── Standard body parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression({
  filter: (req, res) => {
    if ((req.headers.accept || '').includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(`/api/${env.apiVersion}`, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(requestLogger);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.get('/', (_req, res) => res.status(200).json({ service: 'mint-more-api', status: 'ok' }));
app.head('/', (_req, res) => res.sendStatus(200));
app.use('/health', healthRouter);
app.use(`/api/${env.apiVersion}/health`,        healthRouter);
app.use(`/api/${env.apiVersion}`, globalRateLimiter);

app.use(`/api/${env.apiVersion}/public`,        publicRouter);
app.use(`/api/${env.apiVersion}/auth`,          authRouter);
app.use(`/api/${env.apiVersion}/profile`,       profileRouter);
app.use(`/api/${env.apiVersion}/kyc`,           kycRouter);
app.use(`/api/${env.apiVersion}/admin`,         adminRouter);
app.use(`/api/${env.apiVersion}/categories`,    categoryRouter);
app.use(`/api/${env.apiVersion}/jobs`,          jobRouter);
app.use(`/api/${env.apiVersion}/proposals`,     proposalRouter);
app.use(`/api/${env.apiVersion}/matching`,      matchingRouter);
app.use(`/api/${env.apiVersion}/negotiations`,  negotiationRouter);
app.use(`/api/${env.apiVersion}/notifications`, notificationRouter);
app.use(`/api/${env.apiVersion}/wallet`,        walletRouter);
app.use(`/api/${env.apiVersion}/payments`,      paymentRouter);
app.use(`/api/${env.apiVersion}/chat`,          chatRouter);
app.use(`/api/${env.apiVersion}/social`,        socialRouter);
app.use(`/api/${env.apiVersion}/ai`,            aiRouter);
app.use(`/api/${env.apiVersion}/addons`,        addonRouter);
app.use(`/api/${env.apiVersion}/freelancers`,   freelancerRouter);
app.use(`/api/${env.apiVersion}/packages`,      packageRouter);
app.use(`/api/${env.apiVersion}/portfolio`,     portfolioRouter);
app.use(`/api/${env.apiVersion}/reviews`,       reviewRouter);
app.use(`/api/${env.apiVersion}/inquiries`,     inquiryRouter);
app.use(`/api/${env.apiVersion}/mintbox`,       mintboxRouter);
app.use(`/api/${env.apiVersion}/commerce`,      commerceRouter);
app.use(`/api/${env.apiVersion}/disputes`,      disputeRouter);
app.use(`/api/${env.apiVersion}/creative`,      creativeRouter);
app.use(`/api/${env.apiVersion}/support`,       supportRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
