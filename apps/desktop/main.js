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
const { app, BrowserWindow, WebContentsView, session, ipcMain, shell, Menu } = require('electron');
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
const windows = new Map(); // profileId -> profile window record (see launchProfile)

/* ------------------------------------------------------------------
 * Human-paced keystroke replay (CDP Input).
 * ------------------------------------------------------------------ */
const typingRuns = new Map(); // profileId -> generation; a new plan wins

function validateSchedule(schedule) {
  if (!Array.isArray(schedule) || !schedule.length || schedule.length > 10000) {
    return 'A plan must contain 1 to 10,000 keystrokes.';
  }
  for (const k of schedule) {
    if (!k || (k.key !== 'char' && k.key !== 'Backspace')) return 'The plan contains an unknown keystroke kind.';
    if (typeof k.delay !== 'number' || !(k.delay >= 0) || k.delay > 5000) return 'The plan contains an invalid delay.';
    if (k.key === 'char' && (typeof k.char !== 'string' || Array.from(k.char).length > 1)) {
      return 'The plan contains an invalid character.';
    }
  }
  return null;
}

async function dispatchKey(target, k) {
  const dbg = target.debugger;
  if (k.key === 'Backspace') {
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    return;
  }
  if (k.char === '\n') {
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    return;
  }
  await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'char', text: k.char, unmodifiedText: k.char, key: k.char });
}

/**
 * Per-profile browsing controls state: bookmarks and permission decisions.
 * Kept beside the workspace but in its own file — `workspace:replace` adopts
 * the UI's profile objects wholesale and would otherwise clobber these.
 */
const CONTROLS_FILE = () => path.join(app.getPath('userData'), 'controls.json');
let controls = { bookmarks: {}, permissions: {} };
function loadControls() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONTROLS_FILE(), 'utf8'));
    controls = {
      bookmarks: parsed.bookmarks && typeof parsed.bookmarks === 'object' ? parsed.bookmarks : {},
      permissions: parsed.permissions && typeof parsed.permissions === 'object' ? parsed.permissions : {},
    };
  } catch {
    controls = { bookmarks: {}, permissions: {} };
  }
}
function saveControls() {
  try {
    fs.mkdirSync(path.dirname(CONTROLS_FILE()), { recursive: true });
    fs.writeFileSync(CONTROLS_FILE(), JSON.stringify(controls, null, 2));
  } catch (e) { console.error('controls save failed', e); }
}
function bookmarksFor(profileId) {
  return Array.isArray(controls.bookmarks[profileId]) ? controls.bookmarks[profileId] : [];
}
function permissionsFor(profileId) {
  return { geolocation: false, notifications: false, media: false, ...(controls.permissions[profileId] ?? {}) };
}

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

function formatAcceptLanguage(langs) {
  const list = Array.isArray(langs) && langs.length ? langs : ['en-US', 'en'];
  return list.map((l, i) => (i === 0 ? l : `${l};q=${Math.max(0.1, Number((1 - i * 0.1).toFixed(1)))}`)).join(',');
}

