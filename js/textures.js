// Génération procédurale de toutes les textures (64×64).
// Les pixels sont stockés en Uint32 (ABGR little-endian). Un alpha de 254
// marque un pixel « émissif » : il n'est pas assombri par la distance.

export const TEX = 64;
export const EMISSIVE_ALPHA = 254;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function canvas(w = TEX, h = TEX) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Dessine via l'API Canvas puis applique un post-traitement pixel.
function make(seed, draw, post) {
  const c = canvas();
  const g = c.getContext('2d', { willReadFrequently: true });
  const r = rng(seed);
  draw(g, r);
  const img = g.getImageData(0, 0, TEX, TEX);
  if (post) post(img.data, r);
  return new Uint32Array(img.data.buffer.slice(0));
}

function noise(amount, mono = true) {
  return (d, r) => {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === EMISSIVE_ALPHA) continue;
      const n = (r() - 0.5) * amount;
      d[i] = clamp(d[i] + n + (mono ? 0 : (r() - 0.5) * amount * 0.4));
      d[i + 1] = clamp(d[i + 1] + n);
      d[i + 2] = clamp(d[i + 2] + n);
    }
  };
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const chain = (...fns) => (d, r) => fns.forEach((f) => f && f(d, r));

// Marque comme émissifs les pixels dont la luminosité/teinte correspond au test.
function emissive(test) {
  return (d) => {
    for (let i = 0; i < d.length; i += 4) {
      const p = i >> 2;
      if (test(d[i], d[i + 1], d[i + 2], p & 63, p >> 6)) d[i + 3] = EMISSIVE_ALPHA;
    }
  };
}

function rivet(g, x, y) {
  g.fillStyle = '#20262e'; g.beginPath(); g.arc(x + 0.5, y + 0.5, 1.6, 0, 7); g.fill();
  g.fillStyle = '#9aa7b6'; g.fillRect(x, y, 1, 1);
}

function plate(g, x, y, w, h, base, light, dark) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  g.fillStyle = light; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = dark; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
}

function steelBase(g, r, tint = 0) {
  const grd = g.createLinearGradient(0, 0, 0, TEX);
  grd.addColorStop(0, `hsl(${212 + tint},14%,38%)`);
  grd.addColorStop(1, `hsl(${212 + tint},16%,27%)`);
  g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
  plate(g, 0, 0, 64, 32, 'rgba(0,0,0,0)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,.45)');
  plate(g, 0, 32, 32, 32, 'rgba(0,0,0,0)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,.45)');
  plate(g, 32, 32, 32, 32, 'rgba(0,0,0,0)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,.45)');
  for (const [x, y] of [[3, 3], [60, 3], [3, 28], [60, 28], [3, 35], [28, 35], [35, 35], [60, 35], [3, 60], [28, 60], [35, 60], [60, 60]]) rivet(g, x, y);
  g.strokeStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 6; i++) { g.beginPath(); const x = r() * 64, y = r() * 64; g.moveTo(x, y); g.lineTo(x + r() * 14 - 7, y + r() * 4 - 2); g.stroke(); }
}

const T = {};

T.steel = () => make(11, (g, r) => {
  steelBase(g, r);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(10, 12, 44, 8);
  g.fillStyle = 'rgba(150,170,190,.25)';
  for (let i = 0; i < 5; i++) g.fillRect(13 + i * 8, 14, 5, 4);
}, noise(14));

T.steelLight = () => make(12, (g, r) => {
  steelBase(g, r);
  g.fillStyle = '#11161d'; g.fillRect(27, 4, 10, 56);
  const grd = g.createLinearGradient(27, 0, 37, 0);
  grd.addColorStop(0, '#2fd0ff'); grd.addColorStop(0.5, '#e6fbff'); grd.addColorStop(1, '#2fd0ff');
  g.fillStyle = grd; g.fillRect(29, 6, 6, 52);
}, chain(noise(12), emissive((r, g, b) => b > 200 && g > 150)));

T.bulkhead = () => make(13, (g, r) => {
  steelBase(g, r, 8);
  g.fillStyle = '#16191d'; g.fillRect(0, 22, 64, 20);
  g.save(); g.beginPath(); g.rect(0, 24, 64, 16); g.clip();
  for (let i = -2; i < 10; i++) {
    g.fillStyle = '#e8b21c';
    g.beginPath(); g.moveTo(i * 12, 24); g.lineTo(i * 12 + 6, 24); g.lineTo(i * 12 - 10, 40); g.lineTo(i * 12 - 16, 40); g.fill();
  }
  g.restore();
}, noise(16));

