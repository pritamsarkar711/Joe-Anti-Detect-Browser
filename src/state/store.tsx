import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createProfile, generateProfiles, hashString, DEVICE_TEMPLATES, checkProxy, parseProxyLines, proxyUrl,
  applyRealPreset, getRealPreset, applyGeoToSpec, geoForCountry, profilesFromCsv,
  type BrowserProfile, type ProxyConfig, type ProfileStatus,
  importWorkspace as parseWorkspace, exportWorkspace as makeExport, type WorkspaceExport,
} from '@joe/core';
import { createLocalTransport, SyncClient, DEFAULT_PRESENCE, type DeviceKind, type DevicePresence, type SyncEnvelope, type Topic } from '@joe/sync';
import { getNativeWorkspace, installCommandHandler, nativeKind, nativeLaunch, nativeStop, nativeDeviceName } from './native';

export type View = 'profiles' | 'proxies' | 'devices' | 'fingerprints' | 'tests' | 'activity' | 'settings';

export interface ActivityEntry {
  id: string;
  at: string;
  kind: 'launch' | 'stop' | 'create' | 'delete' | 'proxy' | 'sync' | 'import' | 'export' | 'check' | 'edit';
  text: string;
  meta?: string;
}

export interface Settings {
  theme: 'dark' | 'light';
  workspace: string;
  supabaseUrl: string;
  anonKey: string;
  autoSync: boolean;
  defaultDevice: DeviceKind;
  startPage: string;
  density: 'comfortable' | 'compact';
}

interface Persisted {
  profiles: BrowserProfile[];
  proxies: ProxyConfig[];
  groups: string[];
  activity: ActivityEntry[];
  settings: Settings;
}

export interface Toast { id: string; text: string; kind: 'ok' | 'warn' | 'err' | 'info' }

const STORAGE_KEY = 'joe-browser:v2';
export const APP_VERSION = '2.0.0';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  workspace: 'default',
  supabaseUrl: 'https://rajxyaatbvlrxxzjntmo.supabase.co',
  anonKey: '',
  autoSync: true,
  defaultDevice: 'desktop-exe',
  startPage: 'https://example.com',
  density: 'comfortable',
};

/** Fill fields added in v2 so older workspace files keep working. */
function normalizeProfile(p: BrowserProfile): BrowserProfile {
  return {
    ...p,
    tags: p.tags ?? [],
    notes: p.notes ?? '',
    startUrl: p.startUrl ?? '',
    cookies: p.cookies ?? '',
    extensions: p.extensions ?? [],
    realId: p.realId ?? p.fingerprint?.realId,
    fingerprint: {
      ...p.fingerprint,
      uaClientHints: {
        ...p.fingerprint.uaClientHints,
        secChUa: p.fingerprint.uaClientHints?.secChUa ?? '',
        secChUaMobile: p.fingerprint.uaClientHints?.secChUaMobile ?? (p.fingerprint.uaClientHints?.mobile ? '?1' : '?0'),
      },
    },
  };
}

function seed(): Persisted {
  const names = [
    ['Storefront US', 'QA'], ['Storefront EU', 'QA'], ['Ad Ops A', 'Marketing'], ['Ad Ops B', 'Marketing'],
    ['Client Northwind', 'Clients'], ['Client Acme', 'Clients'], ['Mobile Smoke 1', 'Mobile'], ['Mobile Smoke 2', 'Mobile'],
    ['Staging Auth', 'Staging'], ['Staging Checkout', 'Staging'], ['Research A', 'Research'], ['Research B', 'Research'],
    ['Analytics US', 'Analytics'], ['Analytics DE', 'Analytics'], ['Support Desk', 'Support'], ['Support Escalations', 'Support'],
    ['Sandbox 01', 'Sandbox'], ['Sandbox 02', 'Sandbox'], ['Sandbox 03', 'Sandbox'], ['Backup Alpha', 'Backup'],
    ['Backup Beta', 'Backup'], ['Temp Review', 'Temp'], ['Temp Audit', 'Temp'], ['Demo Locale BD', 'Demo'],
  ];
  const templates = ['win11-intel', 'win11-nvidia', 'mac-sonoma-m1', 'android-pixel8', 'win10-amd', 'linux-ubuntu', 'android-samsung-s23', 'mac-ventura-intel'];
  const groups = [...new Set(names.map((n) => n[1]))];
  const proxies: ProxyConfig[] = [
    { id: 'px_1', name: 'US Residential', protocol: 'socks5', host: '198.51.100.12', port: 1080, country: 'US', status: 'ok', latencyMs: 84, lastCheckedAt: null },
    { id: 'px_2', name: 'DE Datacenter', protocol: 'http', host: '203.0.113.40', port: 8080, country: 'DE', status: 'ok', latencyMs: 46, lastCheckedAt: null },
    { id: 'px_3', name: 'BD Mobile', protocol: 'socks5', host: '192.0.2.77', port: 1080, country: 'BD', status: 'unchecked', latencyMs: null, lastCheckedAt: null },
    { id: 'px_4', name: 'SG Rotating', protocol: 'socks5', host: '198.51.100.90', port: 1080, country: 'SG', status: 'ok', latencyMs: 132, lastCheckedAt: null },
    { id: 'px_5', name: 'GB Static', protocol: 'https', host: '203.0.113.5', port: 443, country: 'GB', status: 'failed', latencyMs: null, lastCheckedAt: null },
  ];
  const profiles = names.map(([name, group], i) => createProfile({
    name, group, templateId: templates[i % templates.length],
    proxyId: i % 4 === 0 ? null : proxies[i % proxies.length].id,
    tags: i % 5 === 0 ? ['priority'] : i % 7 === 0 ? ['review'] : [],
    seed: `seed::${name}`,
  }, i));
  return {
    profiles, proxies, groups: ['Default', ...groups],
    activity: [
      { id: 'a0', at: new Date(Date.now() - 1000 * 60 * 4).toISOString(), kind: 'sync', text: 'Workspace synced', meta: '24 profiles' },
      { id: 'a1', at: new Date(Date.now() - 1000 * 60 * 38).toISOString(), kind: 'launch', text: 'Storefront US launched', meta: 'desktop' },
      { id: 'a2', at: new Date(Date.now() - 1000 * 60 * 95).toISOString(), kind: 'check', text: 'Proxy check finished', meta: '4 of 5 online' },
    ],
    settings: DEFAULT_SETTINGS,
  };
}

