import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ext = require('../apps/desktop/extensions.cjs');

/* ------------------------------------------------------------------ *
 * Build real zip archives in the test, so the reader is exercised
 * against genuine bytes rather than a mock.
 * ------------------------------------------------------------------ */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal stored/deflate zip writer: enough to test the reader. */
function makeZip(files: Array<{ name: string; data: string }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const raw = Buffer.from(f.data, 'utf8');
    const deflated = zlib.deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

let tmp: string;
let root: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-ext-'));
  root = path.join(tmp, 'extensions');
  fs.mkdirSync(root, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeZip(name: string, files: Array<{ name: string; data: string }>): string {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, makeZip(files));
  return p;
}

const manifest = (name: string, version = '1.0.0') =>
  JSON.stringify({ manifest_version: 3, name, version });

describe('extension installation', () => {
  it('installs a package and reports its manifest', async () => {
    const zip = writeZip('good.zip', [
      { name: 'manifest.json', data: manifest('Ad Blocker', '2.3.1') },
      { name: 'popup.html', data: '<html><body>hi</body></html>' },
      { name: 'icons/48.png', data: 'fakepng' },
    ]);
    const info = await ext.installZip({ root, zipPath: zip, id: 'ad-blocker' });
    expect(info.name).toBe('Ad Blocker');
    expect(info.version).toBe('2.3.1');
    expect(info.manifestVersion).toBe(3);
    expect(fs.existsSync(path.join(root, 'ad-blocker', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'ad-blocker', 'icons', '48.png'))).toBe(true);
  });

  it('lists only directories that carry a readable manifest', async () => {
    fs.mkdirSync(path.join(root, 'half-unpacked'), { recursive: true });
    fs.writeFileSync(path.join(root, 'half-unpacked', 'manifest.json'), '{ broken');
    fs.writeFileSync(path.join(root, 'stray.txt'), 'not a dir');
    const names = ext.listInstalled(root).map((e: { name: string }) => e.name);
    expect(names).toContain('Ad Blocker');
    expect(names).not.toContain('half-unpacked');
    expect(names).toHaveLength(1);
  });

  it('unwraps a package that nests everything in one folder', async () => {
    const zip = writeZip('nested.zip', [
      { name: 'extension/manifest.json', data: manifest('Nested') },
      { name: 'extension/bg.js', data: 'void 0;' },
    ]);
    const info = await ext.installZip({ root, zipPath: zip, id: 'nested' });
    expect(info.name).toBe('Nested');
  });

  it('removes everything when the package has no manifest', async () => {
    const zip = writeZip('nomanifest.zip', [{ name: 'readme.txt', data: 'nothing here' }]);
    await expect(ext.installZip({ root, zipPath: zip, id: 'bad' })).rejects.toThrow(/manifest/i);
    expect(fs.existsSync(path.join(root, 'bad'))).toBe(false);
  });

  it('rejects a file that is not a zip', async () => {
    const p = path.join(tmp, 'notzip.zip');
    fs.writeFileSync(p, 'this is plainly not a zip archive at all');
    await expect(ext.installZip({ root, zipPath: p, id: 'junk' })).rejects.toThrow(/not a zip/i);
    expect(fs.existsSync(path.join(root, 'junk'))).toBe(false);
  });

  it('rejects a missing file without leaving a directory behind', async () => {
    await expect(
      ext.installZip({ root, zipPath: path.join(tmp, 'absent.zip'), id: 'absent' }),
    ).rejects.toThrow(/no longer exists/i);
    expect(fs.existsSync(path.join(root, 'absent'))).toBe(false);
  });

  it('refuses a path that escapes the install directory', async () => {
    const zip = writeZip('evil.zip', [
      { name: 'manifest.json', data: manifest('Evil') },
      { name: '../../escaped.txt', data: 'pwned' },
    ]);
    await expect(ext.installZip({ root, zipPath: zip, id: 'evil' })).rejects.toThrow(/unsafe path/i);
    expect(fs.existsSync(path.join(tmp, 'escaped.txt'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'evil'))).toBe(false);
  });

  it('digests a package deterministically', () => {
    const zip = writeZip('digest.zip', [{ name: 'manifest.json', data: manifest('D') }]);
    const a = ext.digest(zip);
    const b = ext.digest(zip);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
