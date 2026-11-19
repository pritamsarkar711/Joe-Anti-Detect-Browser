/**
 * Joe Browser — Electron main process.
 *
 * Real per-profile isolation:
 *   - session.fromPartition('persist:<profileId>')  → separate cookies / cache / storage
 *   - ses.setProxy                                   → proxy per profile
 *   - webRequest.onBeforeSendHeaders                 → UA + Client Hints + Accept-Language
 *   - CDP Page.addScriptToEvaluateOnNewDocument      → JS fingerprint consistency payload,
 *                                                      injected in the MAIN world before any page script
 *
 * The management UI is the same Vite/React build used by the web control plane.
 */
const { app, BrowserWindow, session, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
// The fingerprint core is not optional: without it there are no profiles to
// open, so a missing core.cjs is a genuine build failure. scripts/check-desktop.mjs
// fails the build if it is left out of the package, rather than shipping an app
// that dies on launch.
const core = require('./core.cjs');
const { startRestApi, readOrCreateToken } = require('./rest');

/**
 * The shipped version comes from package.json so the shell cannot drift from
 * the installer again: v3.1.0's hard-coded '3.1.0' outlived the 3.1.1 bump and
 * `app:info` reported the wrong version to the UI and the REST API.
 */
const APP_VERSION = require('./package.json').version;
const DATA_FILE = () => path.join(app.getPath('userData'), 'workspace.json');

/**
 * Extensions live beside the workspace, inside this app's own userData. Nothing
 * is read from the machine's Chrome/Firefox profile directories.
 */
const EXT_ROOT = () => path.join(app.getPath('userData'), 'extensions');
/**
 * A missing module must cost one feature, never the whole app.
 *
 * v3.1.0 shipped without extensions.cjs in `app.asar`, so this line threw before
 * a window could be created and Windows showed "Error: Cannot find module
 * './extensions.cjs'" instead of Joe Browser. The packaging bug is fixed at the
 * root (see scripts/check-desktop.mjs), and this fallback means any future gap
 * degrades extension management instead of bricking the install.
 */
let ext;
try {
  ext = require('./extensions.cjs');
} catch (error) {
  console.error('[joe] extension support unavailable:', error.message);
  const unavailable = () => { throw new Error('Extension support is unavailable in this build.'); };
  ext = { listInstalled: () => [], installZip: unavailable, digest: unavailable };
}
const windows = new Map(); // profileId -> BrowserWindow

let managerWindow = null;
let workspace = { profiles: [], proxies: [], groups: ['Default'] }; // `sync` is optional
let realtime = null;

/** Fill v2 fields so workspaces exported by v1 still open safely. */
function normalizeProfile(p) {
  const hint = p.fingerprint?.uaClientHints ?? {};
  const brands = Array.isArray(hint.brands) ? hint.brands : [];
  const secChUa = hint.secChUa || brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
  return {
    ...p,
    tags: Array.isArray(p.tags) ? p.tags : [],
    notes: p.notes ?? '',
    startUrl: p.startUrl ?? '',
    cookies: p.cookies ?? '',
    extensions: Array.isArray(p.extensions) ? p.extensions : [],
    realId: p.realId ?? p.fingerprint?.realId,
    fingerprint: {
      ...p.fingerprint,
      uaClientHints: {
        ...hint,
        brands,
        secChUa,
        secChUaMobile: hint.secChUaMobile ?? (hint.mobile ? '?1' : '?0'),
      },
    },
  };
}

function loadWorkspace() {
  try {
    const raw = fs.readFileSync(DATA_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    workspace = {
      profiles: (Array.isArray(parsed.profiles) ? parsed.profiles : []).map(normalizeProfile),
      proxies: Array.isArray(parsed.proxies) ? parsed.proxies : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : ['Default'],
      sync: parsed.sync && typeof parsed.sync === 'object' ? parsed.sync : undefined,
    };
  } catch {
    workspace = { profiles: [], proxies: [], groups: ['Default'] };
    // First run: seed coherent observed-device profiles so the app is not empty.
    const names = ['Profile 001', 'Profile 002', 'Profile 003'];
    const presets = core.REAL_DEVICE_PRESETS ?? [];
    workspace.profiles = names.map((name, i) => normalizeProfile(core.createProfile({
      name, seed: `desktop::${i}`, ...(presets[i] ? { realPresetId: presets[i].id } : {}),
    }, i)));
    saveWorkspace();
  }
}

function saveWorkspace() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE()), { recursive: true });
    fs.writeFileSync(DATA_FILE(), JSON.stringify(workspace, null, 2));
  } catch (e) { console.error('save failed', e); }
}

