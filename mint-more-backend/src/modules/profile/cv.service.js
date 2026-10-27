const mammoth = require('mammoth');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { generateText } = require('../ai/providers/openrouter.provider');
const { stripContactInfo } = require('../../utils/contactGuard');

const CV_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
const MAX_CV_CHARS = 12000;
const AI_TIMEOUT_MS = 45000;

// Kept in step with the suggestions in the frontend ToolsModal.
const KNOWN_TOOLS = [
  'Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Final Cut Pro', 'CapCut', 'VN Editor', 'Filmora',
  'Photoshop', 'Illustrator', 'Lightroom', 'InDesign', 'Figma', 'Canva', 'Blender', 'Cinema 4D',
  'Audition', 'ElevenLabs', 'Runway', 'Kling AI', 'Midjourney', 'ChatGPT', 'Notion', 'Google Docs', 'Grammarly',
];
const KNOWN_LANGUAGES = ['English', 'Hindi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Urdu', 'Odia'];

const SYSTEM_PROMPT = `You read CVs for CREATYV, a marketplace for video editors, designers and writers.
Return ONLY a JSON object, no prose, with these keys:
{"first_name": string|null, "last_name": string|null, "bio": string|null, "tools": string[], "skills": string[],
 "languages": string[], "city": string|null, "state": string|null, "country": string|null, "years_experience": number|null}
Rules: bio is 2-4 sentences in the first person, at most 600 characters, about the person's creative work and
strengths, with NO phone numbers, emails, links or social handles. tools are software (e.g. "Premiere Pro", "Figma").
skills are short phrases (e.g. "Reel editing", "Colour grading"). Use null or [] when the CV doesn't say.`;

const extractText = async (file) => {
  const kind = CV_MIME_TYPES[file.mimetype];
  if (kind === 'pdf') {
    // unpdf ships as an ES module only.
    const { extractText: extractPdf } = await import('unpdf');
    const { text } = await extractPdf(new Uint8Array(file.buffer), { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : text;
  }
  const { value } = await mammoth.extractRawText({ buffer: file.buffer });
  return value;
};

const cleanList = (value, limit) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => String(item || '').trim().slice(0, 40))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};
const cleanText = (value, max) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, max) : null;
};

/** Pulls the first {...} block out of a model reply and tidies every field. */
const normaliseSuggestions = (raw) => {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in model reply');
  const data = JSON.parse(match[0]);
  const years = Number(data.years_experience);
  return {
    first_name: cleanText(data.first_name, 40),
    last_name: cleanText(data.last_name, 60),
    bio: cleanText(stripContactInfo(data.bio || ''), 600),
    tools: cleanList(data.tools, 30),
    skills: cleanList(data.skills, 20),
    languages: cleanList(data.languages, 10),
    city: cleanText(data.city, 60),
    state: cleanText(data.state, 60),
    country: cleanText(data.country, 60),
    years_experience: Number.isFinite(years) && years >= 0 && years < 60 ? Math.round(years) : null,
  };
};

const SECTION_HEADINGS = {
  summary: /^(?:summary|profile|about(?: me)?|professional summary|objective|career objective)$/i,
  tools: /^(?:tools|software|tools ?(?:&|and) ?software|technical skills)$/i,
  skills: /^(?:skills|key skills|core skills|expertise|core competencies)$/i,
};
const isHeading = (line) => line.length <= 40 && (/^[A-Z][A-Z &/]+$/.test(line) || Object.values(SECTION_HEADINGS).some((re) => re.test(line.replace(/:$/, ''))));

/** Lines under a heading such as SUMMARY, up to the next heading. */
const sectionLines = (lines, name) => {
  const start = lines.findIndex((line) => SECTION_HEADINGS[name].test(line.replace(/:$/, '')));
  if (start < 0) return [];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (isHeading(line)) break;
    body.push(line);
  }
  return body;
};
const splitList = (lines) => lines.join(',').split(/[,•|·;]/).map((item) => item.trim()).filter((item) => item && item.length <= 40);

/** Fallback when the AI is unavailable: reads the name line, common sections and known keywords. */
const basicSuggestions = (text) => {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const nameLine = lines.find((line) => /^[\p{L}][\p{L}.'-]*(?:\s+[\p{L}][\p{L}.'-]*){1,3}$/u.test(line) && line.length <= 40 && !isHeading(line));
  const [first = null, ...rest] = nameLine ? nameLine.split(/\s+/) : [];
  const has = (name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')}\\b`, 'i').test(text);
  const toTitle = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word);
  const years = text.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\b/i);
  const summary = stripContactInfo(sectionLines(lines, 'summary').join(' '));
  // A short line near the top naming a place, e.g. "Pune, Maharashtra, India | …".
  const locationLine = lines.slice(0, 6).map((line) => line.split('|')[0].trim())
    .find((line) => line !== nameLine && /,/.test(line) && !/[@\d]/.test(line) && line.length <= 60) || null;
  return {
    first_name: first ? toTitle(first) : null,
    last_name: rest.length ? rest.map(toTitle).join(' ') : null,
    bio: summary ? summary.slice(0, 600) : null,
    tools: cleanList([...splitList(sectionLines(lines, 'tools')), ...KNOWN_TOOLS.filter(has)], 30),
    skills: cleanList(splitList(sectionLines(lines, 'skills')), 20),
    languages: KNOWN_LANGUAGES.filter(has),
    city: null,
    state: null,
    country: /\bindia\b/i.test(text) ? 'India' : null,
    location_text: locationLine,
    years_experience: years ? Number(years[1]) : null,
  };
};

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('CV parse timed out')), ms)),
]);

/**
 * Reads a PDF or DOCX CV and suggests profile fields. Nothing is saved and the
 * file isn't stored; the freelancer reviews the suggestions before saving.
 */
const parseCv = async (userId, file) => {
  if (!file?.buffer) throw new AppError('Upload your CV as a PDF or Word (.docx) file', 400);
  if (!CV_MIME_TYPES[file.mimetype]) throw new AppError('Your CV must be a PDF or Word (.docx) file', 415);

  let text;
  try {
    text = (await extractText(file) || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  } catch (error) {
    logger.warn('CV text extraction failed', { userId, error: error.message });
    throw new AppError("We couldn't read that file. Try exporting your CV as a PDF again.", 422);
  }
  if (text.length < 40) {
    throw new AppError("We couldn't find any text in that CV. Scanned images can't be read — upload a text PDF or .docx.", 422);
  }
  const excerpt = text.slice(0, MAX_CV_CHARS);

  try {
    const model = process.env.CV_PARSE_MODEL || 'openrouter/free';
    const result = await withTimeout(
      generateText(model, `CV text:\n"""\n${excerpt}\n"""`, { temperature: 0.1, max_tokens: 900 }, SYSTEM_PROMPT),
      AI_TIMEOUT_MS
    );
    const suggestions = normaliseSuggestions(result.text);
    // Models sometimes miss tools that are plainly listed; add the known ones.
    const basic = basicSuggestions(excerpt);
    suggestions.tools = cleanList([...suggestions.tools, ...basic.tools], 30);
    return { suggestions, source: 'ai' };
  } catch (error) {
    logger.warn('CV AI parse failed, using basic extraction', { userId, error: error.message });
    return { suggestions: basicSuggestions(excerpt), source: 'basic' };
  }
};

module.exports = { parseCv, CV_MIME_TYPES, normaliseSuggestions, basicSuggestions };
