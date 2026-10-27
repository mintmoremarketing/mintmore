/**
 * Creates demo accounts for walking the services flow end to end:
 * 1 admin, 1 client, 2 freelancers (KYC verified and opted into services).
 * All emails end in @creatyv-demo.test. Passwords are generated and written to
 * scripts/.demo-accounts.json (git-ignored).
 *
 *   node scripts/seed-demo-services.js            # create / refresh
 *   node scripts/seed-demo-services.js --cleanup  # remove demo users and their data
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, pool } = require('../src/config/database');
const { hashPassword } = require('../src/utils/hash');

const DOMAIN = '@creatyv-demo.test';
const OUTPUT = path.join(__dirname, '.demo-accounts.json');

const ACCOUNTS = [
  { key: 'admin', email: `admin${DOMAIN}`, role: 'admin', name: 'Demo Ops Admin' },
  { key: 'client', email: `client${DOMAIN}`, role: 'client', name: 'Demo Client' },
  { key: 'freelancer1', email: `editor.one${DOMAIN}`, role: 'freelancer', name: 'Aarav (Demo Editor)', optIn: 'all' },
  { key: 'freelancer2', email: `designer.two${DOMAIN}`, role: 'freelancer', name: 'Meera (Demo Designer)', optIn: ['youtube-thumbnail', 'social-post-design', 'carousel-design', 'logo-design', 'talking-head-reel'] },
];

const cleanup = async () => {
  const users = await query(`SELECT id FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  const ids = users.rows.map((row) => row.id);
  if (!ids.length) return console.log('No demo users found');
  // Bookings reference templates without cascade from users' jobs, so clear them first.
  await query(`DELETE FROM service_bookings WHERE client_id = ANY($1) OR freelancer_id = ANY($1)`, [ids]);
  await query(`DELETE FROM service_checkouts WHERE client_id = ANY($1)`, [ids]);
  await query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  console.log(`Removed ${ids.length} demo users`);
  if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);
};

const seed = async () => {
  const saved = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')) : {};
  const templates = await query('SELECT id, slug FROM service_templates WHERE is_active');

  for (const account of ACCOUNTS) {
    const password = saved[account.key]?.password || `Demo-${crypto.randomBytes(6).toString('base64url')}`;
    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, role, full_name, is_active, is_approved, is_email_verified,
                          kyc_status, is_super_admin, admin_permissions)
       VALUES ($1,$2,$3,$4,true,true,true,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name, is_active = true,
         kyc_status = EXCLUDED.kyc_status
       RETURNING id`,
      [account.email, passwordHash, account.role, account.name,
        account.role === 'freelancer' ? 'verified' : 'none',
        account.role === 'admin', account.role === 'admin' ? ['*'] : []]
    );
    const userId = result.rows[0].id;

    if (account.optIn) {
      const chosen = account.optIn === 'all' ? templates.rows : templates.rows.filter((t) => account.optIn.includes(t.slug));
      for (const template of chosen) {
        await query(
          `INSERT INTO freelancer_service_optins (freelancer_id, template_id) VALUES ($1,$2)
           ON CONFLICT (freelancer_id, template_id) DO UPDATE SET is_active = true`,
          [userId, template.id]
        );
      }
    }
    saved[account.key] = { email: account.email, password, role: account.role, id: userId };
    console.log(`✓ ${account.role.padEnd(10)} ${account.email}`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(saved, null, 2));
  console.log(`\nCredentials written to ${OUTPUT}`);
};

(process.argv.includes('--cleanup') ? cleanup() : seed())
  .then(() => pool.end())
  .catch(async (err) => { console.error('❌', err.message); await pool.end(); process.exit(1); });
