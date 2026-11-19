/** Safe, whitelisted bridge between the React UI and the Electron main process. */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

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
  on: (channel, callback) => {
    const allowed = ['profiles:changed', 'sync:event'];
    if (!allowed.includes(channel)) return () => {};
    const listener = (_e, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
