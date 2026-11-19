/**
 * Pure, platform-agnostic profile model.
 *
 * This module has ZERO DOM / Node / Electron / Android dependencies. It is the
 * piece that will be lifted into `packages/core` and shared byte-for-byte by
 * the Electron desktop app and the Android app. A profile is a *declaration*:
 * both clients derive the exact same fingerprint parameters from the same
 * `seed`, so a profile opened on the EXE and on the APK looks identical.
 */

export type Platform = 'windows' | 'android' | 'macos' | 'linux';

export interface FingerprintSpec {
  userAgent: string;
  platform: string;
  screen: { width: number; height: number; dpr: number };
  timezone: string;
  locale: string;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
  webglVendor: string;
  webglRenderer: string;
  noiseSeed: number;
}

export interface BrowserProfile {
  id: string;
  name: string;
  group: string;
  proxy: string;
  platform: Platform;
  fingerprint: FingerprintSpec;
  revision: number;
  updatedAt: string;
}

/** FNV-1a — stable 32-bit hash, identical on V8 (Electron) and ART (Android). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const UA_BY_PLATFORM: Record<Platform, (chrome: string) => string> = {
  windows: (c) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${c} Safari/537.36`,
  android: (c) => `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${c} Mobile Safari/537.36`,
  macos: (c) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${c} Safari/537.36`,
  linux: (c) => `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${c} Safari/537.36`,
};

const SCREENS = [
  { width: 1920, height: 1080, dpr: 1 },
  { width: 2560, height: 1440, dpr: 1 },
  { width: 1366, height: 768, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
  { width: 1080, height: 2400, dpr: 2.625 },
];

const ZONES = ['America/New_York', 'Europe/London', 'Asia/Dhaka', 'Europe/Berlin', 'Asia/Singapore'];
const LOCALES = ['en-US', 'en-GB', 'bn-BD', 'de-DE', 'en-SG'];
const GPUS = [
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Mali-G715, OpenGL ES 3.2)' },
];

export interface CreateProfileOptions {
  id?: string;
  group?: string;
  proxy?: string;
  platform?: Platform;
  revision?: number;
  chromeMajor?: number;
}

/**
 * Deterministic profile derivation. Given the same `name` + `seed`, every
 * client on every OS produces the same spec (only platform-specific fields
 * such as the UA string differ).
 */
export function createProfile(name: string, seed: string, opts: CreateProfileOptions = {}): BrowserProfile {
  const h = hashString(`${name}::${seed}`);
  const platform = opts.platform ?? 'windows';
  const gpu = GPUS[h % GPUS.length];
  const chromeMajor = opts.chromeMajor ?? 131;
  const chrome = `${chromeMajor}.0.${(h >>> 8) % 7000}.${(h >>> 16) % 200}`;

  return {
    id: opts.id ?? `p_${h.toString(16).padStart(8, '0')}`,
    name,
    group: opts.group ?? 'default',
    proxy: opts.proxy ?? 'direct://',
    platform,
    revision: opts.revision ?? 1,
    updatedAt: new Date(0).toISOString(),
    fingerprint: {
      userAgent: UA_BY_PLATFORM[platform](chrome),
      platform: platform === 'android' ? 'Linux armv8l' : platform === 'windows' ? 'Win32' : platform === 'macos' ? 'MacIntel' : 'Linux x86_64',
      screen: SCREENS[(h >>> 3) % SCREENS.length],
      timezone: ZONES[(h >>> 5) % ZONES.length],
      locale: LOCALES[(h >>> 7) % LOCALES.length],
      hardwareConcurrency: [2, 4, 6, 8, 12, 16][(h >>> 11) % 6],
      deviceMemoryGb: [2, 4, 8, 16][(h >>> 13) % 4],
      webglVendor: gpu.vendor,
      webglRenderer: gpu.renderer,
      noiseSeed: h,
    },
  };
}
