// Sprites procéduraux : ennemis, objets, décor, projectiles, effets et armes.
import { canvas, rng, EMISSIVE_ALPHA } from './textures.js';

// Convertit un canvas en sprite {w,h,data}. Alpha binaire, émissif optionnel.
function toSprite(c, glow) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = glow && glow(d[i], d[i + 1], d[i + 2]) ? EMISSIVE_ALPHA : 255;
  }
  return { w: c.width, h: c.height, data: new Uint32Array(d.buffer.slice(0)) };
}

function sprite(size, draw, glow, seed = 7) {
  const c = canvas(size, size);
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, rng(seed));
  return toSprite(c, glow);
}

const bright = (r, g, b) => Math.max(r, g, b) > 235;
const ell = (g, x, y, rx, ry, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
const shadow = (g, x = 32, w = 14) => ell(g, x, 62, w, 2.2, 'rgba(0,0,0,.55)');

function sparks(g, r, n, x, y, spread, colors = ['#fff6a0', '#ffb030', '#ff6020']) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    const a = r() * 6.28, d = r() * spread;
    g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2);
  }
}

// ——— Drone ———
function drawDrone(g, r, pose) {
  const bob = pose === 'walk1' ? 2 : 0;
  if (pose.startsWith('die')) {
    const k = +pose[3];
    if (k === 2) { // épave au sol
      shadow(g, 32, 16);
      ell(g, 30, 57, 13, 5, '#3b4552'); ell(g, 30, 55, 10, 3, '#59687a');
      g.fillStyle = '#1b2027'; g.fillRect(18, 56, 6, 3); g.fillRect(38, 58, 8, 2);
      ell(g, 33, 55, 3, 2, '#0a2f40');
      return;
    }
    ell(g, 32, 30 + k * 10, 18 - k * 4, 16 - k * 4, '#ffcf6a');
    ell(g, 32, 30 + k * 10, 12 - k * 3, 10 - k * 3, '#fff7d6');
    sparks(g, r, 40, 32, 30 + k * 10, 24);
    return;
  }
  shadow(g, 32, 10);
  const y = 26 + bob;
  // ailettes
  g.fillStyle = '#2b333d';
  g.beginPath(); g.moveTo(10, y); g.lineTo(2, y - 6); g.lineTo(4, y + 8); g.fill();
  g.beginPath(); g.moveTo(54, y); g.lineTo(62, y - 6); g.lineTo(60, y + 8); g.fill();
  // coque
  const grd = g.createRadialGradient(26, y - 6, 2, 32, y, 20);
  grd.addColorStop(0, '#c7d3e0'); grd.addColorStop(0.5, '#6f7f92'); grd.addColorStop(1, '#232b35');
  g.fillStyle = grd; g.beginPath(); g.arc(32, y, 18, 0, 7); g.fill();
  g.fillStyle = '#1a2028'; g.fillRect(14, y - 2, 36, 4);
  // antenne
  g.strokeStyle = '#8899aa'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, y - 18); g.lineTo(36, y - 25); g.stroke();
  g.fillStyle = pose === 'attack' ? '#ff4040' : '#40e0ff'; g.fillRect(35, y - 27, 3, 3);
  // œil
  ell(g, 32, y + 3, 9, 8, '#0b0f14');
  const eye = pose === 'attack' ? '#ff3a2a' : pose === 'pain' ? '#ffffff' : '#36e6ff';
  const eg = g.createRadialGradient(32, y + 3, 0, 32, y + 3, 7);
  eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.4, eye); eg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = eg; g.beginPath(); g.arc(32, y + 3, 7, 0, 7); g.fill();
  // réacteurs
  ell(g, 24, y + 19, 3, 2, '#9fefff'); ell(g, 40, y + 19, 3, 2, '#9fefff');
  if (pose === 'pain') sparks(g, r, 18, 32, y, 18);
  if (pose === 'attack') { ell(g, 32, y + 3, 12, 11, 'rgba(255,80,40,.5)'); }
}

