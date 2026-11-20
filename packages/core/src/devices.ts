/**
 * Coherent device templates backed by observed browser traffic.
 *
 * Research takeaway from Camoufox, ShardBrowser, Donut Browser and the Apify
 * fingerprint-suite: never combine random values. A "Windows UA + Apple GPU +
 * mobile screen + US locale + Dhaka timezone" profile is *more* detectable than
 * no spoofing at all, because detectors hash the whole fingerprint and compare
 * it against real-device corpora.
 *
 * Every template below is enriched from ONE real sample drawn from the
 * Apify / BrowserForge Bayesian network of observed traffic (Apache-2.0).
 * User agent, Client Hints, GPU renderer, screen, CPU, memory and font list
 * therefore come from the same device class. Variation is applied only inside
 * fields that genuinely vary for that class.
 */
import { REAL_FINGERPRINTS, FINGERPRINT_DATA_SOURCE, type RealFingerprint } from './data/realFingerprints';

export type OSType = 'Windows' | 'macOS' | 'Android' | 'Linux' | 'iOS' | 'iPadOS';

export interface ScreenSpec { width: number; height: number; dpr: number }
export interface GpuSpec { vendor: string; renderer: string; unmaskedVendor: string; unmaskedRenderer: string }

export interface DeviceTemplate {
  id: string;
  label: string;
  os: OSType;
  osVersion: string;
  chromeMajor: number;
  mobile: boolean;
  touchPoints: number;
  ua: string;
  platform: string;
  screens: ScreenSpec[];
  /**
   * Hardware is stored as ordered pairs, not two independent lists.
   *
   * A CPU core count and a RAM size are not free variables: a 4 GB machine with
   * 20 cores is not a machine anyone ships. Keeping the pair intact is what
   * stops the generator from reporting "12 cores · 8 GB" for an observed
   * device that really had 12 cores and 32 GB.
   */
  hardware: Array<{ cores: number; memoryGb: number }>;
  gpus: GpuSpec[];
  fonts: string[];
  timezones: string[];
  locales: string[];
  languages: string[];
  brands: Array<{ brand: string; version: string }>;
  secChUaPlatform: string;
  gl: { maxTextureSize: number; maxRenderbufferSize: number; maxViewport: [number, number]; maxVertexAttribs: number };
  /** provenance: id of the observed-traffic sample this template derives from */
  /**
   * Provenance. 'observed' = derived from one real traffic sample; 'curated' =
   * hand-written class for a family we have no sample for yet (Apple/WebKit),
   * which is stated in the UI rather than passed off as observed.
   */
  source: 'observed' | 'curated';
  realId?: string;
  realLabel?: string;
}

