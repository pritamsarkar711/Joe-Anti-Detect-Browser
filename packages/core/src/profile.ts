import { getTemplate, getRealPreset, templateFromReal, DEVICE_TEMPLATES, type DeviceTemplate, type ScreenSpec, type GpuSpec, type OSType } from './devices';
import type { RealFingerprint } from './data/realFingerprints';
import { offsetForZone } from './geo';
import type { BrowserFamily } from './extensions';

/** Every new profile lands on an independent fingerprint check first. */
export const DEFAULT_START_PAGE = 'https://browserscan.net/';

export type ProfileStatus = 'ready' | 'running' | 'stopped' | 'error';

export interface FingerprintSpec {
  templateId: string;
  /** id of the observed-traffic sample backing this fingerprint */
  realId?: string;
  userAgent: string;
  platform: string;
  oscpu: string;
  vendor: string;
  chromeMajor: number;
  uaClientHints: {
    brands: Array<{ brand: string; version: string }>;
    mobile: boolean;
    platform: string;
    platformVersion: string;
    fullVersion: string;
    secChUa: string;
    secChUaMobile: string;
  };
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
  /** observed-traffic preset applied to this profile, if any */
  realId?: string;
  os: OSType;
  proxyId: string | null;
  fingerprint: FingerprintSpec;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt: string | null;
  device: 'desktop-exe' | 'android-apk' | 'web-dashboard' | null;
  /**
   * Which built-in browser this profile targets. The shells bundle their own
   * engines; nothing is borrowed from the host machine.
   */
  browserFamily: BrowserFamily;
  /** per-profile launch URL, cookie jar and unpacked extension paths */
  startUrl: string;
  cookies: string;
  extensions: string[];
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
  ['America/Toronto', ['en-CA', 'en-US']], ['America/Sao_Paulo', ['pt-BR']], ['America/Mexico_City', ['es-MX']],
  ['Europe/London', ['en-GB']], ['Europe/Dublin', ['en-GB', 'en-IE']],
  ['Europe/Berlin', ['de-DE', 'en-GB']], ['Europe/Paris', ['fr-FR', 'en-GB']], ['Europe/Amsterdam', ['nl-NL', 'en-GB']],
  ['Europe/Madrid', ['es-ES']], ['Europe/Rome', ['it-IT']], ['Europe/Stockholm', ['sv-SE']], ['Europe/Istanbul', ['tr-TR']],
  ['Asia/Dhaka', ['bn-BD', 'en-US']], ['Asia/Kolkata', ['en-IN', 'hi-IN', 'en-US']],
  ['Asia/Singapore', ['en-SG', 'zh-SG', 'en-US']], ['Asia/Dubai', ['ar-AE', 'en-US']],
  ['Asia/Tokyo', ['ja-JP']], ['Asia/Seoul', ['ko-KR']], ['Asia/Hong_Kong', ['zh-HK']],
  ['Australia/Sydney', ['en-AU']], ['Pacific/Auckland', ['en-NZ']],
];

