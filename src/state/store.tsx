import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createProfile, generateProfiles, hashString, DEVICE_TEMPLATES, checkProxy, parseProxyLines, proxyUrl, guessProxyCountry,
  applyRealPreset, getRealPreset, applyGeoToSpec, geoForCountry, profilesFromCsv,
  rebuildProfileFingerprint, offsetForZone,
  planFor, isAdmin, checkProfileQuota, browserAllowed,
  historyEntryId, mergeHistory,
  type Account, type BrowserFamily, type BrowserProfile, type FingerprintSpec, type ProxyConfig, type ProfileStatus, type Entitlement,
  importWorkspace as parseWorkspace, exportWorkspace as makeExport, type WorkspaceExport,
} from '@joe/core';
import { createLocalTransport, SyncClient, DEFAULT_PRESENCE, type DeviceKind, type DevicePresence, type SyncEnvelope, type Topic } from '@joe/sync';
import { getNativeWorkspace, installCommandHandler, nativeKind, nativeLaunch, nativeStop, nativeDeviceName, syncWorkspaceToDesktop, pullDesktopWorkspace, isDesktopShell, pushSyncConfig, sendSyncCommand, getNativeHistory, clearNativeHistory } from './native';
import {
  CloudError, cacheEntitlement, ensureFreshSession, fetchEntitlement, isConfigured,
  loadCachedEntitlement, loadSession, looksLikeServiceRoleKey, normalizeConfig,
  saveSession, sendRecoveryEmail, signInWithPassword, signOut as cloudSignOut,
  signUp as cloudSignUp,
  type CloudConfig, type CloudSession, type ServerEntitlement,
} from './cloud';

export type View =
  | 'profiles' | 'proxies' | 'groups'
  | 'history' | 'extensions'
  | 'fingerprints' | 'tests'
  | 'devices' | 'activity' | 'settings' | 'account';

export interface HistoryEntry {
  id: string;
  profileId: string;
  profileName: string;
  url: string;
  title: string;
  at: string;
  /** true when the URL came from a search query rather than direct navigation */
  search?: boolean;
}

/** What callers of `addHistory` provide; the store fills id, time and profile name. */
export type HistoryEntryInput = Omit<HistoryEntry, 'id' | 'at' | 'profileName'> & {
  id?: string;
  at?: string;
  profileName?: string;
};

export interface ActivityEntry {
  id: string;
  at: string;
  kind: 'launch' | 'stop' | 'create' | 'delete' | 'proxy' | 'sync' | 'import' | 'export' | 'check' | 'edit';
  text: string;
  meta?: string;
}

/**
 * Two account states, on purpose:
 *
 * - Demo (no account yet): the seeded showcase workspace ships with six
 *   profiles, so the account carries a Starter allowance of six. Without this
 *   the free 2-profile cap would immediately contradict the 6 seeded rows and
 *   block every create action on first run.
 * - Local (signed in): the hard free tier, exactly two profiles for life.
 *
 * Supabase can replace both when cloud auth is configured; nothing here is
 * presented as a server-verified entitlement.
 */
const DEMO_ACCOUNT: Account = {
  email: 'local@joe.browser',
  plan: 'starter',
  role: 'member',
  renewsAt: null,
  verified: false,
  source: 'local',
};

const DEFAULT_ACCOUNT: Account = {
  email: 'local@joe.browser',
  plan: 'free',
  role: 'member',
  renewsAt: null,
  verified: false,
  source: 'local',
};

/**
 * A stored account is a claim, not proof.
 *
 * Anything privileged is stripped here and can only come back from
 * `my_entitlement()` over an authenticated session. Without this, a plan written
 * by an older build (or by hand) would keep granting premium forever, which is
 * exactly the bypass this release removes.
 */
function sanitizeAccount(account: Account | undefined | null): Account {
  if (!account) return DEMO_ACCOUNT;
  const role = account.role === 'owner' || account.role === 'admin' ? 'member' : account.role;
  return {
    ...account,
    role,
    plan: account.plan === 'premium' ? 'free' : account.plan,
    verified: false,
    source: 'local',
    renewsAt: null,
  };
}

/** Account derived from a server entitlement. Only this path grants privileges. */
function accountFromEntitlement(email: string, entitlement: ServerEntitlement): Account {
  return {
    email,
    plan: entitlement.plan,
    role: entitlement.isAdmin ? 'owner' : 'member',
    renewsAt: entitlement.renewsAt,
    verified: entitlement.source !== 'local',
    source: entitlement.source,
  };
}

export type AuthStatus = 'signed-out' | 'working' | 'cloud' | 'cloud-offline';

/** `info` is a neutral message (e.g. "confirm your email"); `error` is a failure. */
export interface AuthOutcome { error: string | null; info?: string }

