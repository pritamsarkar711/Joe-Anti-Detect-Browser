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
    script: (id) => invoke('profiles:script', id),
  },
  proxies: {
    list: () => invoke('proxies:list'),
    add: (p) => invoke('proxies:add', p),
    parse: (line) => invoke('proxies:parse', line),
    import: (lines) => invoke('proxies:import', lines),
  },
  workspace: { export: () => invoke('workspace:export'), import: (json) => invoke('workspace:import', json) },
  sync: { send: (topic, payload, to) => invoke('sync:send', topic, payload, to) },
  on: (channel, callback) => {
    const allowed = ['profiles:changed', 'sync:event'];
    if (!allowed.includes(channel)) return () => {};
    const listener = (_e, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
