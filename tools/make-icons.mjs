// Génère les icônes PNG de l'application (sans dépendance externe).
// Usage : node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - vx * t, wy - vy * t);
};

// Emblème : anneau hexagonal + flocon cristallin, coordonnées normalisées [-1,1].
const segs = [];
for (let i = 0; i < 6; i++) {
  const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
  segs.push({ s: [Math.cos(a0) * 0.8, Math.sin(a0) * 0.8, Math.cos(a1) * 0.8, Math.sin(a1) * 0.8], w: 0.06 });
  const a = a0 + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
  segs.push({ s: [0, 0, c * 0.55, s * 0.55], w: 0.055 });
  for (const sign of [-1, 1]) {
    const b = a + sign * 0.75;
    segs.push({ s: [c * 0.3, s * 0.3, c * 0.3 + Math.cos(b) * 0.2, s * 0.3 + Math.sin(b) * 0.2], w: 0.04 });
  }
}

function emblem(nx, ny) {
  let d = 1e9;
  for (const { s, w } of segs) d = Math.min(d, segDist(nx, ny, ...s) - w);
  return d;
}

function render(size, { inset = 1, rounded = true, transparent = false }) {
  const SS = 3;
  return png(size, (x, y) => {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((x + (sx + 0.5) / SS) / size) * 2 - 1, v = ((y + (sy + 0.5) / SS) / size) * 2 - 1;
      // fond
      const rr = Math.hypot(u, v);
      let r = 3 + 14 * (1 - rr * 0.6), g = 7 + 26 * (1 - rr * 0.6), b = 12 + 40 * (1 - rr * 0.6), a = 255;
      if (rounded && !transparent) {
        const k = 0.36, qx = Math.max(Math.abs(u) - (1 - k), 0), qy = Math.max(Math.abs(v) - (1 - k), 0);
        if (Math.hypot(qx, qy) > k) a = 0;
      }
      const d = emblem(u / (0.82 * inset), v / (0.82 * inset)) * 0.82 * inset;
      const glow = Math.exp(-Math.max(0, d) * 14) * 0.55;
      r += 54 * glow; g += 224 * glow; b += 255 * glow;
      if (d < 0) { const t = Math.min(1, -d * 60); r = r * (1 - t) + 220 * t; g = g * (1 - t) + 250 * t; b = b * (1 - t) + 255 * t; }
      acc[0] += Math.min(255, r); acc[1] += Math.min(255, g); acc[2] += Math.min(255, b); acc[3] += a;
    }
    return acc.map((c) => Math.round(c / (SS * SS)));
  });
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', render(192, {}));
writeFileSync('icons/icon-512.png', render(512, {}));
writeFileSync('icons/icon-maskable-512.png', render(512, { inset: 0.72, rounded: false }));
writeFileSync('icons/apple-touch-icon.png', render(180, { rounded: false }));
writeFileSync('icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2"><rect x="-1" y="-1" width="2" height="2" rx=".36" fill="#071420"/><g stroke="#8ef0ff" stroke-linecap="round" fill="none">${segs.map(({ s, w }) => `<line x1="${(s[0] * 0.82).toFixed(3)}" y1="${(s[1] * 0.82).toFixed(3)}" x2="${(s[2] * 0.82).toFixed(3)}" y2="${(s[3] * 0.82).toFixed(3)}" stroke-width="${(w * 1.64).toFixed(3)}"/>`).join('')}</g></svg>\n`);
console.log('Icônes générées dans icons/');
