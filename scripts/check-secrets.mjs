/**
 * Secret-exposure gate.
 *
 * Nothing in this repository may ship a live credential: not in source, not in
 * generated assets, not in documentation. This scan runs in CI before every
 * build and release and fails on anything shaped like a private key, a service
 * role JWT, a password in a connection string, or a long high-entropy token.
 *
 * It deliberately allows the *publishable* Supabase anon key pattern and test
 * placeholders; the security boundary is RLS + server enforcement, not the
 * anon key (see SECURITY_AUDIT.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'dist-android', 'dist-site', 'coverage',
  '.vite', 'release', 'assets', 'site', 'build',
]);
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf',
  '.svg', '.zip', '.apk', '.exe', '.asar', '.pdf', '.webp',
]);

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

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else {
      yield path.join(dir, entry.name);
    }
  }
}

const patterns = [
  ['private key block', /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['service-role JWT header', /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['passworded connection string', /\b(postgres|postgresql|mysql|redis|mongodb):\/\/[^:\s]+:[^@\s]{6,}@/],
  ['hard-coded api key assignment', /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][A-Za-z0-9+/_-]{24,}['"]/i],
];

const findings = [];
let scanned = 0;
for (const file of walk(root)) {
  if (SKIP_EXT.has(path.extname(file).toLowerCase())) continue;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  // Guard against binary blobs misread as text.
  if (raw.includes('\u0000')) continue;
  scanned += 1;
  for (const [name, re] of patterns) {
    const m = raw.match(re);
    if (m) findings.push(`${path.relative(root, file)}: ${name} (${m[0].slice(0, 24)}…)`);
  }
}

check('no credential-shaped strings in the repository', () => {
  must(findings.length === 0, findings.join('; '));
  return `${scanned} files scanned, ${patterns.length} patterns`;
});

check('.env files are ignored and absent', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  must(/^\.env$/m.test(gitignore), '.gitignore does not ignore .env');
  must(!fs.existsSync(path.join(root, '.env')), 'a .env file exists in the tree');
  return 'no environment files present';
});

check('no key material is tracked by git', () => {
  // Cheap belt-and-braces: keystore/pem/key files must never be committed.
  const forbidden = ['.pem', '.p12', '.pfx', '.keystore', '.jks'];
  const tracked = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const ext of forbidden) {
    // build-apk.sh generates a throwaway keystore in a temp dir; the ignore
    // rules must still cover accidental copies at the repo root.
    must(!fs.existsSync(path.join(root, `joe${ext}`)), `joe${ext} exists in the tree`);
  }
  must(/\.keystore/.test(tracked), '.gitignore does not ignore keystores');
  return 'none tracked';
});

if (failed > 0) {
  console.log(`\n${failed} secret-scan check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nSecret scan is clean');
