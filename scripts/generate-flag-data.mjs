#!/usr/bin/env node
/**
 * Inlines circular 1x1 country flags as URL-encoded SVG data URIs.
 *
 * The app previously loaded flag-icons through CSS `background-image` URLs.
 * Under `file://` (Electron and the Android WebView) those asset requests are
 * blocked, so every flag silently rendered as an empty grey circle. Data URIs
 * remove the request entirely: flags work offline, in the packaged app, and
 * with zero layout shift because the dimensions are known.
 *
 * Only the countries the product actually uses are emitted, which keeps the
 * bundle small (all 271 flag-icons are 2.7 MB).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'node_modules', 'flag-icons', 'flags', '1x1');
const OUT = path.join(root, 'src', 'ui', 'flagData.ts');

const CODES = [
  'bd', 'us', 'gb', 'de', 'fr', 'jp', 'in', 'ca', 'au', 'br', 'nl', 'sg',
  'se', 'kr', 'id', 'pk', 'tr', 'it', 'es', 'pl', 'ru', 'ua', 'mx', 'ar',
  'za', 'ng', 'eg', 'sa', 'ae', 'vn', 'th', 'my', 'ph', 'cn', 'hk', 'tw',
  'ch', 'at', 'be', 'dk', 'no', 'fi', 'ie', 'pt', 'gr', 'cz', 'ro', 'hu',
  'il', 'nz', 'cl', 'co', 'pe', 'xx',
];

const entries = [];
for (const cc of CODES) {
  const file = path.join(SRC, `${cc}.svg`);
  if (!fs.existsSync(file)) continue;
  let svg = fs.readFileSync(file, 'utf8')
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // strip the fixed id so several copies on one page never collide
  svg = svg.replace(/ id="flag-icons-[a-z]{2}"/, '');
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  entries.push(`  ${cc}: '${uri}',`);
}

const body = `/**
 * GENERATED FILE — run \`npm run build:flags\` to refresh.
 *
 * Circular country flags as inline data URIs (flag-icons, MIT).
 * Data URIs are used on purpose: the packaged Electron app and the Android
 * WebView load the UI over file://, where relative asset URLs are not reliable.
 * Do not hand-edit.
 */
export const FLAG_DATA: Record<string, string> = {
${entries.join('\n')}
};

export const FLAG_CODES = Object.keys(FLAG_DATA);
`;

fs.writeFileSync(OUT, body);
console.log(`Wrote ${entries.length} inline flags → src/ui/flagData.ts (${(body.length / 1024).toFixed(1)} kB)`);
