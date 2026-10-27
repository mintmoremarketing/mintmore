/**
 * Detects contact details people try to slip past chat moderation: phone
 * numbers (spaced out, written as words, in Hindi, with O/l for 0/1, emoji
 * keycaps), emails ("me at gmail dot com"), UPI ids, social handles and
 * "call me on WhatsApp" style requests.
 *
 * Copy of mint-more-backend/src/utils/contactGuard.js, which is the source of
 * truth (the server rejects these messages). Keep the two in sync; this one
 * only warns while typing.
 */

const DIGIT_WORDS = {
  zero: '0', oh: '0', shunya: '0', sunya: '0', shoonya: '0',
  one: '1', ek: '1',
  two: '2', do: '2',
  three: '3', teen: '3',
  four: '4', char: '4', chaar: '4',
  five: '5', paanch: '5', panch: '5', panj: '5',
  six: '6', chhe: '6', chhah: '6', chhey: '6', che: '6',
  seven: '7', saat: '7', sat: '7',
  eight: '8', aath: '8', aat: '8',
  nine: '9', nau: '9',
};
const DEVANAGARI_ZERO = 0x0966;

const SEPARATOR = /^[\s.\-_()[\]/+,*~|]+$/;
// A token that is part of a number: digits, separators, and O/I/l look-alikes.
const NUMBERISH = /^[0-9oil|.\-_()[\]/+,*~]+$/;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;
const SPELLED_EMAIL = /[a-z0-9._-]{2,}\s*[([{]?\s*(?:at|@)\s*[)\]}]?\s*[a-z0-9-]{2,}\s*[([{]?\s*(?:dot|\.)\s*[)\]}]?\s*(?:com|in|net|org|co|io|me|info)\b/;
const MAIL_PROVIDER = /(?:\bat\b|@|\(at\)|\[at\])\s*(?:gmail|g mail|yahoo|ymail|hotmail|outlook|rediffmail|rediff|protonmail|proton|icloud|live)\b/;
const UPI_ID = /\b[a-z0-9._-]{2,}@(?:ok(?:axis|hdfcbank|icici|sbi)|ybl|ibl|axl|apl|upi|paytm|oksbi|airtel|jio|freecharge|kotak|icici|hdfcbank|sbi|axisbank|yesbank|idfcbank|pnb|barodampay|unionbank)\b/;
const HANDLE = /(?:^|\s)@[a-z][a-z0-9._]{2,}/;

const OFF_PLATFORM = [
  // Messaging apps and their link shorteners.
  /\bwa\.me\b/, /\bwhat'?s\s?app\b/, /\bwhatsap+\b/, /\bwatsa?p+\b/, /\bwhtsapp\b/, /\bwp\s+(?:me|pe|par|on)\b/,
  /\bt\.me\b/, /\btelegram\b/, /\bskype\b/, /\bdiscord\b/, /\bsnap\s?chat\b/, /\bmessenger\b/, /\bfb\.com\b/,
  /\binsta(?:gram)?\b/, /\big\s*(?::|id|handle|pe|par)\b/,
  // Asking to talk or pay outside Creatyv.
  /\b(?:call|phone|ring|text|sms|ping|msg|message|dm)\s+(?:me|karo|kar)\b/, /\bdm\b/,
  /\bmy\s+(?:number|no\.?|mobile|cell|phone|contact|whats)/, /\b(?:mobile|phone|contact|cell)\s+(?:number|no\.?)\b/,
  /\b(?:gpay|g\s?pay|google\s?pay|phone\s?pe|phonepe|paytm|bhim|upi)\b/,
  /\b(?:pay|talk|deal|contact)\s+(?:me\s+)?(?:directly|outside|off\s?(?:the\s+)?platform)\b/,
  /\boutside\s+(?:of\s+)?(?:creatyv|the\s+platform|this\s+(?:app|site|platform))\b/,
];

