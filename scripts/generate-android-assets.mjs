/**
 * Generate the APK's bundled assets from the SAME TypeScript core used by the
 * desktop EXE and the web control plane. Run after build:core / build:android-ui.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../apps/desktop/core.cjs');
const root = process.cwd();
const assets = path.join(root, 'apps', 'android', 'assets');
const injection = path.join(assets, 'injection');
fs.mkdirSync(injection, { recursive: true });

const names = [
  ['Storefront US', 'QA'], ['Storefront EU', 'QA'], ['Ad Ops A', 'Marketing'], ['Ad Ops B', 'Marketing'],
  ['Client Northwind', 'Clients'], ['Client Acme', 'Clients'], ['Mobile Smoke 1', 'Mobile'], ['Mobile Smoke 2', 'Mobile'],
  ['Staging Auth', 'Staging'], ['Staging Checkout', 'Staging'], ['Research A', 'Research'], ['Research B', 'Research'],
  ['Analytics US', 'Analytics'], ['Analytics DE', 'Analytics'], ['Support Desk', 'Support'], ['Support Escalations', 'Support'],
];
const templates = ['win11-intel', 'win11-nvidia', 'mac-sonoma-m1', 'android-pixel8', 'win10-amd', 'linux-ubuntu', 'android-samsung-s23', 'mac-ventura-intel'];
const presets = core.REAL_DEVICE_PRESETS ?? [];
const groups = ['Default', ...new Set(names.map((n) => n[1]))];

const proxies = [
  { id: 'px_1', name: 'US Residential', protocol: 'socks5', host: '198.51.100.12', port: 1080, country: 'US', status: 'ok', latencyMs: 84, lastCheckedAt: null },
  { id: 'px_2', name: 'DE Datacenter', protocol: 'http', host: '203.0.113.40', port: 8080, country: 'DE', status: 'ok', latencyMs: 46, lastCheckedAt: null },
  { id: 'px_3', name: 'BD Mobile', protocol: 'socks5', host: '192.0.2.77', port: 1080, country: 'BD', status: 'unchecked', latencyMs: null, lastCheckedAt: null },
  { id: 'px_4', name: 'SG Rotating', protocol: 'socks5', host: '198.51.100.90', port: 1080, country: 'SG', status: 'ok', latencyMs: 132, lastCheckedAt: null },
];

const profiles = names.map(([name, group], i) => {
  const real = presets.length ? presets[i % presets.length] : null;
  return core.createProfile({
    name, group,
    ...(i % 3 === 0 && real ? { realPresetId: real.id } : { templateId: templates[i % templates.length] }),
    proxyId: i % 4 === 0 ? null : proxies[i % proxies.length].id,
    seed: `seed::${name}`,
    startUrl: 'https://example.com',
    cookies: '',
    extensions: [],
  }, i);
});

fs.writeFileSync(path.join(assets, 'workspace.json'), JSON.stringify(core.exportWorkspace(profiles, proxies, groups), null, 2));
for (const p of profiles) {
  fs.writeFileSync(path.join(injection, `${p.id}.js`), core.buildInjectionScript(p.fingerprint, { selfTestHook: true }));
}
fs.writeFileSync(path.join(injection, 'default.js'), core.buildInjectionScript(core.createProfile({ name: 'Default', seed: 'default' }).fingerprint, { selfTestHook: true }));

const ui = path.join(root, 'dist-android');
if (!fs.existsSync(path.join(ui, 'index.html'))) throw new Error('dist-android missing — run `npm run build:android-ui` first');
fs.cpSync(ui, path.join(assets, 'app'), { recursive: true });

console.log(`Generated ${profiles.length} profiles, ${profiles.length + 1} self-testing injection scripts and the bundled React UI.`);
