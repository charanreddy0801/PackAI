require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./database');
const hindsight = require('./hindsight');
const groq = require('./groq');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(FRONTEND));

function sendDbError(res, err) {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Database error' });
}

app.get('/api/health', (req, res) => {
  db.get('SELECT 1 AS ok', [], (err) => {
    if (err) return sendDbError(res, err);
    res.json({ success: true, backend: 'running', database: 'connected' });
  });
});

app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Name, valid email and password of at least 6 characters are required.' });
  }

  db.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, password],
    function (err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ success: false, message: 'Account already exists. Please login.' });
        }
        return sendDbError(res, err);
      }
      res.json({ success: true, user: { id: this.lastID, name, email } });
    }
  );
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  db.get('SELECT id, name, email, password FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return sendDbError(res, err);
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  });
});



/* ================= GROQ LLM ================= */
app.get('/api/groq/status', (req, res) => {
  const cfg = groq.config();
  res.json({
    success: true,
    configured: groq.isConfigured(),
    provider: 'Groq',
    model: cfg.model,
    fallback_model: cfg.fallbackModel,
    streaming: true
  });
});

// Plain JSON answer (used as a fallback by the frontend).
app.post('/api/groq/advice', async (req, res) => {
  if (!groq.isConfigured()) {
    return res.status(503).json({ success: false, configured: false, message: 'Add a valid GROQ_API_KEY to backend/.env to enable the Groq LLM.' });
  }
  try {
    const { text, model } = await groq.complete(req.body || {});
    res.json({ success: true, configured: true, provider: 'Groq', model, advice: text });
  } catch (err) {
    console.error('Groq error:', err.message);
    const status = err.status === 401 || err.status === 403 ? 401 : 502;
    const message = status === 401 ? 'Groq rejected the API key. Check GROQ_API_KEY in backend/.env.' : err.message;
    res.status(status).json({ success: false, configured: true, message });
  }
});

// Real-time streaming answer (Server-Sent Events).
app.post('/api/groq/stream', async (req, res) => {
  if (!groq.isConfigured()) {
    return res.status(503).json({ success: false, configured: false, message: 'Add a valid GROQ_API_KEY to backend/.env to enable the Groq LLM.' });
  }
  try {
    await groq.streamAdvice(req.body || {}, req, res);
  } catch (err) {
    console.error('Groq stream error:', err.message);
    if (!res.headersSent) res.status(502).json({ success: false, configured: true, message: err.message });
    else if (!res.writableEnded) { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

/* ================= HINDSIGHT MEMORY ================= */
app.get('/api/memory/status', async (req, res) => {
  if (!hindsight.isConfigured()) {
    return res.json({ success: true, configured: false, provider: 'Hindsight', message: 'Add HINDSIGHT_API_KEY to enable persistent Hindsight memory.' });
  }
  try {
    await hindsight.ensureBank();
    res.json({ success: true, configured: true, provider: 'Hindsight', bank_id: hindsight.config().bankId });
  } catch (err) {
    res.status(502).json({ success: false, configured: true, provider: 'Hindsight', message: err.message });
  }
});

app.post('/api/memory/retain', async (req, res) => {
  const content = String(req.body?.content || '').trim();
  const context = String(req.body?.context || 'packai_interaction').trim();
  if (!content) return res.status(400).json({ success: false, message: 'Memory content is required.' });
  if (!hindsight.isConfigured()) {
    return res.status(503).json({ success: false, configured: false, message: 'Hindsight is not configured. Add HINDSIGHT_API_KEY.' });
  }
  try {
    const result = await hindsight.retain(content, context);
    res.json({ success: true, provider: 'Hindsight', result });
  } catch (err) {
    console.error('Hindsight retain error:', err.message);
    res.status(502).json({ success: false, configured: true, message: err.message });
  }
});

app.post('/api/memory/recall', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query) return res.status(400).json({ success: false, message: 'Recall query is required.' });
  if (!hindsight.isConfigured()) {
    return res.json({ success: true, configured: false, memories: [], message: 'Hindsight is not configured.' });
  }
  try {
    const result = await hindsight.recall(query);
    const memories = (result.results || []).map(item => ({ id: item.id, text: item.text, type: item.type, context: item.context || '' }));
    res.json({ success: true, configured: true, memories });
  } catch (err) {
    console.error('Hindsight recall error:', err.message);
    res.status(502).json({ success: false, configured: true, message: err.message });
  }
});

app.post('/api/memory/reflect', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query) return res.status(400).json({ success: false, message: 'Reflection query is required.' });
  if (!hindsight.isConfigured()) {
    return res.json({ success: true, configured: false, text: '', memories: [] });
  }
  try {
    const result = await hindsight.reflect(query);
    res.json({ success: true, configured: true, text: result.text || '', based_on: result.based_on || [] });
  } catch (err) {
    console.error('Hindsight reflect error:', err.message);
    res.status(502).json({ success: false, configured: true, message: err.message });
  }
});

app.post('/api/recommendations', (req, res) => {
  const d = req.body || {};
  const sql = `INSERT INTO recommendations (
    user_email, commodity, food_item, moisture, fat, ph, respiration, shelf_life,
    temperature, humidity, transport, storage, material, description, match_score,
    otr, wvtr, thickness, sealability, strength, map_suitability, oxygen,
    carbon_dioxide, nitrogen, sustainability, cost_level, estimated_shelf,
    recyclability, reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    d.user_email || null, d.commodity || null, d.food_item || null,
    d.moisture ?? null, d.fat ?? null, d.ph ?? null, d.respiration || null,
    d.shelf_life ?? null, d.temperature ?? null, d.humidity ?? null,
    d.transport || null, d.storage || null, d.material || null,
    d.description || null, d.match_score ?? null, d.otr || null,
    d.wvtr || null, d.thickness || null, d.sealability || null,
    d.strength || null, d.map_suitability || null, d.oxygen ?? null,
    d.carbon_dioxide ?? null, d.nitrogen ?? null, d.sustainability ?? null,
    d.cost_level || null, d.estimated_shelf || null, d.recyclability || null,
    d.reason || null
  ];

  db.run(sql, values, function (err) {
    if (err) return sendDbError(res, err);
    res.json({ success: true, recommendationId: this.lastID, message: 'Recommendation stored in SQLite.' });
  });
});

app.get('/api/recommendations', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const sql = email
    ? 'SELECT * FROM recommendations WHERE lower(user_email) = ? ORDER BY id DESC'
    : 'SELECT * FROM recommendations ORDER BY id DESC';
  const params = email ? [email] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return sendDbError(res, err);
    res.json({ success: true, recommendations: rows });
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`PackAI running at http://localhost:${PORT}`);
  console.log('Open the URL above instead of double-clicking index.html.');
  console.log(`Groq LLM:  ${groq.isConfigured() ? 'configured (' + groq.config().model + ')' : 'NOT configured - add GROQ_API_KEY to backend/.env'}`);
  console.log(`Hindsight: ${hindsight.isConfigured() ? 'configured' : 'not configured (optional) - add HINDSIGHT_API_KEY to backend/.env'}`);
});
