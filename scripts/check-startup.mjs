// Run after npm run build. Only serve the local build; no remote accounts or sites.
import { launchBrowser } from './chromium.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  let broken = true;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://workspace.test' || (broken && url.pathname.endsWith('.js'))) return route.abort();
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css' };
    try {
      await route.fulfill({ body: await readFile(`dist${path}`), contentType: types[path.split('.').pop()] || 'application/octet-stream' });
    } catch { await route.abort(); }
  });
  await page.goto('https://workspace.test');
  const retry = page.getByRole('button', { name: 'Retry startup' });
  await retry.waitFor({ timeout: 15000 });
  broken = false;
  await retry.click();
  await page.locator('#joe-boot').waitFor({ state: 'hidden' });
  assert.ok((await page.locator('#root').innerText()).trim());
  console.log('Missing bundle exposes Retry; retry loads a nonempty workspace.');
} finally { await browser.close(); }
