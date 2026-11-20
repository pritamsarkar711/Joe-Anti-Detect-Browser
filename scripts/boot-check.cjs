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
 * shell is dismissed. Run it against apps/desktop/web-dist:
 *
 *   node scripts/check-webdist.mjs          # static checks (no Electron)
 *   npx electron scripts/boot-check.cjs apps/desktop/web-dist/index.html
 *
 * Exits 0 when the app boots, 1 with the evidence when it does not.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const ui = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!ui || !fs.existsSync(ui)) {
  console.error('usage: electron scripts/boot-check.cjs <path-to-index.html>');
  process.exit(2);
}
const preload = path.join(__dirname, '..', 'apps', 'desktop', 'preload.js');

// No GPU / no window system needed — runs on CI runners too.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('ozone-platform', 'headless');

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
  const win = new BrowserWindow({
    width: 1200, height: 800, show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true,
      devTools: true,
    },
  });
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
        bootText: boot ? boot.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80) : null,
        rootChildren: root ? root.childElementCount : -1,
        bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 120),
      };
    })()`);
    if (state.bootHidden && state.rootChildren > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const booted = !!state && state.bootHidden && state.rootChildren > 0;
  console.log(JSON.stringify({ booted, ui, state, problems: problems.slice(0, 12) }, null, 2));
  app.exit(booted ? 0 : 1);
});
