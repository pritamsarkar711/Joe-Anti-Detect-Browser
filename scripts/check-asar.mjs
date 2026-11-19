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
  const files = listAsarFiles(readAsarHeader(file));
  const missing = required.filter(
    (needle) => !files.some((f) => f === needle || f.endsWith(`/${needle}`)),
  );
  return { file, count: files.length, files, missing };
}

/** `node scripts/check-asar.mjs <target>` */
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node scripts/check-asar.mjs <resources-dir-or-app.asar>');
    process.exit(2);
  }
  try {
    const { file, count, missing } = verifyAsar(target);
    console.log(`${path.basename(file)} contains ${count} entries`);
    if (missing.length) {
      console.error(`MISSING FROM PACKAGE: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log('all runtime modules present in the archive');
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
