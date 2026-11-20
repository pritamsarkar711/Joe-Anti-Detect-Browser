import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Version consistency.
 *
 * v3.1.0's main.js kept a hard-coded `APP_VERSION` after the package bumped to
 * 3.1.1, so the shell and the REST API reported the wrong version and support
 * could not tell which build a user ran. Every surface that names a version
 * must agree with package.json, and the ones that can derive it must derive it.
 */
const root = path.resolve(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const pkg = JSON.parse(read('package.json')) as { version: string };
const desktopPkg = JSON.parse(read('apps/desktop/package.json')) as { version: string };

describe('version surfaces agree with package.json', () => {
  it('package.json and the desktop package carry the same version', () => {
    expect(desktopPkg.version).toBe(pkg.version);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('the Electron shell derives its version from package.json instead of a literal', () => {
    const main = read('apps/desktop/main.js');
    expect(main).toContain("require('./package.json').version");
    // A hard-coded APP_VERSION literal must not come back.
    expect(main).not.toMatch(/APP_VERSION\s*=\s*['"][\d.]+['"]/);
  });

  it('the web workspace reports the same version', () => {
    const store = read('src/state/store.tsx');
    const m = store.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
    expect(m, 'store.tsx no longer exports APP_VERSION').not.toBeNull();
    expect(m?.[1]).toBe(pkg.version);
  });

  it('the Android manifest carries the same version', () => {
    const manifest = read('apps/android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain(`android:versionName="${pkg.version}"`);
    const code = manifest.match(/android:versionCode="(\d+)"/);
    expect(code, 'versionCode missing').not.toBeNull();
    expect(Number(code?.[1])).toBeGreaterThan(0);
  });

  it('the Android manager user agent reads its version from the manifest', () => {
    const java = read('apps/android/app/src/main/java/com/joebrowser/app/MainActivity.java');
    expect(java).toContain('appVersion()');
    expect(java).not.toMatch(/JoeBrowser\/\d/); // no hard-coded UA version
  });

  it('the site build derives its provenance branch from git', () => {
    const site = read('scripts/build-site.mjs');
    expect(site).toContain('git rev-parse --abbrev-ref HEAD');
    expect(site).not.toMatch(/SITE_BRANCH \?\? 'arena\//); // no hard-coded branch
  });
});
