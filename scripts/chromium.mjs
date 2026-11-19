/**
 * Headless Chromium for this sandbox.
 *
 * There is no system Chrome and no Playwright CDN access, so we obtain a
 * Chromium binary from the npm package @sparticuz/chromium. Its NSS libraries
 * ship inside bin/al2023.tar.br; we extract them and put them on
 * LD_LIBRARY_PATH before launching. Everything comes from registry.npmjs.org,
 * which is reachable here.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const cjs = require('@sparticuz/chromium');
const chromium = cjs.default ?? cjs;
const { chromium: playwright } = require('playwright-core');

let libsReady = false;

function ensureLibs() {
  if (libsReady) return;
  const root = process.cwd();
  const dir = path.join(os.tmpdir(), 'joe-chromium-libs');
  const marker = path.join(dir, 'lib', 'libnss3.so');
  if (!fs.existsSync(marker)) {
    fs.mkdirSync(dir, { recursive: true });
    const br = path.join(root, 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br');
    const tar = path.join(dir, 'al2023.tar');
    fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(br)));
    execFileSync('tar', ['-xf', tar, '-C', dir], { stdio: 'ignore' });
  }
  process.env.LD_LIBRARY_PATH = `${path.join(dir, 'lib')}:/tmp:${process.env.LD_LIBRARY_PATH ?? ''}`;
  libsReady = true;
}

export async function launchBrowser() {
  ensureLibs();
  const executablePath = await chromium.executablePath();
  return playwright.launch({
    executablePath,
    headless: true,
    timeout: 60000,
    args: [...chromium.args, '--no-zygote', '--disable-gpu', '--force-color-profile=srgb'],
    env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH },
  });
}
