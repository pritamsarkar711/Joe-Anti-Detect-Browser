/** Render the static SEO site with real URLs, local fonts and local brand assets. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const src = path.join(root, 'site');
const out = path.join(root, 'dist-site');
const siteUrl = (process.env.SITE_URL ?? 'https://joe-browser-control.vercel.app').replace(/\/+$/, '');

/**
 * The footer links `blob/<branch>/docs/VALIDATION.md` on GitHub. A stale
 * hardcoded branch 404s, so default to the branch being built (CI sets
 * SITE_BRANCH explicitly; local and PR builds fall back to the real HEAD,
 * then to main outside a git checkout).
 */
function currentBranch() {
  if (process.env.SITE_BRANCH) return process.env.SITE_BRANCH;
  try {
    const name = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (name && name !== 'HEAD') return name;
  } catch { /* not a git checkout */ }
  return 'main';
}
const branch = currentBranch();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const template = (content) => content
  .replaceAll('{{SITE_URL}}', siteUrl)
  .replaceAll('{{BRANCH}}', branch);

function copyRendered(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyRendered(a, b);
    else if (/\.(html|css|xml|txt|json|svg)$/i.test(entry.name)) fs.writeFileSync(b, template(fs.readFileSync(a, 'utf8')));
    else fs.copyFileSync(a, b);
  }
}
copyRendered(src, out);

// Keep IBM Plex Sans local: no external font CDN in the app or on the site.
const fontSrc = path.join(root, 'node_modules', '@fontsource', 'ibm-plex-sans', 'files');
const fontOut = path.join(out, 'fonts');
fs.mkdirSync(fontOut, { recursive: true });
for (const weight of [400, 500, 600, 700]) {
  const file = `ibm-plex-sans-latin-${weight}-normal.woff2`;
  fs.copyFileSync(path.join(fontSrc, file), path.join(fontOut, file));
}

/**
 * Screenshots.
 *
 * The site only uses the cropped, chrome-free captures in `site/screens`
 * (~1.1 MB total). Shipping every raw capture in assets/screenshots used to add
 * ~2 MB of images that no page referenced, so it is no longer copied; the OG
 * card is the one full-frame image that stays.
 */
const og = path.join(root, 'assets', 'screenshots', 'og-image.png');
if (fs.existsSync(og)) fs.copyFileSync(og, path.join(out, 'og-image.png'));

console.log(`Built SEO site → ${out} (${siteUrl}, branch ${branch})`);