// ——— Sentinelle ———
function drawSentinel(g, r, pose) {
  if (pose.startsWith('die')) {
    const k = +pose[3];
    shadow(g, 32, 18);
    if (k === 0) { drawSentinel(g, r, 'pain'); return; }
    if (k === 1) {
      g.save(); g.translate(32, 60); g.rotate(-0.9); g.translate(-32, -60);
      drawSentinelBody(g, r, 'pain', 0); g.restore();
      sparks(g, r, 20, 26, 34, 12);
      return;
    }
    // carcasse au sol
    g.fillStyle = '#2c333b'; g.fillRect(10, 54, 44, 7);
    g.fillStyle = '#4a5562'; g.fillRect(14, 51, 22, 6);
    ell(g, 46, 54, 7, 5, '#3a434e'); g.fillStyle = '#ff2a2a'; g.fillRect(46, 52, 5, 2);
    g.fillStyle = '#1b1f24'; g.fillRect(6, 58, 16, 3);
    ell(g, 30, 61, 12, 2, '#162a35');
    return;
  }
  shadow(g, 32, 13);
  drawSentinelBody(g, r, pose, pose === 'walk1' ? 1 : 0);
}
function drawSentinelBody(g, r, pose, step) {
  // jambes
  g.fillStyle = '#2a3038';
  const l1 = step ? 4 : 0, l2 = step ? 0 : 4;
  g.fillRect(23, 40, 7, 21 - l1); g.fillRect(34, 40, 7, 21 - l2);
  g.fillStyle = '#56606c'; g.fillRect(22, 58 - l1, 9, 4); g.fillRect(33, 58 - l2, 9, 4);
  g.fillStyle = '#c96a1a'; g.fillRect(24, 46, 5, 3); g.fillRect(35, 46, 5, 3);
  // torse
  const grd = g.createLinearGradient(18, 0, 46, 0);
  grd.addColorStop(0, '#3a434e'); grd.addColorStop(0.5, '#8794a3'); grd.addColorStop(1, '#2d343d');
  g.fillStyle = grd; g.beginPath(); g.moveTo(18, 18); g.lineTo(46, 18); g.lineTo(42, 42); g.lineTo(22, 42); g.fill();
  g.fillStyle = '#e8b21c'; g.fillRect(27, 26, 10, 3);
  g.fillStyle = '#20262d'; g.fillRect(22, 36, 20, 4);
  // tête
  g.fillStyle = '#4c5764'; g.fillRect(25, 6, 14, 12);
  g.fillStyle = '#0a0d11'; g.fillRect(26, 10, 12, 4);
  g.fillStyle = pose === 'pain' ? '#ffffff' : '#ff2a3a'; g.fillRect(27, 11, 10, 2);
  // bras + arme
  g.fillStyle = '#39424d'; g.fillRect(14, 20, 6, 16); g.fillRect(44, 20, 6, 14);
  if (pose === 'attack') {
    g.fillStyle = '#1a1e24'; g.fillRect(36, 28, 18, 6);
    g.fillStyle = '#5b6672'; g.fillRect(38, 26, 8, 3);
    ell(g, 58, 31, 6, 5, '#fff3a0'); ell(g, 58, 31, 3, 3, '#ffffff');
  } else {
    g.fillStyle = '#1a1e24'; g.fillRect(40, 32, 8, 16);
    g.fillStyle = '#5b6672'; g.fillRect(41, 30, 6, 3);
  }
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(18, 6, 28, 36); }
}

