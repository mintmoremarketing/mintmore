const { createClient } = require('@supabase/supabase-js');
const env = require('./src/config/env');

const supabase = createClient(env.supabase.url, env.supabase.serviceKey, {
  auth: { persistSession: false },
});

async function updateModels() {
  const { data: before } = await supabase.from('ai_models').select('openrouter_id, name, id').eq('openrouter_id', 'meta-llama/llama-3.1-8b-instruct:free');
  if (before?.length) {
    const res = await supabase
      .from('ai_models')
      .update({ openrouter_id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B' })
      .eq('id', before[0].id);
    console.log('Update Llama 3.3:', res.error || 'Success');
  }

  // Let's just list the models to see what we have
  const { data, error } = await supabase.from('ai_models').select('*').order('sort_order', { ascending: true });
  console.log('Available models:', data?.map(m => m.openrouter_id));
}

updateModels();