function findProfile(id) { return workspace.profiles.find((p) => p.id === id); }

function proxyFor(profile) {
  const px = workspace.proxies.find((p) => p.id === profile.proxyId);
  if (!px || !px.host) return null;
  const auth = px.username ? `${encodeURIComponent(px.username)}:${encodeURIComponent(px.password ?? '')}@` : '';
  return `${px.protocol}://${auth}${px.host}:${px.port}`;
}

async function applyProxy(ses, profile) {
  const url = proxyFor(profile);
  try { await ses.setProxy(url ? { proxyRules: url, proxyBypassRules: '<local>;localhost;127.0.0.1' } : { mode: 'direct' }); }
  catch (e) { console.error('proxy error', e); }
}

/**
 * WebKit families (Safari-shaped iPhone/iPad profiles and any Firefox profile)
 * never send `Sec-CH-UA*`. Adding those headers to a WebKit user agent is the
 * single most obvious mismatch a server-side check can spot, so the whole
 * Client Hints block is skipped for them instead of forced.
 */
function supportsClientHints(spec) {
  const ua = spec.userAgent || '';
  const webkitOnly = !/Chrome\//.test(ua) && !/Edg\//.test(ua);
  const firefox = /Firefox\//.test(ua);
  return !webkitOnly && !firefox;
}

function applyHeaders(ses, spec) {
  const h = spec.uaClientHints;
  const clientHints = supportsClientHints(spec);
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['User-Agent'] = spec.userAgent;
    headers['Accept-Language'] = spec.languages.join(',') + ';q=0.9';
    if (clientHints) {
      headers['Sec-CH-UA'] = h.secChUa || h.brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
      headers['Sec-CH-UA-Mobile'] = h.secChUaMobile || (h.mobile ? '?1' : '?0');
      headers['Sec-CH-UA-Platform'] = `"${h.platform}"`;
      headers['Sec-CH-UA-Platform-Version'] = `"${h.platformVersion}"`;
      headers['Sec-CH-UA-Full-Version'] = `"${h.fullVersion}"`;
      headers['Sec-CH-UA-Full-Version-List'] = h.brands.map((b) => `"${b.brand}";v="${h.fullVersion}"`).join(', ');
    } else {
      for (const key of Object.keys(headers)) {
        if (/^sec-ch-ua/i.test(key)) delete headers[key];
      }
    }
    if (spec.doNotTrack) headers['DNT'] = '1';
    callback({ requestHeaders: headers });
  });
}

async function seedCookies(ses, profile) {
  const cookies = core.parseCookies(profile.cookies || '');
  for (const c of cookies) {
    if (!c.name || !c.domain) continue;
    const url = `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path || '/'}`;
    try {
      await ses.cookies.set({
        url, name: c.name, value: c.value, domain: c.domain,
        path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly,
        ...(c.expires ? { expirationDate: c.expires } : {}),
      });
    } catch (e) { console.error('cookie seed failed', e.message); }
  }
}

async function loadExtensions(ses, profile) {
  if (!Array.isArray(profile.extensions) || !ses.extensions?.loadExtension) return;
  const installed = new Map(ext.listInstalled(EXT_ROOT()).map((e) => [path.basename(e.dir), e.dir]));
  for (const entry of profile.extensions) {
    // Accept either an absolute directory or a bare id of an installed extension.
    const dir = path.isAbsolute(entry) ? entry : installed.get(entry);
    if (!dir || !fs.existsSync(dir)) { console.error('extension missing', entry); continue; }
    try {
      await ses.extensions.loadExtension(dir, { allowFileAccess: true });
    } catch (e) { console.error('extension load failed', e.message); }
  }
}

function startUrlFor(profile) {
  const candidate = profile.startUrl || process.env.JOE_START_PAGE || 'https://browserscan.net/';
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : 'https://example.com';
  } catch { return 'https://browserscan.net/'; }
}

