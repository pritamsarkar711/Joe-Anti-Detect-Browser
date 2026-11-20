#!/usr/bin/env node
/**
 * Boot-check the desktop UI exactly the way the packaged app loads it.
 *
 * The v3.2.0 release shipped `dist/` (absolute base) inside the EXE: every
 * <script src="/assets/..."> resolved to the filesystem root under file://,
 * the entry module 404'd, and the app sat on the boot splash forever. No gate
 * caught it because nothing ever loaded the built UI in an Electron window.
 *
 * This script opens a window with the manager's exact webPreferences, loads
 * the given index.html via file://, and fails unless React mounts and the boot
 * shell is dismissed:
 *
 *   npx electron scripts/boot-check.cjs <path-to-index.html>
 *
 * The window is shown (as in the real app) because the boot shell is dismissed
 * via requestAnimationFrame, which a permanently hidden window never runs.
 * Diagnostics surface as GitHub Actions annotations so a CI failure explains
 * itself. Exits 0 when the app boots, 1 when it does not, 2 on a harness error.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const say = (kind, message) => {
  console.log(message);
  if (process.env.GITHUB_ACTIONS) {
    const safe = String(message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').slice(0, 300);
    console.log(`::${kind} title=boot-check::${safe}`);
  }
};

// CI runners (and containers) have no configured SUID sandbox; this is a local
// test harness, so the sandbox adds nothing here.
app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('ozone-platform', 'headless');

for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, (error) => {
    say('error', `boot-check harness error (${ev}): ${error?.stack ?? error}`);
    app.exit(2);
  });
}

const ui = (() => {
  // Electron keeps Chromium switches (e.g. --no-sandbox) in process.argv, so
  // positional indexes shift. Take the first argument that is neither a switch
  // nor this script.
  const arg = process.argv
    .slice(1)
    .find((a) => !a.startsWith('--') && !a.endsWith('boot-check.cjs'));
  return arg ? path.resolve(arg) : '';
})();
if (!ui || !fs.existsSync(ui)) {
  say('error', `usage: electron scripts/boot-check.cjs <path-to-index.html> — missing: ${ui}`);
  process.exit(2);
}
const preload = path.join(__dirname, '..', 'apps', 'desktop', 'preload.js');

// Never hang silent: whatever state we are in at the deadline, report it.
setTimeout(() => {
  say('error', 'boot-check watchdog: app did not reach a verdict within 90s');
  app.exit(2);
}, 90000).unref();

// Stub every whitelisted IPC channel so a real handler absence can never be
// mistaken for a bundle failure. The UI must render even in web mode.
const stubs = {
  'app:info': { version: '0.0.0-boot-check', platform: process.platform, profiles: 0 },
  'profiles:list': [], 'profiles:get': null, 'profiles:create': {}, 'profiles:bulk': [],
  'profiles:update': {}, 'profiles:delete': {}, 'profiles:launch': { ok: true },
  'profiles:stop': { ok: true }, 'profiles:consistency': { score: 0 },
  'profiles:quality': { score: 0 }, 'profiles:surfaces': {}, 'profiles:script': '',
  'proxies:list': [], 'proxies:add': {}, 'proxies:parse': [], 'proxies:import': [],
  'extensions:list': [], 'extensions:install': {}, 'extensions:digest': {},
  'extensions:attach': {}, 'extensions:detach': {},
  'workspace:export': {}, 'workspace:import': { ok: true }, 'workspace:replace': { ok: true },
  'workspace:read': { profiles: [], settings: {}, groups: [], proxies: [] },
  'keystrokes:send': { ok: true },
  'sync:send': { ok: true }, 'sync:configure': { ok: true },
  'chrome:command': { ok: true },
};
for (const [channel, value] of Object.entries(stubs)) {
  ipcMain.handle(channel, () => value);
}

app.whenReady().then(async () => {
  say('notice', `boot-check: electron ${process.versions.electron}, chromium ${process.versions.chromium}, ui ${ui}`);
  const win = new BrowserWindow({
    width: 1200, height: 800, show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      devTools: true,
    },
  });
  // The real app shows on ready-to-show; the boot splash is dismissed with
  // requestAnimationFrame, which never runs on a hidden window.
  win.once('ready-to-show', () => win.show());
  const problems = [];
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) problems.push(`console[${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    problems.push(`did-fail-load ${code} ${description} ${url}${isMainFrame ? ' [main]' : ''}`);
  });

  await win.loadFile(ui);

  const deadline = Date.now() + 15000;
  let state = null;
  while (Date.now() < deadline) {
    state = await win.webContents.executeJavaScript(`(() => {
      const boot = document.getElementById('joe-boot');
      const root = document.getElementById('root');
      return {
        bootHidden: !!boot && boot.classList.contains('hidden'),
        rootChildren: root ? root.childElementCount : -1,
        bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140),
      };
    })()`).catch((error) => ({ bootHidden: false, rootChildren: -1, bodyText: `executeJavaScript failed: ${error.message}` }));
    if (state.bootHidden && state.rootChildren > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const booted = !!state && state.bootHidden && state.rootChildren > 0;
  const verdict = JSON.stringify({ booted, state, problems: problems.slice(0, 12) });
  if (booted) say('notice', `boot-check PASS ${verdict}`);
  else say('error', `boot-check FAIL ${verdict}`);
  app.exit(booted ? 0 : 1);
});