// ——— Broyeur ———
function drawMauler(g, r, pose) {
  if (pose.startsWith('die')) {
    const k = +pose[3];
    shadow(g, 32, 22);
    if (k < 2) {
      g.save(); g.translate(32, 62); g.scale(1, 1 - k * 0.35); g.translate(-32, -62);
      drawMaulerBody(g, r, 'pain', 0); g.restore();
      ell(g, 32, 52, 18, 6, 'rgba(160,40,120,.7)');
      return;
    }
    ell(g, 32, 57, 26, 6, '#4a1a44'); ell(g, 30, 55, 18, 4, '#7a2c6a');
    ell(g, 20, 54, 4, 3, '#cfff3a'); ell(g, 44, 57, 3, 2, '#cfff3a');
    g.fillStyle = '#d6d0c0'; g.fillRect(36, 52, 10, 2); g.fillRect(12, 56, 8, 2);
    return;
  }
  shadow(g, 32, 20);
  drawMaulerBody(g, r, pose, pose === 'walk1' ? 1 : 0);
}
function drawMaulerBody(g, r, pose, step) {
  // pattes
  g.fillStyle = '#3d1838';
  g.fillRect(12 + step * 2, 44, 8, 18); g.fillRect(44 - step * 2, 44, 8, 18);
  g.fillRect(22 - step * 2, 46, 6, 15); g.fillRect(36 + step * 2, 46, 6, 15);
  // corps
  const grd = g.createRadialGradient(28, 28, 4, 32, 34, 26);
  grd.addColorStop(0, '#b0478f'); grd.addColorStop(0.6, '#6a2460'); grd.addColorStop(1, '#2d0f2a');
  g.fillStyle = grd; g.beginPath(); g.ellipse(32, 36, 24, 16, 0, 0, 7); g.fill();
  // plaques mécaniques
  g.fillStyle = '#4f5966'; g.fillRect(20, 22, 24, 6);
  g.fillStyle = '#7b8695'; g.fillRect(22, 22, 20, 2);
  // pustules
  ell(g, 18, 34, 3, 3, '#d4ff3a'); ell(g, 46, 38, 2.5, 2.5, '#d4ff3a'); ell(g, 40, 30, 2, 2, '#d4ff3a');
  // gueule + yeux
  g.fillStyle = '#12050f'; g.beginPath(); g.ellipse(32, 42, 11, pose === 'attack' ? 8 : 4, 0, 0, 7); g.fill();
  g.fillStyle = '#e8e2d0';
  for (let i = 0; i < 6; i++) { g.fillRect(23 + i * 3.4, 39, 2, 3); g.fillRect(24 + i * 3.4, pose === 'attack' ? 46 : 43, 2, 3); }
  g.fillStyle = '#ffd400'; g.fillRect(24, 31, 4, 3); g.fillRect(36, 31, 4, 3);
  // griffes
  g.fillStyle = '#d6d0c0';
  const up = pose === 'attack' ? -14 : 0;
  g.beginPath(); g.moveTo(6, 40 + up); g.lineTo(2, 28 + up); g.lineTo(10, 36 + up); g.fill();
  g.beginPath(); g.moveTo(58, 40 + up); g.lineTo(62, 28 + up); g.lineTo(54, 36 + up); g.fill();
  g.fillStyle = '#4a1a44'; g.fillRect(6, 38 + up, 8, 6); g.fillRect(50, 38 + up, 8, 6);
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(32, 36, 24, 16, 0, 0, 7); g.fill(); }
}

// ——— Archonte (boss, 128 px) ———
function drawBoss(g, r, pose) {
  g.save(); g.scale(2, 2);
  if (pose.startsWith('die')) {
    const k = +pose[3];
    if (k === 2) {
      ell(g, 32, 58, 26, 5, '#2a0d1a');
      ell(g, 32, 56, 16, 4, '#531a33');
      for (let i = 0; i < 8; i++) { g.fillStyle = '#6b7380'; g.fillRect(6 + r() * 48, 52 + r() * 8, 4 + r() * 6, 2); }
      ell(g, 32, 55, 4, 2, '#ff3a60');
      g.restore(); return;
    }
    ell(g, 32, 30 + k * 8, 26, 24, '#ffd27a'); ell(g, 32, 30 + k * 8, 16, 14, '#ffffff');
    sparks(g, r, 80, 32, 30 + k * 8, 30, ['#ffffff', '#ff6a9a', '#ffcc33']);
    g.restore(); return;
  }
  shadow(g, 32, 20);
  const y = 26 + (pose === 'walk1' ? 2 : 0);
  // tentacules
  g.strokeStyle = '#5a1b48'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const x0 = 14 + i * 7;
    g.beginPath(); g.moveTo(x0, y + 10);
    g.quadraticCurveTo(x0 + (i % 2 ? 6 : -6) + (pose === 'walk1' ? 3 : 0), y + 22, x0 + (i - 2.5) * 2, y + 34);
    g.stroke();
  }
  // anneaux
  g.strokeStyle = '#8a95a6'; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(32, y, 30, 8, 0.2, 0, 7); g.stroke();
  g.strokeStyle = '#ff4a7a'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(32, y, 27, 6.5, 0.2, 0, 7); g.stroke();
  // noyau
  const grd = g.createRadialGradient(28, y - 6, 2, 32, y, 20);
  grd.addColorStop(0, '#d98ab8'); grd.addColorStop(0.5, '#7c2560'); grd.addColorStop(1, '#2a0a20');
  g.fillStyle = grd; g.beginPath(); g.arc(32, y, 19, 0, 7); g.fill();
  g.fillStyle = '#3c434f';
  g.fillRect(14, y - 3, 6, 6); g.fillRect(44, y - 3, 6, 6); g.fillRect(29, y - 21, 6, 5);
  // œil
  ell(g, 32, y, 10, 9, '#0d0308');
  const eye = pose === 'attack' ? '#ffe14a' : pose === 'pain' ? '#ffffff' : '#ff2a5a';
  const eg = g.createRadialGradient(32, y, 0, 32, y, 8);
  eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.35, eye); eg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = eg; g.beginPath(); g.arc(32, y, 8, 0, 7); g.fill();
  g.fillStyle = '#000'; g.fillRect(31, y - 4, 2, 8);
  if (pose === 'attack') { g.fillStyle = 'rgba(255,220,80,.35)'; g.beginPath(); g.arc(32, y, 24, 0, 7); g.fill(); }
  if (pose === 'pain') sparks(g, r, 30, 32, y, 22, ['#ffffff', '#ff6a9a']);
  g.restore();
}

