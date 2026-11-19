import type { BrowserProfile, ProxyConfig } from '@joe/core';

/** Typed view of the bridges exposed by the Electron preload and the Android Java bridge. */
declare global {
  interface Window {
    JoeBridge?: {
      isAndroid(): boolean;
      getProfiles(): string;
      getDeviceInfo(): string;
      launchProfile(profileJson: string): string;
      saveConfig(url: string, anonKey: string): string;
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
      sync: { send(topic: string, payload: unknown, to?: string): Promise<unknown> };
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

export function nativeLaunch(profile: BrowserProfile): void {
  if (typeof window === 'undefined') return;
  if (window.JoeBridge) {
    window.JoeBridge.launchProfile(JSON.stringify(profile));
  } else if (window.joe) {
    void window.joe.profiles.launch(profile.id);
  }
}

export function nativeStop(profile: BrowserProfile): void {
  if (typeof window === 'undefined') return;
  if (window.joe) void window.joe.profiles.stop(profile.id);
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