/**
 * Record real browsing history per profile.
 *
 * The History view could always list and filter entries, but nothing ever wrote
 * one — `addHistory` had no callers, so the page showed three seeded rows
 * forever while the README promised "every URL and search". Each main-frame
 * navigation is classified and forwarded to the manager window, which merges it
 * into the workspace history. A follow-up on `did-finish-load` re-sends the
 * entry with the real page title (same deterministic id, so the merge updates
 * rather than duplicates).
 */
function attachHistory(profileId, profileName, wc) {
  let last = null;
  const sendEntry = (url, title, at) => {
    if (!managerWindow || managerWindow.isDestroyed()) return;
    const info = core.classifyNavigation(url, title);
    managerWindow.webContents.send('history:entry', {
      id: core.historyEntryId(profileId, url, at),
      profileId, profileName, url,
      title: info.title, search: info.search, at,
    });
  };
  const record = (url) => {
    if (!url || !/^https?:/i.test(url)) return;
    if (last && last.url === url) return; // in-page repeat; title refresh covers it
    last = { url, at: new Date().toISOString() };
    sendEntry(url, '', last.at);
  };
  wc.on('did-navigate', (_e, url) => record(url));
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame !== false) record(url); });
  wc.on('did-finish-load', () => {
    if (!last) return;
    let title = '';
    try { title = wc.getTitle() || ''; } catch { /* window can be closing */ }
    if (title) sendEntry(last.url, title, last.at);
  });
}

function attachInjection(win, spec) {
  // CDP injection runs in the main world *before* any page script executes.
  try {
    win.webContents.debugger.attach('1.3');
    const script = core.buildInjectionScript(spec, { maskToString: true, selfTestHook: true });
    win.webContents.debugger.sendCommand('Page.enable');
    win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: script });
    win.webContents.debugger.sendCommand('Network.enable');
    win.webContents.debugger.sendCommand('Network.setUserAgentOverride', {
      userAgent: spec.userAgent,
      acceptLanguage: spec.languages.join(','),
      platform: spec.platform,
      userAgentMetadata: {
        brands: spec.uaClientHints.brands,
        fullVersionList: spec.uaClientHints.brands.map((b) => ({ brand: b.brand, version: spec.uaClientHints.fullVersion })),
        fullVersion: spec.uaClientHints.fullVersion,
        platform: spec.uaClientHints.platform,
        platformVersion: spec.uaClientHints.platformVersion,
        architecture: spec.uaClientHints.platform === 'Android' ? 'arm' : 'x86',
        model: '', mobile: spec.uaClientHints.mobile, bitness: '64', wow64: false,
      },
    });
  } catch (e) { console.error('CDP injection error', e); }
}

async function launchProfile(id) {
  const profile = findProfile(id);
  if (!profile) throw new Error('That profile is no longer in this workspace. Reload to refresh the list.');
  if (!profile.fingerprint?.userAgent) throw new Error('That profile has no fingerprint yet. Recreate it to regenerate one.');
  if (windows.has(id)) { windows.get(id).focus(); return { ok: true, alreadyRunning: true }; }

  const partition = `persist:${id}`;
  const ses = session.fromPartition(partition);
  await applyProxy(ses, profile);
  await seedCookies(ses, profile);
  await loadExtensions(ses, profile);
  applyHeaders(ses, profile.fingerprint);

  // A profile can arrive from an older export or a hand-edited workspace. A
  // missing `screen` used to throw "Cannot read properties of undefined" and
  // the window never opened; fall back to a sane desktop size instead.
  const screen = profile.fingerprint?.screen ?? {};
  const width = Number.isFinite(screen.width) ? screen.width : 1440;
  const height = Number.isFinite(screen.height) ? screen.height : 900;
  const win = new BrowserWindow({
    width: Math.min(1440, Math.max(900, width)),
    height: Math.min(960, Math.max(640, height)),
    show: false,
    title: `Joe Browser — ${profile.name}`,
    webPreferences: {
      partition, preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: false, nodeIntegration: false,
      webSecurity: true, spellcheck: false,
    },
  });

  windows.set(id, win);
  win.on('closed', () => {
    windows.delete(id);
    profile.status = 'stopped';
    profile.device = null;
    saveWorkspace();
    managerWindow?.webContents.send('profiles:changed', workspace.profiles);
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[joe] profile renderer gone', profile.id, details.reason);
  });

  attachInjection(win, profile.fingerprint);
  attachHistory(profile.id, profile.name, win.webContents);
  win.webContents.setUserAgent(profile.fingerprint.userAgent);
  // dom-ready fires as soon as the document exists; loading the target URL here
  // keeps a collapsed or slow window from appearing frozen.
  win.once('ready-to-show', () => win.show());
  await win.loadURL(startUrlFor(profile)).catch((e) => console.error('profile load failed', e));

  profile.status = 'running';
  profile.device = 'desktop-exe';
  profile.lastLaunchedAt = new Date().toISOString();
  saveWorkspace();
  managerWindow?.webContents.send('profiles:changed', workspace.profiles);
  return { ok: true };
}

