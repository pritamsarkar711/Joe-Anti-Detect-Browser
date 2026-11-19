/**
 * Real Chromium self-test for the v2 fingerprint payload.
 *
 * For each observed-device preset we create a profile, build the exact
 * injection script used by Electron and Android, execute it in headless
 * Chromium and call the hidden __joeVerify() hook. This validates internal
 * JavaScript coherence, not invisibility to remote anti-bot systems.
 */
import { REAL_DEVICE_PRESETS, createProfile, checkProfile, workspaceQuality, profileQuality, applyGeoToSpec } from '@joe/core';
import { buildInjectionScript } from '@joe/fingerprint';
import { launchBrowser } from './chromium.mjs';

interface Verify { passed: number; total: number; failures: string[]; probe: Record<string, unknown> }

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures: string[] = [];
const rows: Array<{ id: string; passed: number; total: number; failures: string[]; consistency: number }> = [];

for (const real of REAL_DEVICE_PRESETS) {
  const profile = createProfile({ name: real.label, realPresetId: real.id, seed: `self-test::${real.id}` });
  const script = buildInjectionScript(profile.fingerprint, { selfTestHook: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
  const result = await page.evaluate(() => (window as unknown as { __joeVerify: () => Verify }).__joeVerify());
  const consistency = checkProfile(profile).score;
  rows.push({ id: real.id, passed: result.passed, total: result.total, failures: result.failures, consistency });
  if (result.failures.length || consistency < 80) failures.push(`${real.id}: ${result.failures.join(', ') || 'low consistency'}`);
  console.log(`${result.failures.length ? 'FAIL' : 'PASS'}  ${real.id.padEnd(8)} ${result.passed}/${result.total}  consistency ${consistency}`);
}

await page.close();
await browser.close();

const profiles = REAL_DEVICE_PRESETS.map((r) => createProfile({ name: r.label, realPresetId: r.id, seed: `quality::${r.id}` }));
const wq = workspaceQuality(profiles);
const geo = applyGeoToSpec(profiles[0].fingerprint, 'BD');
const geoOk = geo.timezone === 'Asia/Dhaka' && geo.locale === 'bn-BD' && geo.languages[0] === 'bn-BD';
const uniqueBundles = new Set(profiles.map((p) => JSON.stringify([p.fingerprint.userAgent, p.fingerprint.screen, p.fingerprint.gpu.renderer]))).size;
console.log(`\n${REAL_DEVICE_PRESETS.length - failures.length}/${REAL_DEVICE_PRESETS.length} injection self-tests passed`);
console.log(`Workspace: consistency ${wq.averageConsistency}%, uniqueness ${wq.averageUniqueness}%, grade ${wq.grade}, distinct bundles ${wq.distinctBundles}`);
console.log(`Geo match BD: ${geoOk ? 'PASS' : 'FAIL'} · Unique observed bundles: ${uniqueBundles}/${profiles.length}`);
if (failures.length || !geoOk || uniqueBundles < profiles.length) {
  console.error('Failures:', failures);
  process.exit(1);
}
