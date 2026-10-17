// Generates the app icons (PNG) without dependencies: node tools/make-icons.mjs
// Design on a 512 grid: beige background, seven strings between the yoke and
// the bridge, and a red pluck marker. Everything stays inside the maskable safe zone.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0xe9, 0xdf, 0xc9];
const FRAME = [0x8a, 0x6a, 0x45];
const STRING = [0x5c, 0x4a, 0x36];
const ACCENT = [0xb3, 0x39, 0x2b];
const INK = [0x3e, 0x32, 0x26];

const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// Shapes in drawing order, later ones on top.
const shapes = [];
for (let i = 0; i < 7; i++) {
  const x = 256 + (i - 3) * 36;
  const w = 7 - (4 * i) / 6;
  shapes.push({ color: STRING, hit: rect(x - w / 2, 140, x + w / 2, 372) });
}
shapes.push({ color: FRAME, hit: rect(130, 124, 382, 142) });
shapes.push({ color: FRAME, hit: rect(130, 368, 382, 388) });
shapes.push({ color: INK, hit: disc(220, 300, 21) });
shapes.push({ color: ACCENT, hit: disc(220, 300, 18) });

function render(size) {
  const scale = 512 / size;
  const SS = 4; // supersampling per axis for smooth edges
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * scale;
          const y = (py + (sy + 0.5) / SS) * scale;
          let c = BG;
          for (const s of shapes) if (s.hit(x, y)) c = s.color;
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      }
      for (let k = 0; k < 3; k++) row[1 + px * 3 + k] = Math.round(sum[k] / (SS * SS));
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

function png(size, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, out), render(size));
  console.log(`icons/${name}`);
}
