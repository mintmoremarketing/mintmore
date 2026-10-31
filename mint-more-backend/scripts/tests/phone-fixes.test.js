const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Load a service with in-memory dependencies. No database or external API is contacted.
function loadWithMocks(path, mocks) {
  const filename = require.resolve(path);
  delete require.cache[filename];
  const original = Module._load;
  Module._load = function (name, parent, ...rest) {
    if (parent?.filename === filename && Object.hasOwn(mocks, name)) return mocks[name];
    return original.call(this, name, parent, ...rest);
  };
  try { return require(filename); } finally { Module._load = original; }
}

const logger = { info() {}, warn() {}, error() {} };

test('KYC approval supplies every SQL parameter and marks the final level verified', async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      const slots = [...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
      assert.equal(slots.length ? Math.max(...slots) : 0, params.length);
      if (sql.startsWith('SELECT * FROM kyc_submissions')) return { rows: [{ user_id: 'demo', level: 'address', status: 'pending' }] };
      if (sql.startsWith('SELECT role FROM users')) return { rows: [{ role: 'freelancer' }] };
      if (sql.includes('COUNT(*)')) return { rows: [{ count: 3 }] };
      return { rows: [] };
    },
    release() {},
  };
  const kyc = loadWithMocks('../../src/modules/kyc/kyc.service', {
    '../../config/database': { getClient: async () => client, query: async () => ({ rows: [{}] }) },
    '../storage/app-storage.provider': {},
    '../../utils/logger': logger,
    '../notifications/notification.triggers': { notifyKycReviewed: async () => {} },
  });
  await kyc.reviewSubmission('demo-submission', 'demo-admin', { status: 'approved' });
  const update = calls.find(call => call.sql.includes("kyc_status = 'verified'"));
  assert.deepEqual(update.params, ['demo', 'address']);
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});

test('password policy rejects missing classes and whitespace as the only symbol', () => {
  const { passwordProblem } = require('../../src/utils/passwordPolicy');
  for (const value of ['lowercase', 'Abcdef12', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef1 ']) {
    assert.ok(passwordProblem(value), `Expected rejection for ${JSON.stringify(value)}`);
  }
  assert.equal(passwordProblem('Abcdef1!'), null);
});

test('changing a password invalidates the stored refresh token', async () => {
  let update;
  const auth = loadWithMocks('../../src/modules/auth/auth.service', {
    '../../config/database': { query: async (sql, params) => {
      if (sql.startsWith('SELECT id, password_hash')) return { rows: [{ id: 'demo', password_hash: 'old-hash' }] };
      update = { sql, params }; return { rows: [] };
    } },
    '../../config/redis': {},
    '../../utils/hash': { comparePassword: async () => true, hashPassword: async () => 'new-hash' },
    '../../utils/jwt': {},
    '../../utils/contactGuard': {},
    '../../utils/logger': logger,
  });
  await auth.changePassword('demo', { current_password: 'old', new_password: 'new' });
  assert.match(update.sql, /refresh_token\s*=\s*NULL/i);
  assert.deepEqual(update.params, ['new-hash', 'demo']);
});

test('new service opt-ins require a matching passed assessment, while existing opt-ins can be kept or disabled', async () => {
  let eligibility = {};
  let writes = 0;
  const service = loadWithMocks('../../src/modules/services/services.service', {
    razorpay: class {},
    '../../config/database': { query: async (sql) => {
      if (sql.includes('FROM service_templates t WHERE t.id')) return { rows: [eligibility] };
      if (sql.includes('INSERT INTO freelancer_service_optins')) { writes += 1; return { rows: [{}] }; }
      throw new Error('Unexpected query');
    } },
    '../../config/env': { payments: { mockCheckout: true }, razorpay: {} },
    '../../utils/logger': logger,
    '../commerce/settings.service': {}, '../wallet/wallet.service': {}, '../chat/chat.service': {},
    '../notifications/notification.service': {}, '../audit/audit.service': {}, './fairMatch': {},
    '../../utils/contactGuard': {}, '../aiEdits/aiEdits.pricing': {}, './briefFields': {}, './allocate': {},
  });
  const template = '11111111-1111-4111-8111-111111111111';
  eligibility = { can_opt_in: false, already_offering: false };
  await assert.rejects(service.setOptIn('demo', template, true), error => error.statusCode === 403);
  assert.equal(writes, 0);
  eligibility = { can_opt_in: true, already_offering: false };
  await service.setOptIn('demo', template, true);
  eligibility = { can_opt_in: false, already_offering: true };
  await service.setOptIn('demo', template, true);
  await service.setOptIn('demo', template, false);
  assert.equal(writes, 3);
});
