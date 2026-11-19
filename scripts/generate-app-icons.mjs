#!/usr/bin/env node
/**
 * Builds the Windows .ico and PNG icon set from the canonical Joe Browser mark.
 *
 * electron-builder needs build/icon.ico (>=256px) for the installer, the EXE
 * file icon and shortcuts. Without it Electron falls back to the generic icon,
 * which is why the logo differed between places.
 *
 * Rendering is done with a tiny supersampling rasteriser (no native deps), so
 * the icon is pixel-identical to the SVG in src/ui/Brand.tsx: an open arc,
 * a solid core and a white pupil on a white rounded tile.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'build');
const PINK = [216, 27, 96];
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Signed distance from point to a rounded rect border. */
function roundRectAlpha(x, y, w, h, r) {
  const dx = Math.abs(x - w / 2) - (w / 2 - r);
  const dy = Math.abs(y - h / 2) - (h / 2 - r);
  const d = Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r;
  return clamp(0.5 - d, 0, 1); // 1 inside
}

/** Anti-aliased circle coverage. */
function circleAlpha(x, y, cx, cy, r) {
  const d = Math.hypot(x - cx, y - cy) - r;
  return clamp(0.5 - d, 0, 1);
}

/** Coverage for the open arc: ring minus a wedge centred on -50deg (upper right). */
const GAP_CENTER = -50;
const GAP_HALF = 16;
function arcAlpha(x, y, cx, cy, r, half) {
  const dist = Math.hypot(x - cx, y - cy);
  const ring = clamp(half / 2 + 0.5 - Math.abs(dist - r), 0, 1);
  if (ring <= 0) return 0;
  const ang = (Math.atan2(y - cy, x - cx) * 180) / Math.PI; // -180..180
  let delta = Math.abs(ang - GAP_CENTER);
  if (delta > 180) delta = 360 - delta;
  if (delta < GAP_HALF) return 0;
  return ring;
}

function renderRGBA(size) {
  const ss = 4; // supersample factor
  const buf = Buffer.alloc(size * size * 4);
  const scale = 48 / size; // SVG viewBox 0..48
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const vx = (px + (sx + 0.5) / ss) * scale;
          const vy = (py + (sy + 0.5) / ss) * scale;
          // tile
          let cr = 255, cg = 255, cb = 255, ca = roundRectAlpha(vx, vy, 48, 48, size <= 32 ? 4 : 9);
          if (ca <= 0) continue;
          // arc
          const arc = arcAlpha(vx, vy, 24, 24, 19, 3.6);
          if (arc > 0) { cr = cr * (1 - arc) + PINK[0] * arc; cg = cg * (1 - arc) + PINK[1] * arc; cb = cb * (1 - arc) + PINK[2] * arc; }
          // core
          const core = circleAlpha(vx, vy, 24, 24, 10.2);
          if (core > 0) { cr = cr * (1 - core) + PINK[0] * core; cg = cg * (1 - core) + PINK[1] * core; cb = cb * (1 - core) + PINK[2] * core; }
          // pupil
          const pupil = circleAlpha(vx, vy, 24, 24, 3.8);
          if (pupil > 0) { cr = cr * (1 - pupil) + 255 * pupil; cg = cg * (1 - pupil) + 255 * pupil; cb = cb * (1 - pupil) + 255 * pupil; }
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const n = ss * ss;
      const alpha = a / n;
      const i = (py * size + px) * 4;
      if (alpha > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  return buf;
}

/* ---------- PNG encoder ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- ICO encoder (PNG-compressed entries, Vista+) ---------- */
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, i) => {
    const b = i * 16;
    dir[b] = e.size >= 256 ? 0 : e.size;
    dir[b + 1] = e.size >= 256 ? 0 : e.size;
    dir[b + 2] = 0;
    dir[b + 3] = 0;
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(e.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

fs.mkdirSync(OUT, { recursive: true });
const entries = SIZES.map((size) => ({ size, png: encodePNG(size, renderRGBA(size)) }));
fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeICO(entries));
fs.writeFileSync(path.join(OUT, 'icon.png'), entries[entries.length - 1].png);
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
for (const e of entries) fs.writeFileSync(path.join(OUT, 'icons', `${e.size}x${e.size}.png`), e.png);

console.log(`Wrote build/icon.ico (${SIZES.join(',')}px), build/icon.png and ${entries.length} PNG sizes.`);
