const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { globalRateLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { initSSESubscriber } = require('./middleware/sse');
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

// Initialise SSE subscriber (does not require main Redis client)
initSSESubscriber();

const app = express();

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.security.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ── Raw body routes BEFORE express.json() ────────────────────────────────────
app.use(`/api/${env.apiVersion}/payments`,  paymentRouter);
app.use(`/api/${env.apiVersion}/whatsapp`,  whatsappRouter);

// Social webhooks also need raw body
app.get(`/api/${env.apiVersion}/social/webhook/facebook`, fbVerify);
app.post(`/api/${env.apiVersion}/social/webhook/facebook`, rawBody, fbWebhook);

// ── Standard body parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(requestLogger);
app.use(`/api/${env.apiVersion}/health`,        healthRouter);
app.use(`/api/${env.apiVersion}`, globalRateLimiter);

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
app.use(`/api/${env.apiVersion}/chat`,          chatRouter);
app.use(`/api/${env.apiVersion}/social`,        socialRouter);
app.use(`/api/${env.apiVersion}/ai`,            aiRouter);
app.use(`/api/${env.apiVersion}/addons`,        addonRouter);
app.use(`/api/${env.apiVersion}/freelancers`,   freelancerRouter);
app.use(`/api/${env.apiVersion}/packages`,      packageRouter);
app.use(`/api/${env.apiVersion}/portfolio`,     portfolioRouter);
app.use(`/api/${env.apiVersion}/reviews`,       reviewRouter);
app.use(`/api/${env.apiVersion}/inquiries`,     inquiryRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;