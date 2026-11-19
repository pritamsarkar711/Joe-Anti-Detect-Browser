/**
 * Desktop main-process smoke test (no display required).
 *
 * The packaging checks prove the files ship. This proves the shipped code
 * actually works: it loads the real `main.js` with a functional Electron stand-in,
 * waits for the real `whenReady()` chain (workspace load, IPC registration,
 * window creation, REST API start), then calls every registered IPC handler with
 * real arguments and asserts the results.
 *
 * That covers the parts a static check cannot: profile CRUD, quota and
 * consistency logic, proxy parsing, extension listing, workspace export/import,
 * and the local REST API on a live socket.
 *
 *   node scripts/smoke-desktop-main.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'apps/desktop');

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

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-smoke-'));
const cleanup = () => fs.rmSync(userData, { recursive: true, force: true });

/* ------------------------------------------------------------------ mocks */
const handlers = new Map();
const sentToRenderer = [];
let createdWindows = [];

class FakeWebContents {
  constructor() {
    this.debugger = {
      attach() {},
      sendCommand() { return Promise.resolve(); },
    };
    this.userAgent = null;
    this.events = new Map();
    this.title = '';
    this.loadedUrl = null;
    this.zoomLevel = 0;
    this.findCalls = [];
    this.closed = false;
  }
  send(channel, payload) { sentToRenderer.push({ channel, payload }); }
  on(event, fn) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event).push(fn);
    return this;
  }
  once(event, fn) {
    if (event === 'ready-to-show') this._ready = fn;
    return this;
  }
  emit(event, ...args) { for (const fn of this.events.get(event) ?? []) fn(...args); }
  getTitle() { return this.title; }
  setUserAgent(ua) { this.userAgent = ua; }
  setWindowOpenHandler(fn) { this.windowOpenHandler = fn; }
  reload() { this.reloaded = (this.reloaded ?? 0) + 1; }
  stop() {}
  close() { this.closed = true; }
  canGoBack() { return false; }
  canGoForward() { return false; }
  goBack() {}
  goForward() {}
  setZoomLevel(level) { this.zoomLevel = level; }
  findInPage(query, opts) { this.findCalls.push({ query, opts }); }
  stopFindInPage(action) { this.findStopped = action; }
  async loadURL(url) { this.loadedUrl = url; return undefined; }
  async loadFile(file) { this.loadedFile = file; return undefined; }
}

class FakeWebContentsView {
  static instances = [];
  constructor(options) {
    this.options = options;
    this.webContents = new FakeWebContents();
    this.bounds = null;
    FakeWebContentsView.instances.push(this);
  }
  setBounds(bounds) { this.bounds = bounds; }
}

class FakeBrowserWindow {
  constructor(options) {
    this.options = options;
    this.destroyed = false;
    this.shown = false;
    this.focused = false;
    this.title = options?.title ?? '';
    this.webContents = new FakeWebContents();
    this.childViews = [];
    this.contentView = {
      addChildView: (v) => { if (!this.childViews.includes(v)) this.childViews.push(v); },
      removeChildView: (v) => { this.childViews = this.childViews.filter((x) => x !== v); },
    };
    FakeBrowserWindow.instances.push(this);
    createdWindows.push(options?.title ?? 'untitled');
  }
  static instances = [];
  static getAllWindows() { return FakeBrowserWindow.instances.filter((w) => !w.destroyed); }
  on() { return this; }
  once(event, fn) { if (event === 'ready-to-show') this._ready = fn; return this; }
  show() { this.shown = true; return this; }
  fireReady() { this._ready?.(); }
  focus() { this.focused = true; return this; }
  setTitle(title) { this.title = title; }
  getContentSize() { return [1360, 860]; }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return false; }
  restore() { return this; }
  close() { this.destroyed = true; return this; }
  // Real BrowserWindow proxies these to webContents.
  async loadURL(url) { this.loadedUrl = url; const r = await this.webContents.loadURL(url); this.fireReady(); return r; }
  async loadFile(file) { this.loadedFile = file; const r = await this.webContents.loadFile(file); this.fireReady(); return r; }
}

