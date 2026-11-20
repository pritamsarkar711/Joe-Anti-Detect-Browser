import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
      // Apple/WebKit classes are curated (no observed sample yet); everything
      // else must be traceable to one real traffic sample.
      if (t.source === 'curated') {
        expect(t.os === 'iOS' || t.os === 'iPadOS').toBe(true);
      } else {
        expect(t.realId).toMatch(/^real-/);
      }
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

  it('keeps the readme versioned for the current release without v1 claims', () => {
    const readme = file('README.md');
    const pkgVersion = JSON.parse(file('package.json')).version as string;
    // Major.minor, derived: the README heading tracks the release, and pinning
    // "3.0" made every minor bump fail this test for no real reason.
    expect(readme).toContain(`Joe Browser ${pkgVersion.split('.').slice(0, 2).join('.')}`);
    expect(readme).toContain('NOTICE');
    expect(readme).toContain('TRADEMARK.md');
    expect(readme).toMatch(/not undetectable/i);
    expect(readme).not.toMatch(/8 coherent device templates/);
    expect(readme).not.toMatch(/v1\.0\.0-beta/);
  });

  it('keeps the release workflow current and publishing checksums', () => {
    const workflow = file('.github/workflows/release.yml');
    // The release notes live in docs/RELEASE-BODY.md and are assembled by the
    // publish job, so the honesty claims are checked there — and the workflow
    // must actually reference that file (a detached body would drop them).
    const body = file('docs/RELEASE-BODY.md');
    // Derive the expected tag from package.json so a version bump cannot break
    // this test and tempt anyone into "fixing" it by pinning an old number.
    const { version } = JSON.parse(file('package.json')) as { version: string };
    expect(workflow).toContain(`default: 'v${version}'`);
    expect(workflow).toContain('SHA256SUMS.txt');
    expect(workflow).toContain('npm run test:site');
    expect(workflow).toContain('docs/RELEASE-BODY.md');
    expect(body).toMatch(/not undetectable/i);
    expect(workflow + body).not.toContain("default: 'v1.0.0'");
    expect(workflow + body).not.toContain("default: 'v2.0.0'");
    expect(workflow + body).not.toContain('8 coherent device templates');
  });

  it('assembles release notes that list the real artifacts and stay honest without the APK', () => {
    // Execute the actual "Compose release notes" script from the workflow —
    // a broken script would otherwise only surface as a failed release run.
    const workflow = file('.github/workflows/release.yml');
    const marker = '- name: Compose release notes';
    const step = workflow.slice(workflow.indexOf(marker));
    const block = step.split('        run: |\n')[1].split('      - name:')[0];
    const script = 'TAG=v3.2.0\n' + block.split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
    const run = (signing: 'none' | 'ephemeral' | 'release') => {
      const dir = mkdtempSync(join(tmpdir(), 'joe-notes-'));
      try {
        mkdirSync(join(dir, 'docs'));
        mkdirSync(join(dir, 'release-assets'));
        writeFileSync(join(dir, 'docs', 'RELEASE-BODY.md'), '## Joe Browser 3.2.0\n\nHonest body.\n');
        writeFileSync(join(dir, 'release-assets', 'JoeBrowser-Setup-3.2.0.exe'), 'exe');
        writeFileSync(join(dir, 'release-assets', 'JoeBrowser-Portable-3.2.0.exe'), 'exe');
        writeFileSync(join(dir, 'release-assets', 'SHA256SUMS.txt'), 'sum');
        if (signing !== 'none') {
          writeFileSync(join(dir, 'release-assets', 'JoeBrowser.apk'), 'apk');
          writeFileSync(
            join(dir, 'release-assets', 'Android-signing.txt'),
            `Joe Browser APK signing\nmode: ${signing}\nSHA-256 digest: AB:CD\n`,
          );
        }
        execFileSync('bash', ['-e', '-c', script], { cwd: dir });
        return readFileSync(join(dir, 'release-notes.md'), 'utf8');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
    const withoutApk = run('none');
    expect(withoutApk).toContain('Honest body.');
    expect(withoutApk).toContain('JoeBrowser-Setup-3.2.0.exe');
    expect(withoutApk).toContain('JoeBrowser-Portable-3.2.0.exe');
    expect(withoutApk).toMatch(/not included in this release/i);
    expect(withoutApk).toContain('JOE_SIGNING_STORE_B64');
    const ephemeral = run('ephemeral');
    expect(ephemeral).toContain('JoeBrowser.apk');
    expect(ephemeral).not.toMatch(/not included in this release/i);
    expect(ephemeral).toMatch(/per-build key/i);
    expect(ephemeral).toContain('setup-signing.sh');
    const release = run('release');
    expect(release).toContain('JoeBrowser.apk');
    expect(release).toMatch(/release key/i);
    expect(release).toContain('Android-signing.txt');
    expect(release).not.toMatch(/per-build key/i);
  });

  it('signs the APK with a stable key or a labelled per-build key, never silently', () => {
    // v3.1.x refused to build any APK without secrets (Android shipped
    // nothing); v3.2.x now builds a real, installable APK either way — with
    // the owner's key when configured, otherwise a per-build key whose status
    // and certificate fingerprint are published in Android-signing.txt.
    const build = file('scripts/build-apk.sh');
    expect(build).toContain('JOE_SIGNING_ALLOW_EPHEMERAL');
    expect(build).toContain('--ks-type');
    expect(build).toContain('Android-signing.txt');
    expect(build).toContain('keytool -genkeypair');
    expect(build).toMatch(/print-certs/);
    const setup = file('scripts/setup-signing.sh');
    expect(setup).toContain('gh secret set JOE_SIGNING_STORE_B64');
    expect(setup).toContain('gh secret set JOE_SIGNING_ALIAS');
    expect(setup).toContain('gh secret set JOE_STORE_PASSWORD');
    expect(setup).toContain('gh secret set JOE_KEY_PASSWORD');
    expect(setup).toContain('openssl pkcs12 -export');
    const workflow = file('.github/workflows/release.yml');
    expect(workflow).toContain("JOE_SIGNING_ALLOW_EPHEMERAL: '1'");
    expect(workflow).toContain('Android-signing.txt');
    const gitignore = file('.gitignore');
    expect(gitignore).toContain('joe-release-keystore');
  });

  it('ships a UI bundle that loads over file:// instead of the v3.2.0 hang', () => {
    // v3.2.0's release pipeline uploaded `dist/` (web build, absolute base) as
    // the packaged UI: every script 404'd under file:// and the app sat on its
    // boot splash forever. These pins keep every step of the corrected flow in
    // place: build the desktop bundle, gate it, ship it, boot it in Electron.
    const release = file('.github/workflows/release.yml');
    const ci = file('.github/workflows/ci.yml');
    expect(release).toContain('npm run build:desktop');
    expect(release).toContain('name: web-dist, path: apps/desktop/web-dist/');
    expect(release).not.toMatch(/name: web-dist,\s*path: dist\//);
    expect(release).toContain('npm run test:webdist');
    expect(release).toContain('npm run test:boot-web');
    expect(release).toContain('boot-check.cjs');
    expect(ci).toContain('npm run build:desktop');
    expect(ci).toContain('npm run test:webdist');
    expect(ci).toContain('npm run test:boot-web');
    expect(ci).toContain('boot-check.cjs');
    const pkg = JSON.parse(file('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['test:webdist']).toContain('check-webdist.mjs');
    expect(pkg.scripts['test:boot-web']).toContain('boot-check-web.mjs');
    // The Android WebView must allow file→file module fetches or the same
    // splash-forever failure ships to phones (API 30+ defaults this to false).
    const activity = file('apps/android/app/src/main/java/com/joebrowser/app/MainActivity.java');
    expect(activity).toContain('setAllowFileAccessFromFileURLs(true)');
    // The asar gate reads the packed index.html itself.
    const asar = file('scripts/check-asar.mjs');
    expect(asar).toContain('verifyPackedUi');
    expect(asar).toContain('readAsarFileSync');
  });
});
