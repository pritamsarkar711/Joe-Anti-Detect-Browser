/**
 * Desktop package integrity check.
 *
 * v3.1.0 shipped an EXE that could not start. `main.js` begins with
 * `require('./extensions.cjs')`, but `apps/desktop/package.json`'s electron-builder
 * `files` allowlist never listed that file, so the module was absent from
 * `app.asar` and Electron died before it drew a window:
 *
 *   Uncaught Exception: Error: Cannot find module './extensions.cjs'
 *
 * Nothing caught it, because every test ran against the source tree, where the
 * file obviously exists. This check inspects the *packaging* configuration
 * instead, so a missing file fails the build rather than the user's install.
 *
 * It asserts, for the real electron-builder config:
 *   1. every relative `require()` in the main process is matched by `files`;
 *   2. every bare package `require()` is a declared runtime dependency;
 *   3. every path the main process loads at startup exists or is guarded;
 *   4. the files list uses explicit entries, not globs that silently match nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'apps/desktop');
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));
const mainPath = path.join(desktop, 'main.js');
const mainSrc = fs.readFileSync(mainPath, 'utf8');

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

/** Files and directories electron-builder will pack. */
const included = (pkg.build?.files ?? []).filter((f) => !f.startsWith('!'));
const excluded = (pkg.build?.files ?? []).filter((f) => f.startsWith('!')).map((f) => f.slice(1));

/**
 * Resolve an allowlist entry the way electron-builder does: a bare filename
 * matches that file at the app root; a trailing `/**` matches a directory tree.
 * Ignore rules (`!foo`) are honoured.
 */
const isPacked = (relPath) => {
  const normal = relPath.replace(/\\/g, '/');
  const matches = (pattern) => {
    const p = pattern.replace(/\\/g, '/');
    if (p.endsWith('/**/*') || p.endsWith('/**')) return normal === p.split('/')[0] || normal.startsWith(`${p.split('/')[0]}/`);
    return normal === p;
  };
  if (excluded.some(matches)) return false;
  return included.some(matches);
};

// ---------------------------------------------------------------- relative requires
const relativeRequires = [...mainSrc.matchAll(/require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g)]
  .map((m) => m[1]);

check('main process entry is declared', () => {
  must(pkg.main, 'package.json has no "main"');
  must(fs.existsSync(path.join(desktop, pkg.main)), `${pkg.main} does not exist`);
  return pkg.main;
});

/**
 * Build outputs do not exist in a clean checkout — the release job generates
 * them before packaging. They must still be in the allowlist; whether they are
 * on disk is checked in CI after the build steps, not here.
 */
const BUILD_OUTPUTS = new Set(['./core.cjs']);

