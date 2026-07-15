const { createClient } = require('@supabase/supabase-js');
const env = require('./src/config/env');

const supabase = createClient(env.supabase.url, env.supabase.serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  const { data } = await supabase.from('ai_models').select('*').eq('openrouter_id', 'openrouter/free');
  console.log(data);
}
run();