function localeForZone(zone: string, locales: string[], rnd: () => number): string {
  const entry = ZONE_LOCALE.find(([k]) => zone.startsWith(k));
  const compatible = entry ? locales.filter((l) => entry[1].includes(l)) : [];
  const pool = compatible.length ? compatible : locales;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

export interface CreateProfileInput {
  name: string;
  seed?: string;
  templateId?: string;
  /** apply one of the observed-traffic presets directly */
  realPresetId?: string;
  group?: string;
  tags?: string[];
  proxyId?: string | null;
  notes?: string;
  startUrl?: string;
  cookies?: string;
  extensions?: string[];
  browserFamily?: BrowserFamily;
  /** explicit overrides for advanced users */
  overrides?: Partial<Pick<FingerprintSpec, 'timezone' | 'locale' | 'screen' | 'cores' | 'memoryGb' | 'webrtcMode' | 'doNotTrack'>>;
}

function applyBrowserIdentity(
  template: DeviceTemplate,
  family: BrowserFamily,
): {
  userAgent: string;
  vendor: string;
  oscpu: string;
  brands: Array<{ brand: string; version: string }>;
  fullVersion: string;
  major: number;
} {
  const isAppleWebKit = template.os === 'iOS' || template.os === 'iPadOS';
  const major = template.chromeMajor;
  const ver = String(major);

  // iOS / iPadOS always use WebKit/Safari semantics (no Chromium Client Hints, Apple vendor).
  if (isAppleWebKit) {
    const safariMajor = template.osVersion.split('.')[0] || '17';
    return {
      userAgent: template.ua,
      vendor: 'Apple Computer, Inc.',
      oscpu: '',
      brands: [{ brand: 'Safari', version: safariMajor }],
      fullVersion: `${major}.0.0.0`,
      major,
    };
  }

  // Firefox (Gecko) semantics when selected via API/preset.
  if (family === 'firefox') {
    const ffMajor = 135;
    const osToken = template.os === 'Windows'
      ? 'Windows NT 10.0; Win64; x64'
      : template.os === 'macOS'
        ? 'Macintosh; Intel Mac OS X 10.15'
        : template.os === 'Android'
          ? 'Android 14; Mobile'
          : 'X11; Linux x86_64';
    const oscpu = template.os === 'Windows'
      ? 'Windows NT 10.0; Win64; x64'
      : template.os === 'macOS'
        ? 'Intel Mac OS X 10.15'
        : template.os === 'Android'
          ? 'Linux armv8l'
          : 'Linux x86_64';
    return {
      userAgent: `Mozilla/5.0 (${osToken}; rv:${ffMajor}.0) Gecko/20100101 Firefox/${ffMajor}.0`,
      vendor: '',
      oscpu,
      brands: [],
      fullVersion: `${ffMajor}.0`,
      major: ffMajor,
    };
  }

  // Chromium family: never expose oscpu, always report 'Google Inc.' vendor.
  // Normalize UA by stripping any trailing Edg/ or EdgA/ token from another sample.
  const baseUa = template.ua
    .replace(/\s+Chrome\/[\d.]+(\s+Mobile)?\s+Safari\/[\d.]+(?:\s+EdgA?\/[\d.]+)?/i, (_, mob) => ` Chrome/${ver}.0.0.0${mob ?? ''} Safari/537.36`)
    .replace(/\s+EdgA?\/[\d.]+/gi, '');

  if (family === 'edge') {
    const edgeToken = template.os === 'Android' ? `EdgA/${ver}.0.0.0` : `Edg/${ver}.0.0.0`;
    return {
      userAgent: `${baseUa} ${edgeToken}`,
      vendor: 'Google Inc.',
      oscpu: '',
      brands: [
        { brand: 'Not/A)Brand', version: '99' },
        { brand: 'Microsoft Edge', version: ver },
        { brand: 'Chromium', version: ver },
      ],
      fullVersion: `${ver}.0.0.0`,
      major,
    };
  }

  if (family === 'brave') {
    return {
      userAgent: baseUa,
      vendor: 'Google Inc.',
      oscpu: '',
      brands: [
        { brand: 'Not/A)Brand', version: '99' },
        { brand: 'Brave', version: ver },
        { brand: 'Chromium', version: ver },
      ],
      fullVersion: `${ver}.0.0.0`,
      major,
    };
  }

  if (family === 'chromium') {
    return {
      userAgent: baseUa,
      vendor: 'Google Inc.',
      oscpu: '',
      brands: [
        { brand: 'Not/A)Brand', version: '99' },
        { brand: 'Chromium', version: ver },
      ],
      fullVersion: `${ver}.0.0.0`,
      major,
    };
  }

  // 'chrome' or 'joe'
  const brands = template.brands.length && !template.brands.some((b) => /Edge/i.test(b.brand))
    ? template.brands.map((b) => (/^Not/i.test(b.brand) ? b : { ...b, version: ver }))
    : [
        { brand: 'Not/A)Brand', version: '99' },
        { brand: 'Google Chrome', version: ver },
        { brand: 'Chromium', version: ver },
      ];

  return {
    userAgent: baseUa,
    vendor: 'Google Inc.',
    oscpu: '',
    brands,
    fullVersion: `${ver}.0.0.0`,
    major,
  };
}

function buildSpec(template: DeviceTemplate, input: CreateProfileInput, h: number, rnd: () => number): FingerprintSpec {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length) % arr.length];
  const screen = input.overrides?.screen ?? pick(template.screens);
  const timezone = input.overrides?.timezone ?? pick(template.timezones);
  const locale = input.overrides?.locale ?? localeForZone(timezone, template.locales, rnd);
  const gpu = pick(template.gpus);
  /**
   * CPU and RAM are drawn as one pair. An override of either field keeps the
   * other from the same coherent pair when possible, so a user who raises RAM
   * does not silently keep a 4-core count that never shipped with 32 GB.
   */
  const pair = pick(template.hardware);
  const cores = input.overrides?.cores ?? pair.cores;
  const memoryGb = input.overrides?.memoryGb ?? pair.memoryGb;
  const mobile = template.mobile;
  const family: BrowserFamily = input.browserFamily ?? 'joe';
  const idSpec = applyBrowserIdentity(template, family);
  const chromeMajor = idSpec.major;
  const brands = idSpec.brands;
  const secChUa = brands.length && template.os !== 'iOS' && template.os !== 'iPadOS'
    ? brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ')
    : '';
  const fullVersion = family === 'chrome' || family === 'joe' || family === 'edge' || family === 'brave' || family === 'chromium'
    ? `${chromeMajor}.0.${6778 + (h % 40)}.${(h >>> 8) % 200}`
    : idSpec.fullVersion;

  return {
    templateId: template.id,
    realId: template.realId,
    userAgent: idSpec.userAgent,
    platform: template.platform,
    oscpu: idSpec.oscpu,
    vendor: idSpec.vendor,
    chromeMajor,
    uaClientHints: {
      brands,
      mobile,
      platform: template.secChUaPlatform || template.os,
      platformVersion: template.os === 'Windows' ? '15.0.0' : template.os === 'macOS' ? '14.6.0' : template.os === 'Android' ? '14.0.0' : template.os === 'iOS' || template.os === 'iPadOS' ? template.osVersion : '6.8.0',
      fullVersion,
      secChUa,
      secChUaMobile: mobile ? '?1' : '?0',
    },
    screen,
    availScreen: { ...screen, height: screen.height - (mobile ? 24 : 80) },
    innerSize: { width: screen.width, height: screen.height - (mobile ? 48 : 140) },
    cores,
    memoryGb,
    touchPoints: template.touchPoints,
    gpu,
    fonts: template.fonts,
    timezone,
    timezoneOffset: offsetForZone(timezone),
    locale,
    languages: [locale, ...template.languages.filter((l) => l !== locale)],
    gl: template.gl,
    webglVendor: gpu.vendor,
    webglRenderer: gpu.renderer,
    canvasNoise: 0.0008 + rnd() * 0.0016,
    audioNoise: 0.00002 + rnd() * 0.00004,
    webrtcMode: input.overrides?.webrtcMode ?? 'replace',
    webrtcPublicIp: '',
    mediaDevices: { audioinput: mobile ? 2 : 1, audiooutput: mobile ? 2 : 1, videoinput: mobile ? 2 : 1 },
    doNotTrack: input.overrides?.doNotTrack ?? null,
    noiseSeed: h,
  };
}