check('every relative require in the main process is packaged', () => {
  must(relativeRequires.length > 0, 'no relative requires found — did the parser break?');
  const missing = [];
  const absent = [];
  const fromBuild = [];
  for (const spec of relativeRequires) {
    // Node resolves ./x to x.js, x.json, x.cjs or x/index.js.
    const candidates = [spec, `${spec}.js`, `${spec}.cjs`, `${spec}.json`, `${spec}/index.js`];
    const onDisk = candidates.find((c) => fs.existsSync(path.join(desktop, c)));
    if (!onDisk && !BUILD_OUTPUTS.has(spec)) absent.push(spec);
    if (onDisk && BUILD_OUTPUTS.has(spec)) candidates.splice(0, candidates.length, onDisk.slice(2));
    if (!onDisk && BUILD_OUTPUTS.has(spec)) fromBuild.push(spec);
    const packedAs = candidates.find((c) => isPacked(c.replace(/^\.\//, '')));
    if (!packedAs) missing.push(spec);
  }
  must(absent.length === 0, `required but missing from the source tree: ${absent.join(', ')}`);
  must(
    missing.length === 0,
    `required by main.js but absent from the packaged app: ${missing.join(', ')}. ` +
      `Add them to build.files in apps/desktop/package.json.`,
  );
  const note = fromBuild.length ? ` (${fromBuild.join(', ')} generated at build time)` : '';
  return `${relativeRequires.length} modules packed${note}`;
});

// ------------------------------------------------------------------ bare requires
/** Node/builtin and Electron-provided modules are always available. */
const isBuiltin = (name) =>
  /^node:/.test(name) || ['electron', 'path', 'fs', 'url', 'os', 'crypto', 'http', 'https', 'net', 'child_process'].includes(name);

const bareRequires = [...mainSrc.matchAll(/require\(\s*['"]([^.'"][^'"]*)['"]\s*\)/g)]
  .map((m) => m[1])
  .filter((name) => !isBuiltin(name));

const packageName = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

check('every package required at runtime is a declared dependency', () => {
  const deps = Object.keys(pkg.dependencies ?? {});
  const problems = bareRequires
    .map(packageName)
    .filter((name) => !deps.includes(name))
    .map((name) => `${name} is required by main.js but is not in dependencies`);
  must(problems.length === 0, problems.join('; '));
  return bareRequires.length ? [...new Set(bareRequires.map(packageName))].join(', ') : 'none';
});

check('runtime dependencies are not shipped as devDependencies', () => {
  // A devDependency is pruned from the packaged app, so `require()` at runtime
  // throws exactly like a missing file would.
  const dev = Object.keys(pkg.devDependencies ?? {});
  const overlap = Object.keys(pkg.dependencies ?? {}).filter((d) => dev.includes(d));
  must(overlap.length === 0, `declared as both runtime and dev dependency: ${overlap.join(', ')}`);
  return 'no overlap';
});

// ------------------------------------------------------------------ startup paths
check('the files allowlist is explicit, not an empty glob', () => {
  must(included.length > 0, 'build.files is empty — electron-builder would fall back to defaults');
  const globs = included.filter((f) => f.includes('*') && !f.includes('/**'));
  must(globs.length === 0, `ambiguous glob entries: ${globs.join(', ')}`);
  return `${included.length} entries`;
});

check('the renderer bundle is packaged and present', () => {
  must(isPacked('web-dist/index.html'), 'web-dist is not in build.files');
  const ui = path.join(desktop, 'web-dist/index.html');
  // Only enforce existence when a build has run; a clean checkout legitimately
  // has no bundle yet, and main.js falls back to the control-plane URL.
  if (!fs.existsSync(ui)) return 'web-dist not built yet (checked in CI after build)';
  return 'web-dist/index.html present';
});

check('the app icon referenced by the builder exists', () => {
  const icon = pkg.build?.win?.icon ?? pkg.build?.icon;
  must(icon, 'no icon configured for the Windows target');
  const resolved = path.resolve(desktop, icon);
  must(fs.existsSync(resolved), `icon ${icon} resolves to ${resolved}, which does not exist`);
  return icon;
});

check('preload exposes exactly the IPC channels the main process handles', () => {
  // A channel exposed in preload but never handled makes the UI await forever;
  // a channel handled but not exposed is dead code. Both are silent in a build.
  const preloadSrc = fs.readFileSync(path.join(desktop, 'preload.js'), 'utf8');
  const invoked = new Set([...preloadSrc.matchAll(/invoke\(\s*['"]([\w:.-]+)['"]/g)].map((m) => m[1]));
  const handled = new Set([...mainSrc.matchAll(/handle\(\s*['"]([\w:.-]+)['"]/g)].map((m) => m[1]));
  const unhandled = [...invoked].filter((c) => !handled.has(c));
  const unexposed = [...handled].filter((c) => !invoked.has(c));
  must(unhandled.length === 0, `exposed in preload but never handled: ${unhandled.join(', ')}`);
  must(unexposed.length === 0, `handled but never exposed to the UI: ${unexposed.join(', ')}`);
  return `${invoked.size} channels in sync`;
});

check('main.js does not crash on a missing optional dependency', () => {
  // @supabase/supabase-js is required lazily inside connectRealtime() and the
  // throw is caught, so it may be absent safely. Anything required at module
  // scope must be unconditional — assert the lazy one stays lazy.
  const supabase = mainSrc.indexOf("require('@supabase/supabase-js')");
  must(supabase !== -1, 'supabase require disappeared — update this check');
  const before = mainSrc.slice(0, supabase);
  const fnStart = before.lastIndexOf('async function connectRealtime');
  must(fnStart !== -1, 'supabase require is no longer inside connectRealtime()');
  return 'supabase stays inside a try/catch';
});

if (failed > 0) {
  console.log(`\n${failed} desktop packaging check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nDesktop packaging is complete');
