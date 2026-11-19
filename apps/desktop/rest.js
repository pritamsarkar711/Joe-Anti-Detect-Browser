/**
 * Local REST API (127.0.0.1:9333) — automation, scripting and MCP-style tooling,
 * inspired by the open-source profile managers. Loopback only, no auth needed
 * because nothing outside the machine can reach it.
 */
const http = require('node:http');

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

function startRestApi({ port, api }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const parts = url.pathname.split('/').filter(Boolean);
    let body = {};
    if (req.method === 'POST') {
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        body = raw ? JSON.parse(raw) : {};
      } catch { return json(res, 400, { ok: false, error: 'invalid JSON' }); }
    }
    try {
      if (url.pathname === '/health') return json(res, 200, { ok: true, ...(await api.info()) });
      if (url.pathname === '/info') return json(res, 200, await api.info());
      if (parts[0] === 'profiles') {
        if (parts.length === 1 && req.method === 'GET') return json(res, 200, await api.list());
        if (parts.length === 1 && req.method === 'POST') return json(res, 201, await api.create(body));
        const id = decodeURIComponent(parts[1] ?? '');
        if (parts[2] === 'launch' && req.method === 'POST') return json(res, 200, await api.launch(id));
        if (parts[2] === 'stop' && req.method === 'POST') return json(res, 200, await api.stop(id));
        if (parts[2] === 'consistency') return json(res, 200, await api.consistency(id));
        if (parts.length === 2 && req.method === 'GET') return json(res, 200, await api.get(id));
      }
      return json(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      return json(res, 500, { ok: false, error: String(e.message || e) });
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Joe Browser local API on http://127.0.0.1:${port}`));
  server.on('error', (e) => console.error('REST API error', e.message));
  return server;
}

module.exports = { startRestApi };