const POSES = ['walk0', 'walk1', 'attack', 'pain', 'die0', 'die1', 'die2'];
function enemyFrames(draw, size, glow) {
  const f = {};
  POSES.forEach((p, i) => { f[p] = sprite(size, (g, r) => draw(g, r, p), glow, 100 + i); });
  return { walk: [f.walk0, f.walk1], attack: f.attack, pain: f.pain, death: [f.die0, f.die1, f.die2] };
}

// ——— Objets ———
const ITEMS = {
  h: (g) => { shadow(g, 32, 9); g.fillStyle = '#e9eef2'; g.fillRect(23, 48, 18, 13); g.fillStyle = '#9aa6b0'; g.fillRect(23, 58, 18, 3); g.fillStyle = '#18c8b4'; g.fillRect(30, 50, 4, 9); g.fillRect(27.5, 52.5, 9, 4); },
  H: (g) => { shadow(g, 32, 15); g.fillStyle = '#f2f5f7'; g.fillRect(16, 42, 32, 19); g.fillStyle = '#a3afb9'; g.fillRect(16, 57, 32, 4); g.fillRect(26, 38, 12, 4); g.fillStyle = '#18c8b4'; g.fillRect(29, 44, 6, 12); g.fillRect(25, 47, 14, 6); },
  r: (g) => { shadow(g, 32, 14); g.fillStyle = '#1f4e8a'; g.beginPath(); g.moveTo(18, 38); g.lineTo(46, 38); g.lineTo(44, 61); g.lineTo(20, 61); g.fill(); g.fillStyle = '#3f8de0'; g.fillRect(22, 42, 8, 8); g.fillRect(34, 42, 8, 8); g.fillRect(22, 52, 20, 6); g.fillStyle = '#7fd0ff'; g.fillRect(24, 43, 4, 2); g.fillRect(36, 43, 4, 2); },
  a: (g) => { shadow(g, 32, 10); g.fillStyle = '#2b333d'; g.fillRect(24, 44, 16, 17); g.fillStyle = '#56e3ff'; g.fillRect(27, 47, 10, 11); g.fillStyle = '#e6fbff'; g.fillRect(30, 49, 4, 7); g.fillStyle = '#8b97a5'; g.fillRect(28, 41, 8, 3); },
  c: (g) => { shadow(g, 32, 12); g.fillStyle = '#5a3a1c'; g.fillRect(20, 48, 24, 13); g.fillStyle = '#e38a2a'; for (let i = 0; i < 4; i++) { g.fillRect(22 + i * 6, 42, 4, 8); } g.fillStyle = '#c9b25a'; for (let i = 0; i < 4; i++) g.fillRect(22 + i * 6, 48, 4, 2); },
  b: (g) => { shadow(g, 32, 9); for (const x of [24, 33]) { g.fillStyle = '#1b1f24'; g.fillRect(x, 44, 8, 17); g.fillStyle = '#e8b21c'; g.fillRect(x, 44, 8, 6); g.fillStyle = '#c9d2dc'; g.fillRect(x + 2, 41, 4, 3); g.fillStyle = '#ffffff'; g.fillRect(x + 1, 52, 2, 7); } },
  k: (g) => card(g, '#2f8cff'),
  K: (g) => card(g, '#ff3344'),
  t: (g) => { shadow(g, 32, 7); const grd = g.createLinearGradient(26, 36, 38, 60); grd.addColorStop(0, '#f2d6ff'); grd.addColorStop(1, '#7a3cff'); g.fillStyle = grd; g.beginPath(); g.moveTo(32, 36); g.lineTo(39, 48); g.lineTo(32, 60); g.lineTo(25, 48); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(30, 42, 2, 8); },
  w: (g) => { shadow(g, 32, 18); g.fillStyle = '#2a3038'; g.fillRect(10, 50, 44, 6); g.fillStyle = '#56606c'; g.fillRect(14, 47, 28, 4); g.fillStyle = '#36e0ff'; g.fillRect(18, 52, 22, 2); g.fillStyle = '#1a1e24'; g.fillRect(36, 55, 6, 6); },
  W: (g) => { shadow(g, 32, 18); g.fillStyle = '#3a2a1c'; g.fillRect(36, 50, 18, 7); g.fillStyle = '#4b535e'; g.fillRect(10, 48, 30, 4); g.fillRect(10, 53, 30, 4); g.fillStyle = '#e38a2a'; g.fillRect(30, 49, 6, 8); },
  Z: (g) => { shadow(g, 32, 20); g.fillStyle = '#2a3038'; g.fillRect(8, 46, 46, 10); g.fillStyle = '#7b8695'; for (let i = 0; i < 5; i++) g.fillRect(14 + i * 7, 44, 4, 14); g.fillStyle = '#8af0ff'; g.fillRect(10, 50, 40, 2); g.fillStyle = '#1a1e24'; g.fillRect(40, 56, 7, 5); },
};
function card(g, c) {
  shadow(g, 32, 8);
  g.fillStyle = c; g.fillRect(24, 46, 16, 12);
  g.fillStyle = '#e8eef4'; g.fillRect(26, 48, 6, 4);
  g.fillStyle = '#0d1014'; g.fillRect(24, 54, 16, 2);
}

