/**
 * Coherent device templates.
 *
 * Research takeaway from Camoufox / ShardBrowser: never combine random values.
 * A "Windows UA + Apple GPU + mobile screen + US locale + Dhaka timezone"
 * profile is *more* detectable than no spoofing at all, because modern engines
 * hash the whole fingerprint and compare it to real-device datasets.
 *
 * Every template below is an internally consistent device class. Variation is
 * applied only within the fields that genuinely vary for that device class.
 */

export type OSType = 'Windows' | 'macOS' | 'Android' | 'Linux';

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
  cores: number[];
  memoryGb: number[];
  gpus: GpuSpec[];
  fonts: string[];
  timezones: string[];
  locales: string[];
  languages: string[];
  gl: { maxTextureSize: number; maxRenderbufferSize: number; maxViewport: [number, number]; maxVertexAttribs: number };
}

const WIN_FONTS = ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia', 'Microsoft YaHei', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana'];
const MAC_FONTS = ['Arial', 'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'SF Pro Display', 'Times', 'Verdana'];
const ANDROID_FONTS = ['Roboto', 'Noto Sans', 'Noto Sans Bengali', 'Droid Sans', 'Droid Serif', 'Arial', 'Georgia'];
const LINUX_FONTS = ['Arial', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Noto Sans', 'Ubuntu', 'Verdana'];

function winUA(major: number, build: number): string {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.0 Safari/537.36`;
}
function macUA(major: number, build: number): string {
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.0 Safari/537.36`;
}
function androidUA(major: number, build: number, device: string): string {
  return `Mozilla/5.0 (Linux; Android 14; ${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.0 Mobile Safari/537.36`;
}
function linuxUA(major: number, build: number): string {
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.0 Safari/537.36`;
}

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  {
    id: 'win11-intel', label: 'Windows 11 · Intel', os: 'Windows', osVersion: '10.0 (11)', chromeMajor: 131,
    mobile: false, touchPoints: 0, ua: winUA(131, 6778), platform: 'Win32',
    screens: [{ width: 1920, height: 1080, dpr: 1 }, { width: 2560, height: 1440, dpr: 1 }, { width: 1366, height: 768, dpr: 1 }],
    cores: [4, 8, 12, 16], memoryGb: [8, 16, 32],
    gpus: [{ vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Google Inc. (Intel)', unmaskedRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)' }],
    fonts: WIN_FONTS, timezones: ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'], locales: ['en-US'], languages: ['en-US', 'en'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [32767, 32767], maxVertexAttribs: 16 },
  },
  {
    id: 'win11-nvidia', label: 'Windows 11 · NVIDIA', os: 'Windows', osVersion: '10.0 (11)', chromeMajor: 131,
    mobile: false, touchPoints: 0, ua: winUA(131, 6778), platform: 'Win32',
    screens: [{ width: 1920, height: 1080, dpr: 1 }, { width: 2560, height: 1440, dpr: 1 }, { width: 3440, height: 1440, dpr: 1 }],
    cores: [8, 12, 16, 24], memoryGb: [16, 32, 64],
    gpus: [{ vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Google Inc. (NVIDIA)', unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' }],
    fonts: WIN_FONTS, timezones: ['Europe/Berlin', 'Europe/Paris', 'Europe/Amsterdam'], locales: ['de-DE', 'fr-FR', 'en-GB'], languages: ['de-DE', 'de', 'en-US', 'en'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [32767, 32767], maxVertexAttribs: 16 },
  },
  {
    id: 'win10-amd', label: 'Windows 10 · AMD', os: 'Windows', osVersion: '10.0', chromeMajor: 130,
    mobile: false, touchPoints: 0, ua: winUA(130, 6723), platform: 'Win32',
    screens: [{ width: 1366, height: 768, dpr: 1 }, { width: 1920, height: 1080, dpr: 1 }, { width: 1600, height: 900, dpr: 1 }],
    cores: [4, 6, 8], memoryGb: [8, 16],
    gpus: [{ vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Google Inc. (AMD)', unmaskedRenderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }],
    fonts: WIN_FONTS, timezones: ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore'], locales: ['bn-BD', 'en-US', 'en-SG'], languages: ['en-US', 'en', 'bn-BD'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [16384, 16384], maxVertexAttribs: 16 },
  },
  {
    id: 'mac-sonoma-m1', label: 'macOS Sonoma · M1', os: 'macOS', osVersion: '14.6', chromeMajor: 131,
    mobile: false, touchPoints: 0, ua: macUA(131, 6778), platform: 'MacIntel',
    screens: [{ width: 1440, height: 900, dpr: 2 }, { width: 1728, height: 1117, dpr: 2 }, { width: 1512, height: 982, dpr: 2 }],
    cores: [8, 10], memoryGb: [8, 16],
    gpus: [{ vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' }],
    fonts: MAC_FONTS, timezones: ['America/Los_Angeles', 'America/New_York'], locales: ['en-US'], languages: ['en-US', 'en'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [16384, 16384], maxVertexAttribs: 16 },
  },
  {
    id: 'mac-ventura-intel', label: 'macOS Ventura · Intel', os: 'macOS', osVersion: '13.5', chromeMajor: 129,
    mobile: false, touchPoints: 0, ua: macUA(129, 6668), platform: 'MacIntel',
    screens: [{ width: 1920, height: 1080, dpr: 2 }, { width: 2560, height: 1440, dpr: 2 }],
    cores: [4, 8], memoryGb: [16, 32],
    gpus: [{ vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris Plus Graphics 645, OpenGL 4.1)', unmaskedVendor: 'Google Inc. (Intel)', unmaskedRenderer: 'ANGLE (Intel, Intel(R) Iris Plus Graphics 645, OpenGL 4.1)' }],
    fonts: MAC_FONTS, timezones: ['Europe/London', 'Europe/Dublin'], locales: ['en-GB'], languages: ['en-GB', 'en'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [16384, 16384], maxVertexAttribs: 16 },
  },
  {
    id: 'android-pixel8', label: 'Android 14 · Pixel 8', os: 'Android', osVersion: '14', chromeMajor: 131,
    mobile: true, touchPoints: 5, ua: androidUA(131, 6778, 'Pixel 8'), platform: 'Linux armv8l',
    screens: [{ width: 412, height: 915, dpr: 2.625 }, { width: 412, height: 892, dpr: 2.625 }],
    cores: [8], memoryGb: [8],
    gpus: [{ vendor: 'Google Inc. (Google)', renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', unmaskedVendor: 'Google Inc. (Google)', unmaskedRenderer: 'ANGLE (Google, Mali-G715, OpenGL ES 3.2)' }],
    fonts: ANDROID_FONTS, timezones: ['Asia/Dhaka', 'Asia/Kolkata', 'Europe/London', 'America/New_York'], locales: ['bn-BD', 'en-GB', 'en-US'], languages: ['en-US', 'en', 'bn-BD'],
    gl: { maxTextureSize: 8192, maxRenderbufferSize: 8192, maxViewport: [8192, 8192], maxVertexAttribs: 16 },
  },
  {
    id: 'android-samsung-s23', label: 'Android 14 · Galaxy S23', os: 'Android', osVersion: '14', chromeMajor: 130,
    mobile: true, touchPoints: 5, ua: androidUA(130, 6723, 'SM-S911B'), platform: 'Linux aarch64',
    screens: [{ width: 360, height: 780, dpr: 3 }, { width: 360, height: 800, dpr: 3 }],
    cores: [8], memoryGb: [8, 12],
    gpus: [{ vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Adreno (TM) 740, OpenGL ES 3.2)', unmaskedVendor: 'Google Inc. (ARM)', unmaskedRenderer: 'ANGLE (ARM, Adreno (TM) 740, OpenGL ES 3.2)' }],
    fonts: ANDROID_FONTS, timezones: ['Asia/Dubai', 'Asia/Singapore', 'Europe/Berlin'], locales: ['en-SG', 'de-DE', 'ar-AE'], languages: ['en-SG', 'en', 'de-DE'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [16384, 16384], maxVertexAttribs: 16 },
  },
  {
    id: 'linux-ubuntu', label: 'Linux · Ubuntu 24.04', os: 'Linux', osVersion: '6.8', chromeMajor: 130,
    mobile: false, touchPoints: 0, ua: linuxUA(130, 6723), platform: 'Linux x86_64',
    screens: [{ width: 1920, height: 1080, dpr: 1 }, { width: 2560, height: 1440, dpr: 1 }],
    cores: [4, 8, 16], memoryGb: [8, 16, 32],
    gpus: [{ vendor: 'Google Inc. (Mesa)', renderer: 'ANGLE (Mesa, llvmpipe (LLVM 15.0.7, 256 bits), OpenGL 4.5)', unmaskedVendor: 'Google Inc. (Mesa)', unmaskedRenderer: 'ANGLE (Mesa, llvmpipe (LLVM 15.0.7, 256 bits), OpenGL 4.5)' }],
    fonts: LINUX_FONTS, timezones: ['Europe/Berlin', 'Europe/London', 'Asia/Kolkata'], locales: ['en-GB', 'de-DE'], languages: ['en-GB', 'en'],
    gl: { maxTextureSize: 16384, maxRenderbufferSize: 16384, maxViewport: [16384, 16384], maxVertexAttribs: 16 },
  },
];

export function getTemplate(id: string): DeviceTemplate {
  return DEVICE_TEMPLATES.find((t) => t.id === id) ?? DEVICE_TEMPLATES[0];
}

export const TEMPLATE_GROUPS: Array<{ os: OSType; items: DeviceTemplate[] }> = (['Windows', 'macOS', 'Android', 'Linux'] as OSType[]).map((os) => ({
  os,
  items: DEVICE_TEMPLATES.filter((t) => t.os === os),
}));
