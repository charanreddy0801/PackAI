/**
 * Groq LLM client for PackAI.
 *
 * - Works with reasoning models (openai/gpt-oss-*) by keeping reasoning effort low
 *   and leaving enough token budget for the visible answer.
 * - Supports real-time token streaming (Server-Sent Events) and a plain JSON mode.
 * - Automatically falls back to a second model if the first one is unavailable,
 *   rate-limited, or returns an empty answer.
 */
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_FALLBACK = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 45000;

function config() {
  const rawKey = String(process.env.GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  return {
    apiKey: rawKey,
    baseUrl: String(process.env.GROQ_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, ''),
    model: String(process.env.GROQ_MODEL || DEFAULT_MODEL).trim(),
    fallbackModel: String(process.env.GROQ_FALLBACK_MODEL || DEFAULT_FALLBACK).trim()
  };
}

function isConfigured() {
  const { apiKey } = config();
  return Boolean(apiKey) && !/your_key_here/i.test(apiKey);
}

function modelChain() {
  const { model, fallbackModel } = config();
  return [...new Set([model, fallbackModel].filter(Boolean))];
}

const SYSTEM_PROMPT = `You are PackAI's senior packaging consultant. Give concise, practical guidance for food packaging.
Treat the technical recommendation fields as the primary engineering constraints. Use Hindsight memories only as user preferences/context and never invent technical facts. Clearly distinguish a remembered preference from an engineering requirement.
Return plain text (no markdown symbols like ** or #) using exactly these headings, each on its own line:
AI ADVICE
WHY THIS FITS
MEMORY USED
NEXT STEP
Keep the whole response under 180 words.`;

function buildMessages(body = {}) {
  const product = body.product || body.food_item || body.commodity || 'food product';
  const inputs = body.inputs || {};
  const recommendation = body.recommendation || {};
  const memories = (Array.isArray(body.memories) ? body.memories : [])
    .slice(0, 6)
    .map(m => (typeof m === 'string' ? m : String(m?.text || '')).slice(0, 400))
    .filter(Boolean);

  const userPrompt = `Product: ${product}
User/product inputs: ${JSON.stringify(inputs)}
PackAI technical recommendation: ${JSON.stringify(recommendation)}
Relevant Hindsight memories: ${memories.length ? JSON.stringify(memories) : 'none'}

Explain the recommendation so a packaging decision-maker can act on it. If there are no memories, say that no prior preference was available under MEMORY USED.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];
}

function buildRequestBody(model, messages, stream) {
  const payload = {
    model,
    messages,
    temperature: 0.4,
    // Reasoning models spend tokens "thinking" before answering, so leave headroom.
    max_completion_tokens: 1500,
    stream: Boolean(stream)
  };
  if (/^openai\/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';
  return payload;
}

function isRetryableStatus(status) {
  // Not 401/403 – a bad key will fail on every model.
  return status === 400 || status === 404 || status === 408 || status === 429 || status >= 500;
}

async function readError(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.message || `Groq request failed (${response.status})`;
  } catch {
    return `Groq request failed (${response.status})`;
  }
}

function post(model, messages, stream, signal) {
  const { apiKey, baseUrl } = config();
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(model, messages, stream)),
    signal
  });
}

/** Non-streaming completion. Returns { text, model }. Throws Error with .status on failure. */
async function complete(body) {
  const messages = buildMessages(body);
  const models = modelChain();
  let lastError = new Error('Groq request failed');

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await post(model, messages, false, AbortSignal.timeout(REQUEST_TIMEOUT_MS));
      if (!response.ok) {
        const err = new Error(await readError(response));
        err.status = response.status;
        lastError = err;
        if (isRetryableStatus(response.status) && i < models.length - 1) continue;
        throw err;
      }
      const data = await response.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!text) {
        lastError = new Error(`Groq model ${model} returned an empty answer.`);
        if (i < models.length - 1) continue;
        throw lastError;
      }
      return { text, model: data.model || model };
    } catch (err) {
      lastError = err;
      if (err.status === 401 || err.status === 403) throw err;
      if (i >= models.length - 1) throw err;
    }
  }
  throw lastError;
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Real-time streaming: pipes Groq tokens to the browser as Server-Sent Events.
 * Events: {delta:"text"}  ...  {done:true, model:"..."}  or  {error:"message"}
 */
async function streamAdvice(body, req, res) {
  const messages = buildMessages(body);
  const models = modelChain();

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const controller = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) { clientGone = true; controller.abort(); }
  });
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastMessage = 'Groq request failed';
  let sentAny = false;
  try {
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const isLast = i === models.length - 1;
      try {
        const response = await post(model, messages, true, controller.signal);
        if (!response.ok) {
          lastMessage = await readError(response);
          if (isRetryableStatus(response.status) && !isLast) continue;
          break;
        }

        let gotText = false;
        let buffer = '';
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          buffer += decoder.decode(chunk, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            let parsed;
            try { parsed = JSON.parse(data); } catch { continue; }
            if (parsed?.error?.message) { lastMessage = parsed.error.message; continue; }
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) { gotText = true; sentAny = true; sse(res, { delta }); }
          }
        }

        if (gotText) {
          sse(res, { done: true, model });
          return res.end();
        }
        lastMessage = `Groq model ${model} returned an empty answer.`;
        if (isLast) break;
      } catch (err) {
        if (clientGone) return;
        lastMessage = controller.signal.aborted ? 'Groq request timed out.' : err.message;
        if (controller.signal.aborted || sentAny || isLast) break;
      }
    }
    if (!clientGone) { sse(res, { error: lastMessage }); res.end(); }
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { config, isConfigured, complete, streamAdvice, buildMessages };
