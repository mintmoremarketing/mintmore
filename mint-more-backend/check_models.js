const { query } = require('./src/config/database');

async function main() {
  try {
    // Get full details of the latest generation
    const gens = await query(
      `SELECT id, raw_prompt, enhanced_prompt, prompt, parameters, created_at 
       FROM ai_generations 
       WHERE tool_type = 'image' 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    const g = gens.rows[0];
    if (!g) { console.log('No generations found'); process.exit(0); }
    
    console.log('\n=== LATEST IMAGE GENERATION FULL DETAILS ===');
    console.log('Created at:', g.created_at);
    console.log('\nRaw prompt:', g.raw_prompt);
    console.log('\nEnhanced prompt:', g.enhanced_prompt || '(null)');
    console.log('\nFinal prompt (first 500 chars):', (g.prompt || '').slice(0, 500));
    
    const params = typeof g.parameters === 'string' ? JSON.parse(g.parameters) : g.parameters;
    console.log('\nai_prompt flag in parameters:', params?.ai_prompt);
    console.log('_enhanced_prompt in parameters:', params?._enhanced_prompt || '(null)');
    console.log('_raw_prompt in parameters:', params?._raw_prompt || '(null)');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