const DECOR = {
  l: (g) => { g.fillStyle = '#2a3038'; g.fillRect(31, 0, 2, 6); g.fillStyle = '#4b535e'; g.fillRect(22, 6, 20, 4); ell(g, 32, 11, 9, 3, '#e6fbff'); ell(g, 32, 11, 5, 1.5, '#ffffff'); },
  o: (g) => { shadow(g, 32, 13); g.fillStyle = '#b8541a'; g.fillRect(20, 30, 24, 31); g.fillStyle = '#e8b21c'; g.fillRect(20, 38, 24, 5); g.fillRect(20, 50, 24, 5); g.fillStyle = '#7a3510'; g.fillRect(20, 30, 24, 3); g.fillRect(41, 30, 3, 31); g.fillStyle = '#ffe9a8'; g.fillRect(23, 32, 3, 27); g.fillStyle = '#1a1e24'; g.font = 'bold 8px monospace'; g.fillText('!', 30, 49); },
  y: (g) => { const grd = g.createLinearGradient(20, 0, 44, 0); grd.addColorStop(0, '#2a3038'); grd.addColorStop(0.4, '#8794a3'); grd.addColorStop(1, '#232930'); g.fillStyle = grd; g.fillRect(22, 0, 20, 64); g.fillStyle = '#16191d'; g.fillRect(19, 0, 26, 5); g.fillRect(19, 58, 26, 6); g.fillStyle = '#36e0ff'; g.fillRect(31, 10, 2, 44); },
  n: (g) => { shadow(g, 32, 16); g.fillStyle = '#2a3038'; g.fillRect(16, 38, 32, 23); g.fillStyle = '#4b535e'; g.fillRect(14, 34, 36, 6); g.fillStyle = '#0a0d11'; g.fillRect(20, 16, 24, 18); g.fillStyle = '#1fe08a'; for (let i = 0; i < 5; i++) g.fillRect(22, 18 + i * 3, 6 + ((i * 7) % 13), 1); g.fillStyle = '#ffb02e'; g.fillRect(40, 18, 2, 2); g.fillStyle = '#39b6ff'; g.fillRect(20, 43, 4, 2); g.fillRect(26, 43, 4, 2); },
  q: (g) => { shadow(g, 32, 15); g.fillStyle = '#3b424b'; g.fillRect(17, 0, 30, 8); g.fillRect(17, 54, 30, 10); const grd = g.createLinearGradient(19, 0, 45, 0); grd.addColorStop(0, '#0e6f8a'); grd.addColorStop(0.5, '#7ff0ff'); grd.addColorStop(1, '#0b4a62'); g.fillStyle = grd; g.fillRect(19, 8, 26, 46); g.fillStyle = '#1b3440'; ell(g, 32, 22, 5, 6, '#1b3440'); g.fillRect(27, 27, 10, 18); g.fillRect(29, 45, 3, 8); g.fillRect(33, 45, 3, 8); g.fillStyle = '#d8fdff'; g.fillRect(22, 10, 2, 40); },
  f: (g) => { ell(g, 32, 60, 20, 3.5, '#5a1b48'); ell(g, 28, 60, 12, 2, '#8a2c62'); ell(g, 40, 61, 2, 1, '#d4ff3a'); },
};