function applyHeaders(ses, spec) {
  const h = spec.uaClientHints;
  const clientHints = supportsClientHints(spec);
  const acceptLang = formatAcceptLanguage(spec.languages);
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['User-Agent'] = spec.userAgent;
    headers['Accept-Language'] = acceptLang;
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
    if (spec.doNotTrack === '1') headers['DNT'] = '1';
    else delete headers['DNT'];
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

/* ------------------------------------------------------------------ *
 * Profile window chrome and tabs.
 *
 * A profile window is two trusted surfaces around one untrusted one:
 *   - win.webContents loads apps/desktop/chrome.html (toolbar, tabs, find,
 *     bookmarks, downloads, permissions) with the preload bridge;
 *   - each tab is a WebContentsView that browses the open web with NO preload,
 *     so a hostile page can never reach the app's IPC bridge (v3.1.x attached
 *     the full management bridge to profile pages — any site could drive the
 *     workspace through window.joe).
 * ------------------------------------------------------------------ */

const TAB_BAR = 30;
const MAIN_BAR = 40;
const FIND_BAR = 34;

function chromeHeight(rec) {
  return TAB_BAR + MAIN_BAR + (rec.findOpen ? FIND_BAR : 0);
}

function layoutProfile(rec) {
  const win = rec.win;
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const y = chromeHeight(rec);
  for (const tab of rec.tabs.values()) {
    try { tab.view.setBounds({ x: 0, y, width, height: Math.max(120, height - y) }); } catch { /* closing */ }
  }
}

function pushChromeState(rec) {
  if (!rec.win || rec.win.isDestroyed()) return;
  const tab = rec.tabs.get(rec.activeTab);
  const state = {
    tabs: [...rec.tabs.values()].map((t) => ({ id: t.id, title: t.title, url: t.url })),
    activeId: rec.activeTab,
    url: tab?.url ?? '',
    title: tab?.title ?? '',
    canBack: tab ? navCan(tab.wc, 'Back') : false,
    canForward: tab ? navCan(tab.wc, 'Forward') : false,
    loading: !!rec.loading,
    zoom: tab?.zoom ?? 0,
    findOpen: !!rec.findOpen,
    findMatches: rec.findMatches ?? '',
    bookmarks: bookmarksFor(rec.profileId),
    downloads: rec.downloads ?? [],
    permissions: permissionsFor(rec.profileId),
    blocked: rec.blocked ?? 0,
    home: startUrlFor(findProfile(rec.profileId) ?? {}),
  };
  try { rec.win.webContents.send('nav:state', state); } catch { /* closing */ }
}

/** Electron moved history navigation to webContents.navigationHistory; support both. */
function navCan(wc, direction) {
  try {
    const hist = wc.navigationHistory;
    if (hist && typeof hist[`canGo${direction}`] === 'function') return hist[`canGo${direction}`]();
    return direction === 'Back' ? wc.canGoBack() : wc.canGoForward();
  } catch { return false; }
}
function navGo(wc, direction) {
  try {
    const hist = wc.navigationHistory;
    if (hist && typeof hist[`go${direction}`] === 'function') hist[`go${direction}`]();
    else if (direction === 'Back') wc.goBack();
    else wc.goForward();
  } catch { /* noop */ }
}

/** What the address bar should navigate to: URLs as-is, bare hosts with https, everything else as a search. */
function inputToUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try { return new URL(raw).toString(); } catch { return null; }
  }
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(raw)) {
    try { return new URL(`https://${raw}`).toString(); } catch { return null; }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
}

function activateTab(rec, tabId) {
  const tab = rec.tabs.get(tabId);
  if (!tab) return;
  for (const other of rec.tabs.values()) {
    if (other !== tab && other.attached) {
      try { rec.win.contentView.removeChildView(other.view); } catch { /* noop */ }
      other.attached = false;
    }
  }
  if (!tab.attached) {
    rec.win.contentView.addChildView(tab.view);
    tab.attached = true;
  }
  rec.activeTab = tab.id;
  layoutProfile(rec);
  pushChromeState(rec);
}

function closeTab(rec, tabId) {
  const tab = rec.tabs.get(tabId);
  if (!tab) return;
  if (tab.attached) {
    try { rec.win.contentView.removeChildView(tab.view); } catch { /* noop */ }
    tab.attached = false;
  }
  try { tab.wc.close(); } catch { /* noop */ }
  rec.tabs.delete(tabId);
  if (rec.tabs.size === 0) {
    if (!rec.win.isDestroyed()) rec.win.close();
    return;
  }
  if (rec.activeTab === tabId) {
    const next = [...rec.tabs.keys()][0];
    activateTab(rec, next);
  } else {
    pushChromeState(rec);
  }
}

function closeFind(rec) {
  const tab = rec.tabs.get(rec.activeTab);
  rec.findOpen = false;
  rec.findMatches = '';
  try { tab?.wc.stopFindInPage('clearSelection'); } catch { /* noop */ }
  pushChromeState(rec);
}

function zoomTab(rec, tab, delta, absolute = false) {
  if (!tab) return;
  tab.zoom = absolute ? 0 : Math.max(-3, Math.min(3, (tab.zoom ?? 0) + delta));
  try { tab.wc.setZoomLevel(tab.zoom); } catch { /* noop */ }
  pushChromeState(rec);
}

/** Keyboard controls — every shortcut maps to the same command the buttons send. */
function handleShortcut(rec, tab, input) {
  if (input.type !== 'keyDown') return false;
  const key = String(input.key ?? '').toLowerCase();
  const ctrl = !!(input.control || input.meta);
  if (ctrl && key === 'f') { rec.findOpen = true; pushChromeState(rec); return true; }
  if (ctrl && key === 't') { createTab(rec, null); return true; }
  if (ctrl && key === 'w') { closeTab(rec, tab.id); return true; }
  if ((ctrl && key === 'r') || key === 'f5') { tab.wc.reload(); return true; }
  if (key === 'escape') {
    if (rec.findOpen) { closeFind(rec); return true; }
    if (rec.loading) { try { tab.wc.stop(); } catch { /* noop */ } return true; }
    return false;
  }
  if (input.alt && key === 'arrowleft') { navGo(tab.wc, 'Back'); return true; }
  if (input.alt && key === 'arrowright') { navGo(tab.wc, 'Forward'); return true; }
  if (ctrl && (key === '=' || key === '+')) { zoomTab(rec, tab, 0.5); return true; }
  if (ctrl && key === '-') { zoomTab(rec, tab, -0.5); return true; }
  if (ctrl && key === '0') { zoomTab(rec, tab, 0, true); return true; }
  return false;
}

