/**
 * Brand-asset check.
 *
 * The Android launcher icon is assembled from XML layers that are edited by
 * hand, so nothing type-checks them. A previous release shipped a white glyph
 * on a white adaptive-icon background: on every device (minSdk 28, so the
 * adaptive icon is the only one used) the app appeared to have no icon at all.
 * That is the failure this guards.
 *
 * Rules:
 *  - the adaptive-icon foreground glyph and background tile must contrast;
 *  - the background layer must be the brand colour, not a placeholder;
 *  - every launcher entry point must exist and resolve;
 *  - the splash must draw the logo, not a bare coloured box;
 *  - the J geometry must match MARK_GEOMETRY in src/ui/Brand.tsx.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'apps/android/app/src/main/res');
const brand = fs.readFileSync(path.join(root, 'src/ui/Brand.tsx'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'apps/android/app/src/main/AndroidManifest.xml'), 'utf8');

let failed = 0;
const check = (label, fn) => {
  try {
    const detail = fn();
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${label} — ${error.message}`);
  }
};
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
const read = (...parts) => fs.readFileSync(path.join(res, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(res, ...parts));

const rgb = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const luminance = (hex) => {
  const { r, g, b } = rgb(hex);
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const MARK_COLOR = (/export const MARK_COLOR = '(#[0-9a-fA-F]{6})'/.exec(brand) || [])[1];
const GEOMETRY = (/export const MARK_GEOMETRY = \{([\s\S]*?)\} as const;/.exec(brand) || [])[1];
// The path uses relative commands (v, a), so it must be captured whole.
const J_PATH = (/(?:const J_PATH = '|pathData=")([^'"]+)['"]/.exec(brand) || [])[1];
const STROKE = Number((/stroke:\s*([\d.]+)/.exec(GEOMETRY) || [])[1]);
const RADIUS = Number((/radius:\s*([\d.]+)/.exec(GEOMETRY) || [])[1]);

check('brand geometry is discoverable in src/ui/Brand.tsx', () => {
  must(MARK_COLOR, 'MARK_COLOR not found');
  must(J_PATH, 'J path not found');
  must(Number.isFinite(STROKE) && STROKE > 0, 'MARK_GEOMETRY.stroke not found');
  must(Number.isFinite(RADIUS) && RADIUS > 0, 'MARK_GEOMETRY.radius not found');
  return `${MARK_COLOR}, stroke ${STROKE}, radius ${RADIUS}`;
});

check('launcher icon is declared and every referenced layer exists', () => {
  const icon = (/android:icon="@mipmap\/([\w]+)"/.exec(manifest) || [])[1];
  const round = (/android:roundIcon="@mipmap\/([\w]+)"/.exec(manifest) || [])[1];
  must(icon, 'android:icon is not a @mipmap drawable');
  must(round, 'android:roundIcon is not a @mipmap drawable');
  for (const name of [icon, round]) {
    must(exists('mipmap-anydpi-v26', `${name}.xml`), `mipmap-anydpi-v26/${name}.xml is missing`);
  }
  return `@mipmap/${icon} + @mipmap/${round}`;
});

check('adaptive icon references real background and foreground layers', () => {
  const xml = read('mipmap-anydpi-v26', 'ic_launcher.xml');
  const refs = [...xml.matchAll(/android:drawable="@drawable\/([\w]+)"/g)].map((m) => m[1]);
  must(refs.includes('ic_launcher_background'), 'no background layer');
  must(refs.includes('ic_launcher_foreground'), 'no foreground layer');
  const round = read('mipmap-anydpi-v26', 'ic_launcher_round.xml');
  must(round.includes('ic_launcher_background') && round.includes('ic_launcher_foreground'),
    'round icon does not use the same layers');
  for (const name of refs) {
    must(exists('drawable', `${name}.xml`), `drawable/${name}.xml is missing`);
  }
  return `${refs.length} layers resolve`;
});

check('foreground glyph and background tile are legible together', () => {
  const fg = read('drawable', 'ic_launcher_foreground.xml');
  const bg = read('drawable', 'ic_launcher_background.xml');
  const glyph = (/android:strokeColor="(#[0-9a-fA-F]{6})"/.exec(fg) || [])[1];
  const tile = (/android:color="(#[0-9a-fA-F]{6})"/.exec(bg) || [])[1];
  must(glyph, 'foreground has no stroke colour');
  must(tile, 'background has no solid colour');
  // An icon is a graphic, not body copy: hold it to the 3:1 non-text floor.
  const ratio = contrast(glyph, tile);
  must(ratio >= 3, `${glyph} on ${tile} is ${ratio.toFixed(2)}:1, below the 3:1 floor`);
  return `${glyph} on ${tile} = ${ratio.toFixed(1)}:1`;
});

check('background tile is the brand colour', () => {
  const bg = read('drawable', 'ic_launcher_background.xml');
  const tile = (/android:color="(#[0-9a-fA-F]{6})"/.exec(bg) || [])[1];
  must(tile.toLowerCase() === MARK_COLOR.toLowerCase(),
    `background is ${tile}, expected brand ${MARK_COLOR}`);
  return tile;
});

check('foreground glyph matches the canonical J path', () => {
  const fg = read('drawable', 'ic_launcher_foreground.xml');
  must(fg.includes(J_PATH), `foreground path does not match "${J_PATH}"`);
  must(new RegExp(`android:strokeWidth="${STROKE}"`).test(fg), `foreground stroke is not ${STROKE}`);
  return J_PATH;
});

check('splash draws the logo rather than a bare tile', () => {
  const splash = read('drawable', 'splash_background.xml');
  must(splash.includes('@drawable/ic_mark'), 'splash does not reference the mark');
  const mark = read('drawable', 'ic_mark.xml');
  must(mark.includes(MARK_COLOR), `ic_mark does not use ${MARK_COLOR}`);
  must(mark.includes(J_PATH), 'ic_mark does not use the canonical J path');
  const compact = mark.replace(/\s+/g, ' ');
  must(new RegExp(`A${RADIUS},${RADIUS}`).test(compact),
    `ic_mark corner radius does not match MARK_GEOMETRY.radius (${RADIUS})`);
  return 'ic_mark centred on the splash';
});

check('no launcher drawable is a plain white box', () => {
  for (const name of fs.readdirSync(path.join(res, 'drawable')).filter((f) => f.startsWith('ic_'))) {
    const xml = read('drawable', name);
    const hasMark = xml.includes(J_PATH);
    const hasTile = xml.includes(MARK_COLOR) || xml.includes('ic_launcher_background') || xml.includes('ic_mark');
    must(hasMark || hasTile, `drawable/${name} contains neither the mark nor the brand tile`);
  }
  return 'all ic_* drawables carry the identity';
});

check('favicon and README logo use the canonical J monogram', () => {
  // The brand generator once emitted the retired ring-and-dot, so the README
  // header and favicons disagreed with the app itself. Every published copy
  // of the mark must be the J from Brand.tsx.
  const files = ['public/favicon.svg', 'site/favicon.svg', 'assets/brand/joe-browser.svg'];
  for (const rel of files) {
    const svg = fs.readFileSync(path.join(root, rel), 'utf8');
    must(svg.includes(J_PATH), `${rel} does not contain the canonical J path`);
    must(svg.includes(MARK_COLOR), `${rel} does not use ${MARK_COLOR}`);
    must(!/<circle/.test(svg), `${rel} still contains the retired ring-and-dot mark`);
  }
  return `${files.length} published marks match Brand.tsx`;
});

if (failed > 0) {
  console.log(`\n${failed} brand check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nAll brand-asset checks passed');
