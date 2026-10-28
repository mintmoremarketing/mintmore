/**
 * Detects contact details people try to slip past chat moderation, so clients and
 * freelancers can't take an order off Creatyv. It looks at the text several ways
 * (plain, with look-alike characters folded, with spaced-out letters joined, with
 * leetspeak undone) and flags:
 * - phone numbers: spaced or punctuated, written as words in English or Indian
 *   languages, misspelled ("sevem"), as tens ("ninety eight"), "double nine",
 *   with O/l for 0/1, in other scripts, as emoji keycaps or circled digits;
 * - numbers sent a few digits per message (see findSplitContact);
 * - emails, including "name at gmail dot com" and a bare "gmail";
 * - links, except to file and reference hosts;
 * - social handles and "find me on Insta" style requests;
 * - messaging apps, outside payment (UPI, bank details) and "deal directly" talk;
 * - street addresses, pincodes, map links and coordinates.
 *
 * The frontend has a copy at mint-more-frontend/src/utils/contactGuard.js, made by
 * `node scripts/sync-contact-guard.js`. Edit this file, then run that script.
 */

// ── Number words ──────────────────────────────────────────────────────────────

// Each word stands for the digits it is said as: "ten" is "10", "ninety" is "9_" (a
// tens word, which takes the next unit word: "ninety eight" is "98").
const NUMBER_WORDS = {
  // English
  zero: '0', zer0: '0', oh: '0', o: '0', nought: '0', naught: '0', nil: '0', null: '0',
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
  twenty: '2_', thirty: '3_', forty: '4_', fourty: '4_', fifty: '5_', sixty: '6_',
  seventy: '7_', eighty: '8_', ninety: '9_',
  hundred: '00', thousand: '000',
  // Hindi and Marathi
  shunya: '0', sunya: '0', shoonya: '0', shunye: '0', sifar: '0', sifer: '0',
  ek: '1', aek: '1', do: '2', doo: '2', don: '2', teen: '3', tin: '3',
  char: '4', chaar: '4', chaar4: '4', paanch: '5', panch: '5', panj: '5', paach: '5', pach: '5',
  chhe: '6', chhah: '6', chhey: '6', che: '6', chhay: '6', cheh: '6', chheh: '6', saha: '6', chha: '6',
  saat: '7', sat: '7', aath: '8', aat: '8', ath: '8', nau: '9', nao: '9', nav: '9',
  das: '10', dus: '10', gyarah: '11', gyara: '11', barah: '12', bara: '12', terah: '13', tera: '13',
  chaudah: '14', chauda: '14', pandrah: '15', pandra: '15', solah: '16', sola: '16',
  satrah: '17', satra: '17', atharah: '18', athara: '18', unnis: '19', unees: '19',
  bees: '2_', bis: '2_', tees: '3_', tis: '3_', chalis: '4_', chaalis: '4_', pachas: '5_', pachaas: '5_',
  saath: '6_', sattar: '7_', assi: '8_', nabbe: '9_', nabbey: '9_',
  // Bengali, Gujarati
  dui: '2', chhoy: '6', noy: '9', shunno: '0', tran: '3',
  // Tamil, Telugu, Kannada, Malayalam
  poojyam: '0', sunna: '0', sonne: '0', onnu: '1', okati: '1', ondu: '1',
  rendu: '2', randu: '2', eradu: '2', moonu: '3', moodu: '3', mooru: '3', moonnu: '3',
  naalu: '4', nalugu: '4', nalku: '4', anju: '5', aidu: '5', anchu: '5', aaru: '6',
  ezhu: '7', edu: '7', elu: '7', ettu: '8', enimidi: '8', entu: '8',
  onbadhu: '9', tommidi: '9', ombattu: '9', onpathu: '9',
  // Devanagari
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
  'छह': '6', 'छः': '6', 'छे': '6', 'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10',
};

// Sound-alikes that are ordinary words too. They only count next to another
// spelled-out digit ("nine for two"), never next to plain digits ("10:30 to 11").
const WEAK_WORDS = {
  to: '2', too: '2', tu: '2', tw0: '2', for: '4', fore: '4', fo: '4', won: '1', wan: '1', wun: '1',
  ate: '8', ait: '8', tree: '3', free: '3', nein: '9', nyne: '9', sicks: '6', sax: '6',
};

// Real words a typo match must not mistake for a number ("fine" is not "nine").
const NOT_NUMBERS = new Set([
  'fine', 'line', 'mine', 'wine', 'dine', 'pine', 'nice', 'none', 'nina', 'nike', 'vine', 'nile', 'mile',
  'fire', 'file', 'hive', 'give', 'live', 'dive', 'jive', 'fife', 'fice', 'five',
  'tour', 'pour', 'your', 'sour', 'hour', 'four', 'flour', 'foul', 'fort', 'form', 'font', 'fork', 'four',
  'hero', 'xero', 'zeros', 'even', 'sever', 'steven', 'seven', 'weight', 'eighth', 'sight',
  'there', 'thee', 'throw', 'three', 'forth', 'fifth', 'sixth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'plenty', 'twin', 'twins', 'tone', 'gone', 'done', 'bone', 'cone', 'lone', 'once', 'ones', 'oney',
  'mix', 'fix', 'sit', 'six', 'ten', 'tan', 'tin', 'teen', 'ton', 'den', 'hen', 'men', 'pen', 'when', 'then',
]);

