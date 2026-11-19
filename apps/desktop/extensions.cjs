/**
 * Extension installation for the desktop shell.
 *
 * The product promise is "download and use them through the app" — visiting the
 * Chrome Web Store and clicking Add to Chrome is not that. A store page fetches
 * a signed CRX and Chromium refuses to load a third-party CRX at runtime, so a
 * real install means: fetch the package, verify it, unpack it into a directory
 * this app owns, and hand that directory to the profile's session.
 *
 * Two sources, in order of trust:
 *   1. `builtin` — extensions compiled into the shipped app (unpacked at first
 *      run). No network, no update channel, works offline forever.
 *   2. `crx`   — an unpacked directory downloaded by the user once and dropped
 *      into the extensions folder; the app verifies and loads it.
 *
 * What this module deliberately does NOT do is pretend a store install worked.
 * `chrome-extension://` packages are signed for the store's own update channel;
 * loading an arbitrary CRX requires `--enable-features` overrides that break the
 * "bundled engine, nothing borrowed from the host" rule and are a code-execution
 * hazard. The UI therefore offers the store link as an explicit fallback.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

/** A manifest is the only thing that makes a directory loadable. */
function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!m || typeof m !== 'object') return null;
    return m;
  } catch {
    return null;
  }
}

function summarize(dir) {
  const m = readManifest(dir);
  if (!m) return null;
  return {
    dir,
    name: typeof m.name === 'string' ? m.name : path.basename(dir),
    version: typeof m.version === 'string' ? m.version : '0.0.0',
    manifestVersion: m.manifest_version ?? 2,
  };
}

/**
 * List installable extension directories under `root`. Only directories with a
 * readable manifest are returned; a half-unpacked zip is ignored rather than
 * handed to Electron and throwing during launch.
 */
function listInstalled(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const info = summarize(path.join(root, entry.name));
    if (info) out.push(info);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ *
 * Minimal ZIP reader.
 *
 * `tar -xf` reads zip on Windows and macOS (bsdtar) but NOT with GNU tar,
 * so depending on the host binary made installation silently platform
 * dependent. This reads the central directory directly and inflates with
 * node's zlib: no native module, identical behaviour everywhere, and it
 * refuses paths that escape the destination (zip-slip).
 * ------------------------------------------------------------------ */

/** Locate the End of Central Directory record and return the entry list. */
function readZipEntries(buf) {
  // The EOCD record is at least 22 bytes and may be followed by a comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('That file is not a zip archive.');

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip central directory.');
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const rawSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries.push({ name, method, compSize, rawSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extract one entry's bytes. */
function readEntry(buf, entry) {
  const { localOffset, method, compSize } = entry;
  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Corrupt zip local header.');
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error(`Unsupported zip compression method ${method}.`);
}

/** Write every entry under `dest`, refusing traversal outside it. */
function extractZip(buf, dest) {
  const root = path.resolve(dest);
  for (const entry of readZipEntries(buf)) {
    const target = path.resolve(root, entry.name);
    // zip-slip guard: every path must stay inside the destination
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Refusing an unsafe path in the package: ${entry.name}`);
    }
    if (entry.name.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, readEntry(buf, entry));
  }
}

/**
 * Unpack a `.zip` into `root/<id>`.
 *
 * Uses the platform's own unzip on Windows 10+ (tar.exe ships with it) and the
 * `tar` binary elsewhere, so no native module is added to the installer.
 * Returns the installed directory, or throws with a message the UI can show.
 */
async function installZip({ root, zipPath, id }) {
  if (!fs.existsSync(zipPath)) throw new Error('That file no longer exists.');
  const target = path.join(root, id);
  fs.mkdirSync(target, { recursive: true });
  try {
    extractZip(fs.readFileSync(zipPath), target);
  } catch (e) {
    // Leave nothing half-unpacked behind: a broken folder would be offered to
    // Electron at launch time and fail there instead of here.
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error(String(e.message || e).slice(0, 200));
  }
  // Some packages wrap everything in a single top-level folder.
  let dir = target;
  const entries = fs.readdirSync(target, { withFileTypes: true });
  if (!fs.existsSync(path.join(target, 'manifest.json')) && entries.length === 1 && entries[0].isDirectory()) {
    dir = path.join(target, entries[0].name);
  }
  const info = summarize(dir);
  if (!info) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('That package does not contain a valid manifest.json.');
  }
  return info;
}

/** SHA-256 of a package, shown next to a download so a user can verify it. */
function digest(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

module.exports = { listInstalled, installZip, digest, summarize, readManifest };
