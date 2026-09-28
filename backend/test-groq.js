// Quick check that your GROQ_API_KEY works:  npm run test:groq
require('dotenv').config();
const groq = require('./groq');

(async () => {
  if (!groq.isConfigured()) {
    console.error('✗ GROQ_API_KEY is missing or still the placeholder. Edit backend/.env first.');
    process.exit(1);
  }
  console.log(`Testing Groq with model chain: ${[groq.config().model, groq.config().fallbackModel].join(' -> ')}`);
  try {
    const { text, model } = await groq.complete({
      product: 'Fresh strawberries',
      inputs: { moisture: 90, shelf_life: 7, storage: 'chilled' },
      recommendation: { material: 'Breathable / Micro-Perforated Film', match_score: 92, cost: 'Low–Medium' },
      memories: []
    });
    console.log(`✓ Groq works (answered by ${model}):\n\n${text}\n`);
  } catch (err) {
    console.error('✗ Groq test failed:', err.message);
    process.exit(1);
  }
})();
