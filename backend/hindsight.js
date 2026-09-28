const DEFAULT_BASE_URL = 'https://api.hindsight.vectorize.io';
const REQUEST_TIMEOUT_MS = 8000; // never let memory calls freeze the UI
const readyBanks = new Set(); // bank setup only needs to happen once per server run

function config() {
  return {
    apiKey: process.env.HINDSIGHT_API_KEY || '',
    baseUrl: (process.env.HINDSIGHT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    bankId: process.env.HINDSIGHT_BANK_ID || 'packai-memory'
  };
}

async function request(path, options = {}) {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new Error('HINDSIGHT_API_KEY is not configured');
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const detail = data?.detail || data?.message || `Hindsight request failed (${response.status})`;
    throw new Error(detail);
  }
  return data;
}

async function ensureBank() {
  const { bankId } = config();
  if (readyBanks.has(bankId)) return { cached: true };
  const result = await request(`/v1/default/banks/${encodeURIComponent(bankId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'PackAI Memory',
      reflect_mission: 'You are PackAI, an AI packaging consultant. Use remembered packaging preferences, prior recommendations, product constraints, and feedback to make future packaging guidance more personalized. Never invent material facts; distinguish remembered user preferences from technical packaging facts.',
      retain_mission: 'Extract useful packaging preferences, product requirements, prior recommendations, outcomes, and user feedback from PackAI interactions.'
    })
  });
  readyBanks.add(bankId);
  return result;
}

async function retain(content, context = 'packai_interaction') {
  const { bankId } = config();
  await ensureBank();
  return request(`/v1/default/banks/${encodeURIComponent(bankId)}/memories`, {
    method: 'POST',
    body: JSON.stringify({ items: [{ content, context, timestamp: new Date().toISOString() }] })
  });
}

async function recall(query) {
  const { bankId } = config();
  await ensureBank();
  return request(`/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`, {
    method: 'POST',
    body: JSON.stringify({ query, max_tokens: 1800 })
  });
}

async function reflect(query) {
  const { bankId } = config();
  await ensureBank();
  return request(`/v1/default/banks/${encodeURIComponent(bankId)}/reflect`, {
    method: 'POST',
    body: JSON.stringify({ query, max_tokens: 900, include: { facts: {} } })
  });
}

function isConfigured() {
  return Boolean(process.env.HINDSIGHT_API_KEY);
}

module.exports = { config, ensureBank, retain, recall, reflect, isConfigured };
