import { getTemplate, DEVICE_TEMPLATES, type DeviceTemplate, type ScreenSpec, type GpuSpec, type OSType } from './devices';

export type ProfileStatus = 'ready' | 'running' | 'stopped' | 'error';

export interface FingerprintSpec {
  templateId: string;
  userAgent: string;
  platform: string;
  oscpu: string;
  vendor: string;
  chromeMajor: number;
  uaClientHints: { brands: Array<{ brand: string; version: string }>; mobile: boolean; platform: string; platformVersion: string; fullVersion: string };
  screen: ScreenSpec;
  availScreen: ScreenSpec;
  innerSize: { width: number; height: number };
  cores: number;
  memoryGb: number;
  touchPoints: number;
  gpu: GpuSpec;
  fonts: string[];
  timezone: string;
  timezoneOffset: number;
  locale: string;
  languages: string[];
  gl: DeviceTemplate['gl'];
  webglVendor: string;
  webglRenderer: string;
  canvasNoise: number;
  audioNoise: number;
  webrtcMode: 'disabled' | 'proxy' | 'replace';
  webrtcPublicIp: string;
  mediaDevices: { audioinput: number; audiooutput: number; videoinput: number };
  doNotTrack: string | null;
  noiseSeed: number;
}

export interface BrowserProfile {
  id: string;
  name: string;
  group: string;
  tags: string[];
  notes: string;
  status: ProfileStatus;
  templateId: string;
  os: OSType;
  proxyId: string | null;
  fingerprint: FingerprintSpec;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt: string | null;
  device: 'desktop-exe' | 'android-apk' | 'web-dashboard' | null;
}

/** FNV-1a. Stable across V8 (desktop) and ART (Android). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG seeded from the profile seed. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

/** Region-matched locale selection: a Dhaka timezone should not get a de-DE locale. */
const ZONE_LOCALE: Array<[string, string[]]> = [
  ['America/New_York', ['en-US', 'en-CA']], ['America/Chicago', ['en-US']], ['America/Los_Angeles', ['en-US']],
  ['Europe/London', ['en-GB']], ['Europe/Dublin', ['en-GB', 'en-IE']],
  ['Europe/Berlin', ['de-DE', 'en-GB']], ['Europe/Paris', ['fr-FR', 'en-GB']], ['Europe/Amsterdam', ['nl-NL', 'en-GB']],
  ['Asia/Dhaka', ['bn-BD', 'en-US']], ['Asia/Kolkata', ['en-IN', 'hi-IN', 'en-US']],
  ['Asia/Singapore', ['en-SG', 'zh-SG', 'en-US']], ['Asia/Dubai', ['ar-AE', 'en-US']],
];