T.window = () => make(14, (g, r) => {
  steelBase(g, r);
  g.fillStyle = '#0b0e13'; g.fillRect(6, 8, 52, 44);
  g.fillStyle = '#01030a'; g.fillRect(9, 11, 46, 38);
  for (let i = 0; i < 40; i++) {
    const v = 120 + r() * 135 | 0;
    g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 30)})`;
    g.fillRect(9 + r() * 46 | 0, 11 + r() * 38 | 0, 1, 1);
  }
  const grd = g.createRadialGradient(40, 70, 10, 40, 70, 40);
  grd.addColorStop(0, '#bfe8ff'); grd.addColorStop(0.7, '#5aa5d6'); grd.addColorStop(1, '#1b3d63');
  g.save(); g.beginPath(); g.rect(9, 11, 46, 38); g.clip();
  g.fillStyle = grd; g.beginPath(); g.arc(40, 72, 34, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(12, 12, 8, 36);
  g.restore();
}, emissive((r, g, b, x, y) => x >= 9 && x < 55 && y >= 11 && y < 49 && b > 40));

T.emblem = () => make(15, (g, r) => {
  steelBase(g, r);
  g.fillStyle = '#10151c'; g.beginPath(); g.arc(32, 30, 20, 0, 7); g.fill();
  g.strokeStyle = '#46c8ff'; g.lineWidth = 2;
  g.beginPath(); g.arc(32, 30, 17, 0, 7); g.stroke();
  g.save(); g.translate(32, 30);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.moveTo(0, -7); g.lineTo(-4, -10); g.moveTo(0, -7); g.lineTo(4, -10); g.stroke();
  }
  g.restore();
  g.fillStyle = '#9fe6ff'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.fillText('KRYOS', 32, 60);
}, chain(noise(10), emissive((r, g, b) => b > 200 && r < 190)));

T.hexlab = () => make(16, (g, r) => {
  g.fillStyle = '#c9d4d6'; g.fillRect(0, 0, 64, 64);
  const s = 8, h = s * Math.sqrt(3);
  for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) {
    const cx = col * s * 1.5, cy = row * h + (col & 1 ? h / 2 : 0);
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * (s - 1), cy + Math.sin(a) * (s - 1)); }
    g.closePath();
    const v = 190 + r() * 40 | 0;
    g.fillStyle = r() < 0.08 ? '#4fb3b0' : `rgb(${v - 10},${v},${v + 4})`; g.fill();
    g.strokeStyle = '#7d8b90'; g.stroke();
  }
  g.fillStyle = '#5c6a70'; g.fillRect(0, 56, 64, 8);
  g.fillStyle = '#2bd1c6'; g.fillRect(0, 58, 64, 2);
}, chain(noise(10), emissive((r, g, b) => g > 190 && r < 80)));

T.servers = () => make(17, (g, r) => {
  g.fillStyle = '#0e1116'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 32) {
    plate(g, x + 2, 2, 28, 60, '#1b2028', '#343c48', '#07090c');
    for (let y = 6; y < 58; y += 6) {
      g.fillStyle = '#262d38'; g.fillRect(x + 5, y, 22, 4);
      g.fillStyle = '#0a0c10'; g.fillRect(x + 6, y + 1, 12, 2);
      const c = r(); g.fillStyle = c < 0.6 ? '#3dff7a' : c < 0.85 ? '#ffb02e' : '#ff3b3b';
      g.fillRect(x + 21, y + 1, 2, 2);
      if (r() < 0.5) { g.fillStyle = '#39b6ff'; g.fillRect(x + 24, y + 1, 1, 2); }
    }
  }
}, chain(noise(6), emissive((r, g, b) => Math.max(r, g, b) > 170)));

T.ice = () => make(18, (g, r) => {
  const grd = g.createLinearGradient(0, 0, 64, 64);
  grd.addColorStop(0, '#a8cfe6'); grd.addColorStop(1, '#5d8fb3');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '20,50,80'},${0.08 + r() * 0.18})`;
    g.beginPath(); g.moveTo(r() * 64, r() * 64);
    for (let k = 0; k < 4; k++) g.lineTo(r() * 64, r() * 64);
    g.fill();
  }
  g.strokeStyle = 'rgba(230,250,255,.7)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let x = r() * 64, y = r() * 64; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += r() * 16 - 8; y += r() * 16 - 8; g.lineTo(x, y); }
    g.stroke();
  }
}, noise(18, false));