const MISC = {
  plasma: (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 10); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.4, '#5cf0ff'); grd.addColorStop(1, 'rgba(0,120,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill(); },
  orb: (g) => { const grd = g.createRadialGradient(32, 30, 0, 32, 30, 14); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, '#ff4a9a'); grd.addColorStop(1, 'rgba(120,0,80,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 30, 14, 0, 7); g.fill(); },
  puff0: (g, r) => sparks(g, r, 14, 32, 32, 5, ['#ffffff', '#ffe08a']),
  puff1: (g, r) => sparks(g, r, 18, 32, 32, 9, ['#b0b8c0', '#ffe08a', '#808890']),
  boom0: (g) => { ell(g, 32, 40, 14, 14, '#ffd27a'); ell(g, 32, 40, 8, 8, '#ffffff'); },
  boom1: (g, r) => { ell(g, 32, 36, 26, 24, '#ff8a2a'); ell(g, 32, 36, 16, 15, '#ffe08a'); sparks(g, r, 30, 32, 36, 30); },
  boom2: (g, r) => { ell(g, 32, 34, 28, 26, 'rgba(90,80,80,.9)'); ell(g, 30, 30, 14, 12, '#ff6a2a'); sparks(g, r, 20, 32, 34, 30, ['#555', '#ff6a2a']); },
  arc0: (g, r) => sparks(g, r, 30, 32, 32, 14, ['#ffffff', '#8af0ff', '#3a8cff']),
};

// ——— Armes en vue subjective (canvas 160×120 dessinés au pixel) ———
function weaponCanvas(draw) {
  const c = canvas(160, 120);
  const g = c.getContext('2d');
  draw(g);
  return c;
}
function flash(g, x, y, s, c1 = '#ffffff', c2 = '#7ff0ff') {
  const grd = g.createRadialGradient(x, y, 0, x, y, s);
  grd.addColorStop(0, c1); grd.addColorStop(0.35, c2); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
}
function glove(g, x, y, w = 30, flip = false) {
  const grd = g.createLinearGradient(x, y, x + w, y);
  grd.addColorStop(0, '#15191e'); grd.addColorStop(0.5, '#2c333c'); grd.addColorStop(1, '#101317');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + w - 4, y); g.quadraticCurveTo(x + w + 2, y + 6, x + w, y + 40); g.lineTo(x, y + 40); g.quadraticCurveTo(x - 2, y + 6, x + 4, y); g.fill();
  g.fillStyle = '#3e4752';
  for (let i = 0; i < 3; i++) g.fillRect(x + 4 + i * ((w - 8) / 3), y + 2, (w - 8) / 3 - 2, 6);
  g.fillStyle = '#e8b21c'; g.fillRect(x + 1, y + 16, w - 2, 3);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(flip ? x + w - 8 : x + 3, y + 10, 4, 26);
}

// Corps en perspective (trapèze) avec dégradé horizontal métallique.
function body(g, cx, top, bot, wTop, wBot, c0, c1, c2) {
  const grd = g.createLinearGradient(cx - wBot / 2, 0, cx + wBot / 2, 0);
  grd.addColorStop(0, c2); grd.addColorStop(0.45, c1); grd.addColorStop(0.55, c0); grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(cx - wTop / 2, top); g.lineTo(cx + wTop / 2, top); g.lineTo(cx + wBot / 2, bot); g.lineTo(cx - wBot / 2, bot); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(cx - wTop / 2, top, wTop, 1);
}
const lerp = (a, b, t) => a + (b - a) * t;

const WEAPON_DRAW = {
  blade: [(g) => blade(g, false), (g) => blade(g, true)],
  pistol: [(g) => pistol(g, false), (g) => pistol(g, true)],
  rifle: [(g) => rifle(g, false), (g) => rifle(g, true)],
  scatter: [(g) => scatter(g, false), (g) => scatter(g, true)],
  arc: [(g) => arcgun(g, false), (g) => arcgun(g, true)],
};

