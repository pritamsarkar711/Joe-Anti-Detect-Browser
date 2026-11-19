/**
 * A local HTTP server for the browser gates.
 *
 * `test:ui`, `test:devices` and `screenshots` all used to assume something was
 * already listening on localhost:5173. Run without that server they failed with
 * ERR_CONNECTION_REFUSED — and `test:devices` then overwrote the committed
 * evidence report with 0/5 failures. This helper makes every one of them
 * self-contained: reuse BASE_URL when it answers, otherwise start a server, wait
 * for it, and always shut it down again.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function isReachable(url, timeout = 1500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, child, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isReachable(url)) return true;
    if (child.exitCode !== null) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Resolve a base URL that is actually serving the app.
 *
 * @param {object} options
 * @param {string} [options.base] explicit URL (defaults to BASE_URL)
 * @param {'preview'|'dev'} [options.mode] prefer a built bundle or the dev server
 * @returns {Promise<{ base: string, stop: () => Promise<void>, started: boolean }>}
 */
export async function ensureServer({ base = process.env.BASE_URL, mode } = {}) {
  if (base) {
    if (await isReachable(base)) return { base, stop: async () => {}, started: false };
    console.log(`[serve] ${base} is not answering; starting a local server instead`);
  }

  const built = fs.existsSync(path.join(ROOT, 'dist', 'index.html'));
  const usePreview = mode ? mode === 'preview' : built;
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  /*
   * Run Vite's CLI directly instead of through `npx`.
   *
   * `npx vite` executes a wrapper that spawns Vite as a *grandchild*. Killing the
   * wrapper leaves Vite holding the port and, worse, leaves this process keeping
   * the inherited stdout pipe open, so the test suite printed its results and
   * then hung until the caller's timeout. Spawning the CLI itself, detached, lets
   * stop() terminate the whole process group deterministically.
   */
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) throw new Error(`Vite CLI not found at ${viteBin}. Run npm ci first.`);
  const args = [
    viteBin,
    ...(usePreview ? ['preview'] : []),
    '--port', String(port), '--host', '127.0.0.1', '--strictPort',
  ];

  console.log(`[serve] ${usePreview ? 'vite preview' : 'vite dev'} on ${url}`);
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    env: { ...process.env, BROWSER: 'none', CI: '1' },
  });

  // A test that exits early (assertion, throw on a locator timeout) must not
  // leave a Vite process holding the port.
  process.once('exit', () => { signal('SIGTERM'); });

  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });

  const signal = (sig) => {
    if (child.exitCode !== null) return;
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, sig);
      else child.kill(sig);
    } catch {
      try { child.kill(sig); } catch { /* already gone */ }
    }
  };

  const stop = async () => {
    if (child.exitCode !== null) return;
    signal('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => { signal('SIGKILL'); resolve(); }, 4000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    // Release the pipes so the event loop can drain even if a grandchild lingers.
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
  };

  if (!(await waitFor(url, child))) {
    await stop();
    throw new Error(`No server answered on ${url}. ${usePreview ? '(dist/ missing? run npm run build)' : ''}\n${log.slice(-1500)}`);
  }

  return { base: url, stop, started: true };
}