function stopProfile(id) {
  const win = windows.get(id);
  if (win) { win.close(); windows.delete(id); }
  const p = findProfile(id);
  if (p) { p.status = 'stopped'; p.device = null; saveWorkspace(); }
  managerWindow?.webContents.send('profiles:changed', workspace.profiles);
  return { ok: true };
}

function createManagerWindow() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.show();
    managerWindow.focus();
    return managerWindow;
  }
  const width = 1360;
  const height = 860;
  managerWindow = new BrowserWindow({
    width, height, minWidth: 760, minHeight: 520,
    show: false,
    title: 'Joe Browser', backgroundColor: '#F6F7F9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true,
      devTools: !app.isPackaged,
    },
  });

  // Show only when the first paint is ready — avoids a white flash on Windows.
  managerWindow.once('ready-to-show', () => managerWindow?.show());
  managerWindow.on('closed', () => { managerWindow = null; });

  // A crashed renderer used to leave a permanently blank window.
  managerWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[joe] manager renderer gone', details);
    if (details.reason !== 'clean-exit' && managerWindow && !managerWindow.isDestroyed()) {
      managerWindow.webContents.reload();
    }
  });
  managerWindow.webContents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;
    console.error('[joe] manager failed to load', code, description, url);
  });
  managerWindow.webContents.on('unresponsive', () => console.warn('[joe] manager unresponsive'));

  const ui = path.join(__dirname, 'web-dist', 'index.html');
  if (fs.existsSync(ui)) {
    managerWindow.loadFile(ui).catch((e) => console.error('[joe] UI load failed', e));
  } else {
    // Developer fallback only; shipped builds always contain web-dist.
    console.warn('[joe] web-dist missing, loading control plane URL');
    managerWindow.loadURL(process.env.JOE_CONTROL_PLANE_URL || 'https://joe-browser-control.vercel.app').catch((e) => console.error(e));
  }
  managerWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  Menu.setApplicationMenu(null);
  return managerWindow;
}

