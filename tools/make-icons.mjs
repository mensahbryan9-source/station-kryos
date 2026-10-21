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

// ——— Motif « citrouille » du Manoir des Ombres ———
const inEll = (u, v, cx, cy, rx, ry) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const inTri = (u, v, [ax, ay], [bx, by], [cx, cy]) => {
  const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = s(u, v, ax, ay, bx, by), d2 = s(u, v, bx, by, cx, cy), d3 = s(u, v, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
function pumpkinColor(u, v) {
  // fond : nuit violette et lune
  const rr = Math.hypot(u, v);
  let c = [20 + 30 * (1 - rr * 0.6), 6 + 10 * (1 - rr * 0.6), 30 + 40 * (1 - rr * 0.6)];
  if (Math.hypot(u - 0.48, v + 0.5) < 0.2) c = [235, 225, 200];
  const body = inEll(u, v, 0, 0.12, 0.62, 0.52) || inEll(u, v, -0.3, 0.14, 0.38, 0.48) || inEll(u, v, 0.3, 0.14, 0.38, 0.48);
  if (inTri(u, v, [-0.06, -0.38], [0.08, -0.38], [0.06, -0.62]) || (u > -0.06 && u < 0.07 && v > -0.6 && v < -0.36)) c = [70, 110, 30];
  if (body) {
    const shade = 0.65 + 0.35 * (1 - Math.min(1, Math.hypot(u + 0.2, v - 0.0) / 0.8));
    c = [250 * shade, 120 * shade, 20 * shade];
    const sideRib = Math.abs(Math.abs(u) - 0.3) < 0.015;
    if (sideRib) c = c.map((x) => x * 0.7);
    const glow = [255, 214, 70];
    if (inTri(u, v, [-0.42, 0.02], [-0.1, 0.02], [-0.26, -0.22]) || inTri(u, v, [0.1, 0.02], [0.42, 0.02], [0.26, -0.22])) c = glow;
    if (inTri(u, v, [-0.08, 0.12], [0.08, 0.12], [0, 0.0])) c = glow;
    // bouche dentelée
    if (v > 0.2 && v < 0.42 && Math.abs(u) < 0.42 - (v - 0.2) * 0.4) {
      const tooth = (v < 0.27 && Math.floor((u + 0.42) / 0.14) % 2 === 1) || (v > 0.35 && Math.floor((u + 0.42) / 0.14) % 2 === 0);
      if (!tooth) c = glow;
    }
  }
  return c;
}
function renderPumpkin(size, { inset = 1, rounded = true }) {
  const SS = 3;
  return png(size, (x, y) => {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((x + (sx + 0.5) / SS) / size) * 2 - 1, v = ((y + (sy + 0.5) / SS) / size) * 2 - 1;
      let a = 255;
      if (rounded) { const k = 0.36, qx = Math.max(Math.abs(u) - (1 - k), 0), qy = Math.max(Math.abs(v) - (1 - k), 0); if (Math.hypot(qx, qy) > k) a = 0; }
      const c = pumpkinColor(u / (0.9 * inset), v / (0.9 * inset));
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += a;
    }
    return acc.map((c) => Math.round(Math.min(255, c / (SS * SS))));
  });
}

// Motif actif : 'pumpkin' (Halloween) ou 'emblem' (ancienne station Kryos).
const DESIGN = process.argv[2] || 'pumpkin';
const draw = DESIGN === 'emblem' ? render : renderPumpkin;

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', draw(192, {}));
writeFileSync('icons/icon-512.png', draw(512, {}));
writeFileSync('icons/icon-maskable-512.png', draw(512, { inset: 0.72, rounded: false }));
writeFileSync('icons/apple-touch-icon.png', draw(180, { rounded: false }));
if (DESIGN === 'emblem') writeFileSync('icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2"><rect x="-1" y="-1" width="2" height="2" rx=".36" fill="#071420"/><g stroke="#8ef0ff" stroke-linecap="round" fill="none">${segs.map(({ s, w }) => `<line x1="${(s[0] * 0.82).toFixed(3)}" y1="${(s[1] * 0.82).toFixed(3)}" x2="${(s[2] * 0.82).toFixed(3)}" y2="${(s[3] * 0.82).toFixed(3)}" stroke-width="${(w * 1.64).toFixed(3)}"/>`).join('')}</g></svg>\n`);
else writeFileSync('icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1a0a24"/><g fill="#f07a14"><ellipse cx="32" cy="36" rx="20" ry="17"/><ellipse cx="22" cy="37" rx="12" ry="15"/><ellipse cx="42" cy="37" rx="12" ry="15"/></g><rect x="30" y="14" width="4" height="8" fill="#4a7a1e"/><g fill="#ffd646"><path d="M19 33h9l-4.5-7z"/><path d="M36 33h9l-4.5-7z"/><path d="M20 40h24l-3 7H23z"/></g></svg>\n`);
console.log(`Icônes générées dans icons/ (motif ${DESIGN})`);
