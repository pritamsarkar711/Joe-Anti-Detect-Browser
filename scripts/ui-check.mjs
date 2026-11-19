/**
 * Real browser end-to-end smoke test for the Material UI workspace.
 *
 * Self-contained: it reuses BASE_URL when that page answers, otherwise it starts
 * a server (a built `dist/` via preview, or the dev server) and shuts it down on
 * exit. `npm run test:ui` therefore works on a clean checkout.
 */
import { launchBrowser } from './chromium.mjs';
import { ensureServer } from './serve.mjs';

const server = await ensureServer();
const BASE = server.base;
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

  // --- the plan cannot be forged from the client -----------------------
  // v3.1.1 wrote `plan: 'premium'` into localStorage and the app believed it, so
  // this suite used to do exactly that to unlock bulk creation. That is the
  // bypass the release removes, so the write is now a regression test: after a
  // reload the account must still be the unverified local tier.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('joe-browser:v3') ?? 'null');
    if (!raw) return;
    raw.account = { email: 'someone@example.com', plan: 'premium', role: 'owner', renewsAt: null };
    localStorage.setItem('joe-browser:v3', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  await page.getByRole('button', { name: 'Account' }).click();
  await page.waitForSelector('.MuiMenu-root');
  const accountMenu = await page.locator('.MuiMenu-root').innerText();
  ok('a forged premium/owner account in localStorage is ignored', !/premium|owner/i.test(accountMenu),
    accountMenu.split('\n').slice(0, 2).join(' / '));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'New profile' }).first().click();
  await page.waitForSelector('.MuiDialog-root', { timeout: 4000 });
  const dialogText = await page.locator('.MuiDialog-root').innerText();
  ok('create dialog opens', /Browser identity/i.test(dialogText));
  ok('create dialog offers browser and device steps', (await page.locator('.MuiDialog-root').getByText(/^(Browser identity|Device)$/).count()) >= 2);
  ok('browser family picker is present', dialogText.includes('Joe Browser'));
  // One engine is bundled: four Chromium-compatible identities, and Firefox is
  // declared unavailable rather than offered as a fake Gecko profile.
  const families = await page.locator('.MuiDialog-root').getByText(/^(Joe Browser|Chrome|Edge|Brave)$/).count();
  ok('four Chromium identities are offered', families >= 4, `${families} identities`);
  ok('the picker explains that Firefox is unavailable', /Firefox is not available/i.test(dialogText));

  // The demo tier holds six profiles; a seventh must be refused with a reason.
  await page.getByPlaceholder('Storefront US').fill('E2E Created Profile');
  await page.getByRole('button', { name: /^Create profile$/ }).last().click();
  await page.waitForTimeout(320);
  const afterRefusal = await page.locator('.data-table').innerText();
  const stillOpen = (await page.locator('.MuiDialog-root').count()) > 0;
  ok('creation beyond the plan is refused instead of silently accepted', stillOpen && !afterRefusal.includes('E2E Created Profile'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Pagination fixture: seed a large workspace directly so the table's paging is
  // exercised. This is UI data, not an entitlement — the plan check above still
  // applies to anything created through the app.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('joe-browser:v3') ?? 'null');
    if (!raw || !raw.profiles?.length) return;
    const template = raw.profiles[0];
    raw.profiles = Array.from({ length: 250 }, (_, i) => ({
      ...template,
      id: `fixture_${i}`,
      name: `Bulk ${String(i + 1).padStart(3, '0')}`,
      status: 'ready',
      device: null,
      lastLaunchedAt: null,
    }));
    localStorage.setItem('joe-browser:v3', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.data-table tbody tr', { timeout: 15000 });
  const before = await page.locator('.data-table tbody tr').count();
  const total = await page.locator('main').innerText();
  const profileCount = await page.locator('main').getByText(/^\d+$/).first().innerText();
  ok('a 250-profile workspace renders', Number(profileCount) >= 250, `${profileCount} profiles`);
  ok('table paginates large datasets', /\b\d+\/\d+\b/.test(total), `${before} rows before`);
  ok('the page does not try to render all 250 rows at once', before > 0 && before < 250, `${before} rendered`);

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
  await server.stop();
}

ok('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 4).join(' | '));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
if (failed.length || errors.length) process.exit(1);
