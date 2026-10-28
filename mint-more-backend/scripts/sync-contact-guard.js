/**
 * Copies the contact guard to the frontend so the composer can warn while typing.
 * The backend file is the source of truth; run this after editing it:
 *   node scripts/sync-contact-guard.js
 */
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../src/utils/contactGuard.js');
const target = path.join(__dirname, '../../mint-more-frontend/src/utils/contactGuard.js');

let code = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
// The server-only part throws AppErrors and logs; the browser only needs the checks.
code = code.slice(0, code.indexOf('const MODERATED_ROLES')).trimEnd();
code = code.replace(
  /\* The frontend has a copy[\s\S]*?Edit this file, then run that script\.\n/,
  '* Generated from mint-more-backend/src/utils/contactGuard.js by\n * `node scripts/sync-contact-guard.js`. Edit that file, not this one. The server\n * rejects these messages; this copy only warns while typing.\n',
);
code += '\n\nexport { findContactInfo, findSplitContact, stripContactInfo, CONTACT_BLOCKED_MESSAGE };\n';
fs.writeFileSync(target, code);
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