T.rust = () => make(19, (g, r) => {
  steelBase(g, r, -170);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${140 + r() * 60 | 0},${60 + r() * 30 | 0},20,${0.15 + r() * 0.35})`;
    g.beginPath(); g.arc(r() * 64, r() * 64, 1 + r() * 5, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(80,30,10,.5)';
  for (let i = 0; i < 6; i++) g.fillRect(r() * 64 | 0, 20 + r() * 20 | 0, 1, 10 + r() * 30 | 0);
}, noise(22, false));

T.reactor = () => make(20, (g, r) => {
  g.fillStyle = '#1a1416'; g.fillRect(0, 0, 64, 64);
  plate(g, 0, 0, 64, 64, '#231b1e', '#3f3236', '#0b0809');
  for (let i = 0; i < 4; i++) {
    const y = 8 + i * 13;
    g.fillStyle = '#0b0708'; g.fillRect(8, y, 48, 8);
    const grd = g.createLinearGradient(0, y, 0, y + 8);
    grd.addColorStop(0, '#ff5a1f'); grd.addColorStop(0.5, '#ffd27a'); grd.addColorStop(1, '#ff3a10');
    g.fillStyle = grd;
    for (let x = 10; x < 54; x += 6) g.fillRect(x, y + 2, 3, 4);
  }
  for (const [x, y] of [[3, 3], [60, 3], [3, 60], [60, 60]]) rivet(g, x, y);
}, chain(noise(10), emissive((r, g, b) => r > 200 && b < 140)));

T.biomass = () => make(21, (g, r) => {
  g.fillStyle = '#3a1838'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 50; i++) {
    g.fillStyle = `rgba(${90 + r() * 70 | 0},${20 + r() * 30 | 0},${70 + r() * 60 | 0},.45)`;
    g.beginPath(); g.ellipse(r() * 64, r() * 64, 2 + r() * 9, 2 + r() * 6, r() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = '#8a2c62'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    g.beginPath(); let x = r() * 64, y = 0; g.moveTo(x, y);
    while (y < 64) { x += r() * 10 - 5; y += 4 + r() * 6; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x = r() * 56 + 4, y = r() * 56 + 4, rad = 2 + r() * 2.5;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, '#fff0a0'); grd.addColorStop(1, '#d4ff3a');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
}, chain(noise(16, false), emissive((r, g, b) => g > 200 && r > 180)));

T.pipes = () => make(22, (g, r) => {
  g.fillStyle = '#1d2228'; g.fillRect(0, 0, 64, 64);
  const pipe = (y, h, c1, c2) => {
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, c2); grd.addColorStop(0.35, c1); grd.addColorStop(1, '#0a0c0f');
    g.fillStyle = grd; g.fillRect(0, y, 64, h);
    g.fillStyle = 'rgba(0,0,0,.5)';
    for (let x = 8 + (y % 16); x < 64; x += 24) { g.fillRect(x, y - 1, 4, h + 2); }
  };
  pipe(4, 12, '#6f7f8e', '#c3d1dc');
  pipe(20, 7, '#8a5a2b', '#e0a35f');
  pipe(31, 14, '#55626f', '#a9b8c4');
  pipe(49, 9, '#2d6b5e', '#7fd6c1');
  g.fillStyle = '#ffcc33'; g.fillRect(40, 34, 5, 3);
}, noise(10));

const exitPanel = (on) => make(on ? 24 : 23, (g, r) => {
  steelBase(g, r);
  g.fillStyle = '#0d1014'; g.fillRect(14, 8, 36, 48);
  plate(g, 16, 10, 32, 44, '#20262e', '#3a4350', '#07090c');
  const c = on ? '#38ff8b' : '#ff3b46';
  g.fillStyle = c; g.fillRect(20, 14, 24, 6);
  g.fillStyle = '#0a0c10'; g.fillRect(28, 26, 8, 22);
  g.fillStyle = '#c9d2dc'; g.fillRect(26, on ? 26 : 40, 12, 8);
  g.fillStyle = c; g.font = 'bold 7px monospace'; g.textAlign = 'center';
  g.fillText(on ? 'OK' : 'EXIT', 32, 53);
}, chain(noise(8), emissive((r, g, b) => (r > 200 && g < 100) || (g > 200 && r < 120))));
T.exitOff = () => exitPanel(false);
T.exitOn = () => exitPanel(true);

const door = (seed, lock) => make(seed, (g, r) => {
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#59626e'); grd.addColorStop(0.5, '#7b8592'); grd.addColorStop(1, '#4b535e');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  plate(g, 2, 2, 60, 60, 'rgba(0,0,0,0)', 'rgba(255,255,255,.25)', 'rgba(0,0,0,.5)');
  g.fillStyle = '#2b3138'; g.fillRect(6, 6, 52, 12); g.fillRect(6, 46, 52, 12);
  g.save(); g.beginPath(); g.rect(6, 46, 52, 12); g.clip();
  for (let i = -2; i < 8; i++) { g.fillStyle = '#e8b21c'; g.beginPath(); g.moveTo(i * 10, 46); g.lineTo(i * 10 + 5, 46); g.lineTo(i * 10 - 7, 58); g.lineTo(i * 10 - 12, 58); g.fill(); }
  g.restore();
  g.fillStyle = '#1a1e24'; g.fillRect(30, 20, 4, 24);
  const c = lock === 'blue' ? '#2f8cff' : lock === 'red' ? '#ff3344' : '#36e0ff';
  g.fillStyle = '#0c0f13'; g.fillRect(22, 26, 20, 12);
  g.fillStyle = c; g.fillRect(24, 28, 16, 8);
  if (lock) { g.fillStyle = c; g.fillRect(6, 8, 52, 3); g.fillRect(6, 13, 52, 3); }
  for (const [x, y] of [[5, 22], [58, 22], [5, 42], [58, 42]]) rivet(g, x, y);
}, chain(noise(10), emissive((r, g, b) => (b > 220 && r < 120) || (r > 230 && g < 90 && b < 110))));
T.door = () => door(30);
T.doorBlue = () => door(31, 'blue');
T.doorRed = () => door(32, 'red');

T.doorSide = () => make(33, (g) => {
  g.fillStyle = '#3b424b'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) { g.fillStyle = y % 16 ? '#2a3037' : '#4a525d'; g.fillRect(0, y, 64, 8); }
  g.fillStyle = '#e8b21c'; g.fillRect(28, 0, 8, 64);
  g.fillStyle = '#16191d'; for (let y = 0; y < 64; y += 8) g.fillRect(28, y, 8, 4);
}, noise(10));

// Sols et plafonds
T.grate = () => make(40, (g) => {
  g.fillStyle = '#20252b'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) {
    g.fillStyle = '#0b0d10'; g.fillRect(x + 1, y + 1, 6, 6);
    g.fillStyle = '#39414a'; g.fillRect(x, y, 8, 1); g.fillRect(x, y, 1, 8);
  }
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64);
}, noise(10));

T.tiles = () => make(41, (g, r) => {
  for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) {
    const v = 150 + r() * 25 | 0;
    plate(g, x, y, 16, 16, `rgb(${v - 8},${v + 4},${v + 8})`, 'rgba(255,255,255,.3)', 'rgba(0,0,0,.35)');
  }
  g.fillStyle = 'rgba(40,180,170,.35)'; g.fillRect(0, 30, 64, 4);
}, noise(9));

T.organic = () => make(42, (g, r) => {
  g.fillStyle = '#2a1426'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) plate(g, x, y, 16, 16, '#2f2a30', '#45404a', '#141114');
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${110 + r() * 60 | 0},20,${80 + r() * 50 | 0},${0.3 + r() * 0.4})`;
    g.beginPath(); g.ellipse(r() * 64, r() * 64, 2 + r() * 7, 1 + r() * 4, r() * 3, 0, 7); g.fill();
  }
}, noise(14, false));

