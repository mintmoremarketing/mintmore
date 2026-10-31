// Same rule as the server (mint-more-backend/src/utils/passwordPolicy.js).
export const PASSWORD_RULES = [
	{ key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
	{ key: 'upper', label: 'An uppercase letter', test: pw => /[A-Z]/.test(pw) },
	{ key: 'lower', label: 'A lowercase letter', test: pw => /[a-z]/.test(pw) },
	{ key: 'number', label: 'A number', test: pw => /[0-9]/.test(pw) },
	{ key: 'special', label: 'A special character, like ! @ # or $', test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export const isStrongPassword = (pw = '') => PASSWORD_RULES.every(rule => rule.test(pw))