const sessions = new Map();
const fakeElectron = {
  app: {
    requestSingleInstanceLock: () => true,
    on: () => {},
    whenReady: () => Promise.resolve(),
    getPath: () => userData,
    commandLine: { appendSwitch: () => {} },
    disableHardwareAcceleration: () => {},
    quit: () => {},
    isPackaged: false,
    async getVersion() { return '33.0.0'; },
  },
  BrowserWindow: FakeBrowserWindow,
  WebContentsView: FakeWebContentsView,
  session: {
    fromPartition(name) {
      if (!sessions.has(name)) {
        sessions.set(name, {
          name,
          proxy: null,
          async setProxy(cfg) { this.proxy = cfg; },
          webRequest: { onBeforeSendHeaders(_filter, cb) { this.callback = cb; } },
          cookies: { async set() { return undefined; } },
          extensions: { async loadExtension() { return {}; } },
          setPermissionRequestHandler(fn) { this.permRequest = fn; },
          setPermissionCheckHandler(fn) { this.permCheck = fn; },
          on(event, fn) { (this.listeners ??= new Map()).set(event, fn); },
          async clearStorageData() { this.cleared = (this.cleared ?? 0) + 1; },
          async clearCache() { this.cacheCleared = (this.cacheCleared ?? 0) + 1; },
        });
      }
      return sessions.get(name);
    },
  },
  ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
  shell: { openExternal: async () => undefined },
  Menu: { setApplicationMenu: () => {} },
};

// Install the mock before main.js resolves `electron`.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return 'electron';
  return originalResolve.call(this, request, ...rest);
};
require.cache.electron = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: fakeElectron,
};

process.env.JOE_API_PORT = String(9400 + Math.floor(Math.random() * 200));
delete process.env.JOE_SUPABASE_URL;

/**
 * Resolve an IPC handler lazily: with the mock, `whenReady()` runs asynchronously,
 * so a handler may not exist at the moment this module is evaluated.
 */
const invoker = (channel) => async (...args) => {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`${channel} is not registered`);
  return fn({}, ...args);
};

let mainLoaded = false;
await check('main.js loads and completes its startup chain', async () => {
  require(path.join(desktop, 'main.js'));
  mainLoaded = true;
  // Let the whenReady promise chain run to completion.
  await new Promise((resolve) => setTimeout(resolve, 400));
  must(handlers.size > 0, 'no IPC handlers were registered');
  must(FakeBrowserWindow.instances.length > 0, 'no BrowserWindow was created');
  const manager = FakeBrowserWindow.instances[0];
  must(manager.shown, 'the management window was never shown');
  return `${handlers.size} IPC channels, ${FakeBrowserWindow.instances.length} window(s)`;
});

await check('app:info reports the running version and platform', async () => {
  must(mainLoaded, 'main.js did not load');
  const info = await invoker('app:info')();
  must(info.version, 'no version');
  must(typeof info.platform === 'string', 'no platform');
  must(typeof info.profiles === 'number', 'no profile count');
  return `v${info.version} on ${info.platform}, ${info.profiles} profiles`;
});

await check('a fresh install is seeded with usable profiles', async () => {
  const list = await invoker('profiles:list')();
  must(Array.isArray(list) && list.length > 0, 'first run produced an empty workspace');
  const profile = list[0];
  must(profile.id && profile.name, 'seeded profile has no id/name');
  must(profile.fingerprint?.userAgent, 'seeded profile has no user agent');
  return `${list.length} profiles, e.g. "${profile.name}"`;
});

await check('profiles:create / update / delete round-trip through storage', async () => {
  const created = await invoker('profiles:create')({ name: 'Smoke Test', group: 'QA', seed: 'smoke' });
  must(created?.id, 'create returned no profile');
  let list = await invoker('profiles:list')();
  must(list.some((p) => p.id === created.id), 'created profile is not in the list');

  const before = created.revision;
  const updated = await invoker('profiles:update')(created.id, { name: 'Smoke Test v2' });
  must(updated.name === 'Smoke Test v2', 'update did not apply');
  must(updated.revision > before, `update did not bump revision (${before} -> ${updated.revision})`);

  const remaining = await invoker('profiles:delete')([created.id]);
  list = await invoker('profiles:list')();
  must(!list.some((p) => p.id === created.id), 'deleted profile is still present');
  must(remaining === list.length, 'delete returned the wrong count');

  // The workspace file must be on disk, or a restart loses everything.
  const saved = path.join(userData, 'workspace.json');
  must(fs.existsSync(saved), 'workspace.json was not written');
  const parsed = JSON.parse(fs.readFileSync(saved, 'utf8'));
  must(Array.isArray(parsed.profiles), 'workspace.json has no profiles array');
  return `persisted ${parsed.profiles.length} profiles to ${path.basename(saved)}`;
});

