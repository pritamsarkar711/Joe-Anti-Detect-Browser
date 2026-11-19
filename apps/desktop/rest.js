/**
 * Local REST API (127.0.0.1:9333) — automation, scripting and MCP-style tooling.
 *
 * Security model
 * --------------
 * A loopback bind alone is NOT sufficient. Any web page the user visits can send
 * a request to http://127.0.0.1:9333 (DNS-rebinding / CSRF style), so this API:
 *
 *   1. binds to 127.0.0.1 only,
 *   2. rejects requests whose Origin/Referer is a real website (no wildcard CORS),
 *   3. requires a per-install bearer token for every state-changing call,
 *   4. requires a JSON content type, which browsers cannot send cross-origin
 *      without a CORS preflight that this server never approves,
 *   5. caps request bodies and never echoes internal errors verbatim,
 *   6. answers only GET/OPTIONS/POST.
 *
 * The token is written to <userData>/api-token.txt (0600) and injected into the
 * UI through the preload bridge, so the bundled app works without any setup.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BODY = 1024 * 1024; // 1 MB is ample for profile payloads
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function readOrCreateToken(userDataDir) {
  const file = path.join(userDataDir, 'api-token.txt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* first run */
  }
  const token = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(file, token, { mode: 0o600 });
  } catch (e) {
    console.error('[joe] could not persist API token', e.message);
  }
  return token;
}

function send(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(data);
}

/** Origins allowed to call the API: none (packaged app), or a localhost dev server. */
function isAllowedOrigin(origin) {
  if (!origin) return true; // native tooling (curl, scripts, MCP clients)
  try {
    const u = new URL(origin);
    if (LOOPBACK.has(u.hostname)) return true;
    if (u.origin === 'null') return false;
    return false;
  } catch {
    return false;
  }
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function startRestApi({ port, api, userDataDir = process.cwd() }) {
  const token = readOrCreateToken(userDataDir);

  const server = http.createServer(async (req, res) => {
    // Reject foreign origins outright — no permissive CORS headers are ever sent.
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) return send(res, 403, { ok: false, error: 'origin not allowed' });

    if (req.method === 'OPTIONS') {
      // Deliberately no Access-Control-Allow-Origin: cross-origin fetches fail.
      res.writeHead(204, { Allow: 'GET, POST, OPTIONS' });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });

    let url;
    try {
      url = new URL(req.url, `http://127.0.0.1:${port}`);
    } catch {
      return send(res, 400, { ok: false, error: 'bad request' });
    }
    const parts = url.pathname.split('/').filter(Boolean);

    // /health stays open so the UI and installers can probe liveness without a token.
    if (url.pathname === '/health' && req.method === 'GET') {
      try {
        return send(res, 200, { ok: true, ...(await api.info()) });
      } catch {
        return send(res, 503, { ok: false });
      }
    }

    // Everything else is authenticated.
    const header = req.headers.authorization || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token') || '';
    if (!provided || !timingSafeEqual(provided, token)) {
      return send(res, 401, { ok: false, error: 'missing or invalid API token' });
    }

    let body = {};
    if (req.method === 'POST') {
      const type = String(req.headers['content-type'] || '');
      if (!type.includes('application/json')) return send(res, 415, { ok: false, error: 'content-type must be application/json' });
      let raw = '';
      try {
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > MAX_BODY) return send(res, 413, { ok: false, error: 'payload too large' });
        }
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, { ok: false, error: 'invalid JSON' });
      }
    }

    try {
      if (url.pathname === '/info') return send(res, 200, await api.info());
      if (parts[0] === 'profiles') {
        if (parts.length === 1 && req.method === 'GET') return send(res, 200, await api.list());
        if (parts.length === 1 && req.method === 'POST') return send(res, 201, await api.create(body));
        const id = decodeURIComponent(parts[1] ?? '');
        if (parts.length === 2 && req.method === 'GET') return send(res, 200, await api.get(id));
        if (req.method === 'POST') {
          if (parts[2] === 'launch') return send(res, 200, await api.launch(id));
          if (parts[2] === 'stop') return send(res, 200, await api.stop(id));
        }
        if (req.method === 'GET') {
          if (parts[2] === 'consistency') return send(res, 200, await api.consistency(id));
          if (parts[2] === 'quality') return send(res, 200, await api.quality(id));
          if (parts[2] === 'surfaces') return send(res, 200, await api.surfaces(id));
          if (parts[2] === 'script') return send(res, 200, { script: await api.script(id) });
        }
      }
      return send(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      // Log privately, return a generic message so internals never leak.
      console.error('[joe] API error', e);
      return send(res, 500, { ok: false, error: 'internal error' });
    }
  });

  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.on('error', (e) => console.error('[joe] REST API error', e.message));
  server.listen(port, '127.0.0.1', () => console.log(`[joe] local API on http://127.0.0.1:${port}`));
  return { server, token };
}

module.exports = { startRestApi, readOrCreateToken };