const WIN_FONTS = ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia', 'Microsoft YaHei', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana'];
const MAC_FONTS = ['Arial', 'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'SF Pro Display', 'Times', 'Verdana'];
const ANDROID_FONTS = ['Roboto', 'Noto Sans', 'Noto Sans Bengali', 'Droid Sans', 'Droid Serif', 'Arial', 'Georgia'];
const LINUX_FONTS = ['Arial', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Noto Sans', 'Ubuntu', 'Verdana'];

const GL_DESKTOP = { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [32767, 32767] as [number, number], maxVertexAttribs: 16 };
const GL_MOBILE = { maxTextureSize: 8192, maxRenderbufferSize: 8192, maxViewport: [8192, 8192] as [number, number], maxVertexAttribs: 16 };

const IOS_FONTS = ['Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro Text', 'Times', 'Verdana'];

function fallbackFonts(os: OSType): string[] {
  if (os === 'Windows') return WIN_FONTS;
  if (os === 'macOS') return MAC_FONTS;
  if (os === 'Android') return ANDROID_FONTS;
  if (os === 'iOS' || os === 'iPadOS') return IOS_FONTS;
  return LINUX_FONTS;
}

function gpuFromReal(r: RealFingerprint): GpuSpec {
  const vendor = r.gpu.vendor || 'Google Inc.';
  const renderer = r.gpu.renderer || 'WebKit WebGL';
  return { vendor, renderer, unmaskedVendor: vendor, unmaskedRenderer: renderer };
}

/** Build a coherent template directly from one observed-traffic sample. */
export function templateFromReal(r: RealFingerprint): DeviceTemplate {
  const os = r.os;
  return {
    id: r.id,
    label: r.label,
    os,
    osVersion: os === 'Windows' ? '10.0 (11)' : os === 'macOS' ? '14.6' : os === 'Android' ? '14' : '6.8',
    chromeMajor: r.chromeMajor,
    mobile: r.mobile,
    touchPoints: r.touchPoints,
    ua: r.userAgent,
    platform: r.platform || (os === 'Windows' ? 'Win32' : os === 'macOS' ? 'MacIntel' : os === 'Android' ? 'Linux armv8l' : 'Linux x86_64'),
    screens: [r.screen],
    hardware: [{ cores: r.cores, memoryGb: r.memoryGb }],
    gpus: [gpuFromReal(r)],
    fonts: r.fonts.length >= 3 ? r.fonts : fallbackFonts(os),
    timezones: os === 'Windows' ? ['America/New_York', 'America/Chicago', 'Europe/London'] : os === 'macOS' ? ['America/Los_Angeles', 'Europe/London'] : os === 'Android' ? ['Asia/Dhaka', 'Asia/Singapore', 'Europe/Berlin'] : ['Europe/Berlin', 'Europe/London'],
    locales: [r.locale, 'en-US', 'en-GB'],
    languages: r.languages.length ? r.languages : [r.locale, 'en'],
    brands: r.brands,
    secChUaPlatform: r.secChUaPlatform || (os === 'Windows' ? 'Windows' : os === 'macOS' ? 'macOS' : os === 'Android' ? 'Android' : 'Linux'),
    gl: r.mobile ? GL_MOBILE : GL_DESKTOP,
    source: 'observed',
    realId: r.id,
    realLabel: r.label,
  };
}

/** Stable hand-curated device classes; each is enriched with a real sample below. */
/**
 * A curated class may declare its own UA / brands (needed for WebKit families:
 * iPhone and iPad are Safari-shaped and must never inherit Chrome hints).
 */
interface Curated extends Omit<DeviceTemplate, 'brands' | 'secChUaPlatform' | 'realId' | 'realLabel' | 'source'> {
  /** WebKit families (iPhone/iPad) must declare their own UA and brand list. */
  brands?: Array<{ brand: string; version: string }>;
  secChUaPlatform?: string;
  match: (r: RealFingerprint) => boolean;
}

const CURATED: Curated[] = [
  {
    id: 'win11-intel', label: 'Windows 11 · Intel', os: 'Windows', osVersion: '10.0 (11)', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Win32',
    screens: [{ width: 1920, height: 1080, dpr: 1 }], hardware: [{ cores: 8, memoryGb: 16 }, { cores: 12, memoryGb: 16 }, { cores: 16, memoryGb: 32 }], gpus: [],
    fonts: WIN_FONTS, timezones: ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Windows' && /intel|uhd|iris/i.test(r.gpu.renderer),
  },
  {
    id: 'win11-nvidia', label: 'Windows 11 · NVIDIA', os: 'Windows', osVersion: '10.0 (11)', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Win32',
    screens: [{ width: 1920, height: 1080, dpr: 1 }], hardware: [{ cores: 12, memoryGb: 32 }, { cores: 16, memoryGb: 32 }, { cores: 12, memoryGb: 16 }], gpus: [],
    fonts: WIN_FONTS, timezones: ['Europe/Berlin', 'Europe/Paris', 'Europe/Amsterdam'],
    locales: ['de-DE', 'fr-FR', 'en-GB'], languages: ['de-DE', 'de', 'en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Windows' && /nvidia|geforce|rtx/i.test(r.gpu.renderer),
  },
  {
    id: 'win10-amd', label: 'Windows 10 · AMD', os: 'Windows', osVersion: '10.0', chromeMajor: 155,
    mobile: false, touchPoints: 0, ua: '', platform: 'Win32',
    screens: [{ width: 1366, height: 768, dpr: 1 }], hardware: [{ cores: 4, memoryGb: 8 }, { cores: 8, memoryGb: 16 }, { cores: 6, memoryGb: 8 }], gpus: [],
    fonts: WIN_FONTS, timezones: ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore'],
    locales: ['bn-BD', 'en-US', 'en-SG'], languages: ['en-US', 'en', 'bn-BD'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Windows' && /amd|radeon/i.test(r.gpu.renderer),
  },
  {
    id: 'win11-amd-ryzen', label: 'Windows 11 · Ryzen', os: 'Windows', osVersion: '10.0 (11)', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Win32',
    screens: [{ width: 2560, height: 1440, dpr: 1 }], hardware: [{ cores: 12, memoryGb: 32 }, { cores: 8, memoryGb: 16 }], gpus: [],
    fonts: WIN_FONTS, timezones: ['America/New_York', 'Europe/London', 'Europe/Berlin'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Windows' && /amd|radeon/i.test(r.gpu.renderer),
  },
  {
    id: 'mac-sonoma-m1', label: 'macOS Sonoma · M1', os: 'macOS', osVersion: '14.6', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'MacIntel',
    screens: [{ width: 1440, height: 900, dpr: 2 }], hardware: [{ cores: 8, memoryGb: 16 }, { cores: 10, memoryGb: 16 }, { cores: 8, memoryGb: 8 }], gpus: [],
    fonts: MAC_FONTS, timezones: ['America/Los_Angeles', 'America/New_York'],
    locales: ['en-US'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'macOS' && /metal|apple m/i.test(r.gpu.renderer),
  },
  {
    id: 'mac-sequoia-m3', label: 'macOS Sequoia · M3', os: 'macOS', osVersion: '15.2', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'MacIntel',
    screens: [{ width: 1728, height: 1117, dpr: 2 }], hardware: [{ cores: 10, memoryGb: 16 }, { cores: 12, memoryGb: 32 }], gpus: [],
    fonts: MAC_FONTS, timezones: ['America/Los_Angeles', 'Europe/London'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'macOS' && /metal|apple m/i.test(r.gpu.renderer),
  },
  {
    id: 'mac-ventura-intel', label: 'macOS Ventura · Intel', os: 'macOS', osVersion: '13.5', chromeMajor: 152,
    mobile: false, touchPoints: 0, ua: '', platform: 'MacIntel',
    screens: [{ width: 1920, height: 1080, dpr: 2 }], hardware: [{ cores: 8, memoryGb: 16 }, { cores: 12, memoryGb: 32 }, { cores: 14, memoryGb: 32 }], gpus: [],
    fonts: MAC_FONTS, timezones: ['Europe/London', 'Europe/Dublin'],
    locales: ['en-GB'], languages: ['en-GB', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'macOS',
  },
  {
    id: 'android-pixel8', label: 'Android 14 · Pixel 8', os: 'Android', osVersion: '14', chromeMajor: 156,
    mobile: true, touchPoints: 5, ua: '', platform: 'Linux armv8l',
    screens: [{ width: 412, height: 915, dpr: 2.625 }], hardware: [{ cores: 8, memoryGb: 8 }, { cores: 8, memoryGb: 4 }], gpus: [],
    fonts: ANDROID_FONTS, timezones: ['Asia/Dhaka', 'Asia/Kolkata', 'Europe/London', 'America/New_York'],
    locales: ['bn-BD', 'en-GB', 'en-US'], languages: ['en-US', 'en', 'bn-BD'], gl: GL_MOBILE,
    match: (r) => r.os === 'Android' && /pixel/i.test(r.label),
  },
  {
    id: 'android-samsung-s23', label: 'Android 14 · Galaxy S23', os: 'Android', osVersion: '14', chromeMajor: 155,
    mobile: true, touchPoints: 5, ua: '', platform: 'Linux aarch64',
    screens: [{ width: 360, height: 780, dpr: 3 }], hardware: [{ cores: 8, memoryGb: 8 }, { cores: 8, memoryGb: 12 }], gpus: [],
    fonts: ANDROID_FONTS, timezones: ['Asia/Dubai', 'Asia/Singapore', 'Europe/Berlin'],
    locales: ['en-SG', 'de-DE', 'ar-AE'], languages: ['en-SG', 'en', 'de-DE'], gl: GL_MOBILE,
    match: (r) => r.os === 'Android' && /galaxy/i.test(r.label),
  },
  {
    id: 'android-oneplus-12', label: 'Android 14 · OnePlus 12', os: 'Android', osVersion: '14', chromeMajor: 156,
    mobile: true, touchPoints: 5, ua: '', platform: 'Linux aarch64',
    screens: [{ width: 412, height: 919, dpr: 3 }], hardware: [{ cores: 8, memoryGb: 12 }, { cores: 8, memoryGb: 16 }], gpus: [],
    fonts: ANDROID_FONTS, timezones: ['Asia/Kolkata', 'America/New_York', 'Europe/London'],
    locales: ['en-US', 'en-IN', 'en-GB'], languages: ['en-US', 'en'], gl: GL_MOBILE,
    match: (r) => r.os === 'Android' && r.mobile,
  },
  {
    id: 'android-xiaomi-14', label: 'Android 14 · Xiaomi 14', os: 'Android', osVersion: '14', chromeMajor: 155,
    mobile: true, touchPoints: 5, ua: '', platform: 'Linux aarch64',
    screens: [{ width: 393, height: 873, dpr: 3 }], hardware: [{ cores: 8, memoryGb: 12 }, { cores: 8, memoryGb: 8 }], gpus: [],
    fonts: ANDROID_FONTS, timezones: ['Asia/Singapore', 'Europe/Berlin', 'Asia/Dhaka'],
    locales: ['en-SG', 'de-DE', 'en-US'], languages: ['en-US', 'en'], gl: GL_MOBILE,
    match: (r) => r.os === 'Android' && r.mobile,
  },
  {
    id: 'android-tablet-tab-s9', label: 'Android 14 · Galaxy Tab S9', os: 'Android', osVersion: '14', chromeMajor: 156,
    mobile: true, touchPoints: 5, ua: '', platform: 'Linux aarch64',
    screens: [{ width: 800, height: 1280, dpr: 2 }, { width: 1280, height: 800, dpr: 2 }],
    hardware: [{ cores: 8, memoryGb: 8 }, { cores: 8, memoryGb: 12 }], gpus: [],
    fonts: ANDROID_FONTS, timezones: ['Asia/Singapore', 'Europe/Berlin', 'America/New_York'],
    locales: ['en-GB', 'en-US'], languages: ['en-GB', 'en'], gl: GL_MOBILE,
    match: (r) => r.os === 'Android' && r.mobile && r.screen.width > 700,
  },
  {
    id: 'iphone-15-pro', label: 'iPhone 15 Pro · iOS 17', os: 'iOS', osVersion: '17.5',
    chromeMajor: 156, mobile: true, touchPoints: 5,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    screens: [{ width: 393, height: 852, dpr: 3 }, { width: 390, height: 844, dpr: 3 }],
    hardware: [{ cores: 6, memoryGb: 6 }],
    fonts: ['Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro Text', 'Times', 'Verdana'],
    timezones: ['America/New_York', 'Europe/London', 'Asia/Dhaka'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_MOBILE,
    brands: [{ brand: 'Safari', version: '17' }], secChUaPlatform: 'iOS',
    gpus: [{ vendor: 'Apple Inc.', renderer: 'Apple GPU', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple GPU' }],
    match: () => false,
  },
  {
    id: 'iphone-16-pro', label: 'iPhone 16 Pro · iOS 18', os: 'iOS', osVersion: '18.2',
    chromeMajor: 156, mobile: true, touchPoints: 5,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    screens: [{ width: 402, height: 874, dpr: 3 }],
    hardware: [{ cores: 6, memoryGb: 8 }],
    fonts: ['Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro Text', 'Times', 'Verdana'],
    timezones: ['America/New_York', 'America/Los_Angeles', 'Europe/London'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_MOBILE,
    brands: [{ brand: 'Safari', version: '18' }], secChUaPlatform: 'iOS',
    gpus: [{ vendor: 'Apple Inc.', renderer: 'Apple GPU', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple GPU' }],
    match: () => false,
  },
  {
    id: 'ipad-pro-11', label: 'iPad Pro 11 · iPadOS 17', os: 'iPadOS', osVersion: '17.5',
    chromeMajor: 156, mobile: true, touchPoints: 5,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPad',
    screens: [{ width: 834, height: 1194, dpr: 2 }, { width: 820, height: 1180, dpr: 2 }],
    hardware: [{ cores: 8, memoryGb: 8 }],
    fonts: ['Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro Text', 'Times', 'Verdana'],
    timezones: ['Europe/London', 'America/Chicago', 'Asia/Singapore'],
    locales: ['en-GB', 'en-US'], languages: ['en-GB', 'en'], gl: GL_MOBILE,
    brands: [{ brand: 'Safari', version: '17' }], secChUaPlatform: 'iPadOS',
    gpus: [{ vendor: 'Apple Inc.', renderer: 'Apple GPU', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple GPU' }],
    match: () => false,
  },
  {
    id: 'ipad-air-m2', label: 'iPad Air M2 · iPadOS 18', os: 'iPadOS', osVersion: '18.2',
    chromeMajor: 156, mobile: true, touchPoints: 5,
    ua: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    platform: 'iPad',
    screens: [{ width: 820, height: 1180, dpr: 2 }],
    hardware: [{ cores: 8, memoryGb: 8 }],
    fonts: ['Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro Text', 'Times', 'Verdana'],
    timezones: ['America/New_York', 'Europe/London'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_MOBILE,
    brands: [{ brand: 'Safari', version: '18' }], secChUaPlatform: 'iPadOS',
    gpus: [{ vendor: 'Apple Inc.', renderer: 'Apple GPU', unmaskedVendor: 'Apple Inc.', unmaskedRenderer: 'Apple GPU' }],
    match: () => false,
  },
  {
    id: 'linux-ubuntu', label: 'Linux · Ubuntu 24.04', os: 'Linux', osVersion: '6.8', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Linux x86_64',
    screens: [{ width: 1920, height: 1080, dpr: 1 }], hardware: [{ cores: 8, memoryGb: 16 }, { cores: 16, memoryGb: 32 }, { cores: 8, memoryGb: 8 }], gpus: [],
    fonts: LINUX_FONTS, timezones: ['Europe/Berlin', 'Europe/London', 'Asia/Kolkata'],
    locales: ['en-GB', 'de-DE'], languages: ['en-GB', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Linux',
  },
  {
    id: 'linux-fedora', label: 'Linux · Fedora 40', os: 'Linux', osVersion: '6.9', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Linux x86_64',
    screens: [{ width: 1920, height: 1080, dpr: 1 }, { width: 2560, height: 1440, dpr: 1 }], hardware: [{ cores: 8, memoryGb: 16 }, { cores: 16, memoryGb: 32 }], gpus: [],
    fonts: LINUX_FONTS, timezones: ['America/New_York', 'Europe/Berlin', 'Europe/London'],
    locales: ['en-US', 'en-GB'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Linux',
  },
  {
    id: 'linux-debian', label: 'Linux · Debian 12', os: 'Linux', osVersion: '6.1', chromeMajor: 155,
    mobile: false, touchPoints: 0, ua: '', platform: 'Linux x86_64',
    screens: [{ width: 1920, height: 1080, dpr: 1 }], hardware: [{ cores: 4, memoryGb: 8 }, { cores: 8, memoryGb: 16 }], gpus: [],
    fonts: LINUX_FONTS, timezones: ['Europe/London', 'Europe/Paris', 'America/Chicago'],
    locales: ['en-GB', 'fr-FR', 'en-US'], languages: ['en-GB', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Linux',
  },
  {
    id: 'linux-arch', label: 'Linux · Arch Rolling', os: 'Linux', osVersion: '6.11', chromeMajor: 156,
    mobile: false, touchPoints: 0, ua: '', platform: 'Linux x86_64',
    screens: [{ width: 2560, height: 1440, dpr: 1 }, { width: 1920, height: 1080, dpr: 1 }], hardware: [{ cores: 16, memoryGb: 32 }, { cores: 12, memoryGb: 16 }], gpus: [],
    fonts: LINUX_FONTS, timezones: ['Europe/Berlin', 'America/Los_Angeles'],
    locales: ['en-US', 'de-DE'], languages: ['en-US', 'en'], gl: GL_DESKTOP,
    match: (r) => r.os === 'Linux',
  },
];

/** Apple-silicon / A-series GPU pair, used by WebKit classes with no sample. */
const APPLE_GPU: GpuSpec = {
  vendor: 'Apple Inc.',
  renderer: 'Apple GPU',
  unmaskedVendor: 'Apple Inc.',
  unmaskedRenderer: 'Apple GPU',
};

function enrich(c: Curated): DeviceTemplate {
  /**
   * A template that declares its own UA and brands is self-contained. Grafting
   * a Chromium sample onto it is exactly the bug that makes an iPhone report an
   * Adreno GPU and Chrome client hints at the same time, so this branch never
   * looks at REAL_FINGERPRINTS.
   */
  const declared = (c.brands?.length ?? 0) > 0 && c.ua !== '';
  if (declared) {
    return {
      ...c,
      brands: c.brands as DeviceTemplate['brands'],
      secChUaPlatform: c.secChUaPlatform ?? c.os,
      gpus: c.gpus.length ? c.gpus : [APPLE_GPU],
      fonts: c.fonts.length ? c.fonts : fallbackFonts(c.os),
      source: 'curated',
    };
  }

  const byMatch = REAL_FINGERPRINTS.find(c.match);
  const sameOs = REAL_FINGERPRINTS.find((r) => r.os === c.os && r.mobile === c.mobile);
  const real = byMatch ?? sameOs;
  if (!real) {
    return {
      ...c, source: 'curated', brands: [],
      secChUaPlatform: c.secChUaPlatform ?? (c.os === 'Windows' ? 'Windows' : c.os),
      gpus: c.gpus.length ? c.gpus : [APPLE_GPU],
    };
  }
  const g = gpuFromReal(real);
  const fonts = real.fonts.length >= 3 ? real.fonts : c.fonts;
  const screens = [{ ...real.screen }, ...c.screens.filter((s) => s.width !== real.screen.width || s.height !== real.screen.height)];
  return {
    ...c,
    chromeMajor: real.chromeMajor,
    ua: real.userAgent,
    platform: real.platform || c.platform,
    screens,
    // The observed pair comes first and is never split apart; extra curated
    // pairs are appended for variation inside the same class.
    hardware: [
      { cores: real.cores, memoryGb: real.memoryGb },
      ...c.hardware.filter((p) => p.cores !== real.cores || p.memoryGb !== real.memoryGb),
    ],
    gpus: [g],
    fonts,
    brands: real.brands,
    secChUaPlatform: real.secChUaPlatform || c.os,
    source: 'observed',
    realId: real.id,
    realLabel: real.label,
  };
}

export const DEVICE_TEMPLATES: DeviceTemplate[] = CURATED.map(enrich);

/** Observed-device presets, grouped by OS, with provenance. */
export const REAL_DEVICE_PRESETS: RealFingerprint[] = REAL_FINGERPRINTS;
export { FINGERPRINT_DATA_SOURCE };

export function getTemplate(id: string): DeviceTemplate {
  const curated = DEVICE_TEMPLATES.find((t) => t.id === id);
  if (curated) return curated;
  const real = REAL_FINGERPRINTS.find((r) => r.id === id);
  if (real) return templateFromReal(real);
  return DEVICE_TEMPLATES[0];
}

export function getRealPreset(id: string): RealFingerprint | undefined {
  return REAL_FINGERPRINTS.find((r) => r.id === id);
}

export const TEMPLATE_GROUPS: Array<{ os: OSType; items: DeviceTemplate[] }> = (
  ['Windows', 'macOS', 'Android', 'iOS', 'iPadOS', 'Linux'] as OSType[]
).map((os) => ({
  os,
  items: DEVICE_TEMPLATES.filter((t) => t.os === os),
}));
