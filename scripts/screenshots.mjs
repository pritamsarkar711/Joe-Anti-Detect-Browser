/** Capture real screenshots of the running app with headless Chromium. */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = path.join(process.cwd(), 'assets', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const shot = async (name) => {
  await page.waitForTimeout(320);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' });
  console.log('saved', `${name}.png`);
};

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('.data-table tbody tr');
await shot('01-profiles-dark');

await page.locator('.data-table tbody tr').first().click();
await page.waitForSelector('.drawer');
await shot('02-profile-detail');
await page.keyboard.press('Escape');

await page.getByRole('button', { name: 'New profile' }).click();
await page.waitForSelector('.drawer');
await shot('03-create-profile');
await page.keyboard.press('Escape');

await page.keyboard.press('Control+k');
await page.waitForSelector('.palette');
await shot('04-command-palette');
await page.keyboard.press('Escape');

for (const [label, name] of [
  ['Proxies', '05-proxies'], ['Devices', '06-devices-sync'], ['Fingerprints', '07-fingerprints'],
  ['Activity', '08-activity'], ['Settings', '09-settings'],
]) {
  await page.locator('.nav-item', { hasText: label }).click();
  await shot(name);
}

await page.getByRole('button', { name: 'Toggle theme' }).click();
await page.locator('.nav-item', { hasText: 'Profiles' }).click();
await shot('10-profiles-light');
await page.getByRole('button', { name: 'Toggle theme' }).click();

// OG image: 1200x630 crop of the dashboard
await page.setViewportSize({ width: 1200, height: 630 });
await page.locator('.nav-item', { hasText: 'Profiles' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'og-image.png'), animations: 'disabled' });
console.log('saved og-image.png');

await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log(`\n${fs.readdirSync(OUT).length} screenshots in ${OUT}`);
