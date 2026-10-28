/**
 * Client briefs for storefront services.
 *
 * Each service asks the client a short list of questions before payment. A service can
 * define its own list (service_templates.brief_fields); otherwise its category's default
 * below applies. Answers are stored on the booking and posted as the first chat message.
 *
 * Field: { key, label, type, required, help, options }
 *   type: text | textarea | link | choice | files
 *   files are picked before payment and uploaded into the order chat right after it,
 *   so the server only sees their names here.
 */
const AppError = require('../../utils/AppError');

const FIELD_TYPES = ['text', 'textarea', 'link', 'choice', 'files'];
const MAX_FIELDS = 12;
const MAX_ANSWER_LENGTH = 4000;

const field = (key, label, type, extra = {}) => ({ key, label, type, required: false, help: '', options: [], ...extra });

const VIDEO = [
  field('footage', 'Raw footage link', 'link', { required: true, help: 'Google Drive, Dropbox or WeTransfer link to your clips. Make sure anyone with the link can view.' }),
  field('goal', 'What is this video for?', 'textarea', { required: true, help: 'Platform, the message, and what viewers should do after watching.' }),
  field('format', 'Format', 'choice', { required: true, options: ['9:16 Reels / Shorts', '16:9 YouTube', '1:1 Square', '4:5 Feed'] }),
  field('reference', 'Reference video', 'link', { help: 'A video whose style or pacing you like.' }),
  field('brand_files', 'Logo, fonts or brand files', 'files'),
  field('style_notes', 'Music, captions and style notes', 'textarea'),
];

const DESIGN = [
  field('what', 'What should we design?', 'textarea', { required: true, help: 'The piece, where it will be used, and the size if you know it.' }),
  field('copy', 'Text to put on the design', 'textarea', { help: 'Headlines, offers, contact details. Leave blank if the designer should write it.' }),
  field('brand_files', 'Logo, product photos and brand files', 'files', { required: true }),
  field('reference', 'Reference designs you like', 'link'),
  field('colors', 'Brand colours and fonts', 'text', { help: 'Hex codes or names, if you have them.' }),
];

const UGC = [
  field('product', 'Product link', 'link', { required: true, help: 'Website or store page for the product.' }),
  field('message', 'Key message', 'textarea', { required: true, help: 'The benefit to highlight and what viewers should do next.' }),
  field('audience', 'Who is it for?', 'text', { help: 'Age, interests, location.' }),
  field('dos_donts', 'Do\'s and don\'ts', 'textarea'),
  field('reference', 'Reference video', 'link'),
];

const WRITING = [
  field('topic', 'Topic and goal', 'textarea', { required: true }),
  field('audience', 'Who will read it?', 'text', { required: true }),
  field('tone', 'Tone', 'choice', { required: true, options: ['Friendly', 'Professional', 'Bold', 'Playful'] }),
  field('points', 'Key points or keywords', 'textarea'),
  field('reference', 'Examples or sources', 'link'),
];

const AI = [
  field('what', 'What do you want made?', 'textarea', { required: true }),
  field('inputs', 'Photos or files to work from', 'files'),
  field('reference', 'Reference you like', 'link'),
];

const CONSULTATION = [
  field('topic', 'What would you like to discuss?', 'textarea', { required: true }),
  field('links', 'Website or social profile', 'link'),
  field('times', 'Times that suit you', 'text', { help: 'Days and time ranges, with your time zone.' }),
];

const GENERAL = [
  field('brief', 'Describe what you need', 'textarea', { required: true }),
  field('files', 'Files to work from', 'files'),
  field('reference', 'Reference link', 'link'),
];

const CATEGORY_DEFAULTS = {
  'video-editing': VIDEO,
  design: DESIGN,
  'graphic-design': DESIGN,
  'ugc-creation': UGC,
  'content-writing': WRITING,
  'ai-service': AI,
  consultation: CONSULTATION,
};

const defaultBriefFields = (categorySlug) => CATEGORY_DEFAULTS[categorySlug] || GENERAL;