function createTab(rec, url, activate = true) {
  const profile = findProfile(rec.profileId) ?? {};
  const spec = profile.fingerprint ?? {};
  const view = new WebContentsView({
    webPreferences: {
      partition: rec.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  const wc = view.webContents;
  const tab = {
    id: `tab_${Date.now().toString(36)}_${rec.tabs.size}`,
    view, wc, url: '', title: '', zoom: 0, attached: false,
  };
  rec.tabs.set(tab.id, tab);

  if (spec.userAgent) {
    attachInjection(wc, spec);
    try { wc.setUserAgent(spec.userAgent); } catch { /* noop */ }
  }
  attachHistory(rec.profileId, rec.profileName, wc);

  wc.on('did-navigate', (_e, u) => { tab.url = u; pushChromeState(rec); });
  wc.on('did-navigate-in-page', (_e, u, isMainFrame) => {
    if (isMainFrame !== false) { tab.url = u; pushChromeState(rec); }
  });
  wc.on('page-title-updated', (_e, title) => {
    tab.title = title;
    if (tab.id === rec.activeTab && rec.win && !rec.win.isDestroyed()) {
      rec.win.setTitle(`Joe Browser — ${rec.profileName} — ${title}`);
    }
    pushChromeState(rec);
  });
  wc.on('did-start-loading', () => { rec.loading = true; pushChromeState(rec); });
  wc.on('did-stop-loading', () => { rec.loading = false; pushChromeState(rec); });
  wc.on('found-in-page', (_e, result) => {
    rec.findMatches = result?.matches
      ? `${result.activeMatchOrdinal ?? 0}/${result.matches}`
      : '0/0';
    pushChromeState(rec);
  });
  wc.on('render-process-gone', (_e, details) => {
    console.error('[joe] tab renderer gone', rec.profileId, details?.reason);
    try { wc.reload(); } catch { /* noop */ }
  });
  wc.on('before-input-event', (event, input) => {
    if (handleShortcut(rec, tab, input)) event.preventDefault();
  });
  // Pop-ups and target=_blank stay inside the same isolated profile.
  wc.setWindowOpenHandler(({ url: target }) => {
    try {
      if (/^https?:/i.test(target)) createTab(rec, target);
    } catch (e) { console.error('popup tab failed', e); }
    return { action: 'deny' };
  });

  if (activate) activateTab(rec, tab.id);
  const target = inputToUrl(url) ?? url ?? null;
  const destination = typeof target === 'string' && /^https?:/i.test(target) ? target : startUrlFor(profile);
  wc.loadURL(destination).catch((e) => console.error('tab load failed', e));
  return tab;
}

/** One chrome command from the toolbar. Every button in chrome.html maps to a case here. */
function chromeCommand(rec, action, arg) {
  const tab = rec.tabs.get(rec.activeTab);
  switch (action) {
    case 'back': if (tab) navGo(tab.wc, 'Back'); break;
    case 'forward': if (tab) navGo(tab.wc, 'Forward'); break;
    case 'reload': tab?.wc.reload(); break;
    case 'stop': try { tab?.wc.stop(); } catch { /* noop */ } break;
    case 'home': tab?.wc.loadURL(startUrlFor(findProfile(rec.profileId) ?? {})).catch(() => {}); break;
    case 'open': {
      const u = inputToUrl(arg);
      if (u && tab) tab.wc.loadURL(u).catch(() => {});
      break;
    }
    case 'tabs:new': createTab(rec, null); break;
    case 'tabs:close': closeTab(rec, String(arg)); break;
    case 'tabs:select': activateTab(rec, String(arg)); break;
    case 'find:open': rec.findOpen = true; break;
    case 'find:close': closeFind(rec); break;
    case 'find':
      rec.findQuery = String(arg ?? '');
      if (tab && rec.findQuery) tab.wc.findInPage(rec.findQuery, { forward: true, findNext: false });
      break;
    case 'find:next':
      if (tab && rec.findQuery) tab.wc.findInPage(rec.findQuery, { forward: Number(arg) >= 0, findNext: true });
      break;
    case 'zoom': zoomTab(rec, tab, Number(arg) || 0); break;
    case 'bookmark:add': {
      const list = bookmarksFor(rec.profileId);
      const entry = { url: arg?.url, title: arg?.title || arg?.url };
      if (entry.url && !list.some((b) => b.url === entry.url)) {
        controls.bookmarks[rec.profileId] = [entry, ...list].slice(0, 500);
        saveControls();
      }
      break;
    }
    case 'bookmark:remove':
      controls.bookmarks[rec.profileId] = bookmarksFor(rec.profileId).filter((b) => b.url !== arg);
      saveControls();
      break;
    case 'download:open':
      if (typeof arg === 'string' && arg) shell.showItemInFolder(arg);
      break;
    case 'perm:set': {
      const perms = permissionsFor(rec.profileId);
      perms[String(arg?.type)] = !!arg?.allow;
      controls.permissions[rec.profileId] = perms;
      saveControls();
      break;
    }
    case 'clear-data': {
      const ses = session.fromPartition(rec.partition);
      Promise.resolve()
        .then(() => ses.clearStorageData?.({ storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage'] }))
        .then(() => ses.clearCache?.())
        .catch((e) => console.error('clear-data failed', e));
      break;
    }
    default:
      throw new Error(`Unknown chrome action: ${action}`);
  }
  pushChromeState(rec);
  return { ok: true };
}

/** Deny-by-default permission gate, with per-profile decisions from controls.json. */
function wirePermissions(rec, ses) {
  const decide = (permission) => {
    const perms = permissionsFor(rec.profileId);
    if (permission === 'geolocation') return perms.geolocation;
    if (permission === 'notifications') return perms.notifications;
    if (permission === 'media' || permission === 'mediaKeySystem') return perms.media;
    return false;
  };
  try {
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = decide(permission);
      if (!allowed) {
        rec.blocked = (rec.blocked ?? 0) + 1;
        pushChromeState(rec);
      }
      callback(allowed);
    });
    ses.setPermissionCheckHandler((_wc, permission) => decide(permission));
  } catch (e) { console.error('permission handler failed', e); }
}

/** Downloads land in the user's downloads folder and are listed in chrome.html. */
function wireDownloads(rec, ses) {
  if (typeof ses.on !== 'function') return;
  ses.on('will-download', (_e, item) => {
    try {
      const name = item.getFilename();
      const dir = app.getPath('downloads');
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, name);
      item.setSavePath(target);
      item.once('done', (_e2, state) => {
        if (state === 'completed') {
          rec.downloads = [{ name, path: target, at: new Date().toISOString() }, ...(rec.downloads ?? [])].slice(0, 100);
          pushChromeState(rec);
        }
      });
    } catch (e) { console.error('download failed', e); }
  });
}

/** Map a profile window's chrome webContents to its record for IPC dispatch. */
const chromeRecipients = new WeakMap();

function attachInjection(wc, spec) {
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    const script = core.buildInjectionScript(spec, { maskToString: true, selfTestHook: true });
    wc.debugger.sendCommand('Page.enable');
    wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: script });
    wc.debugger.sendCommand('Network.enable');
    const override = {
      userAgent: spec.userAgent,
      acceptLanguage: formatAcceptLanguage(spec.languages),
      platform: spec.platform,
    };
    if (supportsClientHints(spec) && spec.uaClientHints) {
      override.userAgentMetadata = {
        brands: spec.uaClientHints.brands,
        fullVersionList: spec.uaClientHints.brands.map((b) => ({ brand: b.brand, version: spec.uaClientHints.fullVersion })),
        fullVersion: spec.uaClientHints.fullVersion,
        platform: spec.uaClientHints.platform,
        platformVersion: spec.uaClientHints.platformVersion,
        architecture: spec.uaClientHints.platform === 'Android' ? 'arm' : 'x86',
        model: '', mobile: !!spec.uaClientHints.mobile, bitness: '64', wow64: false,
      };
    }
    wc.debugger.sendCommand('Network.setUserAgentOverride', override);
  } catch (e) { console.error('CDP injection error', e); }
}