await check('profiles:bulk creates the requested number', async () => {
  const before = (await invoker('profiles:list')()).length;
  const made = await invoker('profiles:bulk')(3, { prefix: 'Bulk' });
  must(made === 3, `expected 3, got ${made}`);
  const after = (await invoker('profiles:list')()).length;
  must(after === before + 3, `expected ${before + 3} profiles, got ${after}`);
  return '+3 profiles';
});

await check('consistency, quality, surfaces and script work for a real profile', async () => {
  const [profile] = await invoker('profiles:list')();
  const consistency = await invoker('profiles:consistency')(profile.id);
  must(consistency, 'consistency returned nothing');
  const quality = await invoker('profiles:quality')(profile.id);
  must(quality, 'quality returned nothing');
  const surfaces = await invoker('profiles:surfaces')(profile.id);
  must(surfaces, 'surfaces returned nothing');
  const script = await invoker('profiles:script')(profile.id);
  must(typeof script === 'string' && script.length > 0, 'injection script is empty');
  must(script.includes(profile.fingerprint.userAgent), 'injection script does not carry the profile UA');
  return `script ${script.length} bytes`;
});

await check('proxies parse and import', async () => {
  const parsed = await invoker('proxies:parse')('socks5://user:pass@10.0.0.1:1080');
  must(parsed && parsed.host === '10.0.0.1', `unexpected parse: ${JSON.stringify(parsed)}`);
  // The preload bridge sends the textarea contents as one string.
  const count = await invoker('proxies:import')('1.2.3.4:8080\nsocks5://5.6.7.8:1080');
  must(count === 2, `expected 2 imported, got ${count}`);
  const list = await invoker('proxies:list')();
  must(list.length >= 2, 'imported proxies are not listed');
  return `${list.length} proxies`;
});

await check('workspace export / import round-trips', async () => {
  const exported = await invoker('workspace:export')();
  must(exported && typeof exported === 'object', 'export returned nothing');
  const text = JSON.stringify(exported);
  const total = await invoker('workspace:import')(text);
  must(typeof total === 'number' && total > 0, 'import returned no count');
  return `${total} profiles after import`;
});

await check('extensions list is safe when nothing is installed', async () => {
  const list = await invoker('extensions:list')();
  must(Array.isArray(list), 'extensions:list did not return an array');
  return `${list.length} installed`;
});

await check('extensions:install rejects a missing file with a clear message', async () => {
  let message = '';
  try {
    await invoker('extensions:install')(path.join(userData, 'nope.zip'), 'test');
  } catch (error) {
    message = error.message;
  }
  must(message, 'installing a missing file did not fail');
  must(/no longer exists/i.test(message), `unhelpful message: ${message}`);
  return message;
});

await check('profile launch applies a session, proxy and window', async () => {
  const [profile] = await invoker('profiles:list')();
  const result = await invoker('profiles:launch')(profile.id);
  must(result?.ok, 'launch did not return ok');
  const ses = sessions.get(`persist:${profile.id}`);
  must(ses, 'launch did not create a per-profile session');
  must(ses.proxy, 'launch did not set a proxy mode');
  const win = FakeBrowserWindow.instances.find((w) => w.options?.title?.includes(profile.name));
  must(win, 'launch did not open a window for the profile');
  must(String(win.loadedFile).endsWith('chrome.html'), 'the window did not load the bundled toolbar page');
  const views = FakeWebContentsView.instances;
  must(views.length > 0, 'launch created no tab');
  const tabView = views.at(-1);
  const tabWc = tabView.webContents;
  must(tabWc.userAgent === profile.fingerprint.userAgent, 'tab UA was not set from the profile');
  must(win.childViews.includes(tabView), 'the tab view was not attached to the window');
  must(tabView.bounds && tabView.bounds.y >= 70, 'the tab was not laid out below the toolbar');

  // Navigating the profile must stream real history to the manager window:
  // the History view used to show three seeded rows forever because nothing
  // ever recorded a visit.
  const before = sentToRenderer.filter((m) => m.channel === 'history:entry').length;
  tabWc.emit('did-navigate', {}, 'https://www.google.com/search?q=joe+browser');
  tabWc.title = 'joe browser - Google Search';
  tabWc.emit('did-finish-load', {});
  const entries = sentToRenderer.filter((m) => m.channel === 'history:entry');
  must(entries.length >= before + 2, 'navigation did not stream history:entry messages');
  const first = entries[entries.length - 2].payload;
  const titled = entries[entries.length - 1].payload;
  must(titled.url === 'https://www.google.com/search?q=joe+browser', 'history entry lost the URL');
  must(titled.profileId === profile.id, 'history entry is attributed to the wrong profile');
  must(titled.profileName === profile.name, 'history entry lost the profile name');
  must(titled.search === true, 'a search results page was not classified as a search');
  must(titled.title === 'joe browser - Google Search', 'the title refresh did not update the entry');
  must(first.id === titled.id, 'the title refresh created a duplicate entry id');

  // A second launch of a running profile must focus, not duplicate.
  const again = await invoker('profiles:launch')(profile.id);
  must(again?.alreadyRunning, 'relaunching a running profile did not report alreadyRunning');

  await invoker('profiles:stop')(profile.id);
  return 'chrome shell + tab session, UA, layout and history all wired';
});

