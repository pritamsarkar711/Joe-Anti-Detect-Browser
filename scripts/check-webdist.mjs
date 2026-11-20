#!/usr/bin/env node
/**
 * Assert that a built UI directory will actually boot when loaded over file://
 * (Electron's loadFile, Android's file:///android_asset).
 *
 * v3.2.0 shipped an EXE whose bundle referenced `/assets/...` — under file://
 * that resolves to the filesystem root, every script 404'd, and the app sat on
 * the boot splash forever. The pipeline had uploaded `dist/` (web build,
 * absolute base) instead of `apps/desktop/web-dist` (desktop build, relative
 * base), and no gate looked inside the built HTML.
 *
 *   node scripts/check-webdist.mjs <dir>
 *
 * Checks:
 *   1. index.html exists and references its entry with a RELATIVE path
 *   2. no local reference starts with "/" (filesystem root under file://)
 *   3. every locally referenced asset (script/link/img) exists on disk
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/check-webdist.mjs <dir>');
  process.exit(2);
}

const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
};

const indexPath = path.join(dir, 'index.html');
if (!fs.existsSync(indexPath)) fail(`${dir}: index.html missing`);
const html = fs.readFileSync(indexPath, 'utf8');

// Collect src/href references from the built HTML.
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const local = refs.filter((u) => !/^(https?:|data:|#|$)/.test(u));
if (local.length === 0) fail(`${dir}: index.html references no local assets`);

const entries = local.filter((u) => /\.(js|mjs)$/.test(u));
if (entries.length === 0) fail(`${dir}: no script entry referenced`);

for (const ref of local) {
  if (ref.startsWith('/')) {
    fail(
      `${dir}: absolute reference "${ref}" — under file:// this resolves to the ` +
        'filesystem root and 404s (build with JOE_TARGET=desktop|android for a relative base)',
    );
  }
  const resolved = path.join(dir, ref.replace(/^\.\//, ''));
  if (!fs.existsSync(resolved)) fail(`${dir}: referenced asset missing on disk: ${ref}`);
}

// The JS entry must exist and be non-trivial.
for (const entry of entries) {
  const p = path.join(dir, entry.replace(/^\.\//, ''));
  const body = fs.readFileSync(p, 'utf8');
  if (body.length < 512) fail(`${dir}: ${entry} looks truncated (${body.length} bytes)`);
}

console.log(`PASS  ${dir}: ${local.length} relative references, all present (${entries.length} script entries)`);
