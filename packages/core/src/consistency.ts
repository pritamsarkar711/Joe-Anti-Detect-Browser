import type { BrowserProfile, FingerprintSpec } from './profile';
import { getTemplate } from './devices';

export interface ConsistencyIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  surface: string;
  message: string;
  hint: string;
}

export interface ConsistencyReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  issues: ConsistencyIssue[];
  checked: number;
}

/**
 * Static leak / contradiction checks. This is the honest version of "is the
 * fingerprint detectable": it catches *internal contradictions* (the #1 reason
 * generated profiles get flagged) and known leak surfaces. It cannot certify
 * invisibility to a remote detector — nobody can, and any product claiming so
 * is marketing. Engine-level surfaces (TLS/JA4, HTTP/2 fingerprint, font
 * rasterisation, CDP side channels) are listed as info-level limitations.
 */
export function checkConsistency(spec: FingerprintSpec): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const t = getTemplate(spec.templateId);
  const ua = spec.userAgent;
  const add = (severity: ConsistencyIssue['severity'], surface: string, message: string, hint: string) =>
    issues.push({ id: `${surface}-${issues.length}`, severity, surface, message, hint });

  // 1. UA vs platform / client hints
  if (ua.includes('Windows') && spec.platform !== 'Win32') add('critical', 'UA ↔ platform', 'Windows UA with non-Windows navigator.platform', 'Use Win32');
  if (ua.includes('Macintosh') && !ua.includes('iPhone') && !ua.includes('iPad') && spec.platform !== 'MacIntel') add('critical', 'UA ↔ platform', 'macOS UA with non-Mac platform', 'Use MacIntel');
  if (ua.includes('iPhone') && spec.platform !== 'iPhone') add('critical', 'UA ↔ platform', 'iPhone UA with non-iPhone platform', 'Use iPhone');
  if (ua.includes('iPad') && spec.platform !== 'iPad') add('critical', 'UA ↔ platform', 'iPad UA with non-iPad platform', 'Use iPad');
  if (ua.includes('Android') && !spec.platform.startsWith('Linux')) add('critical', 'UA ↔ platform', 'Android UA with non-Linux platform', 'Use Linux armv8l / aarch64');
  if (ua.includes('Mobile') !== spec.uaClientHints.mobile) add('critical', 'UA ↔ Client Hints', 'Sec-CH-UA-Mobile contradicts UA', 'Keep both flags in sync');

  // 2. GPU vs OS — the classic random-generator bug
  const renderer = `${spec.gpu.renderer} ${spec.webglRenderer}`.toLowerCase();
  if (spec.uaClientHints.platform === 'Windows' && (renderer.includes('metal') || renderer.includes('apple m') || renderer.includes('adreno') || renderer.includes('mali'))) {
    add('critical', 'GPU ↔ OS', 'Windows profile reports a Mac/ARM GPU', 'Pick a D3D11 ANGLE renderer');
  }
  if (spec.uaClientHints.platform === 'macOS' && renderer.includes('direct3d')) {
    add('critical', 'GPU ↔ OS', 'macOS profile reports a Direct3D GPU', 'Pick an ANGLE Metal renderer');
  }
  if (spec.uaClientHints.platform === 'Android' && renderer.includes('direct3d')) {
    add('critical', 'GPU ↔ OS', 'Android profile reports a Direct3D GPU', 'Pick an OpenGL ES / Vulkan renderer');
  }

  // 3. Mobile vs screen / touch
  const isTablet = t.os === 'iPadOS' || (t.os === 'Android' && spec.screen.width >= 768);
  if (t.mobile && spec.touchPoints === 0) add('critical', 'Touch ↔ OS', 'Mobile device reports 0 touch points', 'Set maxTouchPoints ≥ 1');
  if (!t.mobile && spec.touchPoints > 0) add('warning', 'Touch ↔ OS', 'Desktop device reports touch points', 'Set maxTouchPoints = 0 or use a convertible template');
  if (t.mobile && !isTablet && spec.screen.width > 600) add('warning', 'Screen ↔ OS', 'Phone UA with a desktop-width screen', 'Use a phone viewport');
  if (!t.mobile && spec.screen.width < 800) add('warning', 'Screen ↔ OS', 'Desktop UA with a phone-width screen', 'Use a desktop viewport');
  if (spec.screen.dpr < 1 || spec.screen.dpr > 4) add('warning', 'Screen', 'Implausible device pixel ratio', 'Keep DPR between 1 and 4');

  // 4. Locale / timezone coherence
  const zone = spec.timezone;
  const locale = spec.locale;
  const expectedPrefix: Record<string, string[]> = {
    'America/': ['en-US', 'en-CA', 'es-MX', 'pt-BR'],
    'Europe/': ['en-GB', 'de-DE', 'fr-FR', 'nl-NL', 'en-IE', 'es-ES', 'it-IT', 'sv-SE', 'pl-PL', 'tr-TR', 'uk-UA', 'de-CH'],
    'Africa/': ['en-ZA', 'en-GB'],
    'Asia/Dhaka': ['bn-BD', 'en-US'],
    'Asia/Kolkata': ['en-IN', 'hi-IN', 'en-US'],
    'Asia/Singapore': ['en-SG', 'zh-SG', 'en-US'],
    'Asia/Dubai': ['ar-AE', 'en-US'],
    'Asia/Tokyo': ['ja-JP', 'en-US'],
    'Asia/Seoul': ['ko-KR', 'en-US'],
    'Asia/Hong_Kong': ['zh-HK', 'en-US'],
    'Australia/': ['en-AU', 'en-GB'],
    'Pacific/Auckland': ['en-NZ', 'en-GB'],
  };
  const key = Object.keys(expectedPrefix).find((k) => zone.startsWith(k));
  if (key && !expectedPrefix[key].includes(locale) && !locale.startsWith('en')) {
    add('warning', 'Locale ↔ TZ', `${locale} with ${zone} is unusual`, 'Pick a locale from the same region');
  }
  if (!spec.languages.includes(spec.locale) && spec.languages.length > 0) {
    add('warning', 'Locale ↔ Accept-Language', 'navigator.language not in navigator.languages', 'Include the primary locale first');
  }

  // 5. Hardware plausibility
  if (spec.memoryGb < 2 || spec.memoryGb > 128) add('warning', 'Hardware', 'Implausible deviceMemory', 'Use 2–64 GB');
  if (spec.cores < 2 || spec.cores > 64) add('warning', 'Hardware', 'Implausible hardwareConcurrency', 'Use 2–32 cores');
  if (spec.uaClientHints.fullVersion.split('.')[0] !== String(spec.chromeMajor)) {
    add('critical', 'Client Hints', 'Sec-CH-UA-Full-Version does not match UA major', 'Derive both from the template');
  }

  const isFirefox = /Firefox\//.test(spec.userAgent);
  const isWebKit = !isFirefox && (
    spec.uaClientHints.brands.some((b) => /^Safari$/i.test(b.brand))
    || (!/Chrome\//.test(spec.userAgent) && !/EdgA?\//.test(spec.userAgent))
  );
  if (isWebKit) {
    if (spec.uaClientHints.brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Brave/i.test(b.brand))) {
      add('critical', 'Client Hints', 'WebKit profile advertises Chromium brands', 'Safari sends no Sec-CH-UA brands');
    }
    if (spec.vendor !== 'Apple Computer, Inc.') {
      add('critical', 'Vendor ↔ Engine', 'WebKit profile should report Apple Computer, Inc.', 'Set vendor to Apple Computer, Inc.');
    }
  } else if (isFirefox) {
    if (spec.uaClientHints.brands.length > 0) {
      add('critical', 'Client Hints', 'Firefox profile exposes Chromium Client Hints', 'Firefox sends no Sec-CH-UA');
    }
    if (spec.vendor !== '') {
      add('critical', 'Vendor ↔ Engine', 'Firefox profile exposes non-empty navigator.vendor', 'Set vendor to empty string');
    }
  } else {
    if (spec.oscpu) {
      add('warning', 'Engine ↔ oscpu', 'Chromium profile exposes non-empty navigator.oscpu', 'Leave oscpu empty on Chromium');
    }
    if (!new RegExp(`Chrome/${spec.chromeMajor}\\.`).test(spec.userAgent) && !new RegExp(`EdgA?/${spec.chromeMajor}\\.`).test(spec.userAgent)) {
      add('critical', 'Client Hints', 'UA major does not match Client Hints major', 'Derive both from one observed device');
    }
    if (spec.uaClientHints.brands.length && !spec.uaClientHints.brands.some((b) => b.version === String(spec.chromeMajor))) {
      add('critical', 'Client Hints', 'Sec-CH-UA brand versions do not match UA', 'Use the brands from the same real device');
    }
    if (/EdgA?\//.test(spec.userAgent) && !spec.uaClientHints.brands.some((b) => /Edge/i.test(b.brand))) {
      add('critical', 'Client Hints', 'Edge UA without Microsoft Edge brand', 'Include Microsoft Edge brand');
    }
  }
  if (spec.timezoneOffset === 0 && /^(America|Asia|Australia)\//.test(spec.timezone)) {
    add('warning', 'Timezone', 'UTC offset does not match the declared timezone', 'Apply proxy geo matching');
  }

  // 6. Known leak surfaces
  if (spec.webrtcMode === 'disabled') add('info', 'WebRTC', 'WebRTC disabled — some sites flag this as unusual', 'Prefer "replace" with a proxy-matched public IP');
  if (spec.webrtcMode === 'replace' && !spec.webrtcPublicIp) add('info', 'WebRTC', 'Public IP is filled from the proxy at launch', 'Run a proxy check to populate it');
  add('info', 'Engine', 'TLS/JA4, HTTP/2, font rasterisation and CDP are engine-level surfaces', 'Full parity requires a patched Chromium build');
  add('info', 'Proxy', 'Proxy IP geolocation should match timezone and locale', 'Run a proxy check before launching');

  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warning = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - critical * 22 - warning * 7);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'D';
  return { score, grade, issues, checked: 24 };
}

export function checkProfile(p: BrowserProfile): ConsistencyReport {
  return checkConsistency(p.fingerprint);
}