async function launchProfile(id) {
  const profile = findProfile(id);
  if (!profile) throw new Error('That profile is no longer in this workspace. Reload to refresh the list.');
  if (!profile.fingerprint?.userAgent) throw new Error('That profile has no fingerprint yet. Recreate it to regenerate one.');
  if (windows.has(id)) { windows.get(id).win.focus(); return { ok: true, alreadyRunning: true }; }

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
    autoHideMenuBar: true,
    webPreferences: {
      // The chrome window is a bundled, trusted page. The browsed site lives in
      // WebContentsViews below with NO preload — a page on the open web must
      // never get the management bridge again.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: false, nodeIntegration: false,
      webSecurity: true, spellcheck: false,
    },
  });

  const rec = {
    win,
    profileId: id,
    profileName: profile.name,
    partition,
    tabs: new Map(),
    activeTab: null,
    findOpen: false,
    findQuery: '',
    findMatches: '',
    loading: false,
    downloads: [],
    blocked: 0,
  };
  windows.set(id, rec);
  chromeRecipients.set(win.webContents, rec);

  win.on('resize', () => layoutProfile(rec));
  win.on('closed', () => {
    for (const tab of rec.tabs.values()) {
      try { tab.wc.close(); } catch { /* already gone */ }
    }
    rec.tabs.clear();
    windows.delete(id);
    const p = findProfile(id);
    if (p) {
      p.status = 'stopped';
      p.device = null;
      saveWorkspace();
    }
    managerWindow?.webContents.send('profiles:changed', workspace.profiles);
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[joe] profile chrome renderer gone', profile.id, details?.reason);
  });

  wirePermissions(rec, ses);
  wireDownloads(rec, ses);

  // First tab opens the profile's start page inside the isolated partition.
  createTab(rec, startUrlFor(profile));

  win.once('ready-to-show', () => win.show());
  win.webContents.once('did-finish-load', () => pushChromeState(rec));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadFile(path.join(__dirname, 'chrome.html')).catch((e) => console.error('chrome load failed', e));

  profile.status = 'running';
  profile.device = 'desktop-exe';
  profile.lastLaunchedAt = new Date().toISOString();
  saveWorkspace();
  managerWindow?.webContents.send('profiles:changed', workspace.profiles);
  return { ok: true };
}

