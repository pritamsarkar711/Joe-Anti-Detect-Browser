/**
 * Real Chromium self-test for the fingerprint payload across all observed-device
 * presets as well as browser-family x OS platform combinations.
 */
import {
  REAL_DEVICE_PRESETS, createProfile, checkProfile, workspaceQuality, applyGeoToSpec,
  type BrowserFamily,
} from '@joe/core';
import { buildInjectionScript } from '@joe/fingerprint';
import { launchBrowser } from './chromium.mjs';

interface Verify { passed: number; total: number; failures: string[]; probe: Record<string, unknown> }

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures: string[] = [];

async function testProfile(label: string, profile: ReturnType<typeof createProfile>) {
  const script = buildInjectionScript(profile.fingerprint, { selfTestHook: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
  const result = await page.evaluate(() => (window as unknown as { __joeVerify: () => Verify }).__joeVerify());
  const consistency = checkProfile(profile).score;
  if (result.failures.length || consistency < 80) failures.push(`${label}: ${result.failures.join(', ') || 'low consistency'}`);
  console.log(`${result.failures.length ? 'FAIL' : 'PASS'}  ${label.padEnd(28)} ${result.passed}/${result.total}  consistency ${consistency}`);
}

for (const real of REAL_DEVICE_PRESETS) {
  const profile = createProfile({ name: real.label, realPresetId: real.id, seed: `self-test::${real.id}` });
  await testProfile(real.id, profile);
}

const MATRIX_TEMPLATES = ['win11-intel', 'mac-sonoma-m1', 'linux-ubuntu', 'android-pixel8', 'iphone-15-pro', 'ipad-pro-11'];
const MATRIX_FAMILIES: BrowserFamily[] = ['joe', 'chrome', 'chromium', 'edge', 'brave', 'firefox'];

for (const templateId of MATRIX_TEMPLATES) {
  for (const browserFamily of MATRIX_FAMILIES) {
    const profile = createProfile({
      name: `${templateId} ${browserFamily}`,
      templateId,
      browserFamily,
      seed: `matrix::${templateId}::${browserFamily}`,
    });
    await testProfile(`${templateId}/${browserFamily}`, profile);
  }
}

await page.close();
await browser.close();

const profiles = REAL_DEVICE_PRESETS.map((r) => createProfile({ name: r.label, realPresetId: r.id, seed: `quality::${r.id}` }));
const wq = workspaceQuality(profiles);
const geo = applyGeoToSpec(profiles[0].fingerprint, 'BD');
const geoOk = geo.timezone === 'Asia/Dhaka' && geo.locale === 'bn-BD' && geo.languages[0] === 'bn-BD';
const uniqueBundles = new Set(profiles.map((p) => JSON.stringify([p.fingerprint.userAgent, p.fingerprint.screen, p.fingerprint.gpu.renderer]))).size;
const totalChecks = REAL_DEVICE_PRESETS.length + MATRIX_TEMPLATES.length * MATRIX_FAMILIES.length;
console.log(`\n${totalChecks - failures.length}/${totalChecks} injection self-tests passed`);
console.log(`Workspace: consistency ${wq.averageConsistency}%, uniqueness ${wq.averageUniqueness}%, grade ${wq.grade}, distinct bundles ${wq.distinctBundles}`);
console.log(`Geo match BD: ${geoOk ? 'PASS' : 'FAIL'} · Unique observed bundles: ${uniqueBundles}/${profiles.length}`);
if (failures.length || !geoOk || uniqueBundles < profiles.length) {
  console.error('Failures:', failures);
  process.exit(1);
}
