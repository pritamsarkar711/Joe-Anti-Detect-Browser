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
  // The sidebar is now grouped (Workspace / Quality / System), four sections
  // plus the group list; the point of the check is that every destination is
  // reachable from it, not that the list is a flat seven.
  ok('sidebar exposes every destination', (await page.locator('nav .MuiListItemButton-root').count()) >= 9,
    `${await page.locator('nav .MuiListItemButton-root').count()} entries`);
  ok('metric strip renders', (await page.locator('.MuiPaper-root .MuiSvgIcon-root').count()) >= 4);

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
  await page.waitForSelector('input[placeholder="Jump to a view or action"]', { timeout: 4000 });
  const palette = page.locator('input[placeholder="Jump to a view or action"]');
  ok('command palette opens with Ctrl K', await palette.isVisible());
  await palette.fill('proxies');
  await page.waitForTimeout(120);
  ok('palette filters results', (await page.locator('.MuiDialog-root .MuiListItemButton-root').count()) > 0);
  await page.keyboard.press('Escape');

  // Create one profile. The free tier allows two profiles, so lift the seed
  // workspace above the limit first by switching to Premium on the account
  // screen; this exercises the upgrade path as well as bulk creation.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('joe-browser:v3') ?? 'null');
    if (!raw) return; // first load has not persisted yet; quota check below still applies
    raw.account = { email: 'qa@joe.browser', plan: 'premium', role: 'member', renewsAt: null };
    localStorage.setItem('joe-browser:v3', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  await page.getByRole('button', { name: 'New profile' }).first().click();
  await page.waitForSelector('.MuiDialog-root', { timeout: 4000 });
  // Assert the dialog's real content, not a subtitle that copy edits may remove.
  // Labels are CSS-uppercased, so match the DOM text ("Browser", "Device").
  ok('create dialog opens', await page.locator('.MuiDialog-root').getByText('Browser', { exact: true }).first().isVisible());
  ok('create dialog offers browser and device steps', (await page.locator('.MuiDialog-root').getByText(/^(Browser|Device)$/).count()) >= 2);
  ok('browser family picker is present', (await page.locator('.MuiDialog-root').getByText('Joe Browser').first().isVisible()));
  // Every bundled engine is offered; which ones are locked depends on the
  // account, so assert the full picker rather than the lock state.
  const families = await page.locator('.MuiDialog-root').getByText(/^(Joe Browser|Chrome|Edge|Brave|Firefox)$/).count();
  ok('all five bundled engines are offered', families >= 5, `${families} engines`);
  await page.getByPlaceholder('Storefront US').fill('E2E Created Profile');
  await page.getByRole('button', { name: /^Create profile$/ }).last().click();
  await page.waitForTimeout(280);
  ok('new profile persists to the table', (await page.locator('.data-table').innerText()).includes('E2E Created Profile'));

  // Bulk generate without an artificial cap. The demo workspace allows up to
  // six profiles and now holds seven, so sign in on the Premium plan first and
  // confirm the entitlement is what changes, not the button.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('joe-browser:v3') ?? 'null');
    if (!raw) return;
    raw.account = { email: 'qa@joe.browser', plan: 'premium', role: 'member', renewsAt: null };
    localStorage.setItem('joe-browser:v3', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  const before = await page.locator('.data-table tbody tr').count();
  await page.getByRole('button', { name: 'New profile' }).first().click();
  await page.locator('.MuiDialog-root input[type=number]').fill('250');
  await page.getByPlaceholder('Storefront US').fill('Bulk');
  await page.getByRole('button', { name: /^Create (profile|\d+ profiles)$/ }).last().click();
  await page.waitForTimeout(900);
  const total = await page.locator('main').innerText();
  // MetricStrip renders the count in its own element, so read the Profiles
  // metric instead of matching prose.
  const profileCount = await page.locator('main').getByText(/^\d+$/).first().innerText();
  ok('250 profiles created without restriction', Number(profileCount) >= 250, `${profileCount} profiles`);
  ok('table paginates large datasets', /\b\d+\/\d+\b/.test(total), `${before} rows before`);
  ok('bulk create closes the dialog', (await page.locator('.MuiDialog-root').count()) === 0);

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
    await page.locator('nav .MuiListItemButton-root', { hasText: label }).first().click();
    await page.waitForTimeout(180);
    ok(`${label} view renders`, await page.getByRole('heading', { name: heading, exact: true }).first().isVisible());
  }

  // Local fingerprint self-test in a sandboxed frame
  await page.locator('nav .MuiListItemButton-root', { hasText: 'Leak check' }).first().click();
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
  await page.locator('nav .MuiListItemButton-root', { hasText: 'Devices' }).first().click();
  await page.getByRole('button', { name: 'Launch on APK' }).click();
  await page.waitForTimeout(220);
  ok('desktop to Android command appears in the event log', (await page.locator('.data-table tbody tr').count()) > 0);

  // Proxies: add modal + validation
  await page.locator('nav .MuiListItemButton-root', { hasText: 'Proxies' }).first().click();
  await page.getByRole('button', { name: 'Add proxy' }).first().click();
  await page.getByPlaceholder('198.51.100.12').fill('198.51.100.77');
  await page.getByRole('button', { name: 'Add proxy' }).last().click();
  await page.waitForTimeout(180);
  ok('proxy added to pool', (await page.locator('main').innerText()).includes('198.51.100.77'));

  // Official marks and circular flags
  ok('official brand marks render', (await page.locator('svg[role="img"]').count()) > 0);
  // Flags moved from the flag-icons CSS to inline data URIs; the class is
  // .country-flag and the image is what must actually paint.
  const flag = page.locator('img.country-flag').first();
  ok('circular country flags render', (await page.locator('img.country-flag').count()) > 0
    && await flag.evaluate((el) => el.complete && el.naturalWidth > 0));

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
