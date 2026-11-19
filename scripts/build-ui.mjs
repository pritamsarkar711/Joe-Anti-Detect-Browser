#!/usr/bin/env node
/**
 * Cross-platform UI build runner.
 *
 * `JOE_TARGET=desktop vite build` only works in a POSIX shell, which is why the
 * project used `cross-env` — but `cross-env` was never added to
 * `devDependencies`, so `npm run build:desktop` and `build:android-ui` failed in
 * a clean checkout (and therefore in CI). Setting the variable here and spawning
 * Vite keeps the scripts portable on Windows, Linux and macOS with no extra
 * dependency.
 *
 *   node scripts/build-ui.mjs desktop|android|web
 */
import { spawn } from 'node:child_process';

const target = process.argv[2];
if (!['desktop', 'android', 'web'].includes(target)) {
  console.error('usage: node scripts/build-ui.mjs desktop|android|web');
  process.exit(2);
}

const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build'],
  { stdio: 'inherit', env: { ...process.env, JOE_TARGET: target } },
);
child.on('exit', (code) => process.exit(code ?? 0));
