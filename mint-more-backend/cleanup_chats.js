const { createClient } = require('@supabase/supabase-js');
const env = require('./src/config/env');

const supabase = createClient(env.supabase.url, env.supabase.serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Deleting old text chat generations and usage logs...");
  
  // Get all text generation IDs
  const { data: textGens, error: fetchError } = await supabase
    .from('ai_generations')
    .select('id')
    .eq('tool_type', 'text');
    
  if (fetchError || !textGens) {
    console.error("Fetch error:", fetchError);
    return;
  }
  
  const ids = textGens.map(g => g.id);
  console.log(`Found ${ids.length} text generations to delete.`);
  
  if (ids.length > 0) {
    // Delete from ai_usage_log
    const { error: logError } = await supabase
      .from('ai_usage_log')
      .delete()
      .in('generation_id', ids);
      
    if (logError) console.error("Error deleting logs:", logError);
    
    // Delete from ai_generations
    const { error: genError } = await supabase
      .from('ai_generations')
      .delete()
      .in('id', ids);
      
    if (genError) {
      console.error("Error deleting generations:", genError);
    } else {
      console.log("Successfully deleted old text chats.");
    }
  }
}
run();
