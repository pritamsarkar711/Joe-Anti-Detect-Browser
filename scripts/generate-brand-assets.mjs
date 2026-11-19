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
  brave: 'siBrave',
  typescript: 'siTypescript', mui: 'siMui', google: 'siGoogle', node: 'siNodedotjs',
  vite: 'siVite', postgres: 'siPostgresql', linux: 'siLinux', apple: 'siApple',
  puppeteer: 'siPuppeteer', html5: 'siHtml5', javascript: 'siJavascript', docker: 'siDocker', git: 'siGit',
  xiaomi: 'siXiaomi', samsung: 'siSamsung', oppo: 'siOppo', vivo: 'siVivo',
  // extension publishers whose mark identifies the card at a glance
  ublock: 'siUblockorigin', bitwarden: 'siBitwarden', json: 'siJson',
  lighthouse: 'siLighthouse', darkreader: 'siDarkreader', wappalyzer: 'siWappalyzer',
};

const out = {};
for (const [name, key] of Object.entries(NAMES)) {
  const icon = icons[key];
  if (!icon) throw new Error(`Missing simple-icons export ${key}`);
  out[name] = { path: icon.path, hex: icon.hex, title: icon.title, source: icon.source ?? '' };
}

/*
 * Microsoft Edge.
 *
 * simple-icons REMOVED this mark for trademark reasons; it does not exist in
 * v16 (which this project pins), so the browser picker used to fall back to a
 * generic icon. The official geometry is taken verbatim from simple-icons
 * v11.14.0 `icons/microsoftedge.svg` and committed here so the picker, the
 * site and the docs all show the real Edge mark.
 */
out.edge = {
  path: "M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.8-.28-1.48-.78-.68-.5-1.22-1.17-.53-.66-.92-1.44-.38-.77-.58-1.6-.2-.83-.2-1.67 0-1 .32-1.96.33-.97.87-1.8.14.95.55 1.77.41.82 1.02 1.5.6.68 1.38 1.21.78.54 1.64.9.86.36 1.77.56.92.2 1.8.2 1.12 0 2.18-.24 1.06-.23 2.06-.72l.2-.1.2-.05zm-15.5-1.27q0 1.1.27 2.15.27 1.06.78 2.03.51.96 1.24 1.77.74.82 1.66 1.4-1.47-.2-2.8-.74-1.33-.55-2.48-1.37-1.15-.83-2.08-1.9-.92-1.07-1.58-2.33T.36 14.94Q0 13.54 0 12.06q0-.81.32-1.49.31-.68.83-1.23.53-.55 1.2-.96.66-.4 1.35-.66.74-.27 1.5-.39.78-.12 1.55-.12.7 0 1.42.1.72.12 1.4.35.68.23 1.32.57.63.35 1.16.83-.35 0-.7.07-.33.07-.65.23v-.02q-.63.28-1.2.74-.57.46-1.05 1.04-.48.58-.87 1.26-.38.67-.65 1.39-.27.71-.42 1.44-.15.72-.15 1.38zM11.96.06q1.7 0 3.33.39 1.63.38 3.07 1.15 1.43.77 2.62 1.93 1.18 1.16 1.98 2.7.49.94.76 1.96.28 1 .28 2.08 0 .89-.23 1.7-.24.8-.69 1.48-.45.68-1.1 1.22-.64.53-1.45.88-.54.24-1.11.36-.58.13-1.16.13-.42 0-.97-.03-.54-.03-1.1-.12-.55-.1-1.05-.28-.5-.19-.84-.5-.12-.09-.23-.24-.1-.16-.1-.33 0-.15.16-.35.16-.2.35-.5.2-.28.36-.68.16-.4.16-.95 0-1.06-.4-1.96-.4-.91-1.06-1.64-.66-.74-1.52-1.28-.86-.55-1.79-.89-.84-.3-1.72-.44-.87-.14-1.76-.14-1.55 0-3.06.45T.94 7.55q.71-1.74 1.81-3.13 1.1-1.38 2.52-2.35Q6.68 1.1 8.37.58q1.7-.52 3.58-.52Z",
  hex: '0078D7',
  title: 'Microsoft Edge',
  source: 'https://github.com/simple-icons/simple-icons/blob/11.14.0/icons/microsoftedge.svg',
};

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