function stopProfile(id) {
  const rec = windows.get(id);
  if (rec) {
    for (const tab of rec.tabs.values()) {
      if (tab.attached) {
        try { rec.win.contentView.removeChildView(tab.view); } catch { /* noop */ }
      }
      try { tab.wc.close(); } catch { /* noop */ }
    }
    rec.tabs.clear();
    if (!rec.win.isDestroyed()) rec.win.close();
    windows.delete(id);
  }
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
  /**
   * "Paste as human": replay a reviewed keystroke schedule into the active
   * page of a running profile through CDP `Input.dispatchKeyEvent`, honouring
   * each per-key delay. Accessibility text entry only — nothing runs unattended
   * and no challenge is solved. A new plan cancels a plan already typing.
   */
  handle('keystrokes:send', async (profileId, schedule) => {
    const problem = validateSchedule(schedule);
    if (problem) return { ok: false, reason: problem };
    const rec = windows.get(profileId);
    if (!rec || !rec.win || rec.win.isDestroyed()) return { ok: false, reason: 'That profile window is not open.' };
    const tab = rec.tabs ? rec.tabs.get(rec.activeTab) : null;
    const target = tab && tab.wc ? tab.wc : rec.win.webContents;
    const run = (typingRuns.get(profileId) ?? 0) + 1;
    typingRuns.set(profileId, run);
    try {
      if (!target.debugger.isAttached?.()) target.debugger.attach('1.3');
    } catch {
      return { ok: false, reason: 'That window is not accepting input right now.' };
    }
    const stopped = () => typingRuns.get(profileId) !== run || rec.win.isDestroyed();
    let sent = 0;
    for (const k of schedule) {
      if (stopped()) return { ok: false, reason: 'Typing stopped: the window closed or a newer plan took over.' };
      if (k.delay > 0) await new Promise((resolve) => setTimeout(resolve, k.delay));
      if (stopped()) return { ok: false, reason: 'Typing stopped: the window closed or a newer plan took over.' };
      await dispatchKey(target, k);
      sent += 1;
    }
    return { ok: true, keys: sent };
  });
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

  /**
   * Profile-window chrome commands. Registered with a raw handler so the
   * sending webContents can be resolved to its profile record — the shared
   * `handle` wrapper discards the event, and one window's toolbar must never
   * drive another profile's tabs.
   */
  ipcMain.handle('chrome:command', (event, action, arg) => {
    const rec = chromeRecipients.get(event.sender);
    if (!rec) throw new Error('No profile window owns this toolbar.');
    return chromeCommand(rec, action, arg);
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
  loadControls();
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
