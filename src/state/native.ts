import type { BrowserProfile, ProxyConfig } from '@joe/core';

/** Typed view of the bridges exposed by the Electron preload and the Android Java bridge. */
declare global {
  interface Window {
    JoeBridge?: {
      isAndroid(): boolean;
      getProfiles(): string;
      getDeviceInfo(): string;
      launchProfile(profileJson: string): string;
      saveConfig(url: string, anonKey: string, accessToken: string): string;
      getConfig(): string;
      sendCommand(topic: string, payloadJson: string): string;
      toast(message: string): void;
    };
    joe?: {
      isDesktop: boolean;
      info(): Promise<{ version: string; platform: string }>;
      profiles: {
        launch(id: string): Promise<unknown>;
        stop(id: string): Promise<unknown>;
        list(): Promise<BrowserProfile[]>;
      };
      sync: {
        send(topic: string, payload: unknown, to?: string): Promise<unknown>;
        configure?(config: { url: string; anonKey: string }): Promise<unknown>;
      };
      workspace?: {
        replace(data: unknown): Promise<{ ok: boolean; profiles: number }>;
        read(): Promise<NativeWorkspace>;
      };
    };
    __joeOnCommand?: (commands: Array<{ id: string; topic: string; payload: Record<string, unknown> }>) => void;
  }
}

export interface NativeWorkspace {
  profiles: BrowserProfile[];
  proxies: ProxyConfig[];
  groups: string[];
}

export function nativeKind(): 'android' | 'desktop' | 'web' {
  if (typeof window === 'undefined') return 'web';
  if (window.JoeBridge) return 'android';
  if (window.joe?.isDesktop) return 'desktop';
  return 'web';
}

/** The APK ships a generated workspace.json; the EXE exposes its local store. */
export function getNativeWorkspace(): NativeWorkspace | null {
  if (typeof window === 'undefined') return null;
  if (window.JoeBridge) {
    try {
      const parsed = JSON.parse(window.JoeBridge.getProfiles()) as Partial<NativeWorkspace>;
      if (Array.isArray(parsed.profiles)) {
        return { profiles: parsed.profiles, proxies: parsed.proxies ?? [], groups: parsed.groups ?? ['Default'] };
      }
    } catch { /* fall through to local seed */ }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Sync configuration.
 *
 * The APK's poller and sender live in Java and read the Supabase URL and key
 * from SharedPreferences, while the UI stores them in localStorage. Nothing
 * bridged the two: a user could paste a key into Settings and sync would stay
 * dead until the value was also written by hand. These helpers push the UI's
 * settings into whichever shell exists.
 * ------------------------------------------------------------------ */

export function pushSyncConfig(url: string, anonKey: string, accessToken = ''): void {
  if (typeof window === 'undefined') return;
  if (window.JoeBridge?.saveConfig) {
    // The phone's Java client writes to PostgREST, and RLS needs the user's JWT:
    // the anon key alone leaves auth.uid() empty and every command is refused.
    try { window.JoeBridge.saveConfig(url ?? '', anonKey ?? '', accessToken ?? ''); } catch { /* non-fatal */ }
  } else if (window.joe?.sync?.configure) {
    void window.joe.sync.configure({ url: url ?? '', anonKey: anonKey ?? '' });
  }
}

export function readSyncConfig(): { url: string; anonKey: string; accessToken: string } | null {
  if (typeof window === 'undefined' || !window.JoeBridge?.getConfig) return null;
  try {
    const parsed = JSON.parse(window.JoeBridge.getConfig()) as { url?: string; anonKey?: string; accessToken?: string };
    return { url: parsed.url ?? '', anonKey: parsed.anonKey ?? '', accessToken: parsed.accessToken ?? '' };
  } catch {
    return null;
  }
}

/**
 * Send a sync command to the other device.
 *
 * Returns the reason on failure so the caller can report it; the previous
 * implementation awaited an in-memory bus and reported success unconditionally.
 */
export async function sendSyncCommand(topic: string, payload: unknown, to?: string): Promise<string | null> {
  if (typeof window === 'undefined') return 'Sync is unavailable here.';
  if (window.JoeBridge?.sendCommand) {
    try {
      const raw = window.JoeBridge.sendCommand(topic, JSON.stringify(payload ?? {}));
      const result = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : { ok: true };
      return result.ok === false ? result.error || 'The phone could not reach Supabase.' : null;
    } catch {
      return 'The phone could not reach Supabase.';
    }
  }
  const bridge = window.joe?.sync;
  if (!bridge?.send) return 'Sync is unavailable here.';
  try {
    const result = (await bridge.send(topic, payload, to)) as { ok?: boolean; reason?: string } | undefined;
    if (result && result.ok === false) return result.reason || 'Sync is not configured.';
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Sync failed.';
  }
}

/* ------------------------------------------------------------------ *
 * Desktop workspace sync.
 *
 * The management UI is a normal web app: it keeps its workspace in
 * localStorage. The Electron main process keeps its own copy in userData so a
 * profile can be launched from the local REST API or a synced command.
 *
 * v3.1.0 never linked the two. Launching a profile from the UI called
 * `profiles:launch(id)` for an id the main process had never seen, which threw
 * "Unknown profile" inside a floating promise — the row showed "running" while
 * no browser window opened. Every mutation now mirrors to the main process
 * first, so the two stores stay identical.
 * ------------------------------------------------------------------ */

/** True when a real Electron bridge is present (not the web preview). */
export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && !!window.joe?.isDesktop;
}

/**
 * Push the whole workspace to the main process.
 *
 * Whole-workspace rather than per-operation: the UI can reorder, bulk-import or
 * undo, and a single idempotent write cannot drift out of sync. Failures are
 * reported instead of swallowed so the UI can surface them.
 */
export async function syncWorkspaceToDesktop(workspace: NativeWorkspace): Promise<boolean> {
  const bridge = typeof window === 'undefined' ? undefined : window.joe;
  if (!bridge?.isDesktop || !bridge.workspace?.replace) return false;
  try {
    await bridge.workspace.replace({
      profiles: workspace.profiles,
      proxies: workspace.proxies,
      groups: workspace.groups,
    });
    return true;
  } catch (error) {
    console.error('[joe] could not sync the workspace to the desktop shell', error);
    return false;
  }
}

/**
 * Adopt the shell's workspace after it launches a profile the UI does not know
 * about (REST API, synced command), so both sides converge instead of showing
 * different lists.
 */
export async function pullDesktopWorkspace(): Promise<NativeWorkspace | null> {
  const bridge = typeof window === 'undefined' ? undefined : window.joe;
  if (!bridge?.isDesktop || !bridge.workspace?.read) return null;
  try {
    const data = await bridge.workspace.read();
    if (!data || !Array.isArray(data.profiles)) return null;
    return { profiles: data.profiles, proxies: data.proxies ?? [], groups: data.groups ?? ['Default'] };
  } catch (error) {
    console.error('[joe] could not read the desktop workspace', error);
    return null;
  }
}

/**
 * Launch a profile through the platform shell.
 *
 * Returns a resolved message on success and a reason on failure, so a dead
 * launch is visible in the UI rather than looking like a running profile.
 */
export async function nativeLaunch(profile: BrowserProfile): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (window.JoeBridge) {
    window.JoeBridge.launchProfile(JSON.stringify(profile));
    return null;
  }
  if (!window.joe) return null;
  try {
    const result = (await window.joe.profiles.launch(profile.id)) as { ok?: boolean; alreadyRunning?: boolean } | undefined;
    if (result && result.ok === false) return 'The desktop shell refused the launch.';
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The desktop shell could not open that profile.';
  }
}

