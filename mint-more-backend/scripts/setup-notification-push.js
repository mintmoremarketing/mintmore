const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const webpush = require('web-push');
const target = path.join(__dirname, '../.env');
const contents = fs.readFileSync(target, 'utf8');
const existing = dotenv.parse(contents);
if (existing.VAPID_PUBLIC_KEY && existing.VAPID_PRIVATE_KEY) {
  console.log('VAPID keys already exist; preserved.');
} else if (existing.VAPID_PUBLIC_KEY || existing.VAPID_PRIVATE_KEY) {
  throw new Error('Incomplete VAPID key pair; configure the matching pair without rotating existing subscriptions.');
} else {
  const keys = webpush.generateVAPIDKeys();
  fs.appendFileSync(target, `\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n${existing.VAPID_SUBJECT ? '' : 'VAPID_SUBJECT=https://mintmore.vercel.app\n'}`);
  console.log('Created VAPID keys in the ignored backend .env. No secret values printed.');
}
