/** Capture real v2 Material UI screenshots from the running dev server. */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = path.join(process.cwd(), 'assets', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(OUT)) {
  const p = path.join(OUT, name);
  if (fs.statSync(p).isFile()) fs.rmSync(p, { force: true });
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = async (name) => {
  await page.waitForTimeout(360);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' });
  console.log('saved', `${name}.png`);
};
const nav = async (label, name) => {
  await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: label }).first().click();
  await page.waitForTimeout(220);
  await shot(name);
};

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('.data-table tbody tr');
await shot('01-profiles-light');

await page.locator('.data-table tbody tr').first().click();
await page.waitForSelector('.MuiDialog-paper');
await shot('02-profile-detail');
await page.keyboard.press('Escape');

await page.getByRole('button', { name: 'New profile' }).first().click();
await page.waitForSelector('.MuiDialog-paper');
await shot('03-create-profile');
await page.keyboard.press('Escape');

await page.keyboard.press('Control+k');
await page.waitForSelector('input[placeholder="Search profiles and actions"]');
await shot('04-command-palette');
await page.keyboard.press('Escape');

await nav('Proxies', '05-proxies');
await nav('Devices', '06-devices-sync');
await nav('Fingerprints', '07-fingerprints');
await nav('Leak check', '08-leak-check');
await page.getByRole('button', { name: 'Run local probe' }).click();
await page.waitForTimeout(600);
await shot('08b-leak-check-result');
await nav('Activity', '09-activity');
await nav('Settings', '10-settings');

await page.getByRole('button', { name: 'Toggle theme' }).click();
await nav('Profiles', '11-profiles-dark');
await page.getByRole('button', { name: 'Toggle theme' }).click();

await page.setViewportSize({ width: 1200, height: 630 });
await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: 'Profiles' }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'og-image.png'), animations: 'disabled' });
console.log('saved og-image.png');

await browser.close();
if (errors.length) { console.error('page errors:', errors.slice(0, 5)); process.exit(1); }
console.log(`\n${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} desktop screenshots in ${OUT}`);
