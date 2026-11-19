/** Render the static SEO site with real URLs, local fonts and local brand assets. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'site');
const out = path.join(root, 'dist-site');
const siteUrl = (process.env.SITE_URL ?? 'https://joe-browser-control.vercel.app').replace(/\/+$/, '');
const branch = process.env.SITE_BRANCH ?? 'arena/b5fe5e24-joe-anti-detect-browser';

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

// Ship real screenshots and the OG image locally for hosts that can serve them.
const shots = path.join(root, 'assets', 'screenshots');
const shotOut = path.join(out, 'screenshots');
fs.mkdirSync(shotOut, { recursive: true });
for (const file of fs.readdirSync(shots)) {
  if (file.toLowerCase().endsWith('.png')) fs.copyFileSync(path.join(shots, file), path.join(shotOut, file));
}
const og = path.join(shots, 'og-image.png');
if (fs.existsSync(og)) fs.copyFileSync(og, path.join(out, 'og-image.png'));

console.log(`Built SEO site → ${out} (${siteUrl}, branch ${branch})`);
