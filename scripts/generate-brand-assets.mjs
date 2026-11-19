/**
 * Extract official brand SVG paths from simple-icons (CC0) into committed
 * assets, so no runtime CDN is needed and every mark is the official one.
 * Also writes the Joe Browser mark and a small set of circular flag assets.
 *
 * Run after installing dependencies: npm run build:brands
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const icons = require('simple-icons');
const root = process.cwd();

const NAMES = {
  github: 'siGithub', supabase: 'siSupabase', vercel: 'siVercel', electron: 'siElectron',
  android: 'siAndroid', chrome: 'siGooglechrome', firefox: 'siFirefox', react: 'siReact',
  typescript: 'siTypescript', mui: 'siMui', google: 'siGoogle', node: 'siNodedotjs',
  vite: 'siVite', postgres: 'siPostgresql', linux: 'siLinux', apple: 'siApple',
  puppeteer: 'siPuppeteer', html5: 'siHtml5', javascript: 'siJavascript', docker: 'siDocker', git: 'siGit',
  xiaomi: 'siXiaomi', samsung: 'siSamsung', oppo: 'siOppo', vivo: 'siVivo',
};

const out = {};
for (const [name, key] of Object.entries(NAMES)) {
  const icon = icons[key];
  if (!icon) throw new Error(`Missing simple-icons export ${key}`);
  out[name] = { path: icon.path, hex: icon.hex, title: icon.title, source: icon.source ?? '' };
}

// simple-icons has no Windows mark; the official four-pane Windows logo is a
// plain geometric path, so we ship it directly (still a real brand mark).
out.windows = {
  path: 'M0 2.4 10.2 1v9.4H0V2.4Zm11.6-1.6L24 0v10.4H11.6V.8ZM0 13.2h10.2v9.7L0 21.6v-8.4Zm11.6 0H24V24l-12.4-1.4v-9.4Z',
  hex: '0078D4', title: 'Windows', source: 'Microsoft Windows four-pane mark',
};

const ts = `/**
 * Official brand marks from simple-icons (CC0). Generated, do not edit.
 * https://simpleicons.org  ·  npm run build:brands
 */
export interface BrandMark { path: string; hex: string; title: string; source: string }
export const BRAND_MARKS: Record<string, BrandMark> = ${JSON.stringify(out, null, 2)};

export function brandSvg(name: string, size = 20, color?: string): string {
  const m = BRAND_MARKS[name];
  if (!m) return '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' + (color || '#' + m.hex) + '" aria-label="' + m.title + '" role="img"><path d="' + m.path + '"/></svg>';
}
`;
fs.writeFileSync(path.join(root, 'src', 'ui', 'brandPaths.ts'), ts);
fs.mkdirSync(path.join(root, 'site'), { recursive: true });
fs.writeFileSync(path.join(root, 'site', 'brands.json'), JSON.stringify(out, null, 2));

const svgFor = (m) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="${m.title}"><title>${m.title}</title><path fill="#${m.hex}" d="${m.path}"/></svg>\n`;
const committedMarks = path.join(root, 'assets', 'brand', 'marks');
const siteMarks = path.join(root, 'site', 'brands');
fs.mkdirSync(committedMarks, { recursive: true });
fs.mkdirSync(siteMarks, { recursive: true });
for (const [name, mark] of Object.entries(out)) {
  const svg = svgFor(mark);
  fs.writeFileSync(path.join(committedMarks, `${name}.svg`), svg);
  fs.writeFileSync(path.join(siteMarks, `${name}.svg`), svg);
}

const joeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Joe Browser"><title>Joe Browser</title><rect width="64" height="64" rx="2" fill="#ffffff"/><circle cx="32" cy="32" r="24" fill="none" stroke="#D81B60" stroke-width="5"/><circle cx="32" cy="32" r="9" fill="#D81B60"/></svg>\n`;
fs.mkdirSync(path.join(root, 'assets', 'brand'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'brand', 'joe-browser.svg'), joeSvg);
fs.writeFileSync(path.join(root, 'public', 'favicon.svg'), joeSvg);
fs.writeFileSync(path.join(root, 'site', 'favicon.svg'), joeSvg);

const flagDir = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagOut = path.join(root, 'assets', 'brand', 'flags');
const siteFlags = path.join(root, 'site', 'flags');
fs.mkdirSync(flagOut, { recursive: true });
fs.mkdirSync(siteFlags, { recursive: true });
for (const code of ['bd', 'us', 'gb', 'de', 'fr', 'jp', 'in', 'ca', 'au', 'br', 'nl', 'sg']) {
  const svg = fs.readFileSync(path.join(flagDir, `${code}.svg`), 'utf8');
  fs.writeFileSync(path.join(flagOut, `${code}.svg`), svg);
  fs.writeFileSync(path.join(siteFlags, `${code}.svg`), svg);
}

console.log(`Wrote ${Object.keys(out).length} official brand marks, Joe Browser mark and 12 flags.`);
