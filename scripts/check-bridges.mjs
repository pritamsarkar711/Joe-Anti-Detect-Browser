/**
 * Native bridge check.
 *
 * Each platform shell exposes a hand-written bridge to the shared React UI:
 * the Electron preload (`window.joe`) and the Android Java bridge
 * (`window.JoeBridge`). Neither is typed against the calls the UI makes, so a
 * rename on one side silently breaks a feature on the other — the same failure
 * mode that made profile launch a no-op on the desktop build.
 *
 * This asserts:
 *   - every JoeBridge method the UI calls is declared @JavascriptInterface;
 *   - no declared method is unreachable from the UI;
 *   - the Android browser activity reads the extras the bridge writes;
 *   - every generated profile has an injection script when assets are built.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const javaDir = path.join(root, 'apps/android/app/src/main/java/com/joebrowser/app');

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
const read = (p) => fs.readFileSync(p, 'utf8');

/** Every .ts/.tsx under src/, concatenated — enough to find bridge usage. */
function uiSources(dir = path.join(root, 'src'), out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) uiSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const mainActivity = read(path.join(javaDir, 'MainActivity.java'));
const browserActivity = read(path.join(javaDir, 'BrowserActivity.java'));
const ui = uiSources().map(read).join('\n');

const declared = new Set(
  [...mainActivity.matchAll(/@JavascriptInterface\s+public\s+[\w<>[\]]+\s+(\w+)\s*\(/g)].map((m) => m[1]),
);
const used = new Set([...ui.matchAll(/JoeBridge\??\.(\w+)\s*\(/g)].map((m) => m[1]));

check('the Android bridge declares every method the UI calls', () => {
  must(declared.size > 0, 'no @JavascriptInterface methods found — did the parser break?');
  must(used.size > 0, 'the UI never calls JoeBridge — did the parser break?');
  const missing = [...used].filter((m) => !declared.has(m));
  must(missing.length === 0, `called by the UI but not declared in Java: ${missing.join(', ')}`);
  return `${used.size} calls, all declared`;
});

check('no Android bridge method is unreachable from the UI', () => {
  const unused = [...declared].filter((m) => !used.has(m));
  must(unused.length === 0, `declared in Java but never called: ${unused.join(', ')}`);
  return `${declared.size} methods in use`;
});

check('the browser activity reads the extras the bridge writes', () => {
  const writes = [...mainActivity.matchAll(/i\.putExtra\("(\w+)"/g)].map((m) => m[1]);
  must(writes.length > 0, 'launchProfile put no extras');
  const reads = new Set([...browserActivity.matchAll(/getStringExtra\("(\w+)"\)/g)].map((m) => m[1]));
  const dropped = writes.filter((w) => !reads.has(w));
  must(dropped.length === 0, `written by the bridge but never read: ${dropped.join(', ')}`);
  return writes.join(', ');
});

check('the browser activity loads a per-profile injection script', () => {
  must(/injection\//.test(browserActivity), 'BrowserActivity does not load an injection script');
  must(/profile_suffix|profileId/.test(browserActivity), 'BrowserActivity does not isolate by profile');
  return 'injection/ + profile isolation';
});

check('generated assets match the profiles they were built for', () => {
  const assets = path.join(root, 'apps/android/assets');
  const workspaceFile = path.join(assets, 'workspace.json');
  if (!fs.existsSync(workspaceFile)) return 'assets not generated yet (built by build:assets)';
  const { profiles } = JSON.parse(read(workspaceFile));
  must(Array.isArray(profiles) && profiles.length > 0, 'workspace.json has no profiles');
  const missing = profiles.filter(
    (p) => !fs.existsSync(path.join(assets, 'injection', `${p.id}.js`)),
  );
  must(missing.length === 0, `no injection script for: ${missing.map((p) => p.id).join(', ')}`);
  must(fs.existsSync(path.join(assets, 'injection', 'default.js')), 'no default injection script');
  must(fs.existsSync(path.join(assets, 'app', 'index.html')), 'no bundled UI in assets/app');
  return `${profiles.length} profiles + default, UI bundled`;
});

if (failed > 0) {
  console.log(`\n${failed} bridge check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nNative bridges agree with the UI');
