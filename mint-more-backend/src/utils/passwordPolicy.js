/**
 * The one password rule for every account: at least 8 characters with an uppercase letter,
 * a lowercase letter, a number and a special character. The web app shows the same list
 * (src/utils/passwordPolicy.js there), so people see what's missing as they type.
 */
const PASSWORD_RULES = [
  { test: (pw) => pw.length >= 8, message: 'at least 8 characters' },
  { test: (pw) => /[A-Z]/.test(pw), message: 'an uppercase letter' },
  { test: (pw) => /[a-z]/.test(pw), message: 'a lowercase letter' },
  { test: (pw) => /[0-9]/.test(pw), message: 'a number' },
  { test: (pw) => /[^\p{L}\p{N}\s]/u.test(pw), message: 'a special character, like ! @ # or $' },
];

/** What the password is missing, as a sentence, or null when it passes. */
const passwordProblem = (password) => {
  const pw = typeof password === 'string' ? password : '';
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(pw)).map((rule) => rule.message);
  if (!missing.length) return null;
  return `Password needs ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0]}`;
};

module.exports = { PASSWORD_RULES, passwordProblem };
