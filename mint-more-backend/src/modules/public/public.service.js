const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { generateText } = require('../ai/providers/openrouter.provider');

const PRODUCT_CONTEXT = `
CREATYV by Mint More is a creative operating system for Indian businesses.
Phase 1 focuses on internal Mint More fulfilment, not an open freelancer marketplace.
Clients get a monthly creative calendar, MintCoins, custom design requests, Mintbox file storage, messages, social publishing, insights, and Mint AI.
Clients can choose monthly content moments like festivals, sale days, awareness days, offer posts, and campaign creatives.
Each calendar creative usually costs MintCoins. Extra selections can be accepted but marked for Mint More review.
Custom design requests go to Mint More ops first: social posts, reel covers, product creatives, offer creatives, story designs, menus, flyers, banners, and other creative work.
Mintbox stores project files, references, drafts, revisions, and final delivery in project folders.
Designers see assigned tasks, client context, work slots, status, due dates, notes, and upload deliverables to Mintbox.
Freelancer marketplace, matching, negotiation, wallet UI, and public browsing are feature-flagged for later rollout.
When freelancers launch later, they get verified profiles, clear briefs, protected payments, structured revisions, and predictable payouts.
Revision policy: a revision is feedback submitted in one 24-hour window after delivery. The first 3 revision rounds are included; extra rounds can be charged.
The platform is intended for SMBs in India who need regular marketing creatives without managing scattered WhatsApp chats, folders, and spreadsheets.
Use a friendly, direct tone. Keep answers short. If asked pricing that is not final, say pricing is admin-controlled or pilot-specific. Never invent legal, tax, or guaranteed revenue claims.
`;

const FALLBACK_ANSWERS = [
  {
    keys: ['client', 'business', 'who is it for', 'who is this for'],
    answer: 'CREATYV is for Indian SMBs that need regular social media creatives, festival posts, offer creatives, and custom design work without managing scattered chats and files.',
  },
  {
    keys: ['freelancer', 'creator', 'designer'],
    answer: 'Right now Phase 1 sends work to Mint More internal designers. The freelancer marketplace is still in the product architecture and can be enabled later with feature flags.',
  },
  {
    keys: ['mintcoin', 'coin', 'credit'],
    answer: 'MintCoins are the client-facing monthly creative credits. Clients spend them on calendar creatives and some custom requests. Extra selections can go to Mint More for review.',
  },
  {
    keys: ['mintbox', 'file', 'storage', 'upload'],
    answer: 'Mintbox is the project storage area. Brief references, drafts, revisions, and final files stay organised inside each project folder.',
  },
  {
    keys: ['revision', 'feedback', 'changes'],
    answer: 'A revision means all feedback submitted in a single 24-hour window after delivery. The first 3 rounds are included; extra rounds can be charged later.',
  },
  {
    keys: ['price', 'pricing', 'cost', 'subscription'],
    answer: 'Pricing is controlled by Mint More admins during the pilot. Clients mainly see monthly MintCoins and ops-reviewed custom requests, not complex freelancer negotiation.',
  },
];

const fallbackAnswer = (question) => {
  const text = String(question || '').toLowerCase();
  const match = FALLBACK_ANSWERS.find(item => item.keys.some(key => text.includes(key)));
  return match?.answer || 'CREATYV helps businesses plan monthly creatives, send custom design requests, review work in Mintbox, and keep creative operations in one place.';
};

const answerQuestion = async ({ question }) => {
  const cleaned = String(question || '').trim();
  if (cleaned.length < 2) throw new AppError('Ask a question first', 400);
  if (cleaned.length > 500) throw new AppError('Question is too long', 400);

  const prompt = `Answer this visitor question using only the product context. Question: ${cleaned}`;

  try {
    const result = await generateText(
      'openrouter/free',
      prompt,
      { temperature: 0.35, max_tokens: 180 },
      PRODUCT_CONTEXT
    );
    const text = String(result.text || '').trim();
    if (text) return { answer: text, source: 'ai' };
  } catch (error) {
    logger.warn('Public Q&A AI fallback used', { error: error.message });
  }

  return { answer: fallbackAnswer(cleaned), source: 'fallback' };
};

module.exports = { answerQuestion };