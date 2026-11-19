/** Real browser end-to-end smoke test against the running dev server. */
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const results = [];
const errors = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  ok('app boots and renders profile rows', (await page.locator('.data-table tbody tr').count()) > 0, `${await page.locator('.data-table tbody tr').count()} rows`);
  ok('sidebar has all six views', (await page.locator('.nav-item').count()) === 6);
  ok('stat cards render', (await page.locator('.stat').count()) === 4);

  // Search / filter
  await page.locator('.search-box input').fill('Storefront');
  await page.waitForTimeout(120);
  const searchRows = await page.locator('.data-table tbody tr').count();
  ok('search filters the table', searchRows > 0 && searchRows < 24, `${searchRows} rows`);
  await page.locator('.search-box input').fill('');

  // Command palette
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.palette', { timeout: 4000 });
  ok('command palette opens with Ctrl+K', await page.locator('.palette').isVisible());
  await page.locator('.palette-input input').fill('proxies');
  ok('palette filters results', (await page.locator('.palette-row').count()) > 0);
  await page.keyboard.press('Escape');

  // Create one profile
  await page.getByRole('button', { name: 'New profile' }).click();
  await page.waitForSelector('.drawer', { timeout: 4000 });
  ok('create drawer opens', await page.locator('.template-card').count() >= 8, `${await page.locator('.template-card').count()} templates`);
  await page.locator('.drawer .form-grid input.input').first().fill('E2E Created Profile');
  await page.locator('.template-card').nth(1).click();
  await page.locator('.advanced-toggle').click();
  ok('advanced overrides expand', await page.locator('.advanced-body').isVisible());
  await page.getByRole('button', { name: /Create profile/ }).last().click();
  await page.waitForTimeout(250);
  ok('new profile persists to the table', (await page.locator('.data-table').innerText()).includes('E2E Created Profile'));

  // Bulk generate 250 profiles (no artificial cap)
  await page.getByRole('button', { name: 'New profile' }).click();
  await page.locator('.drawer .form-grid input[type=number]').fill('250');
  await page.locator('.drawer .form-grid input.input').first().fill('Bulk');
  await page.getByRole('button', { name: /Create 250 profiles/ }).click();
  await page.waitForTimeout(500);
  const bulkCount = Number((await page.locator('.nav-item').first().locator('em').innerText()).trim());
  ok('250 profiles created without restriction', bulkCount >= 274, `${bulkCount} total`);
  const pagerText = await page.locator('.pager').innerText();
  ok('table paginates large datasets', /Page 1 of \d+/.test(pagerText), pagerText.split('\n')[0]);

  // Row detail + tabs
  await page.locator('.data-table tbody tr').first().click();
  await page.waitForSelector('.drawer', { timeout: 4000 });
  ok('profile detail opens', (await page.locator('.detail-title h2').innerText()).length > 0);
  await page.getByRole('tab', { name: 'Fingerprint' }).click();
  ok('fingerprint tab lists patched surfaces', (await page.locator('.surface-row').count()) >= 8, `${await page.locator('.surface-row').count()} surfaces`);
  await page.getByRole('tab', { name: 'Network' }).click();
  ok('network tab renders', await page.locator('.drawer-body').isVisible());
  await page.keyboard.press('Escape');

  // Navigate all views
  for (const [label, selector] of [
    ['Proxies', '.data-table'], ['Devices', '.device-card'], ['Fingerprints', '.fp-layout'],
    ['Activity', '.timeline'], ['Settings', '.settings-grid'],
  ]) {
    await page.locator('.nav-item', { hasText: label }).click();
    await page.waitForTimeout(180);
    ok(`${label} view renders`, await page.locator(selector).first().isVisible());
  }

  // Theme toggle
  const themeBtn = page.getByRole('button', { name: 'Toggle theme' });
  await themeBtn.click();
  ok('light theme applies', (await page.locator('html').getAttribute('data-theme')) === 'light');
  await themeBtn.click();

  // Devices: real EXE -> APK command over the sync bus
  await page.locator('.nav-item', { hasText: 'Devices' }).click();
  await page.getByRole('button', { name: 'Launch on APK' }).click();
  await page.waitForTimeout(220);
  ok('EXE → APK command appears in the event log', (await page.locator('.event-row').count()) > 0, `${await page.locator('.event-row').count()} events`);

  // Proxies: add modal + validation
  await page.locator('.nav-item', { hasText: 'Proxies' }).click();
  await page.getByRole('button', { name: 'Add proxy' }).click();
  await page.locator('.modal .form-grid input.input').fill('198.51.100.77:1080');
  ok('proxy parser validates input', (await page.locator('.parse-result.ok').count()) === 1);
  await page.getByRole('button', { name: 'Add proxy' }).last().click();
  await page.waitForTimeout(180);
  ok('proxy added to pool', (await page.locator('.data-table').innerText()).includes('198.51.100.77'));

  // Layout overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('no horizontal page overflow', overflow <= 1, `${overflow}px`);
} catch (e) {
  errors.push(`exception: ${e.message}`);
  console.log('FAIL  exception —', e.message);
} finally {
  await browser.close();
}

ok('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
if (failed.length || errors.length) process.exit(1);