export async function nativeStop(profile: BrowserProfile): Promise<string | null> {
  if (typeof window === 'undefined' || !window.joe) return null;
  try {
    await window.joe.profiles.stop(profile.id);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The desktop shell could not stop that profile.';
  }
}

/** Commands arriving from Supabase (polled by the Android SyncPoller) land here. */
export function installCommandHandler(onCommand: (topic: string, ids: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.__joeOnCommand = (commands) => {
    for (const c of commands) {
      const ids = Array.isArray(c.payload?.profileIds) ? (c.payload.profileIds as string[]) : [];
      if (c.topic === 'command:launch' || c.topic === 'command:stop') onCommand(c.topic, ids);
    }
  };
  return () => { delete window.__joeOnCommand; };
}

export function nativeDeviceName(): string {
  if (typeof window !== 'undefined' && window.JoeBridge) {
    try { return JSON.parse(window.JoeBridge.getDeviceInfo()).name as string; } catch { /* noop */ }
  }
  return 'Desktop';
}

/* ------------------------------------------------------------------ *
 * Extensions.
 *
 * On the desktop build these reach the real installer in
 * apps/desktop/extensions.cjs (download/unpack into the app's own
 * extensions folder). Anywhere else — web preview, Android — there is no
 * folder to install into, so `nativeExtensions()` returns null and the UI
 * must fall back to the store link rather than claiming an install.
 * ------------------------------------------------------------------ */

export interface InstalledExtension {
  dir: string;
  name: string;
  version: string;
  manifestVersion: number;
}

interface ExtBridge {
  list(): Promise<InstalledExtension[]>;
  install(zipPath: string, id: string): Promise<InstalledExtension>;
  attach(profileId: string, dir: string): Promise<unknown>;
  detach(profileId: string, dir: string): Promise<unknown>;
}

export function nativeExtensions(): ExtBridge | null {
  const w = globalThis as unknown as { joe?: { extensions?: ExtBridge; isDesktop?: boolean } };
  return w.joe?.isDesktop && w.joe.extensions ? w.joe.extensions : null;
}

export function nativeCanInstallExtensions(): boolean {
  return nativeExtensions() !== null;
}