function localeForZone(zone: string, locales: string[], rnd: () => number): string {
  const entry = ZONE_LOCALE.find(([k]) => zone.startsWith(k));
  const compatible = entry ? locales.filter((l) => entry[1].includes(l)) : [];
  const pool = compatible.length ? compatible : locales;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

const ZONE_OFFSETS: Record<string, number> = {
  'America/New_York': 240, 'America/Chicago': 300, 'America/Los_Angeles': 420,
  'Europe/London': 0, 'Europe/Berlin': -60, 'Europe/Paris': -60, 'Europe/Amsterdam': -60, 'Europe/Dublin': 0,
  'Asia/Dhaka': -360, 'Asia/Kolkata': -330, 'Asia/Singapore': -480, 'Asia/Dubai': -240,
};

export interface CreateProfileInput {
  name: string;
  seed?: string;
  templateId?: string;
  group?: string;
  tags?: string[];
  proxyId?: string | null;
  notes?: string;
  /** explicit overrides for advanced users */
  overrides?: Partial<Pick<FingerprintSpec, 'timezone' | 'locale' | 'screen' | 'cores' | 'memoryGb' | 'webrtcMode' | 'doNotTrack'>>;
}

export function createProfile(input: CreateProfileInput, index = 0): BrowserProfile {
  const seedText = input.seed ?? `${input.name}::${index}::joe-browser`;
  const h = hashString(seedText);
  const rnd = seeded(h);
  const template = getTemplate(input.templateId ?? DEVICE_TEMPLATES[h % DEVICE_TEMPLATES.length].id);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length) % arr.length];

  const screen = input.overrides?.screen ?? pick(template.screens);
  const timezone = input.overrides?.timezone ?? pick(template.timezones);
  const locale = input.overrides?.locale ?? localeForZone(timezone, template.locales, rnd);
  const gpu = pick(template.gpus);
  const cores = input.overrides?.cores ?? pick(template.cores);
  const memoryGb = input.overrides?.memoryGb ?? pick(template.memoryGb);
  const chromeMajor = template.chromeMajor;

  const spec: FingerprintSpec = {
    templateId: template.id,
    userAgent: template.ua,
    platform: template.platform,
    oscpu: template.os === 'Windows' ? 'Windows NT 10.0; Win64; x64' : template.os === 'macOS' ? 'Intel Mac OS X 14.6' : template.os === 'Android' ? 'Linux armv8l' : 'Linux x86_64',
    vendor: 'Google Inc.',
    chromeMajor,
    uaClientHints: {
      brands: [
        { brand: 'Not A(Brand', version: '99' },
        { brand: 'Google Chrome', version: String(chromeMajor) },
        { brand: 'Chromium', version: String(chromeMajor) },
      ],
      mobile: template.mobile,
      platform: template.os === 'Windows' ? 'Windows' : template.os === 'macOS' ? 'macOS' : template.os === 'Android' ? 'Android' : 'Linux',
      platformVersion: template.os === 'Windows' ? '15.0.0' : template.os === 'macOS' ? '14.6.0' : template.os === 'Android' ? '14.0.0' : '6.8.0',
      fullVersion: `${chromeMajor}.0.${6778 + (h % 40)}.${(h >>> 8) % 200}`,
    },
    screen,
    availScreen: { ...screen, height: screen.height - (template.mobile ? 24 : 80) },
    innerSize: { width: screen.width, height: screen.height - (template.mobile ? 48 : 140) },
    cores,
    memoryGb,
    touchPoints: template.touchPoints,
    gpu,
    fonts: template.fonts,
    timezone,
    timezoneOffset: ZONE_OFFSETS[timezone] ?? 0,
    locale,
    // Primary locale always comes first in Accept-Language / navigator.languages.
    languages: [locale, ...template.languages.filter((l) => l !== locale)],
    gl: template.gl,
    webglVendor: gpu.vendor,
    webglRenderer: gpu.renderer,
    canvasNoise: 0.0008 + rnd() * 0.0016,
    audioNoise: 0.00002 + rnd() * 0.00004,
    webrtcMode: input.overrides?.webrtcMode ?? 'replace',
    webrtcPublicIp: '',
    mediaDevices: { audioinput: template.mobile ? 2 : 1, audiooutput: template.mobile ? 2 : 1, videoinput: template.mobile ? 2 : 1 },
    doNotTrack: input.overrides?.doNotTrack ?? null,
    noiseSeed: h,
  };

  const now = new Date().toISOString();
  return {
    id: `prf_${h.toString(36)}${index.toString(36)}`,
    name: input.name,
    group: input.group ?? 'Default',
    tags: input.tags ?? [],
    notes: input.notes ?? '',
    status: 'ready',
    templateId: template.id,
    os: template.os,
    proxyId: input.proxyId ?? null,
    fingerprint: spec,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    lastLaunchedAt: null,
    device: null,
  };
}

/** Unlimited bulk creation — no artificial caps. */
export function generateProfiles(count: number, base: Omit<CreateProfileInput, 'name'>, prefix = 'Profile'): BrowserProfile[] {
  return Array.from({ length: count }, (_, i) =>
    createProfile({ ...base, name: `${prefix} ${String(i + 1).padStart(3, '0')}`, seed: `${base.seed ?? prefix}::${i}` }, i),
  );
}

export function profileLabel(p: BrowserProfile): string {
  return `${p.fingerprint.uaClientHints.platform} · Chrome ${p.fingerprint.chromeMajor}`;
}