function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, async (_e, ...args) => fn(...args));
  handle('app:info', () => ({ version: APP_VERSION, platform: process.platform, electron: process.versions.electron, profiles: workspace.profiles.length }));
  handle('profiles:list', () => workspace.profiles);
  handle('profiles:get', (id) => findProfile(id) ?? null);
  handle('profiles:create', (input) => {
    const p = core.createProfile(input, workspace.profiles.length);
    workspace.profiles.unshift(p); saveWorkspace();
    managerWindow?.webContents.send('profiles:changed', workspace.profiles);
    return p;
  });
  handle('profiles:bulk', (count, input) => {
    const made = core.generateProfiles(Math.max(1, Number(count) || 1), input, input.prefix || 'Profile');
    workspace.profiles = [...made, ...workspace.profiles]; saveWorkspace();
    return made.length;
  });
  handle('profiles:update', (id, patch) => {
    const p = findProfile(id); if (!p) return null;
    Object.assign(p, patch, { revision: p.revision + 1, updatedAt: new Date().toISOString() });
    saveWorkspace(); return p;
  });
  handle('profiles:delete', (ids) => {
    const set = new Set(ids);
    ids.forEach(stopProfile);
    workspace.profiles = workspace.profiles.filter((p) => !set.has(p.id));
    saveWorkspace(); return workspace.profiles.length;
  });
  handle('profiles:launch', (id) => launchProfile(id));
  handle('profiles:stop', (id) => stopProfile(id));
  handle('profiles:consistency', (id) => { const p = findProfile(id); return p ? core.checkProfile(p) : null; });
  handle('profiles:quality', (id) => { const p = findProfile(id); return p ? core.profileQuality(p, workspace.profiles) : null; });
  handle('profiles:surfaces', (id) => { const p = findProfile(id); return p ? core.surfaces(p.fingerprint) : null; });
  handle('profiles:script', (id) => { const p = findProfile(id); return p ? core.buildInjectionScript(p.fingerprint, { selfTestHook: true }) : null; });
  // --- extensions -------------------------------------------------------
  handle('extensions:list', () => ext.listInstalled(EXT_ROOT()));
  handle('extensions:install', async (zipPath, id) => {
    const safeId = String(id || '').replace(/[^a-z0-9._-]/gi, '-').slice(0, 64);
    if (!safeId) throw new Error('An extension id is required.');
    const info = await ext.installZip({ root: EXT_ROOT(), zipPath, id: safeId });
    return info;
  });
  handle('extensions:digest', (filePath) => ext.digest(filePath));
  handle('extensions:attach', (profileId, dir) => {
    const p = findProfile(profileId);
    if (!p) return null;
    const list = Array.isArray(p.extensions) ? p.extensions : [];
    if (!list.includes(dir)) list.push(dir);
    p.extensions = list;
    p.revision += 1;
    p.updatedAt = new Date().toISOString();
    saveWorkspace();
    return p;
  });
  handle('extensions:detach', (profileId, dir) => {
    const p = findProfile(profileId);
    if (!p) return null;
    p.extensions = (p.extensions || []).filter((d) => d !== dir);
    p.revision += 1;
    p.updatedAt = new Date().toISOString();
    saveWorkspace();
    return p;
  });
  handle('proxies:list', () => workspace.proxies);
  handle('proxies:add', (p) => { workspace.proxies.unshift(p); saveWorkspace(); return p; });
  handle('proxies:parse', (line) => core.parseProxy(line));
  handle('proxies:import', (lines) => {
    const parsed = core.parseProxyLines(lines).filter((p) => p.valid && p.host);
    workspace.proxies = [...parsed.map((p, i) => ({ id: `px_${Date.now()}_${i}`, name: `${p.host}:${p.port}`, protocol: p.protocol, host: p.host, port: p.port, country: 'XX', status: 'unchecked', latencyMs: null })), ...workspace.proxies];
    saveWorkspace(); return parsed.length;
  });
  /**
   * Adopt the management UI's workspace wholesale.
   *
   * The UI owns the user's intent (it is where profiles are created, edited and
   * deleted); the main process needs the same list to launch them. Without this
   * channel the two stores diverged and every launch from the UI failed with
   * "Unknown profile". Idempotent: called after each UI mutation.
   */
  handle('workspace:replace', (next) => {
    if (!next || !Array.isArray(next.profiles)) throw new Error('workspace:replace needs a profiles array');
    const incoming = next.profiles.map(normalizeProfile);
    const keep = new Map(incoming.map((p) => [p.id, p]));
    // A profile that is currently running keeps its live status and window.
    for (const running of windows.keys()) {
      const known = keep.get(running);
      if (known) { known.status = 'running'; known.device = 'desktop-exe'; }
    }
    workspace.profiles = incoming;
    workspace.proxies = Array.isArray(next.proxies) ? next.proxies : [];
    workspace.groups = Array.isArray(next.groups) && next.groups.length ? next.groups : ['Default'];
    saveWorkspace();
    managerWindow?.webContents.send('profiles:changed', workspace.profiles);
    return { ok: true, profiles: workspace.profiles.length };
  });
  /**
   * Accept Supabase credentials from the UI.
   *
   * v3.1.0 read JOE_SUPABASE_URL / JOE_SUPABASE_ANON_KEY from the environment
   * only, so a key typed into Settings did nothing and sync never connected.
   * The values are kept in the workspace file and applied immediately.
   */
  handle('sync:configure', async (config) => {
    const url = String(config?.url ?? '').trim();
    const anonKey = String(config?.anonKey ?? '').trim();
    workspace.sync = { url, anonKey };
    saveWorkspace();
    await connectRealtime();
    return { ok: true, connected: !!realtime };
  });
  /** Read the shell's copy, so the UI can adopt launches made elsewhere. */
  handle('workspace:read', () => ({ profiles: workspace.profiles, proxies: workspace.proxies, groups: workspace.groups }));
  handle('workspace:export', () => core.exportWorkspace(workspace.profiles, workspace.proxies, workspace.groups));
  handle('workspace:import', (json) => {
    const d = core.importWorkspace(json);
    workspace.profiles = [...d.profiles.map(normalizeProfile), ...workspace.profiles.filter((p) => !d.profiles.some((x) => x.id === p.id))];
    workspace.proxies = [...d.proxies, ...workspace.proxies.filter((p) => !d.proxies.some((x) => x.id === p.id))];
    workspace.groups = [...new Set([...workspace.groups, ...d.groups])];
    saveWorkspace(); return workspace.profiles.length;
  });
  handle('sync:send', async (topic, payload, to) => {
    if (!realtime) return { ok: false, reason: 'realtime not configured' };
    await realtime.send({ type: 'broadcast', event: 'joe-sync', payload: { topic, payload, to, from: 'desktop-exe', sentAt: new Date().toISOString() } });
    return { ok: true };
  });
}

