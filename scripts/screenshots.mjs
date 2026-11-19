/**
 * Capture the screenshots the site and the README use.
 *
 * Rules:
 * - every image is captured from the running app, never mocked up;
 * - the sidebar is navigation, not content, so it is cropped out of the
 *   `/site` images to keep the gallery readable;
 * - a deterministic workspace is seeded into localStorage first, so a capture
 *   never depends on whatever happened to be in the previous browser profile.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = path.join(process.cwd(), 'assets', 'screenshots');
const SITE_OUT = path.join(process.cwd(), 'site', 'screens');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SITE_OUT, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

/** Sidebar width in the app shell; used to crop gallery images. */
const NAV_W = 236;

const shot = async (name, { clipNav = false, height = 900 } = {}) => {
  await page.waitForTimeout(340);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' });
  if (clipNav) {
    await page.screenshot({
      path: path.join(SITE_OUT, `${name}.png`),
      animations: 'disabled',
      // Cropping to the content keeps the gallery dense: a 900px-tall capture
      // of a six-row table is mostly empty canvas.
      clip: { x: NAV_W, y: 0, width: 1440 - NAV_W, height },
    });
  }
  console.log('saved', `${name}.png`);
};

const nav = async (label) => {
  await page.locator('nav .MuiListItemButton-root', { hasText: label }).first().click();
  await page.waitForTimeout(260);
};

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
// Seed a clean demo workspace: the persisted one may contain leftovers from a
// previous capture run or a manual session.
await page.evaluate(() => window.localStorage.removeItem('joe-browser:v3'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.data-table tbody tr');

await nav('Profiles');
await shot('01-profiles-light', { clipNav: true, height: 620 });

await page.getByText('Storefront US', { exact: true }).first().click();
await page.waitForSelector('.MuiDialog-paper');
await shot('02-profile-detail');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.getByRole('button', { name: 'New profile' }).first().click();
await page.waitForSelector('.MuiDialog-paper');
await shot('03-create-profile');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.keyboard.press('Control+k');
await page.waitForSelector('input[placeholder="Jump to a view or action"]');
await shot('04-command-palette');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await nav('Proxies');
await shot('05-proxies', { clipNav: true });
await nav('Devices');
await shot('06-devices-sync', { clipNav: true });
await nav('Fingerprints');
await shot('07-fingerprints', { clipNav: true });
await nav('Leak check');
await shot('08-leak-check', { clipNav: true });
await page.getByRole('button', { name: 'Run local probe' }).click();
await page.waitForTimeout(700);
await shot('08b-leak-check-result', { clipNav: true });
await nav('History');
await shot('09-history', { clipNav: true, height: 620 });
await nav('Extensions');
await shot('10-extensions', { clipNav: true, height: 780 });
await nav('Settings');
await shot('11-settings', { clipNav: true });

// Dark theme, captured through the real control so the MUI palette switches.
await page.getByRole('button', { name: 'Toggle theme' }).click();
await page.waitForTimeout(260);
await nav('Profiles');
await shot('12-profiles-dark', { clipNav: true });
await page.getByRole('button', { name: 'Toggle theme' }).click();
await page.waitForTimeout(200);

// Open Graph card: the product view without the chrome around it.
await page.setViewportSize({ width: 1200, height: 630 });
await nav('Profiles');
await page.waitForTimeout(320);
await page.screenshot({ path: path.join(OUT, 'og-image.png'), animations: 'disabled' });
console.log('saved og-image.png');

// Mobile capture for the site's small-screen section.
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto(BASE, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: path.join(SITE_OUT, '13-mobile-profiles.png'), animations: 'disabled' });
console.log('saved 13-mobile-profiles.png');

await browser.close();
if (errors.length) { console.error('page errors:', errors.slice(0, 5)); process.exit(1); }

const siteShots = fs.readdirSync(SITE_OUT).filter((f) => f.endsWith('.png'));
console.log(`\n${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} app screenshots in ${OUT}`);
console.log(`${siteShots.length} optimised site screenshots in ${SITE_OUT}`);