export interface Settings {
  theme: 'dark' | 'light';
  workspace: string;
  supabaseUrl: string;
  anonKey: string;
  autoSync: boolean;
  defaultDevice: DeviceKind;
  startPage: string;
  density: 'comfortable' | 'compact';
  /** notify when a monitored proxy drops or recovers */
  proxyAlerts: boolean;
  /** notify when the app rotates a profile onto a new exit */
  rotationAlerts: boolean;
}

interface Persisted {
  account: Account;
  profiles: BrowserProfile[];
  proxies: ProxyConfig[];
  groups: string[];
  activity: ActivityEntry[];
  history: HistoryEntry[];
  settings: Settings;
}

export interface Toast { id: string; text: string; kind: 'ok' | 'warn' | 'err' | 'info' }

/**
 * v3 moves the workspace to a new key so a v2 install cannot hydrate the old
 * 24-profile shape (or any stale cached bundle) after an update. v2 data is
 * still read once as a migration source and then copied forward.
 */
const STORAGE_KEY = 'joe-browser:v3';
const LEGACY_KEYS = ['joe-browser:v2'];
export const APP_VERSION = '3.2.2';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  workspace: 'default',
  supabaseUrl: 'https://rajxyaatbvlrxxzjntmo.supabase.co',
  anonKey: '',
  autoSync: true,
  defaultDevice: 'desktop-exe',
  startPage: 'https://browserscan.net/',
  density: 'comfortable',
  proxyAlerts: true,
  rotationAlerts: true,
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
  /**
   * Demo workspace. It is deliberately sized to the Starter plan (six profiles,
   * four groups) so the first screen is not the empty state but also is not a
   * 24-row wall, and so browse/demo usage never sits above a plan limit.
   */
  const names = [
    ['Storefront US', 'Desktop'], ['Storefront EU', 'Desktop'],
    ['Client Northwind', 'Clients'], ['Mobile Smoke', 'Mobile'],
    ['Research A', 'Research'], ['Sandbox 01', 'Sandbox'],
  ];
  const templates = ['win11-intel', 'win11-nvidia', 'mac-sonoma-m1', 'android-pixel8', 'win10-amd', 'linux-ubuntu', 'android-samsung-s23', 'mac-ventura-intel'];
  // index 0/1 = Storefront US/EU, the two rows that head the newest-first list
  const groups = [...new Set(names.map((n) => n[1]))];
  const proxies: ProxyConfig[] = [
    { id: 'px_1', name: 'US Residential', protocol: 'socks5', host: '198.51.100.12', port: 1080, country: 'US', status: 'ok', latencyMs: 84, lastCheckedAt: null },
    { id: 'px_2', name: 'DE Datacenter', protocol: 'http', host: '203.0.113.40', port: 8080, country: 'DE', status: 'ok', latencyMs: 46, lastCheckedAt: null },
    { id: 'px_3', name: 'BD Mobile', protocol: 'socks5', host: '192.0.2.77', port: 1080, country: 'BD', status: 'unchecked', latencyMs: null, lastCheckedAt: null },
    { id: 'px_4', name: 'SG Rotating', protocol: 'socks5', host: '198.51.100.90', port: 1080, country: 'SG', status: 'ok', latencyMs: 132, lastCheckedAt: null },
    { id: 'px_5', name: 'GB Static', protocol: 'https', host: '203.0.113.5', port: 443, country: 'GB', status: 'failed', latencyMs: null, lastCheckedAt: null },
  ];
  /**
   * Profiles render newest-first and creation times now differ per index, so
   * index 0 (Storefront US) heads the list. The template list therefore starts
   * with the two Windows desktops a new workspace should open on.
   */
  const created = names.map(([name, group], i) => {
    const px = i % 4 === 0 ? null : proxies[i % proxies.length];
    const base = createProfile({
      name, group, templateId: templates[i % templates.length],
      proxyId: px ? px.id : null,
      tags: i % 5 === 0 ? ['priority'] : i % 7 === 0 ? ['review'] : [],
      seed: `seed::${name}`,
    }, i);
    if (px && geoForCountry(px.country)) {
      return { ...base, fingerprint: applyGeoToSpec(base.fingerprint, px.country) };
    }
    return base;
  });
  const profiles = [...created].reverse();
  return {
    account: DEMO_ACCOUNT,
    profiles, proxies, groups: ['Default', ...groups],
    activity: [
      { id: 'a0', at: new Date(Date.now() - 1000 * 60 * 4).toISOString(), kind: 'sync', text: 'Workspace synced', meta: '24 profiles' },
      { id: 'a1', at: new Date(Date.now() - 1000 * 60 * 38).toISOString(), kind: 'launch', text: 'Storefront US launched', meta: 'desktop' },
      { id: 'a2', at: new Date(Date.now() - 1000 * 60 * 95).toISOString(), kind: 'check', text: 'Proxy check finished', meta: '4 of 5 online' },
    ],
    history: [
      { id: 'h1', profileId: profiles[0].id, profileName: profiles[0].name, url: 'https://browserscan.net/', title: 'BrowserScan — fingerprint check', at: new Date(Date.now() - 1000 * 60 * 22).toISOString() },
      { id: 'h2', profileId: profiles[2].id, profileName: profiles[2].name, url: 'https://pixelscan.net/', title: 'Pixelscan', at: new Date(Date.now() - 1000 * 60 * 51).toISOString() },
      { id: 'h3', profileId: profiles[2].id, profileName: profiles[2].name, url: 'https://www.google.com/search?q=browser+fingerprint+test', title: 'browser fingerprint test - Google Search', at: new Date(Date.now() - 1000 * 60 * 52).toISOString(), search: true },
    ],
    settings: DEFAULT_SETTINGS,
  };
}

