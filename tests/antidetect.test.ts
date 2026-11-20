import { describe, it, expect } from 'vitest';
import {
  DEVICE_TEMPLATES, createProfile, checkProfile, rebuildProfileFingerprint,
  profileBrowserLabel, type BrowserFamily,
} from '@joe/core';
import { buildInjectionScript } from '@joe/fingerprint';

const FAMILIES: BrowserFamily[] = ['joe', 'chrome', 'chromium', 'edge', 'brave', 'firefox'];
const MATRIX_TEMPLATES = [
  'win11-intel',
  'mac-sonoma-m1',
  'linux-ubuntu',
  'android-pixel8',
  'iphone-15-pro',
  'ipad-pro-11',
];

describe('anti-detect browser x OS matrix', () => {
  it('builds consistent profiles with zero critical issues across all browsers and OSes', () => {
    for (const templateId of MATRIX_TEMPLATES) {
      for (const browserFamily of FAMILIES) {
        const profile = createProfile({
          name: `${templateId} ${browserFamily}`,
          templateId,
          browserFamily,
          seed: `matrix::${templateId}::${browserFamily}`,
        });
        const report = checkProfile(profile);
        const critical = report.issues.filter((i) => i.severity === 'critical');
        expect(critical).toEqual([]);
        expect(report.score).toBeGreaterThanOrEqual(85);
      }
    }
  });

  it('compiles injection scripts cleanly and preserves engine-accurate globals', () => {
    for (const templateId of MATRIX_TEMPLATES) {
      for (const browserFamily of FAMILIES) {
        const profile = createProfile({
          name: `${templateId} ${browserFamily}`,
          templateId,
          browserFamily,
          seed: `script::${templateId}::${browserFamily}`,
        });
        const script = buildInjectionScript(profile.fingerprint, { selfTestHook: true });
        // Ensure generated JS parses without syntax errors
        expect(() => new Function(script)).not.toThrow();
        expect(script).toContain('sHash');
        expect(script).toContain('seenBuf');
        expect(script).toContain('noInstanceShadow');
        expect(script).toContain('canvasStable');

        if (profile.os === 'iOS' || profile.os === 'iPadOS') {
          expect(profile.fingerprint.vendor).toBe('Apple Computer, Inc.');
          expect(profile.fingerprint.uaClientHints.secChUa).toBe('');
          expect(profileBrowserLabel(profile)).toMatch(/^Safari /);
        } else if (browserFamily === 'firefox') {
          expect(profile.fingerprint.userAgent).toContain('Firefox/');
          expect(profile.fingerprint.oscpu.length).toBeGreaterThan(0);
          expect(profile.fingerprint.vendor).toBe('');
          expect(profileBrowserLabel(profile)).toMatch(/^Firefox /);
        } else if (browserFamily === 'edge') {
          expect(profile.fingerprint.userAgent).toMatch(/EdgA?\//);
          expect(profileBrowserLabel(profile)).toMatch(/^Edge /);
        } else if (browserFamily === 'brave') {
          expect(profile.fingerprint.uaClientHints.brands.some((b) => b.brand === 'Brave')).toBe(true);
          expect(profileBrowserLabel(profile)).toMatch(/^Brave /);
        } else if (browserFamily === 'chromium') {
          expect(profile.fingerprint.uaClientHints.brands.some((b) => b.brand === 'Chromium')).toBe(true);
          expect(profileBrowserLabel(profile)).toMatch(/^Chromium /);
        }
      }
    }
  });

  it('rebuilds profile fingerprint while keeping identity, proxy, timezone and locale', () => {
    const base = createProfile({
      name: 'Preserved',
      templateId: DEVICE_TEMPLATES[0].id,
      proxyId: 'px_1',
      browserFamily: 'chrome',
      overrides: { timezone: 'Europe/Berlin', locale: 'de-DE', webrtcMode: 'disabled' },
    });
    const rebuilt = rebuildProfileFingerprint(base, { browserFamily: 'edge', templateId: 'mac-sonoma-m1' });
    expect(rebuilt.id).toBe(base.id);
    expect(rebuilt.name).toBe('Preserved');
    expect(rebuilt.proxyId).toBe('px_1');
    expect(rebuilt.browserFamily).toBe('edge');
    expect(rebuilt.os).toBe('macOS');
    expect(rebuilt.fingerprint.timezone).toBe('Europe/Berlin');
    expect(rebuilt.fingerprint.locale).toBe('de-DE');
    expect(rebuilt.fingerprint.webrtcMode).toBe('disabled');
    expect(rebuilt.fingerprint.userAgent).toContain('Edg/');
    expect(checkProfile(rebuilt).score).toBeGreaterThanOrEqual(85);
  });
});
