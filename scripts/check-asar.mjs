/**
 * Assert that a built `app.asar` contains the main process.
 *
 * The first version of this gate used `require('@electron/asar')` from the
 * release job and failed there while passing locally — a packaging check that
 * depends on a module resolving in someone else's working directory is not a
 * reliable gate. This reads the asar header directly, so it needs no
 * dependencies at all.
 *
 * asar layout: uint32 pickle size, uint32 header pickle size, uint32 JSON
 * length, then the JSON header describing every entry, then the file data.
 *
 *   node scripts/check-asar.mjs <path-to-resources-dir-or-asar>
 */
import fs from 'node:fs';
import path from 'node:path';

/** Entries the shipped app needs. */
const REQUIRED = ['main.js', 'preload.js', 'rest.js', 'extensions.cjs', 'core.cjs', 'web-dist/index.html'];

/** Read the JSON header of an asar archive. */
export function readAsarHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const jsonLength = head.readUInt32LE(12);
    // A real header is a few kilobytes; anything enormous means this is not an asar.
    if (jsonLength < 2 || jsonLength > 64 * 1024 * 1024) {
      throw new Error(`implausible asar header length ${jsonLength} in ${file}`);
    }
    const json = Buffer.alloc(jsonLength);
    fs.readSync(fd, json, 0, jsonLength, 16);
    return JSON.parse(json.toString('utf8'));
  } finally {
    fs.closeSync(fd);
  }
}

/** Flatten the header tree into slash-separated file paths. */
export function listAsarFiles(tree) {
  const out = [];
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (entry.files) walk(entry, rel);
      else out.push(rel);
    }
  };
  walk(tree, '');
  return out;
}

function findAsar(target) {
  if (fs.statSync(target).isFile()) return target;
  const hit = fs.readdirSync(target).find((f) => f.endsWith('.asar'));
  if (!hit) throw new Error(`no .asar file in ${target}`);
  return path.join(target, hit);
}

export function verifyAsar(target, required = REQUIRED) {
  const file = findAsar(target);
  const header = readAsarHeader(file);
  const files = listAsarFiles(header);
  const missing = required.filter(
    (needle) => !files.some((f) => f === needle || f.endsWith(`/${needle}`)),
  );
  return { file, count: files.length, files, missing, header };
}

/**
 * Read one file's bytes straight out of the archive.
 *
 * Layout (validated against @electron/asar output): uint32 4, uint32
 * headerPickleLength, uint32 headerJsonLength+4... the JSON header begins at
 * offset 16 with length readUInt32LE(12); file data begins at
 * 8 + readUInt32LE(4); entry offsets are relative to that.
 */
export function readAsarFileSync(file, header, entryPath) {
  const buf = fs.readFileSync(file);
  const node = entryPath.split('/').reduce((n, k) => (n?.files ?? {})[k], header);
  if (!node || node.files) throw new Error(`not a file in archive: ${entryPath}`);
  const dataStart = 8 + buf.readUInt32LE(4);
  const start = dataStart + Number(node.offset);
  return buf.subarray(start, start + Number(node.size)).toString('utf8');
}

/**
 * The shipped UI must load over file://: every local reference relative, every
 * referenced asset packed. v3.2.0's asar held an index.html whose scripts
 * pointed at /assets/... — present on disk yet unreachable under file:// — and
 * the app hung on its boot splash. Checking the archive's own bytes closes the
 * gap between "files listed" and "app actually loads".
 */
export function verifyPackedUi(file, header, files, indexEntry = 'web-dist/index.html') {
  const problems = [];
  const exact = files.find((f) => f === indexEntry || f.endsWith(`/${indexEntry}`));
  if (!exact) return [`${indexEntry} missing from archive`];
  const html = readAsarFileSync(file, header, exact);
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(https?:|data:|#|$)/.test(u));
  const base = exact.slice(0, exact.length - 'index.html'.length);
  for (const ref of refs) {
    if (ref.startsWith('/')) {
      problems.push(`absolute reference "${ref}" 404s under file:// (bundle built with web base?)`);
      continue;
    }
    const packed = (base + ref.replace(/^\.\//, '')).replace(/\/{2,}/g, '/');
    if (!files.includes(packed)) problems.push(`referenced asset not packed: ${ref} (${packed})`);
  }
  if (!refs.some((r) => /\.(js|mjs)$/.test(r))) problems.push('no script entry referenced by packed index.html');
  return problems;
}

/** `node scripts/check-asar.mjs <target>` */
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node scripts/check-asar.mjs <resources-dir-or-app.asar>');
    process.exit(2);
  }
  try {
    const { file, count, missing, header } = verifyAsar(target);
    console.log(`${path.basename(file)} contains ${count} entries`);
    if (missing.length) {
      console.error(`MISSING FROM PACKAGE: ${missing.join(', ')}`);
      process.exit(1);
    }
    const uiProblems = verifyPackedUi(file, header, listAsarFiles(header));
    if (uiProblems.length) {
      for (const p of uiProblems) console.error(`PACKED UI UNLOADABLE: ${p}`);
      process.exit(1);
    }
    console.log('all runtime modules present in the archive');
    console.log('packed UI references resolve relatively and are all included');
  } catch (error) {
    console.error(`asar check failed: ${error.message}`);
    // Leave a breadcrumb: the next run explains itself instead of failing blind.
    try {
      if (fs.statSync(target).isDirectory()) {
        console.error('contents:', fs.readdirSync(target).join(', '));
        const inner = path.join(target, 'resources');
        if (fs.existsSync(inner)) console.error('resources:', fs.readdirSync(inner).join(', '));
      }
    } catch { /* nothing to add */ }
    process.exit(1);
  }
}
