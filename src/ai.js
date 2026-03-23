/**
 * Multi-provider AI service
 * Supports: Anthropic, OpenAI, Gemini, Kimi (Moonshot), Minimax
 * 
 * All providers use a CORS proxy to avoid browser CORS restrictions.
 * Set up the proxy URL in settings, or use the included Cloudflare Worker.
 */

const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-20250514',
    placeholder: 'sk-ant-api03-...',
  },
  openai: {
    name: 'OpenAI (GPT)',
    models: ['gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    placeholder: 'AIza...',
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    defaultModel: 'moonshot-v1-8k',
    placeholder: 'sk-...',
  },
  minimax: {
    name: 'MiniMax',
    models: ['MiniMax-Text-01', 'abab6.5s-chat'],
    defaultModel: 'MiniMax-Text-01',
    placeholder: 'eyJ...',
  },
};

// ── Settings persistence ──
function loadSettings() {
  try {
    const raw = localStorage.getItem('coursemind_settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: 'anthropic', keys: {}, models: {}, proxyUrl: '' };
}

function saveSettings(s) {
  try { localStorage.setItem('coursemind_settings', JSON.stringify(s)); } catch {}
}

// ── Call individual providers ──

async function callAnthropic(apiKey, model, system, userMsg, maxTokens, proxyUrl) {
  const url = proxyUrl
    ? `${proxyUrl}/anthropic/v1/messages`
    : 'https://api.anthropic.com/v1/messages';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(i => i.text || '').join('') || '';
}

async function callOpenAI(apiKey, model, system, userMsg, maxTokens, proxyUrl) {
  const url = proxyUrl
    ? `${proxyUrl}/openai/v1/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey, model, system, userMsg, maxTokens, proxyUrl) {
  const url = proxyUrl
    ? `${proxyUrl}/gemini/v1beta/models/${model}:generateContent?key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callKimi(apiKey, model, system, userMsg, maxTokens, proxyUrl) {
  const url = proxyUrl
    ? `${proxyUrl}/kimi/v1/chat/completions`
    : 'https://api.moonshot.cn/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error?.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

async function callMinimax(apiKey, model, system, userMsg, maxTokens, proxyUrl) {
  const url = proxyUrl
    ? `${proxyUrl}/minimax/v1/text/chatcompletion_v2`
    : 'https://api.minimax.chat/v1/text/chatcompletion_v2';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    }),
  });
  const data = await res.json();
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'MiniMax error');
  }
  return data.choices?.[0]?.message?.content || '';
}

// ── Unified call ──

const CALLERS = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini,
  kimi: callKimi,
  minimax: callMinimax,
};

async function callAI(settings, system, userMsg, maxTokens = 1000) {
  const { provider, keys, models, proxyUrl } = settings;
  const apiKey = keys[provider];
  if (!apiKey) throw new Error(`请先在设置中填入 ${PROVIDERS[provider].name} 的 API Key`);
  const model = models[provider] || PROVIDERS[provider].defaultModel;
  const caller = CALLERS[provider];
  if (!caller) throw new Error(`不支持的 provider: ${provider}`);

  const raw = await caller(apiKey, model, system, userMsg, maxTokens, proxyUrl);
  return raw;
}

// Parse JSON from AI response (handles markdown fences)
function parseJSON(raw) {
  const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

export { PROVIDERS, loadSettings, saveSettings, callAI, parseJSON };
