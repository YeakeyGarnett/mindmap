/**
 * CourseMind CORS Proxy — Cloudflare Worker
 * 
 * Proxies requests to AI APIs to bypass browser CORS restrictions.
 * Deploy to Cloudflare Workers (free tier is enough).
 * 
 * Routes:
 *   /anthropic/*  → https://api.anthropic.com/*
 *   /openai/*     → https://api.openai.com/*
 *   /gemini/*     → https://generativelanguage.googleapis.com/*
 *   /kimi/*       → https://api.moonshot.cn/*
 *   /minimax/*    → https://api.minimax.chat/*
 */

const ROUTES = {
  '/anthropic/': 'https://api.anthropic.com/',
  '/openai/': 'https://api.openai.com/',
  '/gemini/': 'https://generativelanguage.googleapis.com/',
  '/kimi/': 'https://api.moonshot.cn/',
  '/minimax/': 'https://api.minimax.chat/',
};

// Set your allowed origin here (your GitHub Pages URL)
const ALLOWED_ORIGINS = [
  'https://YOUR_USERNAME.github.io',
  'http://localhost:5173',   // dev
  'http://localhost:4173',   // preview
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    // Find matching route
    let targetBase = null;
    let prefix = null;
    for (const [p, base] of Object.entries(ROUTES)) {
      if (url.pathname.startsWith(p)) {
        targetBase = base;
        prefix = p;
        break;
      }
    }

    if (!targetBase) {
      return new Response(JSON.stringify({ error: 'Unknown route' }), {
        status: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Build target URL
    const targetPath = url.pathname.slice(prefix.length) + url.search;
    const targetUrl = targetBase + targetPath;

    // Forward request
    const headers = new Headers(request.headers);
    headers.delete('Host');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' ? request.body : undefined,
      });

      // Return with CORS headers
      const respHeaders = new Headers(response.headers);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => respHeaders.set(k, v));

      return new Response(response.body, {
        status: response.status,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
    'Access-Control-Max-Age': '86400',
  };
}
