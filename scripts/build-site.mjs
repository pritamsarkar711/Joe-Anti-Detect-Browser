/** Render the static SEO site with real URLs injected. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'site');
const out = path.join(root, 'dist-site');
const siteUrl = (process.env.SITE_URL ?? 'https://joe-browser-control.vercel.app').replace(/\/+$/, '');
const branch = process.env.SITE_BRANCH ?? 'arena/b5fe5e24-joe-anti-detect-browser';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(src)) {
  const content = fs.readFileSync(path.join(src, name), 'utf8')
    .replaceAll('{{SITE_URL}}', siteUrl)
    .replaceAll('{{BRANCH}}', branch);
  fs.writeFileSync(path.join(out, name), content);
}

// Also ship the OG image locally for hosts that can serve it.
const og = path.join(root, 'assets', 'screenshots', 'og-image.png');
if (fs.existsSync(og)) fs.copyFileSync(og, path.join(out, 'og-image.png'));

console.log(`Built SEO site → ${out} (${siteUrl}, branch ${branch})`);