// Words that can sit between the digits of one number.
const CONNECTORS = new Set([
  'and', 'n', '&', 'then', 'next', 'comma', 'dash', 'hyphen', 'space', 'dot', 'plus', 'aur', 'or', 'phir', 'fir',
  'also', 'after', 'that', 'is', 'hai', 'h', 'ka', 'ki', 'ke', 'se', 'digit', 'digits', 'no', 'num', 'number',
]);

// Characters people swap in for digits inside a number ("98o76 5432l").
const LOOK_ALIKE_DIGITS = { o: '0', i: '1', l: '1', '|': '1', z: '2', e: '3', a: '4', s: '5', t: '7', b: '8', g: '9', q: '9' };

// ── Character folding ─────────────────────────────────────────────────────────

// Cyrillic and Greek letters that look like Latin ones.
const HOMOGLYPHS = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w', ү: 'y', һ: 'h', ӏ: 'l', з: '3', б: '6', ч: '4',
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
  ℓ: 'l', '٠': '0',
};

// Dingbat and enclosed digits that Unicode normalisation leaves alone.
const ENCLOSED_DIGITS = [
  [0x2776, 1], [0x2780, 1], [0x278a, 1], // ❶ ➀ ➊ … ten of each, the last being 10
  [0x24f5, 1], // ⓵ … ⓾
];
const foldEnclosed = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp === 0x24ff || cp === 0x24ea) return '0'; // ⓿ ⓪
  if (cp === 0x1f51f) return '10'; // 🔟
  for (const [start, first] of ENCLOSED_DIGITS) {
    if (cp >= start && cp < start + 10) return String(first + cp - start);
  }
  return ch;
};

// Any script's decimal digit (Bengali, Tamil, Arabic-Indic, Gujarati …) as ASCII.
const DECIMAL_DIGIT = /\p{Nd}/u;
const asciiDigit = (ch) => {
  const cp = ch.codePointAt(0);
  for (let k = 0; k <= 9; k += 1) {
    const start = cp - k;
    if (DECIMAL_DIGIT.test(String.fromCodePoint(start)) && !DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) {
      return String(k);
    }
  }
  return ch;
};

// Accents ("n\u00ecne"), invisible characters, keycap marks and variation selectors, by code point.
const LATIN_MARKS = [[0x0300, 0x036f], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x20d0, 0x20ff], [0xfe20, 0xfe2f]];
const INVISIBLE = [[0x00ad, 0x00ad], [0x034f, 0x034f], [0x061c, 0x061c], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180e, 0x180e],
  [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x206a, 0x206f], [0xfe00, 0xfe0f], [0xfeff, 0xfeff]];
const dropRanges = (text, ranges) => Array.from(text)
  .filter((ch) => { const cp = ch.codePointAt(0); return !ranges.some(([from, to]) => cp >= from && cp <= to); })
  .join('');

/** Lowercase and fold look-alike characters into plain ASCII. */
const normalise = (input) => {
  let text = String(input || '').normalize('NFKC');
  text = Array.from(text, (ch) => {
    if (/[0-9]/.test(ch)) return ch;
    if (DECIMAL_DIGIT.test(ch)) return asciiDigit(ch);
    return foldEnclosed(ch);
  }).join('');
  text = dropRanges(dropRanges(text.normalize('NFKD'), LATIN_MARKS).normalize('NFC'), INVISIBLE);
  return text
    .toLowerCase()
    .replace(/[\s\S]/g, (ch) => HOMOGLYPHS[ch] || ch)
    // Fancy quotes and dashes.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-―−]/g, '-');
};

/** Joins letters typed one at a time ("n i n e", "g.m.a.i.l") into a word. */
const joinSpacedLetters = (text) => text.replace(
  /(?<![\p{L}\p{N}])\p{L}(?:[\s.\-_*/\\|,]{1,3}\p{L}(?![\p{L}\p{N}])){2,}/gu,
  (match) => match.replace(/[^\p{L}]/gu, ''),
);

// Leetspeak for word checks ("wh4ts4pp", "1nst4", "t3l3gram").
const LEET_LETTERS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'l' };
const unleet = (text) => text.replace(/[\p{L}0-9@$!|]+/gu, (word) => (/\p{L}/u.test(word) ? word.replace(/[0134578@$!|]/g, (c) => LEET_LETTERS[c]) : word));

/** "whaaatsappp" and "whatsapp" both become "whatsap". */
const squash = (text) => text.replace(/(\p{L})\1+/gu, '$1');

// ── Phone numbers ─────────────────────────────────────────────────────────────