T.ceilPanel = () => make(43, (g) => {
  g.fillStyle = '#2a3038'; g.fillRect(0, 0, 64, 64);
  plate(g, 0, 0, 32, 32, '#2e353e', '#3e4651', '#14181d'); plate(g, 32, 32, 32, 32, '#2e353e', '#3e4651', '#14181d');
  plate(g, 32, 0, 32, 32, '#262c34', '#3a424c', '#14181d'); plate(g, 0, 32, 32, 32, '#262c34', '#3a424c', '#14181d');
  g.fillStyle = '#0d1014'; g.fillRect(8, 12, 16, 8);
  g.fillStyle = '#dff6ff'; g.fillRect(9, 13, 14, 6);
}, chain(noise(8), emissive((r, g, b) => r > 200 && b > 230)));

T.ceilLab = () => make(44, (g) => {
  g.fillStyle = '#b8c3c6'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) plate(g, x, y, 32, 32, '#aeb9bd', '#d5dee0', '#77848a');
  g.fillStyle = '#eaffff'; g.fillRect(4, 28, 56, 8);
}, chain(noise(8), emissive((r, g, b) => r > 225 && g > 245)));

T.ceilRock = () => make(45, (g, r) => {
  g.fillStyle = '#1f1418'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${50 + r() * 50 | 0},${25 + r() * 20 | 0},${35 + r() * 25 | 0},.6)`;
    g.beginPath(); g.moveTo(r() * 64, r() * 64);
    for (let k = 0; k < 3; k++) g.lineTo(r() * 64, r() * 64);
    g.fill();
  }
  g.fillStyle = '#ff6a2a'; g.fillRect(10, 40, 2, 2); g.fillRect(50, 12, 2, 2);
}, chain(noise(20, false), emissive((r, g, b) => r > 230 && g < 140)));

export function buildTextures() {
  const out = {};
  for (const k in T) out[k] = T[k]();
  return out;
}

export { canvas, plate, rivet };
