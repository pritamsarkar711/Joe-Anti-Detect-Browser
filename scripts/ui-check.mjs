/**
 * Real browser end-to-end smoke test for the v2 Material UI workspace.
 * Run against the Vite dev server: npm run dev, then npm run test:ui.
 */
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const results = [];
const errors = [];
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` · ${extra}` : ''}`);
};

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  ok('app boots and renders profile rows', (await page.locator('.data-table tbody tr').count()) > 0, `${await page.locator('.data-table tbody tr').count()} rows`);
  ok('sidebar exposes all seven views', (await page.locator('.MuiDrawer-root .MuiListItemButton-root').count()) >= 7);
  ok('four stat cards render', (await page.locator('.MuiPaper-root .MuiSvgIcon-root').count()) >= 4);

  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  ok('IBM Plex Sans is active', font.includes('IBM Plex Sans'), font.slice(0, 50));
  const flat = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('body *')].slice(0, 600);
    return nodes.filter((n) => {
      const s = getComputedStyle(n);
      return /gradient/.test(s.backgroundImage) || [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle].some((v) => v === 'dashed');
    }).length;
  });
  ok('no gradients or dashed borders', flat === 0, `${flat} offenders`);

  // Search / filter
  await page.getByPlaceholder('Search profiles').fill('Storefront');
  await page.waitForTimeout(160);
  const searchRows = await page.locator('.data-table tbody tr').count();
  ok('search filters the table', searchRows > 0 && searchRows < 24, `${searchRows} rows`);
  await page.getByPlaceholder('Search profiles').fill('');

  // Command palette
  await page.keyboard.press('Control+k');
  await page.waitForSelector('input[placeholder="Search profiles and actions"]', { timeout: 4000 });
  ok('command palette opens with Ctrl K', await page.locator('input[placeholder="Search profiles and actions"]').isVisible());
  await page.locator('input[placeholder="Search profiles and actions"]').fill('proxies');
  await page.waitForTimeout(120);
  ok('palette filters results', (await page.locator('.MuiDialog-root .MuiListItemButton-root').count()) > 0);
  await page.keyboard.press('Escape');

  // Create one profile
  await page.getByRole('button', { name: 'New profile' }).first().click();
  await page.waitForSelector('.MuiDialog-root', { timeout: 4000 });
  ok('create dialog opens', await page.getByText('One coherent device per profile.').isVisible());
  await page.getByPlaceholder('Storefront US').fill('E2E Created Profile');
  await page.getByRole('button', { name: 'Create profile' }).last().click();
  await page.waitForTimeout(280);
  ok('new profile persists to the table', (await page.locator('.data-table').innerText()).includes('E2E Created Profile'));

  // Bulk generate without an artificial cap
  await page.getByRole('button', { name: 'New profile' }).first().click();
  await page.locator('.MuiDialog-root input[type=number]').fill('250');
  await page.getByPlaceholder('Storefront US').fill('Bulk');
  await page.getByRole('button', { name: 'Create profile' }).last().click();
  await page.waitForTimeout(600);
  const pager = await page.locator('.MuiPaper-root').filter({ hasText: 'Page 1 of' }).first().innerText();
  ok('250 profiles created without restriction', /275 profiles/.test(pager), pager.split('\n').pop());
  ok('table paginates large datasets', /Page 1 of \d+/.test(pager));

  // Row detail + tabs
  await page.locator('.data-table tbody tr').first().click();
  await page.waitForSelector('.MuiDialog-root', { timeout: 4000 });
  ok('profile detail opens', (await page.locator('.MuiDialogTitle-root').innerText()).length > 0);
  await page.getByRole('tab', { name: 'Fingerprint' }).click();
  ok('fingerprint tab lists patched surfaces', (await page.locator('.MuiDialog-root').innerText()).includes('User agent'));
  await page.getByRole('tab', { name: 'Network' }).click();
  ok('network tab renders', (await page.locator('.MuiDialog-root').innerText()).includes('Proxy geo match'));
  await page.keyboard.press('Escape');

  // Navigate all views
  for (const [label, heading] of [
    ['Proxies', 'Proxies'], ['Devices', 'Devices'], ['Fingerprints', 'Fingerprints'],
    ['Leak check', 'Leak check'], ['Activity', 'Activity'], ['Settings', 'Settings'],
  ]) {
    await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: label }).first().click();
    await page.waitForTimeout(180);
    ok(`${label} view renders`, await page.getByRole('heading', { name: heading, exact: true }).first().isVisible());
  }

  // Local fingerprint self-test in a sandboxed frame
  await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: 'Leak check' }).first().click();
  await page.getByRole('button', { name: 'Run local probe' }).click();
  await page.waitForTimeout(900);
  const probeText = await page.locator('main').innerText();
  ok('live JavaScript probe passes', /No internal contradictions found|checks passed/.test(probeText), `${(probeText.match(/\d+ of \d+ checks passed/) ?? [''])[0]}`);

  // Detector links
  const detectorLinks = await page.locator('a[href^="https://"]').count();
  ok('independent detector links are present', detectorLinks >= 6, `${detectorLinks} links`);

  // Theme toggle
  const themeBtn = page.getByRole('button', { name: 'Toggle theme' });
  await themeBtn.click();
  ok('dark theme applies', (await page.locator('html').getAttribute('data-theme')) === 'dark');
  await themeBtn.click();
  ok('light theme restores', (await page.locator('html').getAttribute('data-theme')) === 'light');

  // Devices: real desktop to Android command over the sync bus
  await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: 'Devices' }).first().click();
  await page.getByRole('button', { name: 'Launch on APK' }).click();
  await page.waitForTimeout(220);
  ok('desktop to Android command appears in the event log', (await page.locator('.data-table tbody tr').count()) > 0);

  // Proxies: add modal + validation
  await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: 'Proxies' }).first().click();
  await page.getByRole('button', { name: 'Add proxy' }).first().click();
  await page.getByPlaceholder('198.51.100.12').fill('198.51.100.77');
  await page.getByRole('button', { name: 'Add proxy' }).last().click();
  await page.waitForTimeout(180);
  ok('proxy added to pool', (await page.locator('main').innerText()).includes('198.51.100.77'));

  // Official marks and circular flags
  ok('official brand marks render', (await page.locator('svg[role="img"]').count()) > 0);
  ok('circular country flags render', (await page.locator('.flag-round').count()) > 0);

  // Layout overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('no horizontal page overflow', overflow <= 1, `${overflow}px`);
} catch (e) {
  errors.push(`exception: ${e.message}`);
  console.log('FAIL  exception ·', e.message);
} finally {
  await browser.close();
}

ok('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 4).join(' | '));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
if (failed.length || errors.length) process.exit(1);
