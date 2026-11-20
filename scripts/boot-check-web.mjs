#!/usr/bin/env node
/**
 * Boot the built desktop UI in a real (headless) Chromium over file:// — the
 * exact scheme and path semantics of the packaged app's loadFile(web-dist).
 *
 * Fails unless React mounts, the workspace renders and the boot splash is
 * dismissed. v3.2.0 shipped a bundle whose scripts 404'd under file:// and the
 * app sat on "Starting Joe Browser…" forever; this gate makes that state
 * impossible to publish again.
 *
 *   node scripts/boot-check-web.mjs <path-to-index.html> [--expect-fail]
 *
 * Uses the shared chromium.mjs launcher (playwright-core + @sparticuz/chromium
 * — the browser ships inside the npm tarball), so it runs the same on CI and
 * dev machines with no download step.
 */
import path from 'node:path';
import { launchBrowser } from './chromium.mjs';

const target = process.argv[2];
const expectFail = process.argv.includes('--expect-fail');
if (!target) {
  console.error('usage: node scripts/boot-check-web.mjs <index.html> [--expect-fail]');
  process.exit(2);
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text().slice(0, 160)}`);
  });
  page.on('requestfailed', (r) =>
    problems.push(`requestfailed: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`),
  );
  await page
    .goto('file://' + path.resolve(target), { waitUntil: 'networkidle', timeout: 20000 })
    .catch((e) => problems.push('goto: ' + e.message));
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const boot = document.getElementById('joe-boot');
    const root = document.getElementById('root');
    return {
      bootHidden: !!boot && boot.classList.contains('hidden'),
      rootChildren: root ? root.childElementCount : -1,
      bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 140),
    };
  });
  const booted = state.bootHidden && state.rootChildren > 0;
  console.log(JSON.stringify({ target, booted, expectFail, state, problems: problems.slice(0, 10) }, null, 2));
  if (expectFail ? booted : !booted) process.exit(1);
} finally {
  await browser.close();
}