await check('the profile window chrome routes toolbar commands to the tab', async () => {
  const [profile] = await invoker('profiles:list')();
  await invoker('profiles:launch')(profile.id);
  const win = FakeBrowserWindow.instances.filter((w) => String(w.loadedFile).endsWith('chrome.html')).at(-1);
  must(win, 'no window loaded chrome.html');
  const chromeSender = win.webContents;
  const chrome = (action, arg) => handlers.get('chrome:command')({ sender: chromeSender }, action, arg);

  // A toolbar command from a window that owns no profile must be refused —
  // one window's chrome must never drive another profile's tabs.
  let foreign = '';
  try { await handlers.get('chrome:command')({ sender: new FakeWebContents() }, 'reload'); }
  catch (e) { foreign = e.message; }
  must(/No profile window owns this toolbar/.test(foreign), 'a foreign chrome sender was not rejected');

  const viewsBefore = FakeWebContentsView.instances.length;
  await chrome('tabs:new');
  must(FakeWebContentsView.instances.length === viewsBefore + 1, 'the New tab button created no tab');

  await chrome('open', 'example.com');
  const tabWc = FakeWebContentsView.instances.at(-1).webContents;
  must(tabWc.loadedUrl === 'https://example.com/', `the address bar did not navigate: ${tabWc.loadedUrl}`);

  await chrome('open', 'joe browser anti detect');
  must(
    /google\.com\/search\?q=joe%20browser/.test(FakeWebContentsView.instances.at(-1).webContents.loadedUrl),
    'plain text in the address bar did not become a search',
  );

  await chrome('find', 'joe');
  must(tabWc.findCalls.length === 1 && tabWc.findCalls[0].query === 'joe', 'find on page did not reach the tab');

  await chrome('zoom', 0.5);
  must(tabWc.zoomLevel === 0.5, 'zoom did not apply to the tab');

  await chrome('bookmark:add', { url: 'https://example.com/', title: 'Example' });
  await chrome('bookmark:remove', 'https://example.com/');

  await chrome('perm:set', { type: 'geolocation', allow: true });

  await chrome('clear-data');
  must(sessions.get(`persist:${profile.id}`)?.cleared >= 1, 'clear-data did not clear the profile storage');

  let unknown = '';
  try { await chrome('teleport'); } catch (e) { unknown = e.message; }
  must(/Unknown chrome action/.test(unknown), 'an unknown toolbar action was not rejected');

  // Tab list state reaches the toolbar; closing the extra tab removes it.
  const navStates = () => sentToRenderer.filter((m) => m.channel === 'nav:state');
  const beforeClose = navStates().at(-1).payload;
  must(beforeClose.tabs.length === 2, `expected 2 tabs in nav:state, got ${beforeClose.tabs.length}`);
  await chrome('tabs:close', beforeClose.tabs.at(-1).id);
  const afterClose = navStates().at(-1).payload;
  must(afterClose.tabs.length === 1, 'closing a tab did not remove it from the strip');

  await invoker('profiles:stop')(profile.id);
  return 'tabs, navigation, find, zoom, bookmarks, permissions and clear-data all routed';
});