/** Optional Supabase Realtime link — no credentials bundled, configured in Settings. */
async function connectRealtime() {
  const url = workspace.sync?.url || process.env.JOE_SUPABASE_URL;
  const key = workspace.sync?.anonKey || process.env.JOE_SUPABASE_ANON_KEY;
  // Reconnecting (after a settings change) must not leak the old channel.
  if (realtime) {
    try { await realtime.unsubscribe?.(); } catch { /* noop */ }
    realtime = null;
  }
  if (!url || !key) return;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
    const channel = supabase.channel('joe-sync').on('broadcast', { event: 'joe-sync' }, ({ payload }) => {
      if (payload.to && payload.to !== 'desktop-exe') return;
      if (payload.from === 'desktop-exe') return;
      if (payload.topic === 'command:launch' && Array.isArray(payload.payload?.profileIds)) {
        payload.payload.profileIds.forEach((id) => launchProfile(id).catch((e) => console.error(e)));
      }
      if (payload.topic === 'command:stop' && Array.isArray(payload.payload?.profileIds)) {
        payload.payload.profileIds.forEach(stopProfile);
      }
      managerWindow?.webContents.send('sync:event', payload);
    }).subscribe();
    realtime = channel;
  } catch (e) { console.error('Supabase connection failed', e); }
}

/**
 * Crash avoidance for low-spec Windows machines.
 *
 *   - A second launch must focus the existing window, not start a second
 *     process that competes for the same userData lock.
 *   - GPU compositing on old Intel/AMD drivers is a common cause of a white
 *     management window. Users can force software rendering with
 *     JOE_DISABLE_GPU=1 (or --disable-gpu), plus the shell fallbacks below.
 *   - An unhandled rejection must be logged, never left to kill the process.
 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (managerWindow) {
      if (managerWindow.isMinimized()) managerWindow.restore();
      managerWindow.show();
      managerWindow.focus();
    }
  });
}

if (process.env.JOE_DISABLE_GPU === '1' || process.argv.includes('--disable-gpu')) {
  app.disableHardwareAcceleration();
}
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-angle', 'd3d11');
}

process.on('unhandledRejection', (reason) => console.error('[joe] unhandled rejection', reason));
process.on('uncaughtException', (error) => console.error('[joe] uncaught exception', error));

app.whenReady().then(async () => {
  loadWorkspace();
  registerIpc();
  createManagerWindow();
  const apiToken = readOrCreateToken(app.getPath('userData'));
  startRestApi({ port: Number(process.env.JOE_API_PORT || 9333), userDataDir: app.getPath('userData'), api: {
    info: () => ({ version: APP_VERSION, profiles: workspace.profiles.length, running: windows.size }),
    list: () => workspace.profiles,
    get: (id) => findProfile(id),
    create: (body) => {
      const p = core.createProfile(body, workspace.profiles.length);
      workspace.profiles.unshift(p);
      saveWorkspace();
      managerWindow?.webContents.send('profiles:changed', workspace.profiles);
      return p;
    },
    launch: (id) => launchProfile(id),
    stop: (id) => stopProfile(id),
    consistency: (id) => { const p = findProfile(id); return p ? core.checkProfile(p) : null; },
    quality: (id) => { const p = findProfile(id); return p ? core.profileQuality(p, workspace.profiles) : null; },
    surfaces: (id) => { const p = findProfile(id); return p ? core.surfaces(p.fingerprint) : null; },
    script: (id) => { const p = findProfile(id); return p ? core.buildInjectionScript(p.fingerprint, { selfTestHook: true }) : null; },
  } });
  await connectRealtime();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createManagerWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { for (const w of windows.values()) try { w.close(); } catch { /* noop */ } });

module.exports = { launchProfile, stopProfile };