function load(): Persisted {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fromNative = getNativeWorkspace();
      if (fromNative) {
        return { ...fromNative, profiles: fromNative.profiles.map(normalizeProfile), activity: [], settings: DEFAULT_SETTINGS };
      }
      return seed();
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(parsed.profiles)) return seed();
    return {
      profiles: parsed.profiles.map(normalizeProfile),
      proxies: parsed.proxies ?? [],
      groups: parsed.groups ?? ['Default'],
      activity: parsed.activity ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch { return seed(); }
}

const bus = createLocalTransport();
const desktop = new SyncClient('desktop-exe', bus);
const android = new SyncClient('android-apk', bus);
const web = new SyncClient('web-dashboard', bus);
void web;

interface Store {
  profiles: BrowserProfile[];
  proxies: ProxyConfig[];
  groups: string[];
  activity: ActivityEntry[];
  settings: Settings;
  devices: DevicePresence[];
  toasts: Toast[];
  appVersion: string;
  view: View; setView: (v: View) => void;
  selectedId: string | null; setSelectedId: (id: string | null) => void;
  createOpen: boolean; setCreateOpen: (v: boolean) => void;
  paletteOpen: boolean; setPaletteOpen: (v: boolean) => void;
  addProfiles: (p: BrowserProfile[]) => void;
  createOne: (input: Parameters<typeof createProfile>[0]) => BrowserProfile;
  updateProfile: (id: string, patch: Partial<BrowserProfile>) => void;
  deleteProfiles: (ids: string[]) => void;
  duplicateProfiles: (ids: string[]) => void;
  applyPreset: (ids: string[], realId: string) => void;
  geoMatch: (ids: string[]) => void;
  importCsv: (text: string) => number;
  setStatus: (ids: string[], status: ProfileStatus, device?: DeviceKind | null) => void;
  addGroup: (g: string) => void;
  addProxy: (p: ProxyConfig) => void;
  updateProxy: (id: string, patch: Partial<ProxyConfig>) => void;
  deleteProxies: (ids: string[]) => void;
  checkProxies: (ids: string[]) => void;
  importProxies: (lines: string) => { ok: number; bad: number };
  importData: (json: string) => number;
  exportData: () => WorkspaceExport;
  reset: () => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  log: (kind: ActivityEntry['kind'], text: string, meta?: string) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  send: (topic: Topic, payload: unknown, to?: DeviceKind) => Promise<void>;
  setDeviceOnline: (kind: DeviceKind, online: boolean) => void;
  syncEvents: SyncEnvelope[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);
  const [view, setView] = useState<View>('profiles');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [devices, setDevices] = useState<DevicePresence[]>(() => DEFAULT_PRESENCE.map((d) => ({
    ...d,
    name: d.kind === 'android-apk' && nativeKind() === 'android' ? nativeDeviceName() : d.name,
    online: d.kind === 'desktop-exe' ? nativeKind() !== 'android' : nativeKind() === 'android',
    lastSeen: new Date().toISOString(),
  })));
  const [syncEvents, setSyncEvents] = useState<SyncEnvelope[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    }, 250);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.dataset.density = data.settings.density;
  }, [data.settings.theme, data.settings.density]);

  const log = useCallback((kind: ActivityEntry['kind'], text: string, meta?: string) => {
    setData((d) => ({ ...d, activity: [{ id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), kind, text, meta }, ...d.activity].slice(0, 400) }));
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, text, kind }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  useEffect(() => installCommandHandler((topic, ids) => {
    if (!ids.length) return;
    const running = topic === 'command:launch';
    const set = new Set(ids);
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => set.has(p.id) ? {
        ...p, status: running ? 'running' : 'stopped',
        device: running ? 'android-apk' : null,
        lastLaunchedAt: running ? new Date().toISOString() : p.lastLaunchedAt,
      } : p),
    }));
    log('sync', `Remote ${topic}`, `${ids.length} profiles`);
  }), [log]);

  useEffect(() => {
    const offBus = bus.subscribe((e) => setSyncEvents((prev) => [e, ...prev].slice(0, 80)));
    const offAck = desktop.on('event:launch-ack', (e) => {
      log('sync', 'Android acknowledgement', JSON.stringify(e.payload).slice(0, 60));
    });
    const offLaunch = android.on('command:launch', (e) => {
      const online = devices.find((d) => d.kind === 'android-apk')?.online;
      if (online) void android.send('event:launch-ack', { ack: 'launched', id: (e.payload as { profileId?: string })?.profileId }, 'desktop-exe');
      else void android.send('event:status', { ack: 'offline' }, 'desktop-exe');
    });
    return () => { offBus(); offAck(); offLaunch(); };
  }, [devices, log]);

  const api = useMemo<Store>(() => ({
    ...data, devices, toasts, appVersion: APP_VERSION,
    view, setView, selectedId, setSelectedId, createOpen, setCreateOpen, paletteOpen, setPaletteOpen, syncEvents,
    addProfiles: (ps) => { setData((d) => ({ ...d, profiles: [...ps, ...d.profiles] })); log('create', `${ps.length} profiles created`); },
    createOne: (input) => {
      const p = createProfile(input, Date.now() % 100000);
      setData((d) => ({ ...d, profiles: [p, ...d.profiles] }));
      log('create', `${p.name} created`, p.templateId);
      return p;
    },
    updateProfile: (id, patch) => setData((d) => ({ ...d, profiles: d.profiles.map((p) => p.id === id ? { ...p, ...patch, revision: p.revision + 1, updatedAt: new Date().toISOString() } : p) })),
    deleteProfiles: (ids) => {
      const set = new Set(ids);
      setData((d) => ({ ...d, profiles: d.profiles.filter((p) => !set.has(p.id)) }));
      log('delete', `${ids.length} profiles removed`);
      setSelectedId((s) => (s && set.has(s) ? null : s));
    },
    duplicateProfiles: (ids) => {
      const set = new Set(ids);
      const copies = data.profiles.filter((p) => set.has(p.id)).map((p, i) => {
        const id = `prf_${Date.now().toString(36)}_${i}`;
        const fingerprint = JSON.parse(JSON.stringify(p.fingerprint)) as BrowserProfile['fingerprint'];
        fingerprint.noiseSeed = hashString(`${id}::copy`);
        return { ...p, id, name: `${p.name} copy`, status: 'ready' as const, fingerprint, revision: 1,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastLaunchedAt: null, device: null };
      });
      setData((d) => ({ ...d, profiles: [...copies, ...d.profiles] }));
      log('create', `${copies.length} profiles duplicated`);
      toast(`${copies.length} copies created`);
    },
    applyPreset: (ids, realId) => {
      const real = getRealPreset(realId);
      if (!real) return;
      const set = new Set(ids);
      setData((d) => ({ ...d, profiles: d.profiles.map((p) => set.has(p.id) ? applyRealPreset(p, real) : p) }));
      log('edit', `Real device applied to ${ids.length} profiles`, realId);
      toast('Observed device applied');
    },
    geoMatch: (ids) => {
      const set = new Set(ids);
      let matched = 0;
      setData((d) => ({
        ...d,
        profiles: d.profiles.map((p) => {
          if (!set.has(p.id) || !p.proxyId) return p;
          const px = d.proxies.find((x) => x.id === p.proxyId);
          if (!px || !geoForCountry(px.country)) return p;
          matched++;
          const spec = { ...applyGeoToSpec(p.fingerprint, px.country), webrtcPublicIp: /^\d{1,3}(\.\d{1,3}){3}$/.test(px.host) ? px.host : '' };
          return { ...p, fingerprint: spec, revision: p.revision + 1, updatedAt: new Date().toISOString() };
        }),
      }));
      log('edit', `Geo match applied to ${matched} profiles`);
      toast(matched ? `Matched ${matched} profiles to proxy region` : 'Assign a proxy first', matched ? 'ok' : 'warn');
    },
    importCsv: (text) => {
      const rows = profilesFromCsv(text);
      if (!rows.length) return 0;
      const groups = [...new Set(rows.map((r) => r.group))];
      const created = rows.map((r, i) => createProfile({ name: r.name, group: r.group, notes: r.notes, seed: `csv::${r.name}::${i}` }, i));
      setData((d) => ({ ...d, profiles: [...created, ...d.profiles], groups: [...new Set([...d.groups, ...groups])] }));
      log('import', `${created.length} profiles imported from CSV`);
      return created.length;
    },
    setStatus: (ids, status, device) => {
      const set = new Set(ids);
      const now = new Date().toISOString();
      setData((d) => ({
        ...d,
        profiles: d.profiles.map((p) => set.has(p.id) ? {
          ...p, status, device: device === undefined ? p.device : device,
          lastLaunchedAt: status === 'running' ? now : p.lastLaunchedAt,
        } : p),
      }));
      log(status === 'running' ? 'launch' : 'stop', `${ids.length} profiles ${status === 'running' ? 'launched' : 'stopped'}`, device ?? undefined);
      if (nativeKind() !== 'web') {
        data.profiles.filter((p) => set.has(p.id)).forEach((p) => {
          if (status === 'running') nativeLaunch(p); else nativeStop(p);
        });
      }
      if (status === 'running') void desktop.send('command:launch', { profileIds: ids }, 'android-apk');
      else void desktop.send('command:stop', { profileIds: ids }, 'android-apk');
    },
    addGroup: (g) => setData((d) => (d.groups.includes(g) ? d : { ...d, groups: [...d.groups, g] })),
    addProxy: (p) => { setData((d) => ({ ...d, proxies: [p, ...d.proxies] })); log('proxy', `${p.name} added`); },
    updateProxy: (id, patch) => setData((d) => ({ ...d, proxies: d.proxies.map((p) => p.id === id ? { ...p, ...patch } : p) })),
    deleteProxies: (ids) => { const s = new Set(ids); setData((d) => ({ ...d, proxies: d.proxies.filter((p) => !s.has(p.id)), profiles: d.profiles.map((p) => p.proxyId && s.has(p.proxyId) ? { ...p, proxyId: null } : p) })); },
    checkProxies: (ids) => {
      const s = new Set(ids);
      setData((d) => ({ ...d, proxies: d.proxies.map((p) => s.has(p.id) ? checkProxy(p) : p) }));
      log('check', `${ids.length} proxy checks finished`);
    },
    importProxies: (lines) => {
      const parsed = parseProxyLines(lines);
      const good = parsed.filter((p) => p.valid && p.host);
      const next = good.map((p, i) => ({
        id: `px_${Date.now().toString(36)}_${i}`, name: `${p.host}:${p.port}`, protocol: p.protocol,
        host: p.host, port: p.port, username: p.username, password: p.password,
        country: 'XX', status: 'unchecked' as const, latencyMs: null, lastCheckedAt: null,
      }));
      setData((d) => ({ ...d, proxies: [...next, ...d.proxies] }));
      log('import', `${good.length} proxies imported`);
      return { ok: good.length, bad: parsed.length - good.length };
    },
    importData: (json) => {
      const parsed = parseWorkspace(json);
      const profiles = parsed.profiles.map(normalizeProfile);
      setData((d) => ({
        ...d,
        profiles: [...profiles, ...d.profiles.filter((p) => !profiles.some((x) => x.id === p.id))],
        proxies: [...parsed.proxies, ...d.proxies.filter((p) => !parsed.proxies.some((x) => x.id === p.id))],
        groups: [...new Set([...d.groups, ...parsed.groups])],
      }));
      log('import', `${profiles.length} profiles imported`);
      return profiles.length;
    },
    exportData: () => { log('export', 'Workspace exported'); return makeExport(data.profiles, data.proxies, data.groups); },
    reset: () => { setData(seed()); toast('Demo workspace restored', 'info'); },
    setSetting: (k, v) => setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } })),
    log, toast,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    send: async (topic, payload, to) => { await desktop.send(topic, payload, to); },
    setDeviceOnline: (kind, online) => {
      setDevices((d) => d.map((x) => x.kind === kind ? { ...x, online, lastSeen: new Date().toISOString() } : x));
      log('sync', `${kind} ${online ? 'connected' : 'disconnected'}`);
    },
  }), [data, devices, toasts, view, selectedId, createOpen, paletteOpen, syncEvents, log, toast]);

  useEffect(() => {
    setDevices((d) => d.map((x) => ({ ...x, profiles: data.profiles.filter((p) => p.device === x.kind).length })));
  }, [data.profiles]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export { proxyUrl, DEVICE_TEMPLATES, generateProfiles };
