/**
 * Desktop renderer smoke test.
 *
 * Forces the desktop build of the UI, serves it, installs a stand-in for the
 * preload bridge, and asserts the real app:
 *   - renders without a console error;
 *   - pushes its workspace to the shell on startup (the fix for launches that
 *     used to fail with "Unknown profile");
 *   - sends a real profile id through `profiles.launch` when a row is launched.
 *
 *   node scripts/smoke-desktop-ui.mjs
 *
 * Skipped (exit 0) when a Chromium binary is unavailable, so it never blocks a
 * machine that cannot run a browser.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
const check = async (label, fn) => {
  try {
    const detail = await fn();
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${label} — ${error.message}`);
  }
};
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** Build the desktop-target bundle into a temp directory. */
async function buildUi() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-ui-'));
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir'],
      { cwd: root, env: { ...process.env, JOE_TARGET: 'desktop' }, stdio: 'ignore' },
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build exited ${code}`))));
  });
  must(fs.existsSync(path.join(out, 'index.html')), 'no index.html in the bundle');
  return out;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function serve(dir, port) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '0.0.0.0', () => resolve(server)));
}

let chromium;
try {
  ({ launchBrowser: chromium } = await import('./chromium.mjs'));
} catch (error) {
  console.log(`SKIP  desktop renderer smoke — no Chromium available (${error.message})`);
  process.exit(0);
}

let browser;
let server;
let outDir;
try {
  outDir = await buildUi();
  const port = 5300 + Math.floor(Math.random() * 400);
  server = await serve(outDir, port);

  let launchError = null;
  try {
    browser = await chromium();
  } catch (error) {
    launchError = error;
  }
  if (!browser) {
    console.log(`SKIP  desktop renderer smoke — Chromium did not launch (${launchError?.message})`);
    process.exit(0);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const calls = [];
  await page.exposeFunction('__record', (name, arg) => { calls.push({ name, arg }); });
  await page.addInitScript(() => {
    // Mirrors apps/desktop/preload.js: only these channels exist.
    window.joe = {
      isDesktop: true,
      info: async () => ({ version: 'test', platform: 'win32' }),
      profiles: {
        list: async () => [],
        launch: async (id) => { window.__record('launch', id); return { ok: true }; },
        stop: async (id) => { window.__record('stop', id); return { ok: true }; },
      },
      workspace: {
        replace: async (d) => {
          window.__record('replace', d.profiles.length);
          return { ok: true, profiles: d.profiles.length };
        },
        read: async () => ({ profiles: [], proxies: [], groups: ['Default'] }),
      },
      sync: { send: async () => ({ ok: true }), configure: async () => ({ ok: true }) },
    };
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('h1, h2, [role="heading"]') !== null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(2000);

  await check('the desktop UI renders without errors', async () => {
    const body = await page.locator('body').innerText();
    must(body.trim().length > 50, 'the page rendered nothing');
    must(!/failed to load|something went wrong/i.test(body), 'the UI showed an error state');
    must(errors.length === 0, `browser errors: ${errors.slice(0, 3).join(' | ')}`);
    const profileRows = await page.locator('[role="row"], tr').count();
    return `${profileRows} rows, no console errors`;
  });

  await check('the workspace is pushed to the shell on startup', async () => {
    // This is the fix: without it the shell never learned the UI's profiles and
    // every launch failed with "Unknown profile".
    await page.waitForFunction(() => true);
    await page.waitForTimeout(600);
    const sync = calls.filter((c) => c.name === 'replace');
    must(sync.length > 0, 'the UI never called workspace.replace');
    must(sync[0].arg > 0, `workspace.replace sent ${sync[0].arg} profiles`);
    return `${sync[0].arg} profiles mirrored`;
  });

  await check('launching a row sends its real id to the shell', async () => {
    const buttons = page.locator('button[aria-label*="aunch"]');
    const count = await buttons.count();
    must(count > 0, 'no launch control is rendered');
    await buttons.first().click();
    await page.waitForTimeout(1200);
    const launches = calls.filter((c) => c.name === 'launch');
    must(launches.length > 0, 'clicking launch did not reach the bridge');
    must(/^[\w-]+$/.test(String(launches[0].arg)), `launch sent a bad id: ${launches[0].arg}`);
    return `profiles.launch("${launches[0].arg}")`;
  });

  await check('a refused launch is reported, not silently swallowed', async () => {
    // Make the bridge fail, then launch again: the UI must surface it.
    await page.evaluate(() => {
      window.joe.profiles.launch = async () => { throw new Error('That profile is gone.'); };
    });
    const buttons = page.locator('button[aria-label*="aunch"]');
    await buttons.nth(1).click();
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    must(/gone|could not|failed|unavailable/i.test(text), 'the failure was not surfaced in the UI');
    return 'error shown to the user';
  });

  await check('the built bundle loads from file:// as Electron serves it', async () => {
    // `file:` behaves differently from http: absolute asset paths, module scripts
    // and fetch all change meaning. The installed app loads index.html this way,
    // so testing only over HTTP would miss a blank window in the shipped build.
    const filePage = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const fileErrors = [];
    filePage.on('pageerror', (e) => fileErrors.push(e.message));
    filePage.on('console', (m) => { if (m.type() === 'error') fileErrors.push(m.text()); });
    await filePage.addInitScript(() => {
      window.joe = {
        isDesktop: true,
        info: async () => ({ version: 'test', platform: 'win32' }),
        profiles: { list: async () => [], launch: async () => ({ ok: true }), stop: async () => ({ ok: true }) },
        workspace: { replace: async (d) => ({ ok: true, profiles: d.profiles.length }), read: async () => ({ profiles: [], proxies: [], groups: ['Default'] }) },
        sync: { send: async () => ({ ok: true }), configure: async () => ({ ok: true }) },
      };
    });
    await filePage.goto(`file://${path.join(outDir, 'index.html')}`, { waitUntil: 'domcontentloaded' });
    await filePage.waitForTimeout(2500);
    const text = await filePage.locator('body').innerText();
    must(text.trim().length > 200, 'the app rendered nothing over file://');
    must(/Profiles/i.test(text), 'the profile workspace did not render over file://');
    const rows = await filePage.locator('tr, [role="row"]').count();
    must(rows > 0, 'no profile rows rendered over file://');
    must(fileErrors.length === 0, `file:// errors: ${fileErrors.slice(0, 3).join(' | ')}`);
    await filePage.close();
    return `${rows} rows, no errors`;
  });


  await page.screenshot({ path: path.join(os.tmpdir(), 'joe-ui-smoke.png') });
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.close();
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
}

if (failed > 0) {
  console.log(`\n${failed} renderer smoke check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nDesktop renderer works end to end');
process.exit(0);