/** Lowercase and fold look-alike characters into plain ASCII. */
const normalise = (input) => String(input || '')
  .normalize('NFKC')
  .replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - DEVANAGARI_ZERO))
  .replace(/[\uFE0F\u20E3\u200B-\u200D\u2060]/g, '')
  .toLowerCase();

/**
 * Finds digit runs, including ones spelled out or broken up, and reports
 * whether any looks like a phone number.
 */
const hasPhoneNumber = (text) => {
  const tokens = text
    // Split words stuck to digits ("number:98765") but keep "98o7" together.
    .replace(/([a-z]{2,})(?=[0-9])|([0-9])(?=[a-z]{2,})/g, '$1$2 ')
    .replace(/[:#=]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const expanded = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i].replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') || tokens[i];
    const repeat = { double: 2, triple: 3 }[token];
    if (repeat && i + 1 < tokens.length) {
      const next = tokens[i + 1].replace(/[^a-z0-9]/g, '');
      const digit = DIGIT_WORDS[next] || (/^[0-9]$/.test(next) ? next : null);
      if (digit) {
        expanded.push({ value: digit.repeat(repeat), tricky: true });
        i += 1;
        continue;
      }
    }
    if (DIGIT_WORDS[token]) {
      expanded.push({ value: DIGIT_WORDS[token], tricky: true });
      continue;
    }
    expanded.push({ value: tokens[i], tricky: false });
  }

  let run = [];
  const runs = [];
  const flush = () => { if (run.length) runs.push(run); run = []; };
  for (const part of expanded) {
    const isNumber = SEPARATOR.test(part.value) || (NUMBERISH.test(part.value) && /[0-9]/.test(part.value));
    if (isNumber) run.push(part);
    else flush();
  }
  flush();

  return runs.some((parts) => {
    const raw = parts.map((p) => p.value).join('');
    const lookAlikes = /[oil|]/.test(raw);
    const digits = raw.replace(/o/g, '0').replace(/[il|]/g, '1').replace(/[^0-9]/g, '');
    const digitTokens = parts.filter((p) => /[0-9]/.test(p.value));
    // Spelled out, look-alike letters, or broken into tiny chunks ("98 76 5 4…").
    const tricky = lookAlikes
      || parts.some((p) => p.tricky)
      || (digitTokens.length >= 4 && digitTokens.filter((p) => p.value.replace(/[^0-9]/g, '').length <= 2).length >= 3);
    if (tricky) return digits.length >= 8;
    if (/^(?:\+?91|0)?[6-9]\d{9}$/.test(digits)) return true;
    // International numbers, or one unbroken 10+ digit block.
    return (raw.includes('+') && digits.length >= 10 && digits.length <= 15)
      || digitTokens.some((p) => p.value.replace(/[^0-9]/g, '').length >= 10);
  });
};

/**
 * @returns {{ blocked: boolean, reasons: string[] }}
 */
export const findContactInfo = (input) => {
  const text = normalise(input);
  if (!text.trim()) return { blocked: false, reasons: [] };
  const reasons = [];
  if (hasPhoneNumber(text)) reasons.push('phone');
  if (EMAIL.test(text) || SPELLED_EMAIL.test(text) || MAIL_PROVIDER.test(text)) reasons.push('email');
  if (UPI_ID.test(text)) reasons.push('upi');
  if (!reasons.includes('email') && HANDLE.test(text)) reasons.push('handle');
  if (OFF_PLATFORM.some((pattern) => pattern.test(text))) reasons.push('off_platform');
  return { blocked: reasons.length > 0, reasons };
};

/** Drops the sentences of a text that contain contact details. */
export const stripContactInfo = (input) => String(input || '')
  .split(/(?<=[.!?\n])\s+/)
  .filter((sentence) => !findContactInfo(sentence).blocked)
  .join(' ')
  .trim();

export const CONTACT_BLOCKED_MESSAGE = "For your safety, phone numbers, emails and outside contact details can't be shared on Creatyv. Keep the conversation here.";
