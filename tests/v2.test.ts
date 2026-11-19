import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  REAL_DEVICE_PRESETS, DEVICE_TEMPLATES, TEMPLATE_GROUPS, FINGERPRINT_DATA_SOURCE,
  GEO, GEO_COUNTRIES, applyGeoToSpec, offsetForZone,
  createProfile, generateProfiles, checkProfile, profileQuality, workspaceQuality,
  parseCookies, cookiesToText, profilesFromCsv, applyRealPreset, getRealPreset,
} from '@joe/core';
import { buildInjectionScript, surfaces } from '@joe/fingerprint';
import { makeTheme, PINK } from '../src/theme';

describe('v2 observed-device fingerprint data', () => {
  it('has a substantial coherent dataset with no headless or stale Client Hints', () => {
    expect(REAL_DEVICE_PRESETS.length).toBeGreaterThanOrEqual(25);
    expect(FINGERPRINT_DATA_SOURCE).toContain('Apache-2.0');
    for (const r of REAL_DEVICE_PRESETS) {
      expect(r.chromeMajor).toBeGreaterThanOrEqual(130);
      expect(r.brands.some((b) => b.version === String(r.chromeMajor))).toBe(true);
      expect(r.brands.some((b) => /headless/i.test(b.brand))).toBe(false);
      expect(r.screen.width).toBeGreaterThan(0);
      expect(r.gpu.renderer.length).toBeGreaterThan(3);
      expect(r.fonts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps all templates backed by a real sample and grouped by OS', () => {
    expect(DEVICE_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(TEMPLATE_GROUPS.every((g) => g.items.length > 0)).toBe(true);
    for (const t of DEVICE_TEMPLATES) {
      expect(t.realId).toMatch(/^real-/);
      expect(t.brands.length).toBeGreaterThan(0);
      expect(t.gpus.length).toBeGreaterThan(0);
    }
  });

  it('creates profiles with perfect internal consistency and unique bundles', () => {
    const profiles = REAL_DEVICE_PRESETS.map((r, i) => createProfile({ name: `QA ${i}`, realPresetId: r.id, seed: `test::${r.id}` }));
    expect(profiles.every((p) => checkProfile(p).score === 100)).toBe(true);
    const q = workspaceQuality(profiles);
    expect(q.averageConsistency).toBe(100);
    expect(q.distinctBundles).toBe(profiles.length);
    expect(q.grade).toMatch(/^[AB]$/);
    expect(profileQuality(profiles[0], profiles).realBacked).toBe(true);
  });

  it('supports unlimited deterministic bulk generation', () => {
    const many = generateProfiles(500, { seed: 'bulk', group: 'QA', templateId: DEVICE_TEMPLATES[0].id }, 'Bulk');
    expect(many).toHaveLength(500);
    expect(new Set(many.map((p) => p.id)).size).toBe(500);
    expect(many.every((p) => checkProfile(p).score >= 90)).toBe(true);
  });

  it('applies an observed preset without losing profile identity', () => {
    const original = createProfile({ name: 'Keep me', seed: 'identity' });
    const real = getRealPreset(REAL_DEVICE_PRESETS[3].id)!;
    const applied = applyRealPreset(original, real);
    expect(applied.id).toBe(original.id);
    expect(applied.name).toBe('Keep me');
    expect(applied.realId).toBe(real.id);
    expect(applied.fingerprint.userAgent).toBe(real.userAgent);
  });
});

describe('v2 geo, transfer and injection', () => {
  it('matches proxy countries to timezone, locale and WebRTC policy', () => {
    expect(GEO_COUNTRIES.length).toBeGreaterThanOrEqual(30);
    const base = createProfile({ name: 'Geo', seed: 'geo' }).fingerprint;
    const bd = applyGeoToSpec(base, 'BD');
    expect(bd.timezone).toBe('Asia/Dhaka');
    expect(bd.locale).toBe('bn-BD');
    expect(bd.languages[0]).toBe('bn-BD');
    expect(bd.webrtcMode).toBe('replace');
    expect(bd.timezoneOffset).toBe(offsetForZone('Asia/Dhaka'));
    expect(offsetForZone('America/New_York')).not.toBe(0);
    expect(GEO.US.timezone).toBe('America/New_York');
  });

  it('imports cookies and CSV profiles from other managers', () => {
    const json = parseCookies('[{"name":"sid","value":"abc","domain":"example.com","secure":true}]');
    const pairs = parseCookies('sid=abc; theme=light');
    const csv = profilesFromCsv('name,group,notes,proxy\nA,QA,hello,socks5://127.0.0.1:1080\nB,QA,,\n');
    expect(json[0]).toMatchObject({ name: 'sid', value: 'abc', domain: 'example.com', secure: true });
    expect(pairs).toHaveLength(2);
    expect(cookiesToText(json)).toContain('"sid"');
    expect(csv).toHaveLength(2);
    expect(csv[0]).toMatchObject({ name: 'A', group: 'QA', notes: 'hello' });
  });

  it('builds one self-testing injection script with explicit engine limits', () => {
    const p = createProfile({ name: 'Probe', realPresetId: REAL_DEVICE_PRESETS[0].id, seed: 'probe' });
    const script = buildInjectionScript(p.fingerprint, { selfTestHook: true });
    expect(script).toContain('__joeProbe');
    expect(script).toContain('__joeVerify');
    expect(script).toContain('native code');
    expect(script).not.toContain('HeadlessChrome');
    const list = surfaces(p.fingerprint);
    expect(list.some((x) => x.level === 'engine' && x.key === 'tls')).toBe(true);
    expect(list.filter((x) => x.level === 'js').length).toBeGreaterThanOrEqual(10);
  });
});

describe('v2 MUI design system', () => {
  it('uses one pink primary, tiny radii and IBM Plex Sans', () => {
    const theme = makeTheme('light');
    expect(PINK).toBe('#D81B60');
    expect(theme.palette.primary.main).toBe(PINK);
    expect(theme.shape.borderRadius).toBe(2);
    expect(theme.typography.fontFamily).toContain('IBM Plex Sans');
    expect(theme.spacing(1)).toBe('8px');
  });

  it('keeps gradients and dashed borders out of the stylesheet and theme', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const theme = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
    const forbidden = /(linear|radial)-gradient\(|border(?:-[a-z]+)?:\s*[^;]*dashed|border(?:-[a-z]+)?-style:\s*dashed/;
    expect(css).not.toMatch(forbidden);
    expect(theme).not.toMatch(forbidden);
    expect(css).toContain('border-radius: 2px');
  });
});

describe('v2 provenance and licensing', () => {
  const file = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

  it('keeps the MIT source grant and its copyright holder', () => {
    const license = file('LICENSE');
    expect(license).toContain('MIT License');
    expect(license).toContain('Pritam Sarkar');
    expect(license).toMatch(/WITHOUT WARRANTY OF ANY KIND/);
  });

  it('attributes third-party data, fonts, flags and official marks', () => {
    const notice = file('NOTICE');
    for (const needle of ['Apache-2.0', 'BrowserForge', 'SIL Open Font License', 'flag-icons', 'simple-icons', 'CC BY-ND']) {
      expect(notice).toContain(needle);
    }
    expect(notice).toContain('https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases/latest');
  });

  it('reserves the name and logo while allowing nominative reference', () => {
    const trademark = file('TRADEMARK.md');
    expect(trademark).toContain('# Joe Browser trademark and brand policy');
    expect(trademark).toMatch(/nominative/i);
    expect(trademark).toMatch(/not licensed by the MIT/i);
  });

  it('states the real limits of an open-source license', () => {
    const policy = file('docs/IP-POLICY.md');
    expect(policy).toMatch(/cannot be retroactively revoked/i);
    expect(policy).toMatch(/no public software license can honestly promise/i);
    expect(policy).toMatch(/signed annotated tags/i);
    expect(policy).toMatch(/Developer Certificate of Origin|DCO/);
    for (const path of ['LICENSE', 'NOTICE', 'TRADEMARK.md', 'CONTRIBUTING.md', 'docs/LICENSE.md', 'docs/ARCHITECTURE.md', 'docs/VALIDATION.md']) {
      expect(file(path).length).toBeGreaterThan(200);
    }
  });

  it('keeps the readme versioned for v2 without v1 claims', () => {
    const readme = file('README.md');
    expect(readme).toContain('Joe Browser 2.0');
    expect(readme).toContain('NOTICE');
    expect(readme).toContain('TRADEMARK.md');
    expect(readme).toMatch(/not undetectable/i);
    expect(readme).not.toMatch(/8 coherent device templates/);
    expect(readme).not.toMatch(/v1\.0\.0-beta/);
  });

  it('keeps the release workflow on v2 and publishing checksums', () => {
    const workflow = file('.github/workflows/release.yml');
    expect(workflow).toContain("default: 'v2.0.0'");
    expect(workflow).toContain('SHA256SUMS.txt');
    expect(workflow).toContain('npm run test:site');
    expect(workflow).toMatch(/not undetectable/i);
    expect(workflow).not.toContain("default: 'v1.0.0'");
    expect(workflow).not.toContain('8 coherent device templates');
  });
});
