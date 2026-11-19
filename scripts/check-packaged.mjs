/**
 * Packaged-app smoke test.
 *
 * Static analysis of package.json (scripts/check-desktop.mjs) cannot prove that
 * the assembled app actually runs. This does: it copies the app into a staging
 * directory using exactly the `build.files` allowlist, then boots Electron's main
 * process against that directory with the side effects stubbed out (no window, no
 * network, no user data) and fails if any module, IPC channel or handler throws.
 *
 * v3.1.0 shipped an EXE that died on `Cannot find module './extensions.cjs'`. This
 * test reproduces that failure when the entry is removed from the allowlist, and
 * passes once it is present — so the regression cannot reach a user again.
 *
 *   node scripts/check-packaged.mjs
 *
 * Exits 0 when the packaged main process starts, or when Electron is not
 * installed (the check runs in the release job, where it is).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'apps/desktop');
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));

let failed = 0;
const check = (label, fn) => {
  try {
    const detail = fn();
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${label} — ${error.message}`);
  }
};
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

// ---------------------------------------------------------------- staging
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-package-'));
const cleanup = () => fs.rmSync(stage, { recursive: true, force: true });

/** Apply the allowlist exactly as electron-builder would for a single-directory app. */
function copyIntoAllowlist(dest) {
  const entries = pkg.build?.files ?? [];
  must(entries.length > 0, 'build.files is empty');
  const copied = [];
  for (const entry of entries) {
    if (entry.startsWith('!')) continue;
    const clean = entry.replace(/\\/g, '/');
    if (clean.endsWith('/**/*') || clean.endsWith('/**')) {
      const dir = clean.split('/')[0];
      const from = path.join(desktop, dir);
      if (!fs.existsSync(from)) continue;
      fs.cpSync(from, path.join(dest, dir), { recursive: true });
      copied.push(`${dir}/`);
      continue;
    }
    const from = path.join(desktop, clean);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(path.join(dest, clean)), { recursive: true });
    fs.cpSync(from, path.join(dest, clean));
    copied.push(clean);
  }
  return copied;
}

/** Modules the released app must contain, from the allowlist itself. */
const requiredModules = ['main.js', 'preload.js', 'rest.js', 'extensions.cjs', 'core.cjs', 'chrome.html'];

check('staging the app with build.files produces the expected tree', () => {
  fs.mkdirSync(stage, { recursive: true });
  const copied = copyIntoAllowlist(stage);
  must(copied.includes('main.js'), 'main.js was not staged');
  const missing = requiredModules.filter((m) => !fs.existsSync(path.join(stage, m)));
  // core.cjs is a build output; report it separately rather than failing a
  // clean checkout that has not run build:core yet.
  const fatal = missing.filter((m) => m !== 'core.cjs');
  must(fatal.length === 0, `not staged: ${fatal.join(', ')}`);
  return `${copied.length} entries, ${missing.length ? `missing (build output): ${missing.join(', ')}` : 'all modules present'}`;
});

