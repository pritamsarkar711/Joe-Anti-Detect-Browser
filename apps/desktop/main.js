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
const core = require('./core.cjs');
const { startRestApi } = require('./rest');

const APP_VERSION = '2.0.0';
const DATA_FILE = () => path.join(app.getPath('userData'), 'workspace.json');
const windows = new Map(); // profileId -> BrowserWindow

let managerWindow = null;
let workspace = { profiles: [], proxies: [], groups: ['Default'] };
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

function applyHeaders(ses, spec) {
  const h = spec.uaClientHints;
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['User-Agent'] = spec.userAgent;
    headers['Accept-Language'] = spec.languages.join(',') + ';q=0.9';
    headers['Sec-CH-UA'] = h.secChUa || h.brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
    headers['Sec-CH-UA-Mobile'] = h.secChUaMobile || (h.mobile ? '?1' : '?0');
    headers['Sec-CH-UA-Platform'] = `"${h.platform}"`;
    headers['Sec-CH-UA-Platform-Version'] = `"${h.platformVersion}"`;
    headers['Sec-CH-UA-Full-Version'] = `"${h.fullVersion}"`;
    headers['Sec-CH-UA-Full-Version-List'] = h.brands.map((b) => `"${b.brand}";v="${h.fullVersion}"`).join(', ');
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
  for (const dir of profile.extensions) {
    try {
      if (!fs.existsSync(dir)) continue;
      await ses.extensions.loadExtension(dir, { allowFileAccess: true });
    } catch (e) { console.error('extension load failed', e.message); }
  }
}

function startUrlFor(profile) {
  const candidate = profile.startUrl || process.env.JOE_START_PAGE || 'https://example.com';
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : 'https://example.com';
  } catch { return 'https://example.com'; }
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
  if (!profile) throw new Error(`Unknown profile ${id}`);
  if (windows.has(id)) { windows.get(id).focus(); return { ok: true, alreadyRunning: true }; }

  const partition = `persist:${id}`;
  const ses = session.fromPartition(partition);
  await applyProxy(ses, profile);
  await seedCookies(ses, profile);
  await loadExtensions(ses, profile);
  applyHeaders(ses, profile.fingerprint);

  const win = new BrowserWindow({
    width: Math.min(1440, Math.max(900, profile.fingerprint.screen.width)),
    height: Math.min(960, Math.max(640, profile.fingerprint.screen.height)),
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

  attachInjection(win, profile.fingerprint);
  win.webContents.setUserAgent(profile.fingerprint.userAgent);
  await win.loadURL(startUrlFor(profile)).catch((e) => console.error('load failed', e));

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
  managerWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 620,
    title: 'Joe Browser', backgroundColor: '#F6F7F9',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  const ui = path.join(__dirname, 'web-dist', 'index.html');
  if (fs.existsSync(ui)) managerWindow.loadFile(ui);
  else managerWindow.loadURL(process.env.JOE_CONTROL_PLANE_URL || 'https://joe-browser.vercel.app');
  managerWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  Menu.setApplicationMenu(null);
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
  handle('proxies:list', () => workspace.proxies);
  handle('proxies:add', (p) => { workspace.proxies.unshift(p); saveWorkspace(); return p; });
  handle('proxies:parse', (line) => core.parseProxy(line));
  handle('proxies:import', (lines) => {
    const parsed = core.parseProxyLines(lines).filter((p) => p.valid && p.host);
    workspace.proxies = [...parsed.map((p, i) => ({ id: `px_${Date.now()}_${i}`, name: `${p.host}:${p.port}`, protocol: p.protocol, host: p.host, port: p.port, country: 'XX', status: 'unchecked', latencyMs: null })), ...workspace.proxies];
    saveWorkspace(); return parsed.length;
  });
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
  const url = process.env.JOE_SUPABASE_URL;
  const key = process.env.JOE_SUPABASE_ANON_KEY;
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

app.whenReady().then(async () => {
  loadWorkspace();
  registerIpc();
  createManagerWindow();
  startRestApi({ port: Number(process.env.JOE_API_PORT || 9333), api: {
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
