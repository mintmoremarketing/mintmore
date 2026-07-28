const { Blob } = require('node:buffer');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000/api/v1';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const READ_ONLY = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_READ_ONLY || '').toLowerCase());
const CHECK_STORAGE_UPLOAD = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_STORAGE_UPLOAD || '').toLowerCase());
const CHECK_AI_GENERATE = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_AI_GENERATE || '').toLowerCase());
const CHECK_SHEETS_SYNC = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_SHEETS_SYNC || '').toLowerCase());
const CHECK_SOCIAL_OAUTH = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_SOCIAL_OAUTH || '').toLowerCase());
const CHECK_PAYMENT_CHECKOUT = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_PAYMENT_CHECKOUT || '').toLowerCase());

const accounts = {
  client: {
    email: process.env.SMOKE_CLIENT_EMAIL || 'qa.client.20260629113318@example.com',
    password: process.env.SMOKE_CLIENT_PASSWORD || 'TestPass1',
  },
  admin: {
    email: process.env.SMOKE_ADMIN_EMAIL || 'qa.admin.20260629113318@example.com',
    password: process.env.SMOKE_ADMIN_PASSWORD || 'TestPass1',
  },
  designer: {
    email: process.env.SMOKE_DESIGNER_EMAIL || 'qa.designer.20260629113318@example.com',
    password: process.env.SMOKE_DESIGNER_PASSWORD || 'TestPass1',
  },
};

const results = [];

const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  const symbol = ok ? 'PASS' : 'FAIL';
  console.log(`${symbol} ${name}${detail ? ` - ${detail}` : ''}`);
};

const request = async (path, { token, method = 'GET', body, expected = [200] } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  return { response, json };
};

const multipartRequest = async (path, { token, method = 'POST', form, expected = [200] } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  return { response, json };
};

const login = async (role) => {
  const { json } = await request('/auth/login', {
    method: 'POST',
    body: accounts[role],
  });
  const token = json?.data?.accessToken;
  if (!token) throw new Error(`Missing access token for ${role}`);
  return token;
};

const check = async (name, fn) => {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (error) {
    record(name, false, error.message);
  }
};

const skip = (name, detail = '') => {
  console.log(`SKIP ${name}${detail ? ` - ${detail}` : ''}`);
};

const expectArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} should be an array`);
  return value;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getModelList = async (clientToken) => {
  const models = await request('/ai/models', { token: clientToken });
  const modelList = models.json?.data?.models || models.json?.data || [];
  return expectArray(modelList, 'AI models');
};

const pickTextModel = (models) => models.find(model =>
  model?.tier === 'free' && model?.supported_tools?.includes('caption')
) || models.find(model =>
  model?.tier === 'free' && model?.supported_tools?.includes('text')
) || models.find(model =>
  model?.supported_tools?.includes('caption') || model?.supported_tools?.includes('text')
);

const run = async () => {
  console.log(`CREATYV API smoke test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`Mode: ${READ_ONLY ? 'read-only' : 'full'}`);
  console.log(
    `Provider checks: storage=${CHECK_STORAGE_UPLOAD}, ai_generate=${CHECK_AI_GENERATE}, ` +
    `sheets=${CHECK_SHEETS_SYNC}, social_oauth=${CHECK_SOCIAL_OAUTH}, payment_checkout=${CHECK_PAYMENT_CHECKOUT}`
  );

  let clientToken;
  let adminToken;
  let designerToken;

  await check('client login', async () => {
    clientToken = await login('client');
    return accounts.client.email;
  });
  await check('admin login', async () => {
    adminToken = await login('admin');
    return accounts.admin.email;
  });
  await check('designer login', async () => {
    designerToken = await login('designer');
    return accounts.designer.email;
  });

  if (!clientToken || !adminToken || !designerToken) {
    throw new Error('Cannot continue smoke test without all three role tokens');
  }

  await check('client entitlements', async () => {
    const { json } = await request('/commerce/entitlements/me', { token: clientToken });
    const entitlements = json?.data?.entitlements || json?.data;
    if (!entitlements?.can_access_mintbox) throw new Error('client cannot access Mintbox');
    if (!entitlements?.feature_flags?.calendar_creatives) throw new Error('calendar_creatives flag is off');
    if (entitlements?.feature_flags?.marketplace) throw new Error('marketplace should be hidden in phase 1');
    return 'phase-1 flags are active';
  });

  await check('client MintCoins', async () => {
    const { json } = await request('/commerce/credits/me', { token: clientToken });
    const account = json?.data?.account || json?.data;
    if (Number(account?.balance || 0) < 0) throw new Error('negative MintCoin balance');
    return `${account?.balance ?? 'unknown'} available`;
  });

  await check('client Mintbox list', async () => {
    const { json } = await request('/mintbox', { token: clientToken });
    const folders = json?.data?.folders || json?.data || [];
    expectArray(folders, 'mintbox folders');
    return `${folders.length} folders`;
  });

  await check('creative calendar', async () => {
    const { json } = await request('/creative/calendar?month=2026-06', { token: clientToken });
    const events = json?.data?.events || json?.data?.calendar || json?.data || [];
    expectArray(events, 'calendar events');
    return `${events.length} events`;
  });

  await check('client creative work list', async () => {
    const { json } = await request('/creative/work', { token: clientToken });
    const work = json?.data?.items || json?.data?.tasks || json?.data || [];
    expectArray(work, 'creative work');
    return `${work.length} items`;
  });

  await check('designer task board', async () => {
    const { json } = await request('/creative/designer/tasks', { token: designerToken });
    const tasks = json?.data?.tasks || json?.data || [];
    expectArray(tasks, 'designer tasks');
    return `${tasks.length} tasks`;
  });

  await check('admin operations overview', async () => {
    const { json } = await request('/creative/admin/overview', { token: adminToken });
    const overview = json?.data || {};
    if (!overview.counts && !overview.tasks && !overview.designers) {
      throw new Error('overview payload missing operating data');
    }
    return 'overview loaded';
  });

  await check('admin commercial settings', async () => {
    const { json } = await request('/commerce/admin/settings', { token: adminToken });
    const settings = json?.data?.settings || json?.data || [];
    expectArray(settings, 'admin settings');
    return `${settings.length} settings`;
  });

  await check('admin audit records', async () => {
    const { json } = await request('/commerce/admin/audit?limit=5', { token: adminToken });
    const records = json?.data?.logs || json?.data?.records || json?.data?.items || json?.data || [];
    expectArray(records, 'audit records');
    return `${records.length} records`;
  });

  await check('social account and post lists', async () => {
    const accountsResult = await request('/social/accounts', { token: clientToken });
    const postsResult = await request('/social/posts', { token: clientToken });
    const connectedAccounts = accountsResult.json?.data?.accounts || accountsResult.json?.data || [];
    const posts = postsResult.json?.data?.posts || postsResult.json?.data || [];
    expectArray(connectedAccounts, 'social accounts');
    expectArray(posts, 'social posts');
    return `${connectedAccounts.length} accounts, ${posts.length} posts`;
  });

  if (CHECK_SOCIAL_OAUTH) {
    await check('provider social OAuth redirects', async () => {
      const expectedHosts = {
        facebook: 'https://www.facebook.com/',
        youtube: 'https://accounts.google.com/',
      };
      const platforms = [];
      for (const [platform, expectedHost] of Object.entries(expectedHosts)) {
        const response = await fetch(`${BASE_URL}/social/connect/${platform}?token=${encodeURIComponent(clientToken)}`, {
          redirect: 'manual',
        });
        const location = response.headers.get('location') || '';
        if (response.status !== 302 || !location.startsWith(expectedHost)) {
          throw new Error(`${platform} did not redirect to provider auth`);
        }
        platforms.push(platform);
      }
      return platforms.join(', ');
    });
  } else {
    skip('provider social OAuth redirects', 'set SMOKE_SOCIAL_OAUTH=true');
  }

  await check('support ticket list', async () => {
    const { json } = await request('/support', { token: clientToken });
    const tickets = json?.data?.tickets || json?.data || [];
    expectArray(tickets, 'support tickets');
    return `${tickets.length} tickets`;
  });

  if (READ_ONLY) {
    skip('social post draft with multiple platforms', 'SMOKE_READ_ONLY=true');
    skip('support ticket create', 'SMOKE_READ_ONLY=true');
  } else {
    await check('social post draft with multiple platforms', async () => {
      const { json } = await request('/social/posts', {
        token: clientToken,
        method: 'POST',
        expected: [201],
        body: {
          caption: `Smoke social draft ${RUN_ID}`,
          content_type: 'image',
          target_platforms: ['facebook', 'instagram'],
        },
      });
      const post = json?.data?.post;
      const platforms = expectArray(post?.target_platforms, 'created post target_platforms');
      if (!platforms.includes('facebook') || !platforms.includes('instagram')) {
        throw new Error('created post does not preserve both platforms');
      }
      return platforms.join(',');
    });

    await check('support ticket create/list', async () => {
      const { json } = await request('/support', {
        token: clientToken,
        method: 'POST',
        expected: [201],
        body: {
          subject: `Smoke support ${RUN_ID}`,
          body: 'Automated launch smoke test support ticket.',
          category: 'general',
        },
      });
      if (!json?.data?.ticket?.id) throw new Error('support ticket id missing');
      const list = await request('/support', { token: clientToken });
      const tickets = list.json?.data?.tickets || list.json?.data || [];
      expectArray(tickets, 'support tickets');
      return `created ${json.data.ticket.id}`;
    });
  }

  if (CHECK_STORAGE_UPLOAD) {
    await check('provider storage avatar upload', async () => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l6gvPQAAAABJRU5ErkJggg==',
        'base64'
      );
      const form = new FormData();
      form.append('avatar', new Blob([png], { type: 'image/png' }), `smoke-avatar-${RUN_ID}.png`);
      const { json } = await multipartRequest('/profile/me/avatar', {
        token: clientToken,
        method: 'PATCH',
        form,
      });
      const avatarUrl = json?.data?.profile?.avatar_url;
      if (!avatarUrl) throw new Error('avatar_url missing after upload');
      if (!/^https?:\/\//.test(avatarUrl)) throw new Error(`avatar_url is not an absolute URL: ${avatarUrl}`);
      return avatarUrl.includes('supabase.co') ? 'supabase storage URL saved' : 'avatar URL saved';
    });
  } else {
    skip('provider storage avatar upload', 'set SMOKE_STORAGE_UPLOAD=true');
  }

  if (CHECK_SHEETS_SYNC) {
    await check('provider Google Sheets task sync', async () => {
      const { json } = await request('/creative/admin/tasks/sync-sheet', {
        token: adminToken,
        method: 'POST',
      });
      const data = json?.data || {};
      if (data.configured === false) throw new Error(data.message || 'Google Sheets sync is not configured');
      return `${data.rows_synced ?? 'unknown'} rows synced`;
    });
  } else {
    skip('provider Google Sheets task sync', 'set SMOKE_SHEETS_SYNC=true');
  }

  if (CHECK_PAYMENT_CHECKOUT) {
    await check('provider Razorpay checkout order', async () => {
      const { json } = await request('/commerce/membership/checkout', {
        token: clientToken,
        method: 'POST',
        expected: [200, 201],
        body: { kind: 'membership' },
      });
      const data = json?.data || {};
      if (data.checkout_mode === 'mock') return `mock checkout activated ${data.payment?.id || ''}`.trim();
      if (!data.order_id && !data.subscription_id) throw new Error('checkout did not return order_id or subscription_id');
      if (Number(data.amount || 0) <= 0) throw new Error('checkout amount is missing');
      if (data.currency !== 'INR') throw new Error(`unexpected checkout currency ${data.currency}`);
      return data.order_id ? `order ${data.order_id}` : `subscription ${data.subscription_id}`;
    });
  } else {
    skip('provider Razorpay checkout order', 'set SMOKE_PAYMENT_CHECKOUT=true');
  }

  await check('AI model and usage metadata', async () => {
    const modelList = await getModelList(clientToken);
    const usage = await request('/ai/usage', { token: clientToken });
    if (!usage.json?.data) throw new Error('AI usage payload missing');
    return `${modelList.length} models`;
  });

  if (CHECK_AI_GENERATE) {
    await check('provider AI generation queue and result', async () => {
      const model = pickTextModel(await getModelList(clientToken));
      if (!model?.id) throw new Error('No active text/caption AI model available');
      const toolType = model.supported_tools?.includes('caption') ? 'caption' : 'text';
      const { json } = await request('/ai/generate', {
        token: clientToken,
        method: 'POST',
        expected: [201],
        body: {
          tool_type: toolType,
          model_id: model.id,
          prompt: `Write one short launch checklist sentence for CREATYV. Smoke run ${RUN_ID}.`,
          parameters: {
            tone: 'clear',
            length: 'one sentence',
            platform: 'Instagram',
            hashtag_count: 0,
          },
        },
      });
      const generationId = json?.data?.generation_id;
      if (!generationId) throw new Error('generation_id missing');

      let generation = null;
      for (let attempt = 0; attempt < 18; attempt += 1) {
        await sleep(5000);
        const result = await request(`/ai/generations/${generationId}`, { token: clientToken });
        generation = result.json?.data?.generation;
        if (['completed', 'failed'].includes(generation?.status)) break;
      }
      if (!generation) throw new Error('generation status missing');
      if (generation.status !== 'completed') {
        throw new Error(`generation ${generationId} ended as ${generation.status}: ${generation.error_message || 'no error message'}`);
      }
      const output = generation.output?.text || generation.result_text || generation.text || '';
      if (!String(output).trim()) throw new Error('completed generation has empty output');
      return `${model.name} completed ${generationId}`;
    });
  } else {
    skip('provider AI generation queue and result', 'set SMOKE_AI_GENERATE=true');
  }

  const failed = results.filter(result => !result.ok);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} smoke checks passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(`FATAL smoke test error: ${error.message}`);
  process.exit(1);
});