export function createProfile(input: CreateProfileInput, index = 0): BrowserProfile {
  const seedText = input.seed ?? `${input.name}::${index}::joe-browser`;
  const h = hashString(seedText);
  const rnd = seeded(h);
  const real = input.realPresetId ? getRealPreset(input.realPresetId) : undefined;
  const template = real ? templateFromReal(real) : getTemplate(input.templateId ?? DEVICE_TEMPLATES[h % DEVICE_TEMPLATES.length].id);
  const now = new Date(Date.now() - index * 1000).toISOString();
  return {
    id: `prf_${h.toString(36)}${index.toString(36)}`,
    name: input.name,
    group: input.group ?? 'Default',
    tags: input.tags ?? [],
    notes: input.notes ?? '',
    status: 'ready',
    templateId: template.id,
    realId: template.realId,
    os: template.os,
    proxyId: input.proxyId ?? null,
    fingerprint: buildSpec(template, input, h, rnd),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    lastLaunchedAt: null,
    device: null,
    browserFamily: input.browserFamily ?? 'joe',
    startUrl: input.startUrl ?? DEFAULT_START_PAGE,
    cookies: input.cookies ?? '',
    extensions: input.extensions ?? [],
  };
}

/** Apply an observed-device preset to an existing profile, keeping its identity. */
export function applyRealPreset(profile: BrowserProfile, real: RealFingerprint): BrowserProfile {
  const template = templateFromReal(real);
  const h = hashString(`${profile.id}::${real.id}`);
  const rnd = seeded(h);
  const spec = buildSpec(template, {
    name: profile.name,
    browserFamily: profile.browserFamily,
    overrides: { timezone: profile.fingerprint.timezone, locale: profile.fingerprint.locale },
  }, h, rnd);
  return {
    ...profile,
    templateId: template.id,
    realId: real.id,
    os: template.os,
    fingerprint: spec,
    revision: profile.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** Re-derive fingerprint specs when changing browserFamily or device template on an existing profile. */
export function rebuildProfileFingerprint(
  profile: BrowserProfile,
  opts: { templateId?: string; browserFamily?: BrowserFamily } = {},
): BrowserProfile {
  const family = opts.browserFamily ?? profile.browserFamily;
  const template = getTemplate(opts.templateId ?? profile.templateId);
  const h = profile.fingerprint.noiseSeed || hashString(profile.id);
  const rnd = seeded(h);
  const spec = buildSpec(template, {
    name: profile.name,
    browserFamily: family,
    overrides: {
      timezone: profile.fingerprint.timezone,
      locale: profile.fingerprint.locale,
      webrtcMode: profile.fingerprint.webrtcMode,
      doNotTrack: profile.fingerprint.doNotTrack,
    },
  }, h, rnd);
  spec.webrtcPublicIp = profile.fingerprint.webrtcPublicIp;
  return {
    ...profile,
    templateId: template.id,
    realId: template.realId,
    os: template.os,
    browserFamily: family,
    fingerprint: spec,
    revision: profile.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** Unlimited bulk creation — no artificial caps. */
export function generateProfiles(count: number, base: Omit<CreateProfileInput, 'name'>, prefix = 'Profile'): BrowserProfile[] {
  return Array.from({ length: count }, (_, i) =>
    createProfile({ ...base, name: `${prefix} ${String(i + 1).padStart(3, '0')}`, seed: `${base.seed ?? prefix}::${i}` }, i),
  );
}

export function profileBrowserLabel(p: BrowserProfile): string {
  if (p.os === 'iOS' || p.os === 'iPadOS') return `Safari ${p.fingerprint.uaClientHints.brands[0]?.version ?? '17'}`;
  if (p.browserFamily === 'edge') return `Edge ${p.fingerprint.chromeMajor}`;
  if (p.browserFamily === 'brave') return `Brave ${p.fingerprint.chromeMajor}`;
  if (p.browserFamily === 'chromium') return `Chromium ${p.fingerprint.chromeMajor}`;
  if (p.browserFamily === 'firefox') return `Firefox ${p.fingerprint.chromeMajor}`;
  return `Chrome ${p.fingerprint.chromeMajor}`;
}

export function profileLabel(p: BrowserProfile): string {
  return `${p.fingerprint.uaClientHints.platform} · ${profileBrowserLabel(p)}`;
}