/** Optimal string alignment distance, capped: enough to say "one typo away". */
const typoDistance = (a, b, cap = 2) => {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
};

const ENGLISH_WORDS = Object.keys(NUMBER_WORDS).filter((w) => /^[a-z]+$/.test(w) && w.length >= 4 && !['hundred', 'thousand'].includes(w));
const SQUASHED_WORDS = Object.fromEntries(Object.entries(NUMBER_WORDS).map(([w, v]) => [squash(w), v]));
const typoCache = new Map();

/** A number word, exact, with stretched letters, or one typo off ("sevem", "eigth"). */
const numberWord = (word) => {
  if (NUMBER_WORDS[word]) return { value: NUMBER_WORDS[word], typo: false };
  const squashed = squash(word);
  // "niiine" is nine, but "at" is not "aat" (eight in Hindi).
  if (squashed !== word && squashed.length >= 4 && SQUASHED_WORDS[squashed]) return { value: SQUASHED_WORDS[squashed], typo: false };
  if (word.length < 4 || NOT_NUMBERS.has(word) || !/^[a-z]+$/.test(word)) return null;
  if (typoCache.has(word)) return typoCache.get(word);
  let found = null;
  for (const candidate of ENGLISH_WORDS) {
    const allowed = candidate.length >= 7 ? 2 : 1;
    if (typoDistance(word, candidate, allowed) <= allowed || typoDistance(squashed, squash(candidate), allowed) <= allowed) {
      found = { value: NUMBER_WORDS[candidate], typo: true };
      break;
    }
  }
  if (typoCache.size > 5000) typoCache.clear();
  typoCache.set(word, found);
  return found;
};

/** Splits run-together number words: "nineeightseven", "ninetyeight". */
const splitGluedWords = (word) => {
  if (word.length < 6 || !/^[a-z]+$/.test(word)) return null;
  const best = new Array(word.length + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < word.length; i += 1) {
    if (!best[i]) continue;
    for (let j = i + 2; j <= Math.min(word.length, i + 9); j += 1) {
      const piece = word.slice(i, j);
      const value = NUMBER_WORDS[piece] || (piece.length >= 4 && SQUASHED_WORDS[piece]);
      if (value && piece !== 'o' && (!best[j] || best[j].length > best[i].length + 1)) best[j] = [...best[i], value];
    }
  }
  return best[word.length] && best[word.length].length >= 2 ? best[word.length] : null;
};

/** Turns tens words into digits: ["9_", "8"] is "98", a lone "9_" is "90". */
const resolveTens = (values) => values.map((v, i) => {
  if (!v.endsWith('_')) return v;
  const next = values[i + 1];
  return next && /^[1-9]$/.test(next) ? v[0] : `${v[0]}0`;
}).join('');

const PUNCTUATION_ONLY = /^[^\p{L}\p{N}]+$/u;