await check('the UI workspace syncs first, then launches the UI\'s own profiles', async () => {
  // The shipped bug: the UI's profiles existed only in localStorage, so this
  // exact call sequence threw "Unknown profile" and no window ever opened.
  const fromUi = {
    profiles: [{
      id: 'ui_profile_1',
      name: 'From the UI',
      group: 'UI',
      templateId: 'win11-intel',
      proxyId: 'px_ui',
      fingerprint: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0' },
    }],
    proxies: [{ id: 'px_ui', name: 'UI proxy', protocol: 'http', host: '10.1.1.1', port: 8080 }],
    groups: ['Default', 'UI'],
  };

  const sync = await invoker('workspace:replace')(fromUi);
  must(sync?.ok, 'workspace:replace did not report ok');
  must(sync.profiles === 1, `expected 1 profile after sync, got ${sync.profiles}`);

  const list = await invoker('profiles:list')();
  must(list.length === 1 && list[0].id === 'ui_profile_1', 'the shell did not adopt the UI workspace');

  // A profile created by the UI and never seeded by the shell must launch.
  const launched = await invoker('profiles:launch')('ui_profile_1');
  must(launched?.ok, `launching the UI profile failed: ${JSON.stringify(launched)}`);
  const win = FakeBrowserWindow.instances.find((w) => w.options?.title?.includes('From the UI'));
  must(win, 'no window opened for the UI profile');
  const ses = sessions.get('persist:ui_profile_1');
  must(ses?.proxy?.proxyRules === 'http://10.1.1.1:8080', `proxy not applied: ${JSON.stringify(ses?.proxy)}`);

  // Syncing again must not disturb a running profile's live status.
  await invoker('workspace:replace')(fromUi);
  const after = await invoker('profiles:list')();
  must(after[0].status === 'running', `a sync reset a running profile to "${after[0].status}"`);

  await invoker('profiles:stop')('ui_profile_1');
  return 'UI profile adopted, launched with its proxy, status preserved across syncs';
});

await check('sync credentials from the UI are stored and applied', async () => {
  // v3.1.0 read these only from the environment, so a key typed into Settings
  // was silently ignored and sync never connected.
  const result = await invoker('sync:configure')({ url: 'https://example.supabase.co', anonKey: 'test-key' });
  must(result?.ok, 'sync:configure did not report ok');
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'workspace.json'), 'utf8'));
  must(saved.sync?.url === 'https://example.supabase.co', 'the URL was not persisted');
  must(saved.sync?.anonKey === 'test-key', 'the key was not persisted');
  return 'persisted to workspace.json and reconnected';
});

await check('the local REST API answers /health and rejects unauthenticated calls', async () => {
  // The API binds 127.0.0.1 on the configured port; find it from the token file.
  const tokenFile = path.join(userData, 'api-token.txt');
  must(fs.existsSync(tokenFile), 'no api token was created');
  const token = fs.readFileSync(tokenFile, 'utf8').trim();
  must(token.length >= 16, 'api token looks too short');

  const request = (options) =>
    new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });

  const port = Number(process.env.JOE_API_PORT);
  const base = { host: '127.0.0.1', port };

  const health = await request({ ...base, path: '/health', method: 'GET' });
  must(health.status === 200, `/health returned ${health.status}`);
  must(JSON.parse(health.body).ok === true, '/health did not report ok');

  const denied = await request({ ...base, path: '/profiles', method: 'GET' });
  must(denied.status === 401, `/profiles without a token returned ${denied.status}`);

  const allowed = await request({
    ...base,
    path: '/profiles',
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
  must(allowed.status === 200, `authorized /profiles returned ${allowed.status}`);
  const profiles = JSON.parse(allowed.body);
  must(Array.isArray(profiles) && profiles.length > 0, 'authorized /profiles returned no data');

  const crossOrigin = await request({
    ...base,
    path: '/profiles',
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, origin: 'https://evil.example' },
  });
  must(crossOrigin.status === 403, `foreign origin returned ${crossOrigin.status}, expected 403`);
  return `health 200, no-token 401, token 200, foreign origin 403`;
});

// Let the servers and windows settle before tearing down.
await new Promise((resolve) => setTimeout(resolve, 100));
for (const win of FakeBrowserWindow.instances) win.close();
cleanup();

if (failed > 0) {
  console.log(`\n${failed} main-process smoke check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nDesktop main process works end to end');
process.exit(0);