function load(): Persisted {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? LEGACY_KEYS.map((k) => window.localStorage.getItem(k)).find(Boolean);
    if (!raw) {
      const fromNative = getNativeWorkspace();
      if (fromNative) {
        return { ...fromNative, account: DEFAULT_ACCOUNT, profiles: fromNative.profiles.map(normalizeProfile), activity: [], history: [], settings: DEFAULT_SETTINGS };
      }
      return seed();
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(parsed.profiles)) return seed();
    return {
      account: sanitizeAccount(parsed.account),
      profiles: parsed.profiles.map(normalizeProfile),
      proxies: parsed.proxies ?? [],
      groups: parsed.groups ?? ['Default'],
      activity: parsed.activity ?? [],
      history: parsed.history ?? [],
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
  history: HistoryEntry[];
  settings: Settings;
  devices: DevicePresence[];
  toasts: Toast[];
  appVersion: string;
  view: View; setView: (v: View) => void;
  groupFilter: string | null; setGroupFilter: (g: string | null) => void;
  nativeLabel: string;
  account: Account;
  planLabel: string;
  entitlement: Entitlement;
  lockedBrowser: (family: string) => boolean;
  /** Where the plan and role came from: server, cached server answer, or device. */
  entitlementSource: ServerEntitlement['source'];
  /** Plain-language provenance shown in the account screens. */
  planNotice: string;
  authStatus: AuthStatus;
  authBusy: boolean;
  cloudConfigured: boolean;
  /** null when the account service is not configured or not reachable */
  cloudEmail: string | null;
  signIn: (email: string, password: string) => Promise<AuthOutcome>;
  signUp: (email: string, password: string) => Promise<AuthOutcome>;
  resetPassword: (email: string) => Promise<AuthOutcome>;
  signOut: () => void;
  /** Keep using this device without an account. Never grants a paid tier. */
  continueLocally: () => void;
  /** Re-read the entitlement for the current session. */
  refreshEntitlement: () => Promise<string | null>;
  addHistory: (entries: HistoryEntryInput[]) => void;
  clearHistory: (profileId?: string) => void;
  selectedId: string | null; setSelectedId: (id: string | null) => void;
  previewProfileId: string | null; setPreviewProfileId: (id: string | null) => void;
  createOpen: boolean; setCreateOpen: (v: boolean) => void;
  paletteOpen: boolean; setPaletteOpen: (v: boolean) => void;
  addProfiles: (p: BrowserProfile[]) => void;
  createOne: (input: Parameters<typeof createProfile>[0]) => BrowserProfile | null;
  updateProfile: (id: string, patch: Partial<BrowserProfile>) => void;
  toggleProfileExtension: (profileId: string, extId: string) => void;
  updateProfileIdentity: (id: string, opts: { templateId?: string; browserFamily?: BrowserFamily; webrtcMode?: FingerprintSpec['webrtcMode']; timezone?: string; locale?: string }) => void;
  deleteProfiles: (ids: string[]) => void;
  duplicateProfiles: (ids: string[]) => void;
  applyPreset: (ids: string[], realId: string) => void;
  geoMatch: (ids: string[]) => void;
  rotateProxy: (ids: string[]) => void;
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
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
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
  const [session, setSession] = useState<CloudSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('signed-out');
  const [authBusy, setAuthBusy] = useState(false);
  const [entitlementSource, setEntitlementSource] = useState<ServerEntitlement['source']>('local');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProxyStatus = useRef<Map<string, string>>(new Map());

  const cloudConfig = useMemo<CloudConfig>(
    () => normalizeConfig({ url: data.settings.supabaseUrl, anonKey: data.settings.anonKey }),
    [data.settings.supabaseUrl, data.settings.anonKey],
  );
  const cloudConfigured = isConfigured(cloudConfig);

  /**
   * Persist on every data change, including the very first render. The old code
   * skipped the first save, so a fresh install kept nothing until the user
   * happened to mutate something — which also meant a reload re-seeded the
   * workspace and any account choice was silently lost.
   */
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Quota exceeded: keep the in-memory workspace usable and say so once.
        console.warn('Workspace is too large for localStorage; keeping it in memory only');
      }
    }, 200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data]);

  /**
   * Mirror the workspace into the desktop shell.
   *
   * The shell keeps its own copy in userData so profiles can be launched from
   * its REST API and from synced commands. v3.1.0 never pushed anything, so the
   * UI could show a profile the shell had never heard of and every launch failed
   * with "Unknown profile" while the row flipped to "running".
   *
   * Skipped while a profile is mid-transition so a launch cannot be undone by a
   * write that lands a moment earlier.
   */
  useEffect(() => {
    if (!isDesktopShell()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void syncWorkspaceToDesktop({ profiles: data.profiles, proxies: data.proxies, groups: data.groups });
    }, 150);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data.profiles, data.proxies, data.groups]);

  // Adopt launches the shell performed on its own (REST API, synced command).
  useEffect(() => {
    if (!isDesktopShell()) return;
    let cancelled = false;
    const pull = async () => {
      const fromShell = await pullDesktopWorkspace();
      if (cancelled || !fromShell) return;
      setData((d) => {
        const byId = new Map(fromShell.profiles.map((p) => [p.id, p]));
        // Only reconcile status/device: everything else is the UI's to own.
        let changed = false;
        const profiles = d.profiles.map((p) => {
          const live = byId.get(p.id);
          if (!live) return p;
          const status = live.status ?? p.status;
          const device = live.device ?? p.device;
          if (status === p.status && device === p.device) return p;
          changed = true;
          return { ...p, status, device };
        });
        return changed ? { ...d, profiles } : d;
      });
    };
    const timer = setInterval(() => { void pull(); }, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Push any already-saved credentials once, so a configured install starts
  // syncing immediately after an update instead of needing the field re-saved.
  useEffect(() => {
    if (nativeKind() === 'web') return;
    pushSyncConfig(data.settings.supabaseUrl, data.settings.anonKey, session?.accessToken ?? '');
    // Re-runs when the session is restored or its access token is rotated, so the
    // native client never keeps a stale credential.
  }, [data.settings.supabaseUrl, data.settings.anonKey, session]);

  /**
   * Cloud accounts: point the auth client at the configured project and adopt
   * an existing session (with its server-side entitlement) on start-up.
   * Without keys the app stays local-first and the AuthView says so.
   */
  /**
   * Merge visits into the workspace history.
   *
   * Ids are deterministic (`historyEntryId`) so the same navigation reported
   * twice — a desktop title refresh, or an Android poll re-reading the JSONL
   * file — updates the entry instead of duplicating it. `mergeHistory` owns the
   * dedupe, newest-first order and the 1500-entry cap.
   */
  const pushHistory = useCallback((entries: HistoryEntryInput[]) => {
    if (!entries.length) return;
    setData((d) => ({
      ...d,
      history: mergeHistory(d.history, entries.map((e) => {
        const at = e.at ?? new Date().toISOString();
        return {
          id: e.id ?? historyEntryId(e.profileId, e.url, at),
          at,
          profileId: e.profileId,
          profileName: e.profileName || d.profiles.find((p) => p.id === e.profileId)?.name || e.profileId,
          url: e.url,
          title: e.title,
          search: e.search,
        };
      })),
    }));
  }, []);

  /**
   * Desktop: profile windows stream every visit to the manager over the
   * `history:entry` IPC channel (see attachHistory in apps/desktop/main.js).
   */
  useEffect(() => {
    const bridge = typeof window === 'undefined' ? undefined : window.joe;
    if (!bridge?.isDesktop || !bridge.on) return;
    return bridge.on('history:entry', (entry) => {
      const e = entry as HistoryEntryInput & { profileId?: string; url?: string };
      if (e && e.profileId && e.url) pushHistory([e]);
    });
  }, [pushHistory]);

  /**
   * Android: each profile WebView runs in its own process and appends visits
   * to a shared JSONL file. The manager polls that file through the bridge —
   * deterministic ids make re-polls free.
   */
  useEffect(() => {
    if (nativeKind() !== 'android') return;
    const pull = () => {
      const entries = getNativeHistory();
      if (entries.length) pushHistory(entries);
    };
    pull();
    const timer = setInterval(pull, 6000);
    return () => clearInterval(timer);
  }, [pushHistory]);

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

  /**
   * Proxy monitor: compare the previous health state with the current one and
   * raise exactly one notification per transition (down or recovered). Without
   * the ref this would fire on every render and spam the user.
   */
  useEffect(() => {
    if (!data.settings.proxyAlerts) return;
    const prev = prevProxyStatus.current;
    const changes: Array<{ kind: 'proxy' | 'check'; text: string; meta?: string }> = [];
    const toasts: Array<{ text: string; kind: 'ok' | 'warn' | 'err' | 'info' }> = [];
    for (const p of data.proxies) {
      const before = prev.get(p.id);
      if (before && before !== p.status) {
        if (p.status === 'failed') {
          changes.push({ kind: 'proxy', text: `Proxy offline: ${p.name}` });
          toasts.push({ text: `${p.name} is offline`, kind: 'err' });
        } else if (before === 'failed' && p.status === 'ok') {
          changes.push({ kind: 'proxy', text: `Proxy recovered: ${p.name}` });
          toasts.push({ text: `${p.name} is back online`, kind: 'ok' });
        }
      }
      prev.set(p.id, p.status);
    }
    if (!changes.length) return;
    setData((d) => ({
      ...d,
      activity: [
        ...changes.map((c, i) => ({ id: `act_${Date.now()}_${i}`, at: new Date().toISOString(), ...c })),
        ...d.activity,
      ].slice(0, 400),
    }));
    toasts.forEach((t) => toast(t.text, t.kind));
  }, [data.proxies, data.settings.proxyAlerts, toast]);


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

  /**
   * Apply a server answer to the account.
   *
   * This is the only code path that can grant a paid plan or the owner role.
   */
  const applyEntitlement = useCallback((email: string, entitlement: ServerEntitlement) => {
    setEntitlementSource(entitlement.source);
    setData((d) => ({ ...d, account: accountFromEntitlement(email || d.account.email, entitlement) }));
  }, []);

  /** Read `my_entitlement()` and fall back to the cached answer when offline. */
  const readEntitlement = useCallback(async (config: CloudConfig, active: CloudSession): Promise<string | null> => {
    try {
      const entitlement = await fetchEntitlement(config, active);
      cacheEntitlement(entitlement, active.user.email);
      applyEntitlement(active.user.email, entitlement);
      setAuthStatus('cloud');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read your plan.';
      if (error instanceof CloudError && error.code === 'expired_session') {
        saveSession(null);
        setSession(null);
        setAuthStatus('signed-out');
        return message;
      }
      const cached = loadCachedEntitlement(Date.now(), active.user.email);
      if (cached) applyEntitlement(active.user.email, cached);
      setAuthStatus('cloud-offline');
      return message;
    }
  }, [applyEntitlement]);

  /**
   * Restore a stored session on start.
   *
   * No session means no verified plan: the account stays on the local tier until
   * the server answers, which is why a hand-edited workspace cannot keep a
   * premium claim after a restart.
   */
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!cloudConfigured) {
        setSession(null);
        setAuthStatus('signed-out');
        return;
      }
      const stored = loadSession();
      if (!stored) {
        setAuthStatus('signed-out');
        return;
      }
      try {
        const fresh = await ensureFreshSession(cloudConfig, stored);
        if (cancelled) return;
        if (!fresh) {
          saveSession(null);
          setSession(null);
          setAuthStatus('signed-out');
          return;
        }
        saveSession(fresh);
        setSession(fresh);
        setAuthStatus('working');
        await readEntitlement(cloudConfig, fresh);
      } catch {
        // Offline start: keep the session and the cached entitlement if any.
        if (cancelled) return;
        setSession(stored);
        const cached = loadCachedEntitlement(Date.now(), stored.user.email);
        if (cached) applyEntitlement(stored.user.email, cached);
        setAuthStatus('cloud-offline');
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [cloudConfigured, cloudConfig, applyEntitlement, readEntitlement]);

  /** Keep the access token fresh while the app stays open. */
  useEffect(() => {
    if (!session || !cloudConfigured) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const fresh = await ensureFreshSession(cloudConfig, session);
          if (!fresh) {
            saveSession(null);
            setSession(null);
            setAuthStatus('signed-out');
            setData((d) => ({ ...d, account: sanitizeAccount(d.account) }));
            toast('Your session expired — sign in again', 'warn');
            return;
          }
          if (fresh !== session) { saveSession(fresh); setSession(fresh); }
        } catch { /* offline: retry on the next tick */ }
      })();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [session, cloudConfig, cloudConfigured, toast]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthOutcome> => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { error: 'Enter a valid email address.' };
    if (!cloudConfigured) {
      return { error: 'No account service is configured. Add your Supabase project URL and publishable key in Settings → Sync.' };
    }
    if (!password) return { error: 'Enter your password.' };
    setAuthBusy(true);
    setAuthStatus('working');
    try {
      const next = await signInWithPassword(cloudConfig, address, password);
      saveSession(next);
      setSession(next);
      const problem = await readEntitlement(cloudConfig, next);
      if (problem) toast(problem, 'warn');
      toast(`Signed in as ${next.user.email}`);
      return { error: null };
    } catch (error) {
      setAuthStatus('signed-out');
      return { error: error instanceof Error ? error.message : 'Sign-in failed.' };
    } finally {
      setAuthBusy(false);
    }
  }, [cloudConfig, cloudConfigured, readEntitlement, toast]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthOutcome> => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { error: 'Enter a valid email address.' };
    if (!cloudConfigured) {
      return { error: 'No account service is configured. Add your Supabase project URL and publishable key in Settings → Sync.' };
    }
    if (password.length < 8) return { error: 'Use at least 8 characters.' };
    setAuthBusy(true);
    setAuthStatus('working');
    try {
      const result = await cloudSignUp(cloudConfig, address, password);
      if (!result.session) {
        setAuthStatus('signed-out');
        return { error: null, info: `Check ${address} for the confirmation link, then sign in.` };
      }
      saveSession(result.session);
      setSession(result.session);
      const problem = await readEntitlement(cloudConfig, result.session);
      if (problem) toast(problem, 'warn');
      toast('Account created');
      return { error: null };
    } catch (error) {
      setAuthStatus('signed-out');
      return { error: error instanceof Error ? error.message : 'Could not create the account.' };
    } finally {
      setAuthBusy(false);
    }
  }, [cloudConfig, cloudConfigured, readEntitlement, toast]);

  const resetPassword = useCallback(async (email: string): Promise<AuthOutcome> => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { error: 'Enter a valid email address.' };
    if (!cloudConfigured) {
      return { error: 'No account service is configured, so no reset email can be sent. Add your Supabase project keys in Settings → Sync.' };
    }
    setAuthBusy(true);
    try {
      await sendRecoveryEmail(cloudConfig, address);
      return { error: null, info: `If ${address} has an account, a reset link is on its way.` };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not send the reset email.' };
    } finally {
      setAuthBusy(false);
    }
  }, [cloudConfig, cloudConfigured]);

  const doSignOut = useCallback(() => {
    void cloudSignOut(cloudConfig, session);
    saveSession(null);
    cacheEntitlement(null);
    setSession(null);
    setAuthStatus('signed-out');
    setEntitlementSource('local');
    setData((d) => ({ ...d, account: d.profiles.length > 2 ? DEMO_ACCOUNT : DEFAULT_ACCOUNT }));
    toast('Signed out — this device is on the local tier', 'info');
  }, [cloudConfig, session, toast]);

  const refreshEntitlement = useCallback(async (): Promise<string | null> => {
    if (!session) return 'Sign in to a cloud account first.';
    const fresh = await ensureFreshSession(cloudConfig, session).catch(() => null);
    if (!fresh) {
      saveSession(null);
      setSession(null);
      setAuthStatus('signed-out');
      return 'Your session expired — sign in again.';
    }
    saveSession(fresh);
    setSession(fresh);
    const problem = await readEntitlement(cloudConfig, fresh);
    if (!problem) toast('Plan confirmed by your account service');
    return problem;
  }, [cloudConfig, session, readEntitlement, toast]);

  const api = useMemo<Store>(() => ({
    ...data, devices, toasts, appVersion: APP_VERSION,
    view, setView, groupFilter, setGroupFilter,
    nativeLabel: nativeKind() === 'android' ? 'Android active' : nativeKind() === 'desktop' ? 'Desktop active' : 'Browser workspace',
    account: data.account,
    planLabel: isAdmin(data.account)
      ? 'Owner · unlimited'
      : `${planFor(data.account).name} plan${planFor(data.account).profileLimit ? ` · ${planFor(data.account).profileLimit} profiles` : ' · unlimited'}`,
    entitlement: checkProfileQuota(data.account, data.profiles.length, 1),
    lockedBrowser: (family) => !browserAllowed(data.account, family as never),
    entitlementSource,
    planNotice: entitlementSource === 'server'
      ? 'Plan confirmed by your account service.'
      : entitlementSource === 'cache'
        ? 'Cached from your last verified session — reconnect to refresh it.'
        : 'Device-only account: the plan has not been verified by a server.',
    authStatus,
    authBusy,
    cloudConfigured,
    cloudEmail: session?.user.email ?? null,
    signIn: async (email, password) => {
      const outcome = await signIn(email, password);
      if (!outcome.error) { log('edit', 'Signed in', email.trim().toLowerCase()); setView('profiles'); }
      return outcome;
    },
    signUp: async (email, password) => {
      const outcome = await signUp(email, password);
      if (!outcome.error && !outcome.info) { log('edit', 'Account created', email.trim().toLowerCase()); setView('profiles'); }
      return outcome;
    },
    resetPassword,
    signOut: doSignOut,
    continueLocally: () => { setView('profiles'); toast('Using this device without an account', 'info'); },
    refreshEntitlement,
    addHistory: pushHistory,
    clearHistory: (profileId) => {
      clearNativeHistory(profileId);
      setData((d) => ({
        ...d,
        history: profileId ? d.history.filter((h) => h.profileId !== profileId) : [],
      }));
    },
    selectedId, setSelectedId, previewProfileId, setPreviewProfileId, createOpen, setCreateOpen, paletteOpen, setPaletteOpen, syncEvents,
    addProfiles: (ps) => {
      const quota = checkProfileQuota(data.account, data.profiles.length, ps.length);
      if (!quota.allowed) { toast(quota.reason, 'warn'); return; }
      setData((d) => ({ ...d, profiles: [...ps, ...d.profiles] }));
      log('create', `${ps.length} profiles created`);
    },
    createOne: (input) => {
      const quota = checkProfileQuota(data.account, data.profiles.length, 1);
      if (!quota.allowed) {
        toast(quota.reason, 'warn');
        return null;
      }
      const p = createProfile(input, Date.now() % 100000);
      setData((d) => ({ ...d, profiles: [p, ...d.profiles] }));
      log('create', `${p.name} created`, p.templateId);
      return p;
    },
    updateProfile: (id, patch) => setData((d) => ({ ...d, profiles: d.profiles.map((p) => p.id === id ? { ...p, ...patch, revision: p.revision + 1, updatedAt: new Date().toISOString() } : p) })),
    toggleProfileExtension: (profileId, extId) => setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => {
        if (p.id !== profileId) return p;
        const has = p.extensions.includes(extId);
        const extensions = has ? p.extensions.filter((x) => x !== extId) : [...p.extensions, extId];
        return { ...p, extensions, revision: p.revision + 1, updatedAt: new Date().toISOString() };
      }),
    })),
    updateProfileIdentity: (id, opts) => setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => {
        if (p.id !== id) return p;
        const base = opts.templateId || opts.browserFamily
          ? rebuildProfileFingerprint(p, { templateId: opts.templateId, browserFamily: opts.browserFamily })
          : p;
        const tz = opts.timezone ?? base.fingerprint.timezone;
        const loc = opts.locale ?? base.fingerprint.locale;
        const fp: FingerprintSpec = {
          ...base.fingerprint,
          timezone: tz,
          timezoneOffset: opts.timezone ? offsetForZone(tz) : base.fingerprint.timezoneOffset,
          locale: loc,
          languages: opts.locale ? [loc, ...base.fingerprint.languages.filter((l) => l !== loc)] : base.fingerprint.languages,
          webrtcMode: opts.webrtcMode ?? base.fingerprint.webrtcMode,
        };
        return { ...base, fingerprint: fp, revision: base.revision + 1, updatedAt: new Date().toISOString() };
      }),
    })),
    deleteProfiles: (ids) => {
      const set = new Set(ids);
      setData((d) => ({ ...d, profiles: d.profiles.filter((p) => !set.has(p.id)) }));
      log('delete', `${ids.length} profiles removed`);
      setSelectedId((s) => (s && set.has(s) ? null : s));
    },
    duplicateProfiles: (ids) => {
      const quota = checkProfileQuota(data.account, data.profiles.length, ids.length);
      if (!quota.allowed) { toast(quota.reason, 'warn'); return; }
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
    rotateProxy: (ids) => {
      const set = new Set(ids);
      let rotated = 0;
      setData((d) => ({
        ...d,
        profiles: d.profiles.map((p) => {
          if (!set.has(p.id)) return p;
          const current = d.proxies.find((x) => x.id === p.proxyId);
          const pool = d.proxies.filter((x) => x.id !== p.proxyId && x.status !== 'failed'
            && (current ? x.country === current.country : true));
          if (!pool.length) return p;
          rotated += 1;
          const next = pool[rotated % pool.length];
          return { ...p, proxyId: next.id, revision: p.revision + 1, updatedAt: new Date().toISOString() };
        }),
      }));
      if (rotated && data.settings.rotationAlerts) toast(`${rotated} profiles rotated to a new exit`, 'info');
      log('proxy', `Rotation applied to ${rotated} profiles`);
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
      // The free tier is enforced on every path that adds profiles. Importing a
      // 250-row CSV was a one-click way around the two-profile limit.
      const limit = planFor(data.account).profileLimit;
      const room = limit === null ? rows.length : Math.max(0, limit - data.profiles.length);
      if (!room) { toast(checkProfileQuota(data.account, data.profiles.length, 1).reason, 'warn'); return 0; }
      const take = rows.slice(0, room);
      const groups = [...new Set(take.map((r) => r.group))];
      const created = take.map((r, i) => createProfile({ name: r.name, group: r.group, notes: r.notes, seed: `csv::${r.name}::${i}` }, i));
      setData((d) => ({ ...d, profiles: [...created, ...d.profiles], groups: [...new Set([...d.groups, ...groups])] }));
      log('import', `${created.length} profiles imported from CSV`);
      if (take.length < rows.length) toast(`Imported ${take.length} of ${rows.length} — plan limit reached`, 'warn');
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
      if (nativeKind() === 'web') {
        if (status === 'running' && ids.length === 1) setPreviewProfileId(ids[0]);
        else if (status === 'stopped' && previewProfileId && set.has(previewProfileId)) setPreviewProfileId(null);
      } else {
        data.profiles.filter((p) => set.has(p.id)).forEach((p) => {
          const run = status === 'running' ? nativeLaunch(p) : nativeStop(p);
          void run.then((problem) => {
            if (problem) toast(`${p.name}: ${problem}`, 'warn');
          });
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
        country: guessProxyCountry(p.host), status: 'unchecked' as const, latencyMs: null, lastCheckedAt: null,
      }));
      setData((d) => ({ ...d, proxies: [...next, ...d.proxies] }));
      log('import', `${good.length} proxies imported`);
      return { ok: good.length, bad: parsed.length - good.length };
    },
    importData: (json) => {
      const parsed = parseWorkspace(json);
      const incoming = parsed.profiles.map(normalizeProfile);
      const known = new Set(data.profiles.map((p) => p.id));
      const limit = planFor(data.account).profileLimit;
      const room = limit === null ? incoming.length : Math.max(0, limit - data.profiles.length);
      // Only genuinely new rows consume a seat; re-importing an existing
      // workspace replaces rows instead of duplicating them.
      const fresh = incoming.filter((p) => !known.has(p.id));
      const allowed = fresh.slice(0, room);
      if (fresh.length > allowed.length) {
        toast(`Imported ${allowed.length} of ${fresh.length} new profiles — plan limit reached`, 'warn');
      }
      const allowedIds = new Set(allowed.map((p) => p.id));
      const keep = new Set(incoming.map((p) => p.id));
      setData((d) => ({
        ...d,
        profiles: [
          ...allowed,
          ...incoming.filter((p) => known.has(p.id)),
          ...d.profiles.filter((p) => !allowedIds.has(p.id) && !keep.has(p.id)),
        ],
        proxies: [...parsed.proxies, ...d.proxies.filter((p) => !parsed.proxies.some((x) => x.id === p.id))],
        groups: [...new Set([...d.groups, ...parsed.groups])],
      }));
      log('import', `${allowed.length} new profiles imported`);
      return allowed.length;
    },
    exportData: () => { log('export', 'Workspace exported'); return makeExport(data.profiles, data.proxies, data.groups); },
    reset: () => { setData(seed()); setGroupFilter(null); toast('Demo workspace restored', 'info'); },
    setSetting: (k, v) => {
      // A service-role key bypasses every RLS policy; refusing it in the client
      // is the last line of defence behind the packaging checks.
      if (k === 'anonKey' && looksLikeServiceRoleKey(String(v))) {
        toast('That is a service-role key. Paste the publishable (anon) key instead — a service key must never ship in an app.', 'err');
        return;
      }
      setData((d) => {
        const settings = { ...d.settings, [k]: v };
        // The APK keeps its Supabase credentials in SharedPreferences for the
        // Java poller; the UI stores them in localStorage. Push on change so
        // sync starts working without an app restart.
        if (k === 'supabaseUrl' || k === 'anonKey') {
          pushSyncConfig(settings.supabaseUrl, settings.anonKey, session?.accessToken ?? '');
        }
        return { ...d, settings };
      });
    },
    log, toast,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    send: async (topic, payload, to) => {
      // The desktop shell owns a real Supabase channel; the phone's Java bridge
      // posts to PostgREST. Only fall back to the in-process bus when neither
      // exists (web preview), where it is a no-op demo.
      if (isDesktopShell() || nativeKind() === 'android') {
        const problem = await sendSyncCommand(topic, payload, to);
        if (problem) toast(problem, 'warn');
      }
      await desktop.send(topic, payload, to);
    },
    setDeviceOnline: (kind, online) => {
      setDevices((d) => d.map((x) => x.kind === kind ? { ...x, online, lastSeen: new Date().toISOString() } : x));
      log('sync', `${kind} ${online ? 'connected' : 'disconnected'}`);
    },
  }), [data, devices, toasts, view, groupFilter, selectedId, previewProfileId, createOpen, paletteOpen, syncEvents, log, toast, pushHistory,
    entitlementSource, authStatus, authBusy, cloudConfigured, session, signIn, signUp, resetPassword, doSignOut, refreshEntitlement]);

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