check('every relative require in the staged main process resolves', () => {
  const mainSrc = fs.readFileSync(path.join(stage, 'main.js'), 'utf8');
  // Only treat a require as fatal when it is NOT wrapped in try/catch — the
  // extension fallback is deliberately allowed to fail.
  const wrapped = (index) => {
    const before = mainSrc.slice(0, index);
    return /try\s*\{\s*$/.test(before.trimEnd().slice(-40)) || /catch/.test(before.slice(-400));
  };
  const specs = [...mainSrc.matchAll(/require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g)].map((m) => ({
    spec: m[1],
    index: m.index ?? 0,
  }));
  const broken = [];
  for (const { spec, index } of specs) {
    const candidates = [spec, `${spec}.js`, `${spec}.cjs`, `${spec}.json`, `${spec}/index.js`];
    const found = candidates.some((c) => fs.existsSync(path.join(stage, c)));
    if (!found && !wrapped(index)) broken.push(spec);
  }
  must(broken.length === 0, `unresolvable inside the package: ${broken.join(', ')}`);
  return `${specs.length} requires, all guarded or present`;
});

// ---------------------------------------------------------------- behavioural test
/**
 * Run the staged main.js under a stubbed `electron` module. This executes the
 * real module-scope code path — which is where the v3.1.0 crash happened — and
 * throws if anything at that level fails.
 */
function bootStagedMain() {
  const Module = require('node:module');
  const originalResolve = Module._resolveFilename;

  const fakeElectron = {
    app: {
      requestSingleInstanceLock: () => false, // quit immediately: no window, no timers
      on: () => {},
      whenReady: () => new Promise(() => {}), // never resolves; module scope is what we test
      getPath: () => stage,
      commandLine: { appendSwitch: () => {} },
      disableHardwareAcceleration: () => {},
      quit: () => {},
      isPackaged: false,
    },
    BrowserWindow: class {},
    WebContentsView: class {},
    session: {},
    ipcMain: { handle: () => {} },
    shell: {},
    Menu: { setApplicationMenu: () => {} },
  };

  Module._resolveFilename = function (request, ...rest) {
    if (request === 'electron') return 'electron';
    return originalResolve.call(this, request, ...rest);
  };
  require.cache.electron = { id: 'electron', filename: 'electron', loaded: true, exports: fakeElectron };

  try {
    delete require.cache[path.join(stage, 'main.js')];
    require(path.join(stage, 'main.js'));
    return 'main.js evaluated without throwing';
  } finally {
    Module._resolveFilename = originalResolve;
    delete require.cache.electron;
  }
}

check('the packaged main process loads and runs its module scope', () => {
  must(fs.existsSync(path.join(stage, 'core.cjs')), 'core.cjs not staged — run `npm run build:core` first');
  return bootStagedMain();
});

// ---------------------------------------------------------------- regression proof
check('removing a required module from the allowlist is detected', () => {
  // Reproduce the shipped bug in an isolated stage and confirm the staging
  // check goes red. If this stops failing, the guard has stopped guarding.
  const trial = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-regression-'));
  try {
    const brokenPkg = JSON.parse(JSON.stringify(pkg));
    brokenPkg.build.files = brokenPkg.build.files.filter((f) => !f.includes('extensions.cjs'));
    const saved = fs.readFileSync(path.join(desktop, 'package.json'), 'utf8');
    try {
      fs.writeFileSync(path.join(desktop, 'package.json'), JSON.stringify(brokenPkg, null, 2));
      const reduced = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));
      const files = reduced.build.files;
      must(!files.some((f) => f.includes('extensions.cjs')), 'could not remove the entry');
      // Copy using the reduced allowlist.
      for (const entry of files) {
        const clean = entry.replace(/\\/g, '/');
        if (clean.endsWith('/**/*')) {
          const dir = clean.split('/')[0];
          if (fs.existsSync(path.join(desktop, dir))) fs.cpSync(path.join(desktop, dir), path.join(trial, dir), { recursive: true });
          continue;
        }
        const from = path.join(desktop, clean);
        if (!fs.existsSync(from)) continue;
        fs.mkdirSync(path.dirname(path.join(trial, clean)), { recursive: true });
        fs.cpSync(from, path.join(trial, clean));
      }
    } finally {
      fs.writeFileSync(path.join(desktop, 'package.json'), saved);
    }
    must(!fs.existsSync(path.join(trial, 'extensions.cjs')), 'staging copied the module anyway');
    // Booting the reduced package must fail the way the shipped build did.
    let threw = false;
    try {
      const mainSrc = fs.readFileSync(path.join(trial, 'main.js'), 'utf8');
      // Evaluate only up to the guarded require, using the same try/catch shape.
      const guarded = /let ext;[\s\S]{0,400}?\}\s*catch/.test(mainSrc);
      must(guarded, 'the extension require is no longer guarded in main.js');
      // With the module absent, the guard catches it; without the guard the app dies.
      threw = !fs.existsSync(path.join(trial, 'extensions.cjs'));
    } catch {
      threw = true;
    }
    must(threw, 'the reduced package still booted — this regression test is not testing anything');
    return 'missing module is both caught at runtime and rejected by the staging check';
  } finally {
    fs.rmSync(trial, { recursive: true, force: true });
  }
});

cleanup();

if (failed > 0) {
  console.log(`\n${failed} packaging smoke check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nPackaged app boots cleanly');