function blade(g, swing) {
  g.save();
  if (swing) { g.translate(-34, 6); }
  const hx = swing ? 70 : 100, hy = swing ? 80 : 78, rot = swing ? -1.15 : -0.32;
  g.save(); g.translate(hx + 10, hy); g.rotate(rot);
  const len = swing ? 78 : 62;
  const glow = g.createLinearGradient(-9, 0, 9, 0);
  glow.addColorStop(0, 'rgba(54,224,255,0)'); glow.addColorStop(0.5, 'rgba(120,240,255,.55)'); glow.addColorStop(1, 'rgba(54,224,255,0)');
  g.fillStyle = glow; g.fillRect(-9, -len - 4, 18, len + 4);
  const core = g.createLinearGradient(-3, 0, 3, 0);
  core.addColorStop(0, '#5cf0ff'); core.addColorStop(0.5, '#ffffff'); core.addColorStop(1, '#5cf0ff');
  g.fillStyle = core; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(1, -len); g.lineTo(-1, -len); g.fill();
  g.fillStyle = '#4b535e'; g.fillRect(-7, -2, 14, 6);
  g.fillStyle = '#2a3038'; g.fillRect(-5, 4, 10, 18);
  g.fillStyle = '#e8b21c'; g.fillRect(-5, 8, 10, 2);
  g.restore();
  glove(g, hx - 4, hy + 10, 30);
  g.restore();
  if (swing) {
    g.strokeStyle = 'rgba(160,240,255,.45)'; g.lineWidth = 6;
    g.beginPath(); g.arc(80, 120, 80, -2.6, -1.2); g.stroke();
  }
}

function pistol(g, fire) {
  const dy = fire ? -7 : 0;
  if (fire) flash(g, 80, 46 + dy, 26);
  body(g, 80, 50 + dy, 104 + dy, 18, 34, '#9aa6b4', '#5d6773', '#2a3038');
  g.fillStyle = '#1b2026'; g.fillRect(74, 50 + dy, 12, 6);
  g.fillStyle = '#0a0c10'; g.beginPath(); g.arc(80, 53 + dy, 3, 0, 7); g.fill();
  g.fillStyle = '#c9d2dc'; g.fillRect(71, 48 + dy, 3, 5); g.fillRect(86, 48 + dy, 3, 5);
  for (let i = 0; i < 4; i++) {
    const y = 62 + i * 9 + dy, t = (y - 50 - dy) / 54, w = lerp(18, 34, t);
    g.fillStyle = fire ? '#e6fbff' : '#36e0ff';
    g.fillRect(80 - w / 2 + 2, y, 3, 4); g.fillRect(80 + w / 2 - 5, y, 3, 4);
  }
  g.fillStyle = '#3e4752'; g.fillRect(74, 70 + dy, 12, 16);
  g.fillStyle = '#e8b21c'; g.fillRect(74, 82 + dy, 12, 2);
  glove(g, 64, 94 + dy, 32);
}

function rifle(g, fire) {
  const dy = fire ? -4 : 0, sx = fire ? (Math.random() * 2 - 1) : 0;
  g.save(); g.translate(sx, 0);
  if (fire) flash(g, 80, 30 + dy, 30, '#ffffff', '#5cf0ff');
  body(g, 80, 34 + dy, 120, 14, 64, '#8794a3', '#4b5561', '#1d2228');
  g.fillStyle = '#0a0c10'; g.beginPath(); g.arc(80, 37 + dy, 4, 0, 7); g.fill();
  // ailettes de refroidissement
  for (let i = 0; i < 6; i++) {
    const y = 44 + i * 7 + dy, t = (y - 34 - dy) / 86, w = lerp(14, 64, t) + 6;
    g.fillStyle = i % 2 ? '#2a3038' : '#5d6773'; g.fillRect(80 - w / 2, y, w, 3);
  }
  // fenêtre de plasma
  const t0 = 0.55, w0 = lerp(14, 64, t0) * 0.3;
  const pg = g.createLinearGradient(80 - w0, 0, 80 + w0, 0);
  pg.addColorStop(0, '#0b6f8a'); pg.addColorStop(0.5, fire ? '#ffffff' : '#9ff4ff'); pg.addColorStop(1, '#0b6f8a');
  g.fillStyle = pg; g.fillRect(80 - w0, 86 + dy, w0 * 2, 22);
  g.fillStyle = '#1a1e24'; g.fillRect(72, 80 + dy, 16, 4);
  g.fillStyle = '#e8b21c'; g.fillRect(64, 112, 32, 3);
  g.restore();
  glove(g, 40, 92 + dy, 34); glove(g, 88, 96 + dy, 34, true);
}

