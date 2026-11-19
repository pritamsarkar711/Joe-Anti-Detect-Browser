import { describe, it, expect } from 'vitest';
import {
  DEVICE_TEMPLATES, createProfile, generateProfiles, checkConsistency, checkProfile,
  parseProxy, parseProxyLines, proxyUrl, profilesToCsv, csvToRows,
  exportWorkspace, importWorkspace,
} from '@joe/core';
import { buildInjectionScript, surfaces } from '@joe/fingerprint';

describe('profile engine', () => {
  it('derives a byte-identical fingerprint from the same seed (EXE and APK agree)', () => {
    const a = createProfile({ name: 'A', seed: 's' });
    const b = createProfile({ name: 'A', seed: 's' });
    // Timestamps are real wall-clock values; the *fingerprint* must be identical.
    expect(a.fingerprint).toEqual(b.fingerprint);
    expect(a.id).toBe(b.id);
  });

  it('keeps the same noise seed and honours explicit overrides on both platforms', () => {
    const win = createProfile({ name: 'X', seed: 'same', templateId: 'win11-intel', overrides: { timezone: 'Asia/Dhaka' } });
    const android = createProfile({ name: 'X', seed: 'same', templateId: 'android-pixel8', overrides: { timezone: 'Asia/Dhaka' } });
    expect(android.fingerprint.noiseSeed).toBe(win.fingerprint.noiseSeed);
    expect(android.fingerprint.timezone).toBe(win.fingerprint.timezone);
    expect(android.fingerprint.userAgent).not.toBe(win.fingerprint.userAgent);
  });

  it('every device template is internally coherent (no critical contradictions)', () => {
    for (const t of DEVICE_TEMPLATES) {
      const p = createProfile({ name: `check-${t.id}`, seed: t.id, templateId: t.id });
      const r = checkProfile(p);
      expect(r.issues.filter((i) => i.severity === 'critical'), `${t.id}: ${JSON.stringify(r.issues)}`).toHaveLength(0);
      expect(r.score, `${t.id} score`).toBeGreaterThanOrEqual(90);
      expect(p.fingerprint.languages[0]).toBe(p.fingerprint.locale);
    }
  });

  it('matches locale to timezone region', () => {
    const p = createProfile({ name: 'tz', seed: 'tz', templateId: 'win10-amd', overrides: { timezone: 'Asia/Dhaka' } });
    expect(['bn-BD', 'en-US']).toContain(p.fingerprint.locale);
  });

  it('generates hundreds of profiles with unique ids and no cap', () => {
    const list = generateProfiles(500, { templateId: 'win11-intel', group: 'Bulk' }, 'Bulk');
    expect(list).toHaveLength(500);
    expect(new Set(list.map((p) => p.id)).size).toBe(500);
    expect(new Set(list.map((p) => p.fingerprint.noiseSeed)).size).toBe(500);
  });

  it('flags a deliberately contradictory fingerprint', () => {
    const good = createProfile({ name: 'ok', seed: 'ok', templateId: 'win11-intel' });
    const bad = structuredClone(good);
    bad.fingerprint.gpu.renderer = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1)';
    bad.fingerprint.webglRenderer = bad.fingerprint.gpu.renderer;
    expect(checkConsistency(bad.fingerprint).issues.some((i) => i.severity === 'critical' && i.surface === 'GPU ↔ OS')).toBe(true);
    expect(checkConsistency(bad.fingerprint).score).toBeLessThan(checkConsistency(good.fingerprint).score);
  });
});

describe('proxy handling', () => {
  it('parses URL, shorthand and credential forms', () => {
    expect(parseProxy('socks5://u:p@198.51.100.1:1080')).toMatchObject({ protocol: 'socks5', host: '198.51.100.1', port: 1080, username: 'u', password: 'p', valid: true });
    expect(parseProxy('203.0.113.4:8080')).toMatchObject({ protocol: 'http', port: 8080, valid: true });
    expect(parseProxy('nope').valid).toBe(false);
    expect(parseProxyLines('http://a.com:80\nb.com:8080\nc.com:1080:user:pass\nbroken').filter((p) => p.valid)).toHaveLength(3);
    expect(proxyUrl({ protocol: 'socks5', host: 'h', port: 1080, username: 'u', password: 'p' })).toBe('socks5://u:p@h:1080');
  });
});

describe('transfer', () => {
  it('round-trips a workspace and CSV', () => {
    const profiles = generateProfiles(3, { templateId: 'mac-sonoma-m1', group: 'QA' }, 'QA');
    const ws = exportWorkspace(profiles, [], ['QA']);
    expect(importWorkspace(JSON.stringify(ws)).profiles).toHaveLength(3);
    expect(() => importWorkspace('{}')).toThrow();
    const csv = profilesToCsv(profiles);
    expect(csvToRows(csv)).toHaveLength(4);
    expect(csvToRows(csv)[1][0]).toBe(profiles[0].name);
  });
});

describe('fingerprint payload', () => {
  it('generates valid JavaScript that patches every declared surface', () => {
    const spec = createProfile({ name: 'payload', seed: 'payload', templateId: 'win11-nvidia' }).fingerprint;
    const script = buildInjectionScript(spec);
    expect(() => new Function(script)).not.toThrow();
    for (const token of ['userAgent', 'userAgentData', 'hardwareConcurrency', 'getParameter', 'getImageData', 'RTCPeerConnection', 'DateTimeFormat', 'devicePixelRatio', 'mediaDevices', 'Function.prototype']) {
      expect(script).toContain(token);
    }
    expect(script).toContain(spec.userAgent);
    expect(script).toContain(spec.timezone);
    expect(script).toContain(spec.gpu.unmaskedRenderer);
  });

  it('is identical for the same spec (desktop and Android inject the same bytes)', () => {
    const spec = createProfile({ name: 'same', seed: 'same' }).fingerprint;
    expect(buildInjectionScript(spec)).toBe(buildInjectionScript(spec));
  });

  it('exposes both JS-level and engine-level surfaces honestly', () => {
    const s = surfaces(createProfile({ name: 's', seed: 's' }).fingerprint);
    expect(s.some((x) => x.level === 'js')).toBe(true);
    expect(s.some((x) => x.level === 'engine')).toBe(true);
  });
});
