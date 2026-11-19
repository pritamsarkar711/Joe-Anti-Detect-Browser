/**
 * Mobile responsiveness matrix for the five device families requested by the
 * product brief. Uses real Chromium viewports, HD device pixel ratios, and
 * checks horizontal overflow, out-of-bounds controls, overlapping tap targets,
 * text clipping, dialog fit, navigation and console errors one device at a time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = path.join(process.cwd(), 'assets', 'screenshots', 'devices');
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { key: 'google-pixel', label: 'Google Pixel 8', width: 412, height: 915, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { key: 'xiaomi', label: 'Xiaomi 13', width: 393, height: 852, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 14; 2211133C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { key: 'samsung-galaxy', label: 'Samsung Galaxy S23', width: 360, height: 780, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { key: 'oppo', label: 'OPPO Find X6', width: 412, height: 915, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; PGFM10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { key: 'vivo', label: 'Vivo X90', width: 393, height: 873, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 14; V2218) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
];

const VIEWS = [
  { label: 'Profiles', heading: 'Profiles' },
  { label: 'Proxies', heading: 'Proxies' },
  { label: 'Devices', heading: 'Devices' },
  { label: 'Fingerprints', heading: 'Fingerprints' },
  { label: 'Leak check', heading: 'Leak check' },
  { label: 'Activity', heading: 'Activity' },
  { label: 'Settings', heading: 'Settings' },
];

function audit() {
  const vw = window.innerWidth;
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
  };
  const nodes = [...document.querySelectorAll('body *')].filter(visible);
  const clippedByAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  // MUI Grid uses negative margins for gutters; the main column clips them.
  // Only genuinely visible horizontal out-of-bounds controls are failures.
  const outside = nodes.filter((el) => {
    const r = el.getBoundingClientRect();
    return (r.right > vw + 1 || r.left < -1) && !clippedByAncestor(el);
  }).map((el) => `${el.tagName}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')}`).slice(0, 12);

  const clipped = nodes.filter((el) => {
    const s = getComputedStyle(el);
    if (!el.textContent || !el.textContent.trim()) return false;
    if (s.overflow === 'visible' || s.textOverflow === 'ellipsis') return false;
    if (el.classList.contains('MuiTabs-scroller')) return false;
    return el.scrollWidth > el.clientWidth + 3 && s.whiteSpace === 'nowrap';
  }).map((el) => el.textContent.trim().slice(0, 40)).slice(0, 12);

  // Fixed UI (app bar and bottom navigation) intentionally sits above scrollable
  // content. Exclude it from tap-target overlap checks.
  const overlay = '.MuiDrawer-root, .MuiDialog-root, .MuiSnackbar-root, .MuiTooltip-popper, .MuiPopover-root, .MuiBottomNavigation-root';
  const interactive = [...document.querySelectorAll('button, a, input, select, [role="button"]')]
    .filter(visible)
    .filter((el) => getComputedStyle(el).position !== 'fixed' && !el.closest(overlay))
    .filter((el) => !el.querySelector('button, a, input, select, [role="button"]'));
  const small = interactive.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 28 || r.height < 28;
  }).length;
  let overlaps = 0;
  for (let i = 0; i < interactive.length; i++) {
    const a = interactive[i].getBoundingClientRect();
    for (let j = i + 1; j < interactive.length; j++) {
      const b = interactive[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 3 && h > 3) overlaps++;
    }
  }
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    outside,
    clipped,
    smallTargets: small,
    overlaps,
    bottomNav: !!document.querySelector('.MuiBottomNavigation-root'),
  };
}

const report = [];
let failed = 0;

for (const device of DEVICES) {
  // A fresh browser per device avoids Chromium mobile-emulation crashes after
  // closing a high-DPR context in the sandboxed headless build.
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: device.ua,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const checks = [];
  const ok = (name, cond, extra = '') => {
    checks.push({ name, pass: !!cond, extra });
    if (!cond) failed++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${device.label} · ${name}${extra ? ` · ${extra}` : ''}`);
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('main', { timeout: 15000 });
    await page.waitForTimeout(250);

    const home = await page.evaluate(audit);
    ok('no horizontal page overflow', home.overflow <= 1, `${home.overflow}px`);
    ok('no controls outside the viewport', home.outside.length === 0, home.outside.slice(0, 3).join(' | '));
    ok('no clipped text', home.clipped.length === 0, home.clipped.slice(0, 3).join(' | '));
    ok('no overlapping tap targets', home.overlaps === 0, `${home.overlaps}`);
    ok('tap targets are usable', home.smallTargets === 0, `${home.smallTargets} small`);
    ok('mobile bottom navigation present', home.bottomNav);
    await page.screenshot({ path: path.join(OUT, `${device.key}-profiles.png`), animations: 'disabled' });

    // Check every view on this device through the bottom bar and More drawer.
    for (const view of VIEWS) {
      // The bottom bar covers four destinations; everything else lives behind
      // More. Navigation is state-driven, so the More drawer button is reused
      // on every iteration and must be clicked before each off-bar view.
      const bottom = page.locator('.MuiBottomNavigationAction-root', { hasText: view.label });
      if (await bottom.count()) {
        await bottom.first().click();
      } else {
        const more = page.locator('.MuiBottomNavigationAction-root', { hasText: 'More' });
        await more.first().click();
        await page.waitForTimeout(220);
        const item = page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: view.label }).first();
        await item.waitFor({ state: 'visible', timeout: 5000 });
        await item.click();
      }
      await page.waitForTimeout(320);
      const heading = await page.getByRole('heading', { name: view.heading, exact: true }).first().isVisible();
      const a = await page.evaluate(audit);
      ok(`${view.heading} renders cleanly`, heading && a.overflow <= 1 && a.outside.length === 0 && a.overlaps === 0 && a.clipped.length === 0,
        `overflow ${a.overflow}, outside ${a.outside.length}, overlaps ${a.overlaps}, clipped ${a.clipped.length}`);
    }

    // Create dialog must fit a phone screen. On mobile the only entry point is
    // the Profiles toolbar button (the app bar hides its copy), so return to
    // Profiles first instead of relying on whatever view the loop ended on.
    await page.locator('.MuiBottomNavigationAction-root', { hasText: 'Profiles' }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'New profile' }).first().click();
    await page.waitForSelector('.MuiDialog-paper', { timeout: 5000 });
    const dialog = await page.locator('.MuiDialog-paper').boundingBox();
    ok('create dialog fits the viewport', !!dialog && dialog.x >= -1 && dialog.x + dialog.width <= device.width + 1 && dialog.height <= device.height - 8,
      dialog ? `${Math.round(dialog.width)}×${Math.round(dialog.height)}` : 'missing');
    await page.keyboard.press('Escape');

    await page.locator('.MuiBottomNavigationAction-root', { hasText: 'More' }).click();
    await page.locator('.MuiDrawer-root .MuiListItemButton-root', { hasText: 'Settings' }).first().click();
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(OUT, `${device.key}-settings.png`), animations: 'disabled' });
    ok('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (e) {
    ok('device run completed', false, e.message);
  } finally {
    await context.close();
    await browser.close();
  }
  report.push({ device: device.label, key: device.key, viewport: `${device.width}×${device.height}`, dpr: device.dpr, checks });
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, report }, null, 2));
const total = report.reduce((a, d) => a + d.checks.length, 0);
console.log(`\n${total - failed}/${total} device checks passed · report: ${path.join(OUT, 'report.json')}`);
if (failed) process.exit(1);