function scatter(g, fire) {
  const dy = fire ? -11 : 0;
  if (fire) { flash(g, 69, 40 + dy, 28, '#ffffff', '#ffb030'); flash(g, 91, 40 + dy, 28, '#ffffff', '#ffb030'); }
  body(g, 69, 44 + dy, 120, 14, 30, '#9aa6b4', '#5d6773', '#22272e');
  body(g, 91, 44 + dy, 120, 14, 30, '#9aa6b4', '#5d6773', '#22272e');
  g.fillStyle = '#0a0c10'; g.beginPath(); g.arc(69, 47 + dy, 4.5, 0, 7); g.arc(91, 47 + dy, 4.5, 0, 7); g.fill();
  g.fillStyle = '#ff7a1a'; g.fillRect(77, 46 + dy, 6, 3);
  // garde-main en polymère orange
  const fg = g.createLinearGradient(0, 74 + dy, 0, 92 + dy);
  fg.addColorStop(0, '#f09a3a'); fg.addColorStop(1, '#8a4a14');
  g.fillStyle = fg; g.beginPath(); g.moveTo(56, 74 + dy); g.lineTo(104, 74 + dy); g.lineTo(108, 92 + dy); g.lineTo(52, 92 + dy); g.fill();
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 58; x < 104; x += 6) g.fillRect(x, 77 + dy, 2, 12);
  g.fillStyle = '#e8b21c'; g.fillRect(66, 104 + dy, 28, 3);
  glove(g, 44, 96 + dy, 34); glove(g, 84, 98 + dy, 34, true);
}

function arcgun(g, fire) {
  const dy = fire ? -6 : 0;
  if (fire) flash(g, 80, 26 + dy, 46, '#ffffff', '#8af0ff');
  body(g, 80, 32 + dy, 120, 26, 86, '#7b8695', '#3e4752', '#14181d');
  // anneaux de bobines
  for (let i = 0; i < 5; i++) {
    const y = 40 + i * 12 + dy, t = (y - 32 - dy) / 88, w = lerp(26, 86, t) + 10;
    g.fillStyle = '#b87333'; g.fillRect(80 - w / 2, y, w, 5);
    g.fillStyle = '#e0a35f'; g.fillRect(80 - w / 2, y, w, 1);
  }
  g.fillStyle = '#0a0c10'; g.beginPath(); g.arc(80, 36 + dy, 7, 0, 7); g.fill();
  g.fillStyle = fire ? '#ffffff' : '#8af0ff'; g.beginPath(); g.arc(80, 36 + dy, 3.5, 0, 7); g.fill();
  // arc électrique
  g.strokeStyle = fire ? '#ffffff' : 'rgba(138,240,255,.8)'; g.lineWidth = fire ? 2 : 1;
  g.beginPath(); let x = 66, y = 50 + dy; g.moveTo(x, y);
  for (let i = 0; i < 8; i++) { x = 66 + ((i % 2) ? 28 : 0) + Math.random() * 4; y += 6; g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#e8b21c'; g.fillRect(48, 110, 64, 3);
  glove(g, 30, 94 + dy, 36); glove(g, 94, 94 + dy, 36, true);
}

export function buildSprites() {
  const glowE = (r, g, b) => bright(r, g, b) || (b > 200 && g > 180 && r < 120) || (r > 220 && g < 80);
  const S = {
    enemy: {
      g: enemyFrames(drawDrone, 64, glowE),
      s: enemyFrames(drawSentinel, 64, (r, g, b) => r > 230 && g < 80),
      m: enemyFrames(drawMauler, 64, (r, g, b) => (g > 200 && r > 190 && b < 100) || (r > 240 && g > 200 && b < 60)),
      O: enemyFrames(drawBoss, 128, (r, g, b) => bright(r, g, b) || (r > 230 && b > 60 && g < 120)),
    },
    item: {}, decor: {}, misc: {}, weapon: {},
  };
  for (const k in ITEMS) S.item[k] = sprite(64, ITEMS[k], (r, g, b) => (g > 180 && b > 160 && r < 120) || (b > 230 && r > 200) || (r > 230 && g < 80), k.charCodeAt(0));
  for (const k in DECOR) S.decor[k] = sprite(64, DECOR[k], (r, g, b) => bright(r, g, b) || (g > 200 && r < 80) || (g > 200 && r > 190 && b < 100) || (b > 230 && g > 200), k.charCodeAt(0));
  for (const k in MISC) S.misc[k] = sprite(64, MISC[k], () => true, k.length * 31);
  for (const k in WEAPON_DRAW) S.weapon[k] = WEAPON_DRAW[k].map(weaponCanvas);
  return S;
}
