#!/usr/bin/env node
/**
 * Static checks for the SEO site and release provenance.
 *
 * Runs against the built dist-site/ when it exists, otherwise against site/
 * with the template placeholders left in place. It never claims a live
 * detector score; it only proves that metadata, local assets and required
 * provenance files are present and consistent for v2.0.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = path.join(root, 'dist-site');
const siteDir = fs.existsSync(path.join(built, 'index.html')) ? built : path.join(root, 'site');
const CANONICAL = 'https://joe-browser-control.vercel.app';
const REPO = 'https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser';

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail: detail || 'ok' });
  } catch (error) {
    results.push({ ok: false, name, detail: error.message });
  }
}
function must(condition, message) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(siteDir, 'styles.css'), 'utf8');
const robots = fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8');
const read = (relative) => fs.readFileSync(path.join(siteDir, relative), 'utf8');

check('page declares a v2 title and description', () => {
  must(/<title>[^<]*Joe Browser 2\.0[^<]*<\/title>/.test(html), 'title is not v2 branded');
  must(/<meta name="description" content="[^"]{80,}"/.test(html), 'meta description missing or too short');
  return 'title + description present';
});

check('canonical, Open Graph and Twitter metadata are consistent', () => {
  must(html.includes(`<link rel="canonical" href="${CANONICAL}/"`), 'canonical is not the canonical site URL');
  must(html.includes(`<meta property="og:url" content="${CANONICAL}/"`), 'og:url mismatch');
  must(html.includes(`<meta property="og:image" content="${CANONICAL}/og-image.png"`), 'og:image mismatch');
  must(html.includes('<meta name="twitter:card" content="summary_large_image"'), 'twitter card missing');
  must(!/\{\{SITE_URL\}\}|\{\{BRANCH\}\}/.test(html), 'unresolved template placeholder in built HTML');
  return 'canonical + OG + Twitter resolved';
});

check('structured data declares software version 2.0.0', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  must(blocks.length >= 2, 'expected SoftwareApplication and FAQPage JSON-LD');
  const parsed = blocks.map((b) => JSON.parse(b[1]));
  const app = parsed.find((j) => j['@type'] === 'SoftwareApplication');
  const faq = parsed.find((j) => j['@type'] === 'FAQPage');
  must(app, 'SoftwareApplication JSON-LD missing');
  must(faq && Array.isArray(faq.mainEntity) && faq.mainEntity.length >= 3, 'FAQPage JSON-LD missing entries');
  must(String(app.softwareVersion) === '2.0.0', `softwareVersion is ${app.softwareVersion}`);
  must(app.offers && app.offers.price === '0', 'expected zero-price offer');
  must(app.license === `${REPO}/blob/main/LICENSE`, 'license URL is not canonical');
  return `version ${app.softwareVersion}, ${faq.mainEntity.length} FAQ entries`;
});

check('links point at the canonical repository, release and provenance docs', () => {
  must(html.includes(`${REPO}/releases/latest`), 'release link missing');
  must(html.includes('/docs/IP-POLICY.md'), 'IP policy link missing');
  must(html.includes('/docs/VALIDATION.md'), 'validation link missing');
  must(html.includes('/docs/ARCHITECTURE.md'), 'architecture link missing');
  return 'release + IP/validation/architecture links present';
});

check('page states the honest engine-level scope', () => {
  must(/does not ship a patched/i.test(html), 'missing patched-engine disclaimer');
  must(/does not claim to be undetectable|not claim to be undetectable/i.test(html), 'missing undetectable disclaimer');
  must(/TLS\/JA4/.test(html), 'missing TLS/JA4 boundary');
  must(!/100% undetectable|undetectable browser|guaranteed stealth/i.test(html), 'overclaims detection avoidance');
  return 'scope disclaimers present, no overclaim';
});

check('design system is flat: no gradients or dashed borders', () => {
  const offenders = [...css.matchAll(/[^;{}]*\b(linear-gradient|radial-gradient|conic-gradient|dashed)\b[^;{}]*[;}]/g)].map((m) => m[0].trim());
  must(offenders.length === 0, `found ${offenders.length}: ${offenders.slice(0, 3).join(' | ')}`);
  return '0 offenders';
});

check('typography is local IBM Plex Sans', () => {
  must(/@font-face/.test(css), 'no @font-face declared');
  must(/IBM Plex Sans/.test(css), 'IBM Plex Sans not declared');
  must(!/fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit/.test(html + css), 'external font CDN referenced');
  for (const weight of [400, 500, 600, 700]) {
    must(fs.existsSync(path.join(siteDir, 'fonts', `ibm-plex-sans-latin-${weight}-normal.woff2`)), `missing local font weight ${weight}`);
  }
  return '4 local weights, no CDN';
});

check('single pink accent, no second accent color', () => {
  must(/#D81B60/i.test(css), 'primary pink missing');
  const hexes = new Set((css.match(/#[0-9a-f]{6}/gi) || []).map((h) => h.toUpperCase()));
  const decorative = [...hexes].filter((h) => !['#D81B60'].includes(h));
  must(decorative.length <= 12, `too many distinct hex colors (${decorative.length})`);
  return `${hexes.size} total hex colors, one primary accent`;
});

check('favicon, official marks and flags resolve locally', () => {
  must(fs.existsSync(path.join(siteDir, 'favicon.svg')), 'favicon.svg missing');
  const srcs = [...html.matchAll(/(?:src|href)="\.\/([^"]+\.(?:svg|png))"/g)].map((m) => m[1]);
  must(srcs.length > 0, 'no local asset references found');
  const missing = [...new Set(srcs)].filter((s) => !fs.existsSync(path.join(siteDir, s)));
  must(missing.length === 0, `missing local assets: ${missing.slice(0, 5).join(', ')}`);
  must(/circular|border-radius:\s*50%/.test(css), 'circular flag styling missing');
  return `${new Set(srcs).size} local assets resolve`;
});

check('flags cover the documented country set', () => {
  const flags = fs.readdirSync(path.join(siteDir, 'flags')).filter((f) => f.endsWith('.svg'));
  must(flags.length >= 12, `only ${flags.length} flags`);
  for (const iso of ['bd', 'us', 'gb', 'de', 'fr', 'jp', 'in', 'ca', 'au', 'br', 'nl', 'sg']) {
    must(flags.includes(`${iso}.svg`), `missing flag ${iso}`);
  }
  return `${flags.length} flags`;
});

check('screenshots are real local captures', () => {
  const dir = path.join(siteDir, 'screenshots');
  const pngs = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
  must(pngs.length >= 12, `only ${pngs.length} screenshots`);
  for (const name of ['01-profiles-light.png', '07-fingerprints.png', '11-profiles-dark.png']) {
    must(pngs.includes(name), `missing ${name}`);
  }
  const size = fs.statSync(path.join(dir, '01-profiles-light.png')).size;
  must(size > 20000, `screenshot suspiciously small (${size} bytes)`);
  must(fs.existsSync(path.join(siteDir, 'og-image.png')), 'og-image.png missing');
  return `${pngs.length} PNGs + OG image`;
});

check('robots and sitemap use the canonical URL', () => {
  must(robots.includes(`Sitemap: ${CANONICAL}/sitemap.xml`), 'robots sitemap URL mismatch');
  must(!robots.includes('Disallow: /'), 'robots blocks crawling');
  must(sitemap.includes(`<loc>${CANONICAL}/</loc>`), 'sitemap home URL mismatch');
  must(sitemap.includes(REPO), 'sitemap missing repository URLs');
  must(!/\{\{SITE_URL\}\}/.test(sitemap + robots), 'unresolved placeholder in robots/sitemap');
  return 'canonical robots + sitemap';
});

check('releases page is linked and versioned for 2.0.0', () => {
  must(/2\.0\.0/.test(html), 'page does not mention version 2.0.0');
  must(fs.existsSync(path.join(root, 'package.json')), 'package.json missing');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  must(pkg.version === '2.0.0', `package version is ${pkg.version}`);
  const desktop = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'desktop', 'package.json'), 'utf8'));
  must(desktop.version === '2.0.0', `desktop version is ${desktop.version}`);
  return 'site + package + desktop all 2.0.0';
});

check('provenance files exist and keep the MIT grant honest', () => {
  for (const file of ['LICENSE', 'NOTICE', 'TRADEMARK.md', 'CONTRIBUTING.md', 'docs/IP-POLICY.md', 'docs/ARCHITECTURE.md', 'docs/VALIDATION.md', 'docs/LICENSE.md']) {
    must(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  must(/MIT License/.test(license), 'LICENSE is not MIT');
  must(/Pritam Sarkar/.test(license), 'LICENSE lacks the copyright holder');
  const notice = fs.readFileSync(path.join(root, 'NOTICE'), 'utf8');
  must(/Apache-2\.0/.test(notice), 'NOTICE lacks the dataset attribution');
  must(/CC BY-ND/.test(notice), 'NOTICE lacks the docs/brand grant');
  const policy = fs.readFileSync(path.join(root, 'docs', 'IP-POLICY.md'), 'utf8');
  must(/cannot be retroactively revoked/i.test(policy), 'IP policy hides the MIT reality');
  must(/signed annotated tags/.test(policy), 'IP policy lacks signing guidance');
  return 'license, notice, trademark and IP policy present and candid';
});

check('README documents v2 truthfully', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const needle of ['Joe Browser 2.0', 'npm run test:devices', 'docs/VALIDATION.md', 'MIT', 'Pritam Sarkar', '29 observed']) {
    must(readme.includes(needle), `README missing "${needle}"`);
  }
  must(/not undetectable/i.test(readme), 'README hides the detection boundary');
  must(!/8 coherent device templates/.test(readme), 'README still carries the v1 template count');
  must(!/v1\.0\.0\.exe/.test(readme), 'README still links v1 binaries');
  return 'v2 README with honest scope';
});

const failed = results.filter((r) => !r.ok);
const target = path.relative(root, siteDir) || '.';
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} site checks passed (${target})`);
process.exit(failed.length === 0 ? 0 : 1);
