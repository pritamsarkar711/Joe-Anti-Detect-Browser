/**
 * Safe, whitelisted bridge between trusted app pages and the Electron main
 * process. Exposed only to pages this app ships:
 *
 *   - the management UI (web-dist/index.html or a localhost dev server), and
 *   - the profile-window toolbar (chrome.html).
 *
 * Profile pages are browsed in WebContentsViews with no preload at all, and a
 * remote fallback URL gets nothing — v3.1.x attached this full bridge to
 * whatever a window loaded, so any website a profile visited could call
 * workspace:replace / profiles:delete / sync:configure through window.joe.
 */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

/** True only for pages bundled with the app or a localhost dev server. */
const trusted = (() => {
  try {
    if (typeof location === 'undefined') return true;
    if (location.protocol === 'file:') return true;
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(location.href);
  } catch {
    return false;
  }
})();

const on = (channel, callback) => {
  const allowed = ['profiles:changed', 'sync:event', 'history:entry', 'nav:state'];
  if (!allowed.includes(channel)) return () => {};
  const listener = (_e, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

if (trusted) {
  contextBridge.exposeInMainWorld('joe', {
    isDesktop: true,
    info: () => invoke('app:info'),
    profiles: {
      list: () => invoke('profiles:list'),
      get: (id) => invoke('profiles:get', id),
      create: (input) => invoke('profiles:create', input),
      bulk: (count, input) => invoke('profiles:bulk', count, input),
      update: (id, patch) => invoke('profiles:update', id, patch),
      remove: (ids) => invoke('profiles:delete', ids),
      launch: (id) => invoke('profiles:launch', id),
      stop: (id) => invoke('profiles:stop', id),
      consistency: (id) => invoke('profiles:consistency', id),
      quality: (id) => invoke('profiles:quality', id),
      surfaces: (id) => invoke('profiles:surfaces', id),
      script: (id) => invoke('profiles:script', id),
    },
    proxies: {
      list: () => invoke('proxies:list'),
      add: (p) => invoke('proxies:add', p),
      parse: (line) => invoke('proxies:parse', line),
      import: (lines) => invoke('proxies:import', lines),
    },
    extensions: {
      list: () => invoke('extensions:list'),
      install: (zipPath, id) => invoke('extensions:install', zipPath, id),
      digest: (filePath) => invoke('extensions:digest', filePath),
      attach: (profileId, dir) => invoke('extensions:attach', profileId, dir),
      detach: (profileId, dir) => invoke('extensions:detach', profileId, dir),
    },
    workspace: {
      export: () => invoke('workspace:export'),
      import: (json) => invoke('workspace:import', json),
      // Mirrors the UI's workspace into the main process so it can launch profiles.
      replace: (data) => invoke('workspace:replace', data),
      read: () => invoke('workspace:read'),
    },
    sync: {
      send: (topic, payload, to) => invoke('sync:send', topic, payload, to),
      configure: (config) => invoke('sync:configure', config),
    },
    on,
  });
}

/**
 * Profile-window toolbar API (chrome.html). Separate object so the management
 * surface above is not implied for it.
 */
if (trusted) {
  contextBridge.exposeInMainWorld('joeChrome', {
    command: (action, arg) => invoke('chrome:command', action, arg),
    onState: (callback) => on('nav:state', callback),
  });
}
