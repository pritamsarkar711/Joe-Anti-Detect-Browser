#!/usr/bin/env node
/**
 * Builds the Windows .ico and PNG icon set from the canonical Joe Browser mark.
 *
 * electron-builder needs build/icon.ico (>=256px) for the installer, the EXE
 * file icon and shortcuts. Without it Electron falls back to the generic icon,
 * which is why the logo differed between places.
 *
 * Rendering is done with a tiny supersampling rasteriser (no native deps), so
 * the icon matches MARK_GEOMETRY in src/ui/Brand.tsx: a "J" monogram in white
 * on a #D81B60 squircle.
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

/** Signed distance from point to a rounded rect (negative inside). */
function sdRoundRect(x, y, w, h, r) {
  const dx = Math.abs(x - w / 2) - (w / 2 - r);
  const dy = Math.abs(y - h / 2) - (h / 2 - r);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r;
}

/** Coverage of a rounded rect: 1 inside, anti-aliased at the edge. */
function roundRectAlpha(x, y, w, h, r) {
  return clamp(0.5 - sdRoundRect(x, y, w, h, r), 0, 1);
}

/**
 * Coverage of the "J" monogram + octagonal stealth frame, mirroring
 * MARK_GEOMETRY in src/ui/Brand.tsx.
 */
const J = {
  barX1: 21.2, barX2: 29.4, barY: 14.5,
  stemX: 29.4, stemTop: 14.5, stemBottom: 28.3,
  hookCx: 21.4, hookCy: 28.3, hookR: 8.0,
  stroke: 4.6,
};

const FRAME_SEGMENTS = [
  [15, 9.5, 33, 9.5],
  [33, 9.5, 38.5, 15],
  [38.5, 15, 38.5, 33],
  [38.5, 33, 33, 38.5],
  [33, 38.5, 15, 38.5],
  [15, 38.5, 9.5, 33],
  [9.5, 33, 9.5, 15],
  [9.5, 15, 15, 9.5],
];

/** Distance from (x,y) to the segment (ax,ay)-(bx,by). */
function sdSegment(x, y, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = x - ax;
  const wy = y - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp((wx * vx + wy * vy) / len2, 0, 1);
  return Math.hypot(wx - vx * t, wy - vy * t);
}

/** Distance from (x,y) to the lower half-circle hook. */
function sdHook(x, y) {
  const dx = x - J.hookCx;
  const dy = y - J.hookCy;
  if (dy >= 0) return Math.abs(Math.hypot(dx, dy) - J.hookR);
  return Math.min(Math.hypot(x - (J.hookCx + J.hookR), dy), Math.hypot(x - (J.hookCx - J.hookR), dy));
}

/** 1 inside the stroke, 0 outside, anti-aliased across one pixel. */
function jAlpha(x, y, px) {
  const d = Math.min(
    sdSegment(x, y, J.barX1, J.barY, J.barX2, J.barY),
    sdSegment(x, y, J.stemX, J.stemTop, J.stemX, J.stemBottom),
    sdHook(x, y),
  );
  const edge = J.stroke / 2;
  return clamp((edge - d) / px + 0.5, 0, 1);
}

function frameAlpha(x, y, px) {
  let d = Infinity;
  for (let i = 0; i < FRAME_SEGMENTS.length; i++) {
    const s = FRAME_SEGMENTS[i];
    d = Math.min(d, sdSegment(x, y, s[0], s[1], s[2], s[3]));
  }
  return clamp((1.2 - d) / px + 0.5, 0, 1) * 0.34;
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
          const tileA = roundRectAlpha(vx, vy, 48, 48, 11.5);
          if (tileA <= 0) continue;
          let cr = PINK[0], cg = PINK[1], cb = PINK[2];
          const f = frameAlpha(vx, vy, scale);
          if (f > 0) {
            cr = cr * (1 - f) + 255 * f;
            cg = cg * (1 - f) + 255 * f;
            cb = cb * (1 - f) + 255 * f;
          }
          const j = jAlpha(vx, vy, scale);
          if (j > 0) {
            cr = cr * (1 - j) + 255 * j;
            cg = cg * (1 - j) + 255 * j;
            cb = cb * (1 - j) + 255 * j;
          }
          const ca = tileA;
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