/** The questions a service asks: its own list, or its category's default. */
const resolveBriefFields = (template) =>
  (Array.isArray(template?.brief_fields) && template.brief_fields.length
    ? template.brief_fields
    : defaultBriefFields(template?.category_slug));

const slugKey = (label, index) =>
  String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `field_${index + 1}`;

/** Cleans an admin-edited field list. null/[] clears it so the category default applies. */
const normalizeBriefFields = (fields) => {
  if (fields === null || (Array.isArray(fields) && fields.length === 0)) return null;
  if (!Array.isArray(fields)) throw new AppError('Brief questions must be a list', 422);
  if (fields.length > MAX_FIELDS) throw new AppError(`A brief can have at most ${MAX_FIELDS} questions`, 422);
  const errors = [];
  const seen = new Set();
  const cleaned = fields.map((raw, index) => {
    const label = String(raw?.label || '').trim().slice(0, 120);
    const type = FIELD_TYPES.includes(raw?.type) ? raw.type : null;
    const options = (Array.isArray(raw?.options) ? raw.options : [])
      .map((option) => String(option).trim().slice(0, 80)).filter(Boolean).slice(0, 12);
    if (!label) errors.push(`Question ${index + 1}: add a label`);
    if (!type) errors.push(`Question ${index + 1}: choose a type`);
    if (type === 'choice' && options.length < 2) errors.push(`Question ${index + 1}: a choice needs at least two options`);
    let key = String(raw?.key || '').trim() || slugKey(label, index);
    while (seen.has(key)) key = `${key}_${index + 1}`;
    seen.add(key);
    return {
      key,
      label,
      type,
      required: !!raw?.required,
      help: String(raw?.help || '').trim().slice(0, 200),
      options: type === 'choice' ? options : [],
    };
  });
  if (errors.length) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
  return cleaned;
};

const isUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Checks a client's answers against the service's questions and returns the stored
 * form: [{ key, label, type, value }], value being a string or, for files, a list of names.
 */
const validateBriefAnswers = (fields, answers = {}, itemLabel = 'This service', { allowIncomplete = false } = {}) => {
  const errors = [];
  const brief = [];
  for (const f of fields) {
    const raw = answers?.[f.key];
    if (f.type === 'files') {
      const names = (Array.isArray(raw) ? raw : [])
        .map((name) => String(name).trim().slice(0, 200)).filter(Boolean).slice(0, 20);
      if (f.required && !allowIncomplete && !names.length) errors.push(`${itemLabel}: attach ${f.label.toLowerCase()}`);
      if (names.length) brief.push({ key: f.key, label: f.label, type: f.type, value: names });
      continue;
    }
    const value = String(raw ?? '').trim();
    if (!value) {
      if (f.required && !allowIncomplete) errors.push(`${itemLabel}: ${f.label} is required`);
      continue;
    }
    if (value.length > MAX_ANSWER_LENGTH) errors.push(`${itemLabel}: ${f.label} is too long`);
    else if (f.type === 'link' && !isUrl(value)) errors.push(`${itemLabel}: ${f.label} must be a full link starting with https://`);
    else if (f.type === 'choice' && !f.options.includes(value)) errors.push(`${itemLabel}: pick an option for ${f.label}`);
    else brief.push({ key: f.key, label: f.label, type: f.type, value });
  }
  return { brief, errors };
};

/** Chat text for the brief. Files arrive as their own messages, so they're only named here. */
const heading = (label) => (/[?:]$/.test(label) ? label : `${label}:`);
const formatBrief = (brief = []) => brief.map((answer) => (
  answer.type === 'files'
    ? `${heading(answer.label)} ${answer.value.length} file${answer.value.length === 1 ? '' : 's'} attached below`
    : `${heading(answer.label)}\n${answer.value}`
)).join('\n\n');

module.exports = { FIELD_TYPES, defaultBriefFields, resolveBriefFields, normalizeBriefFields, validateBriefAnswers, formatBrief };