/** Breaks text into tokens and labels the number-ish ones. */
const numberTokens = (text) => {
  const raw = text
    .replace(/[:#=;"'`~^]/g, ' ')
    // "nine-eight-seven", "9-eight", "nine.eight"
    .replace(/(\p{L}\p{M}*)[-._*/\\,|+]+(?=\p{L})|(\p{L}\p{M}*)[-._*/\\,|]+(?=[0-9])|([0-9])[-._*/\\,|]+(?=\p{L})/gu, '$1$2$3 ')
    // "number:98765" → "number 98765", but "98o7" stays together for the look-alike check.
    .replace(/([a-z]{2,})(?=[0-9])|([0-9])(?=[a-z]{2,})/g, '$1$2 ')
    .split(/\s+/)
    .filter(Boolean);

  const tokens = [];
  for (let i = 0; i < raw.length; i += 1) {
    const original = raw[i];
    const token = original.replace(/^[^\p{L}\p{M}\p{N}+]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
    if (!token || PUNCTUATION_ONLY.test(token)) { tokens.push({ kind: 'sep', has: original.includes('+') }); continue; }

    const repeat = { double: 2, triple: 3, dubble: 2, dabal: 2, tripple: 3 }[token];
    if (repeat && i + 1 < raw.length) {
      const next = raw[i + 1].replace(/[^\p{L}\p{N}]/gu, '');
      const word = /^[0-9]$/.test(next) ? { value: next } : numberWord(next);
      if (word && /^[0-9]$/.test(word.value)) {
        tokens.push({ kind: 'num', value: word.value.repeat(repeat), word: true });
        i += 1;
        continue;
      }
    }

    // Digits with look-alike letters mixed in: "98o76", "9876s432l0".
    const digitCount = (token.match(/[0-9]/g) || []).length;
    if (digitCount && /^\+?[0-9oilzeastbgq|().\-_/*,]+$/.test(token) && digitCount >= 2 && digitCount * 2 >= token.replace(/[^a-z0-9]/g, '').length) {
      const lookAlike = /[a-z|]/.test(token);
      const value = token.replace(/[a-z|]/g, (c) => LOOK_ALIKE_DIGITS[c] || '').replace(/[^0-9]/g, '');
      tokens.push({ kind: 'num', value, lookAlike, plus: token.startsWith('+'), chunk: value.length });
      continue;
    }
    if (/^\+?[0-9][0-9().\-_/*,+]*$/.test(token)) {
      const value = token.replace(/[^0-9]/g, '');
      tokens.push({ kind: 'num', value, plus: token.startsWith('+'), chunk: value.length });
      continue;
    }

    const word = numberWord(token);
    if (word) { tokens.push({ kind: 'num', value: word.value, word: true, typo: word.typo }); continue; }
    const glued = splitGluedWords(token);
    if (glued) { tokens.push({ kind: 'num', value: resolveTens(glued), word: true }); continue; }
    // Words stuck to digits: "9eight7six".
    if (/[0-9]/.test(token) && /[a-z]/.test(token)) {
      const parts = token.match(/[0-9]+|[a-z]+/g);
      const values = parts.map((p) => (/[0-9]/.test(p) ? p : (numberWord(p)?.value || splitGluedWords(p)?.join('') || null)));
      if (values.every(Boolean)) { tokens.push({ kind: 'num', value: resolveTens(values), word: true }); continue; }
    }
    if (WEAK_WORDS[token]) { tokens.push({ kind: 'weak', value: WEAK_WORDS[token] }); continue; }
    if (CONNECTORS.has(token)) { tokens.push({ kind: 'sep' }); continue; }
    tokens.push({ kind: 'word', length: token.length });
  }
  return tokens;
};

/** Groups number tokens into runs. Loose runs may skip a couple of filler words. */
const numberRuns = (tokens) => {
  const runs = [];
  let run = null;
  let gap = 0;
  const close = () => { if (run && run.parts.length) runs.push(run); run = null; gap = 0; };
  tokens.forEach((token, index) => {
    if (token.kind === 'num' || token.kind === 'weak') {
      if (token.kind === 'weak') {
        // A sound-alike only counts beside a spelled-out digit.
        const near = [tokens[index - 1], tokens[index + 1]].some((t) => t && t.kind === 'num' && t.word);
        if (!near) { if (run) gap += 0; return; }
      }
      if (!run) run = { parts: [], loose: false, plus: false };
      if (gap) run.loose = true;
      gap = 0;
      run.parts.push(token);
      if (token.plus) run.plus = true;
    } else if (token.kind === 'sep') {
      if (token.has && !run) run = { parts: [], loose: false, plus: true };
    } else if (run) {
      gap += 1;
      if (gap > 2 || token.length > 7) close();
    }
  });
  close();
  return runs;
};

const INDIAN_MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;
const MOBILE_INSIDE = /[6-9]\d{9}/;

// "1, 2, 3, 4, 5, 6, 7, 8" is a list, not a number. Counting down is how people hide one.
const isCountingList = (parts) => parts.length >= 4 && Number(parts[0].value) <= 1
  && parts.every((p, i) => /^[0-9]$/.test(p.value) && (i === 0 || Number(p.value) - Number(parts[i - 1].value) === 1));

const runIsPhone = (run) => {
  const digits = run.parts.map((p) => p.value).join('');
  if (digits.length < 7 || isCountingList(run.parts)) return false;
  const chunks = run.parts.filter((p) => p.chunk !== undefined);
  const spelled = run.parts.some((p) => p.word || p.kind === 'weak' || p.lookAlike);
  const tiny = chunks.length >= 4 && chunks.filter((p) => p.chunk <= 2).length >= 3;

  if (run.loose && (run.parts.length < 3 || chunks.some((p) => p.chunk > 5))) return false;
  if (run.loose) return MOBILE_INSIDE.test(digits) || (digits.length >= 10 && /^(?:\+?91|0)/.test(digits) && spelled);
  if (spelled) return digits.length >= 8;
  if (tiny) return digits.length >= 9 || INDIAN_MOBILE.test(digits);
  if (INDIAN_MOBILE.test(digits)) return true;
  // Landlines with an STD code, international numbers, or any unbroken long block.
  return (/^0\d{9,11}$/.test(digits))
    || (run.plus && digits.length >= 10 && digits.length <= 15)
    || chunks.some((p) => p.chunk >= 10)
    || (digits.length >= 10 && digits.length <= 13 && chunks.length <= 4 && MOBILE_INSIDE.test(digits));
};

const hasPhoneNumber = (text) => {
  const views = [text, joinSpacedLetters(text)];
  return views.some((view) => numberRuns(numberTokens(view)).some(runIsPhone));
};

/** The digits a message is made of, when it is nothing but a number ("98", "nine eight"). */
const fragmentDigits = (text) => {
  const tokens = numberTokens(joinSpacedLetters(normalise(text)));
  if (!tokens.length || tokens.some((t) => t.kind === 'word')) return null;
  const digits = tokens.filter((t) => t.kind === 'num' || t.kind === 'weak').map((t) => t.value).join('');
  return digits.length >= 1 && digits.length <= 7 ? digits : null;
};

// ── Emails, links, handles ────────────────────────────────────────────────────

const TLD = '(?:com|in|net|org|co|io|me|info|biz|xyz|online|site|app|dev|ai|us|uk|ly|gg|to|tv|page|store|shop|link|live|email|mail|club|pro|world|tech|cc|ca|au|ee|bio|gl|gd|sh|fm|ws|id|pk|bd|lk|np|ae|sg|de|fr|nl|eu|asia|art|design|studio|work|agency|media|social|chat|contact)';

/** Spelled-out email and link pieces back into symbols: "raj at gmail dot com". */
const unspell = (text) => text
  .replace(/\s*[([{<]\s*(at|dot)\s*[)\]}>]\s*/g, ' $1 ')
  .replace(/(\w)\s*(?:@|\bat\s*the\s*rate\s*(?:of)?\b|\battherate\b|\batrate\b|\bat\s*sign\b|\bat\b)\s*(?=\w)/g, '$1@')
  .replace(new RegExp(`\\s*(?:\\bdot\\b|\\bdaat\\b|\\bdott\\b|\\.|\\bpoint\\b|\\bperiod\\b)\\s*(?=${TLD}\\b)`, 'g'), '.')
  .replace(new RegExp(`(\\w)(?:dot)(${TLD})\\b`, 'g'), '$1.$2');

const EMAIL = new RegExp(`[a-z0-9._%+-]+@[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.${TLD}\\b`);
const MAIL_WORDS = /\b(?:g\s?-?mail|gmial|gmal|gmaill|jimail|gmeil|ymail|yahoo|yahu|hotmail|hotmial|outlook\.|rediffmail|rediff|protonmail|proton\s?mail|icloud|aol|zoho\s?mail|e-?mail\s*(?:id|me|address|kar|karo|bhejo|send|pe|par|on)|mail\s*(?:id|me|kar|karo|bhejo|pe|par)|my\s+e?-?mail|your\s+e?-?mail|ur\s+e?-?mail|apna\s+e?-?mail|mera\s+e?-?mail)\b/;
const UPI_ID = /\b[a-z0-9._-]{2,}@(?:ok(?:axis|hdfcbank|icici|sbi)|ybl|ibl|axl|apl|upi|paytm|oksbi|airtel|jio|freecharge|kotak|icici|hdfcbank|sbi|axisbank|yesbank|idfcbank|pnb|barodampay|unionbank|waicici|wahdfcbank|waaxis|wasbi|axisb|ikwik|fbl|pz|abfspay|timecosmos|naviaxis|superyes|yapl|rapl)\b/;

// Links people can share: file transfer, design tools, and (from clients) references.
const FILE_HOSTS = /^(?:drive\.google\.com|docs\.google\.com|dropbox\.com|dl\.dropboxusercontent\.com|wetransfer\.com|we\.tl|onedrive\.live\.com|1drv\.ms|figma\.com|canva\.com|frame\.io|f\.io|mintmore\.vercel\.app|creatyv\.(?:com|in|app))$/;
const REFERENCE_LINKS = [
  /^(?:youtube\.com\/(?:watch|shorts\/)|youtu\.be\/|m\.youtube\.com\/(?:watch|shorts\/))/,
  /^instagram\.com\/(?:p|reel|reels|tv)\//,
  /^(?:pinterest\.[a-z.]+\/pin\/|pin\.it\/)/,
  /^behance\.net\/gallery\//, /^dribbble\.com\/shots\//, /^vimeo\.com\/\d/,
  /^(?:unsplash\.com|pexels\.com|freepik\.com|elements\.envato\.com|pixabay\.com)\//,
];
const LINK = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s]+|\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.${TLD}\\b(?:\\/[^\\s]*)?`, 'g');

const findBadLink = (text, role) => {
  for (const match of text.match(LINK) || []) {
    const link = match.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[),.!?]+$/, '');
    if (/@/.test(link)) continue; // emails are reported as emails
    const host = link.split(/[/?#]/)[0];
    if (FILE_HOSTS.test(host)) continue;
    if (role !== 'freelancer' && role !== 'designer' && REFERENCE_LINKS.some((pattern) => pattern.test(link))) continue;
    return true;
  }
  return false;
};

// @handles, and naming an account to look up.
const HANDLE = /(?:^|[\s(])@\s?[a-z][a-z0-9._]{2,}/;
const HANDLE_ASK = /\b(?:my|mera|meri|apna|apni|our|hamara|your|ur|apka|aapka|tera|teri)\s+(?:insta(?:gram)?|ig|fb|facebook|linkedin|twitter|x\s+handle|youtube|yt|channel|page|handle|account|acc|profile|id|username|user\s?name|snap|threads)\b|\b(?:insta(?:gram)?|ig|fb|facebook|linkedin|twitter|youtube|yt|threads)\s*(?:id|handle|account|acc|profile|username|user\s?name|page|pe|par|mein|me\s+(?:add|search|follow|dm|msg|message|find)|on)\b|\b(?:follow|add|search|find|dm|ping|message|msg|text)\s+(?:me|us|kar(?:o|na|lo)?)\s+(?:on|at|in|via|pe|par)\b|\b(?:search|find|follow|add)\s+(?:for\s+)?(?:me|us)\b|\b(?:username|user\s?name|handle)\s+(?:is|hai|h)\b|\b(?:channel|page|account|profile|id|naam|name)\s+(?:search|dhundh|dhoondh|dhund|follow)|\b(?:search|dhundh|dhoondh|dhund|google)\s+(?:kar|karo|kar\s?lo|kar\s?lena|lo|le|karna)\b|\b(?:on|at)\s+(?:insta(?:gram)?|ig|fb|facebook|linkedin|twitter|threads)\s+(?:as|@|it'?s|its|i'?m|im)\b/;

// Messaging and calling apps have no place in a Creatyv order.
const MESSAGING_APPS = /\b(?:wh?a+t+'?s+\s?-?a+p+s?|wh?at+s+ap+|wat+s+ap+|wha?t+ap+|whtsap+|wtsp+|wts\s?ap+|whts|wp\s+(?:me|pe|par|on|kar|karo|no|number)|w\.?\s?a\.?\s?(?:me|no|num|number|pe|par)|w\s?\/\s?a|vat+s+ap+|watsup|whatsup|telegram|telegrm|telgram|tele\s?gram|tg\s+(?:me|id|pe|par|on)|t\.me|wa\.me|signal\s+(?:app|me|pe|par|on|number)|skype|discord|snap\s?chat|snapchat|wechat|viber|imo\s+(?:pe|par|me|on|number)|botim|zoom\s+(?:call|meet|meeting|link|id|pe|par)|google\s+meet|g\s?meet|hangouts|ms\s+teams|teams\s+(?:call|meeting|link)|facetime|messenger)\b|व्हाट्सए?प|व्हाट्सऐप|वॉट्सऐप|टेलीग्राम/;
const COMPACT_APPS = /whatsap|telegram|snapchat|wechat|gmail|hotmail|rediffmail|protonmail|phonepe|paytm/;

// Payment or contact outside Creatyv.
const OFF_PLATFORM = [
  /\b(?:call|cal|phone|ring|text|sms|ping|msg|message|dm|contact|reach|buzz|whatsapp)\s+(?:me|karo|kar|karna|krna|kro|kar\s?do|us|him|her)\b/,
  /\b(?:call|phone|baat)\s+(?:pe|par|on)\b/, /\bdm\b/, /\binbox\s+me\b/,
  /\b(?:my|mera|meri|apna|apni|your|ur|yr|aapka|apka|tera|tumhara|his|her|uska|personal|private)\s+(?:number|no\.?|num|nmbr|nbr|mobile|mob|cell|phone|ph|contact|whats|wa|digits|landline|insta|ig|email|mail|address|location|adress|addr)\b/,
  /\b(?:mobile|mobil|phone|phn|fone|fon|contact|cntct|cell|cel|ph|mob|mbl|whatsapp|wa|personal)\s*(?:number|no\.?|num|nmbr|nbr|details)(?![a-z])/,
  /\b(?:number|no\.?|num|nmbr|contact)\s+(?:do|de|dedo|dijiye|dena|bhejo|bhej|send|share|please|pls|plz|chahiye|milega|batao|bata|dalo|likho|de\s?do)\b/,
  /\b(?:tel|ph|mob|cell|contact)\s*:/, /[☎\u{1f4de}\u{1f4f1}\u{1f4f2}\u{1f4e7}\u{1f4e9}✉\u{1f4e8}\u{1f4e0}]/u,
  /\b(?:gpay|g\s?pay|google\s?pay|phone\s?pe|phonepe|paytm|bhim|upi|paypal|neft|imps|rtgs|ifsc|qr\s?code|scan\s+(?:and|&|n|kar|karke)\s+pay|bank\s+(?:account|acc|details|transfer)|account\s+(?:no|number|details)|a\/c\s*(?:no)?|cash\s+(?:payment|pay|me|dena|de\s?do|on)|pay\s+(?:in\s+)?cash)\b/,
  /\b[a-z]{4}0[a-z0-9]{6}\b(?=.*\b(?:ifsc|bank|account|branch)\b)/,
  /\b(?:pay|talk|deal|contact|connect|chat|baat|work|kaam)\s+(?:me\s+|with\s+me\s+|karo\s+|karte\s+(?:hai|hain)\s+)?(?:directly|direct|outside|bahar|off\s?(?:the\s+)?platform|privately|personally)\b/,
  /\b(?:direct|personal|private|outside)\s+(?:deal|payment|pay|chat|contact|talk|baat|kaam|work|number)\b/,
  /\boutside\s+(?:of\s+)?(?:creatyv|the\s+(?:platform|app|site)|this\s+(?:app|site|platform)|here)\b/, /\boff\s?-?platform\b/,
  /\b(?:without|bina|skip|avoid|save|bacha(?:o|na)?)\s+(?:the\s+)?(?:creatyv|platform|commission|fee|fees|cut)\b/, /\bcommission\s+(?:bach|save|bachao)/,
  /\bbahar\s+(?:baat|deal|kaam|milte|pay|payment)\b/, /(?:फोन|फ़ोन|नंबर|नम्बर|मोबाइल|ईमेल|इंस्टा|कॉल)/u,
];

// ── Addresses ─────────────────────────────────────────────────────────────────

const ADDRESS_ASK = /\b(?:my|mera|meri|your|ur|apna|apka|aapka|home|ghar\s+ka|office|shop|studio|full|exact|permanent|current|residential|delivery|postal)\s+(?:address|adress|addr|location|loc|pincode|pin\s?code)\b|\b(?:address|adress|location|pincode|pin\s?code)\s+(?:do|de|dedo|bhejo|send|share|batao|bata|please|pls|plz|kya|is|hai|chahiye)\b|\b(?:send|share|drop)\s+(?:me\s+)?(?:your\s+|ur\s+|the\s+)?(?:address|location|live\s+location|pin)\b|\blive\s+location\b|\b(?:come|aao|aa\s+jao|visit|milo|mil\s+lo)\s+(?:to\s+)?(?:my|mere|meri|our|hamare)\s+(?:home|house|place|office|shop|studio|ghar|flat)\b|\bmeet\s+(?:me\s+|us\s+)?(?:in\s+person|offline|irl|personally|face\s+to\s+face|outside)\b|\b(?:milte|mil\s+ke|milke)\s+(?:hai|hain|baat|baat\s+karte)\b|पता\s+(?:भेजो|दो|बताओ)|एड्रेस/;
const ADDRESS_UNIT = /\b(?:h\.?\s?no|house\s?(?:no|number)?|flat|plot|apartment|apt|appt|tower|wing|floor|sector|sec|block|blk|phase|ward|gali|lane|street|st|road|rd|marg|nagar|colony|society|soc|chowk|cross|main|layout|stage|extension|extn|village|vill|tehsil|district|dist|taluka|po|p\.o|ps|thana|near|opp|opposite|behind|landmark|pin|pincode|zip|bldg|building|complex|enclave|vihar|puram|bagh|ganj|pur|abad|gaon|bazar|bazaar|market|mohalla)\b/g;
const PINCODE = /\b[1-9][0-9]{2}\s?[0-9]{3}\b/;
const MAP_LINK = /\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google|google\.[a-z.]+\/maps|g\.co\/kgs|what3words|w3w\.co|maps\.apple|osm\.org|openstreetmap)\b|\/\/\/[a-z]+\.[a-z]+\.[a-z]+\b/;
const COORDINATES = /\b-?(?:[1-8]?\d(?:\.\d{3,})|90(?:\.0+)?)\s*[°,]?\s*[ns]?\s*[,/ ]\s*-?(?:1[0-7]\d|0?\d{1,2})\.\d{3,}\b/;
const PLUS_CODE = /\b[23456789cfghjmpqrvwx]{4,8}\+[23456789cfghjmpqrvwx]{2,3}\b/;

const hasAddress = (text) => {
  if (ADDRESS_ASK.test(text) || MAP_LINK.test(text) || COORDINATES.test(text) || PLUS_CODE.test(text)) return true;
  // An address is several numbered parts: "Flat 302, Sector 21 … 201301".
  const units = text.match(ADDRESS_UNIT) || [];
  const numbered = (text.match(/\b(?:h\.?\s?no|house(?:\s?no)?|flat|plot|apt|tower|floor|sector|sec|block|phase|ward|gali|lane|street|road|cross|main|stage)\s*(?:no\.?|number|#)?\s*(?:-|:)?\s*[0-9]{1,5}[a-z]?\b|\b[0-9]{1,4}(?:st|nd|rd|th)?\s*(?:floor|cross|main|street|road|lane|block|sector|stage|phase|avenue)\b/g) || []).length;
  const pin = PINCODE.test(text) && /\b(?:pin|pincode|zip|india|delhi|mumbai|bangalore|bengaluru|kolkata|chennai|hyderabad|pune|noida|gurgaon|gurugram|jaipur|lucknow|ahmedabad|state|district|dist|nagar|colony|road|sector|city)\b/.test(text);
  // "H.No 221B", "Flat no 12": a house number alone is an address.
  if (/\b(?:h\.?\s?no|house\s?no|flat\s?no|plot\s?no|door\s?no|qtr\s?no)\.?\s*(?:-|:|#)?\s*[0-9]{1,5}/.test(text)) return true;
  return numbered >= 2 || (numbered >= 1 && (pin || units.length >= 3)) || (pin && units.length >= 2);
};

// ── Checks ────────────────────────────────────────────────────────────────────

/**
 * @param {string} input
 * @param {{ role?: string }} [options] role decides which reference links are allowed.
 * @returns {{ blocked: boolean, reasons: string[] }}
 */
const findContactInfo = (input, { role } = {}) => {
  const text = normalise(input);
  if (!text.trim()) return { blocked: false, reasons: [] };
  const joined = joinSpacedLetters(text);
  const words = [text, joined, unleet(joined), squash(unleet(joined))];
  const spelled = [...new Set(words.map(unspell))];
  const compact = squash(unleet(text).replace(/[^\p{L}]/gu, ''));

  const reasons = [];
  if (hasPhoneNumber(text)) reasons.push('phone');
  if (spelled.some((view) => EMAIL.test(view)) || words.some((view) => MAIL_WORDS.test(view))) reasons.push('email');
  if (spelled.some((view) => UPI_ID.test(view))) reasons.push('upi');
  // Not the squashed views: "https" and "google" must keep their double letters.
  if ([text, joined].map(unspell).some((view) => findBadLink(view, role))) reasons.push('link');
  if (!reasons.includes('email') && !reasons.includes('upi') && (HANDLE.test(text) || words.some((view) => HANDLE_ASK.test(view)))) reasons.push('handle');
  if (words.some((view) => MESSAGING_APPS.test(view)) || COMPACT_APPS.test(compact)
    || words.some((view) => OFF_PLATFORM.some((pattern) => pattern.test(view)))) reasons.push('off_platform');
  if (words.some(hasAddress)) reasons.push('address');
  return { blocked: reasons.length > 0, reasons: [...new Set(reasons)] };
};

/**
 * Catches details sent in pieces: "98" … "76" … "54", or "my id is raj" then
 * "at gmail dot com". `previous` is the sender's recent messages, oldest first.
 */
const findSplitContact = (previous, current, options = {}) => {
  const recent = (previous || []).filter((text) => typeof text === 'string' && text.trim()).slice(-12);
  if (!recent.length || !String(current || '').trim()) return { blocked: false, reasons: [] };

  // Each recent message alone was allowed; together with this one they must not add up.
  for (let k = 1; k <= Math.min(4, recent.length); k += 1) {
    const together = findContactInfo([...recent.slice(-k), current].join(' '), options);
    if (together.blocked && together.reasons.some((r) => ['phone', 'email', 'upi', 'link'].includes(r))) {
      return { blocked: true, reasons: ['split', ...together.reasons] };
    }
  }

  // Digits a few at a time, with the odd "ok" in between.
  const own = fragmentDigits(current);
  if (!own) return { blocked: false, reasons: [] };
  const pieces = [own];
  let skipped = 0;
  for (let i = recent.length - 1; i >= 0 && skipped <= 2; i -= 1) {
    const digits = fragmentDigits(recent[i]);
    if (digits) pieces.unshift(digits);
    else skipped += 1;
  }
  // Prices like "1500" or "2000" on their own aren't parts of a phone number.
  const parts = pieces.filter((p) => !(p.length >= 3 && /(?:00|50)$/.test(p)));
  const total = parts.join('');
  const blocked = parts.length >= 2 && (
    (parts.length >= 3 && total.length >= 7)
    || INDIAN_MOBILE.test(total) || MOBILE_INSIDE.test(total)
    || (parts.length >= 4 && parts.every((p) => p.length <= 2))
  );
  return blocked ? { blocked: true, reasons: ['split', 'phone'] } : { blocked: false, reasons: [] };
};

/** Drops the sentences of a text that contain contact details. */
const stripContactInfo = (input) => String(input || '')
  .split(/(?<=[.!?\n])\s+/)
  .filter((sentence) => !findContactInfo(sentence).blocked)
  .join(' ')
  .trim();

const CONTACT_BLOCKED_MESSAGE = "For your safety, phone numbers, emails, addresses, social handles and outside links can't be shared on Creatyv. Keep the conversation here.";

const MODERATED_ROLES = new Set(['client', 'freelancer', 'designer']);

/**
 * Throws a 422 when a client or freelancer tries to share contact details.
 * Pass `previous` (the sender's recent messages, oldest first) to also catch
 * details split across messages. Logs who and why, never the text itself.
 */
const assertNoContactInfo = (text, { userId, role, where, previous }) => {
  if (!MODERATED_ROLES.has(role)) return;
  let result = findContactInfo(text, { role });
  if (!result.blocked && previous) result = findSplitContact(previous, text, { role });
  if (!result.blocked) return;
  // Required here so the pure helpers above stay free of server imports.
  const AppError = require('./AppError');
  const logger = require('./logger');
  logger.warn('Blocked contact details', { userId, role, where, reasons: result.reasons });
  throw new AppError(CONTACT_BLOCKED_MESSAGE, 422, 'CONTACT_INFO_BLOCKED');
};

module.exports = { findContactInfo, findSplitContact, stripContactInfo, assertNoContactInfo, CONTACT_BLOCKED_MESSAGE };
