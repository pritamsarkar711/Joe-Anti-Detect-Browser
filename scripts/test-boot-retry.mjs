// Exercise the compiled entry point without touching a user's workspace.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { launchBrowser } from './chromium.mjs';

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  let blockEntry = true;
  let requests = 0;
  await page.route('**/*', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') requests++;
    if (blockEntry && pathname.endsWith('.js')) return route.abort();
    if (pathname.startsWith('/assets/App-')) return route.abort();
    const body = await fs.readFile(`dist${pathname === '/' ? '/index.html' : pathname}`);
    const contentType = pathname === '/' ? 'text/html' : pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    await route.fulfill({ body, contentType });
  });
  await page.goto('https://workspace.invalid/');
  blockEntry = false;
  await page.getByRole('link', { name: /Retry startup/ }).click();
  const retry = page.getByRole('button', { name: 'Retry startup' });
  await retry.click();
  await retry.waitFor();
  assert.equal(requests, 3);
  console.log('PASS: missing entry and missing app chunk both allow retry');
} finally {
  await browser.close();
}
