// Textures du thème Halloween (64×64) : pierre, bois pourri, sang séché,
// toiles d'araignée, papier peint de manoir, vitraux, ossuaire…
import { make, noise, chain, emissive, rivet } from './textures.js';

const H = {};
const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// ——— Briques de base réutilisables ———
function stoneBlocks(g, r, hue = 215, sat = 6, light = 30) {
  g.fillStyle = `hsl(${hue},${sat}%,${light - 12}%)`; g.fillRect(0, 0, 64, 64);
  const rows = [0, 14, 30, 46, 64];
  for (let i = 0; i < 4; i++) {
    const y = rows[i], hgt = rows[i + 1] - y;
    let x = i % 2 ? -12 : 0;
    while (x < 64) {
      const w = 18 + r() * 14;
      const l = light - 4 + r() * 10;
      g.fillStyle = `hsl(${hue + r() * 10 - 5},${sat}%,${l}%)`;
      g.fillRect(x + 1, y + 1, w - 2, hgt - 2);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 1, y + 1, w - 2, 1);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y + hgt - 2, w - 2, 1);
      // fissures
      if (r() < 0.35) {
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.beginPath();
        let cx = x + r() * w, cy = y + 2; g.moveTo(cx, cy);
        for (let k = 0; k < 3; k++) { cx += r() * 6 - 3; cy += hgt / 3; g.lineTo(cx, cy); }
        g.stroke();
      }
      x += w;
    }
  }
}

function moss(g, r, n = 14) {
  for (let i = 0; i < n; i++) {
    const x = r() * 64, y = r() * 64;
    g.fillStyle = rgba(40 + r() * 30, 70 + r() * 40, 30, 0.35 + r() * 0.3);
    g.beginPath(); g.ellipse(x, y, 2 + r() * 6, 1 + r() * 3, 0, 0, 7); g.fill();
    if (r() < 0.4) { g.fillRect(x, y, 1, 4 + r() * 10); }
  }
}

function cobweb(g, corner = 0, size = 34) {
  const cx = corner === 1 ? 64 : 0, cy = 0;
  g.save(); g.strokeStyle = 'rgba(220,225,230,.55)'; g.lineWidth = 0.7;
  const angles = [];
  for (let i = 0; i <= 6; i++) angles.push((Math.PI / 2) * (i / 6));
  const dir = corner === 1 ? -1 : 1;
  for (const a of angles) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dir * Math.cos(a) * size, cy + Math.sin(a) * size); g.stroke(); }
  for (let k = 1; k <= 5; k++) {
    const rad = (size * k) / 5.5;
    g.beginPath();
    angles.forEach((a, i) => {
      const sag = i % 2 ? 0.88 : 1;
      const x = cx + dir * Math.cos(a) * rad * sag, y = cy + Math.sin(a) * rad * sag;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }
  g.restore();
}

function blood(g, r, amount = 1) {
  for (let i = 0; i < 3 * amount; i++) {
    const x = 8 + r() * 48, y = 6 + r() * 30;
    g.fillStyle = rgba(70 + r() * 30, 8, 10, 0.75);
    g.beginPath(); g.ellipse(x, y, 4 + r() * 7, 3 + r() * 4, r() * 3, 0, 7); g.fill();
    // coulures
    for (let k = 0; k < 3; k++) {
      const dx = x - 5 + r() * 10, len = 6 + r() * 26;
      g.fillRect(dx, y, 1.5, len);
      g.beginPath(); g.arc(dx + 0.7, y + len, 1.4, 0, 7); g.fill();
    }
  }
}

function planks(g, r, base = [58, 42, 30], vertical = true) {
  for (let i = 0; i < 4; i++) {
    const v = 0.75 + r() * 0.35;
    g.fillStyle = rgba(base[0] * v, base[1] * v, base[2] * v, 1);
    if (vertical) g.fillRect(i * 16, 0, 16, 64); else g.fillRect(0, i * 16, 64, 16);
    // veines du bois
    g.strokeStyle = rgba(base[0] * 0.55, base[1] * 0.55, base[2] * 0.55, 0.6); g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      const o = i * 16 + 2 + r() * 12;
      if (vertical) { g.moveTo(o, 0); g.bezierCurveTo(o + 3, 20, o - 3, 40, o + 1, 64); }
      else { g.moveTo(0, o); g.bezierCurveTo(20, o + 3, 40, o - 3, 64, o + 1); }
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.6)';
    if (vertical) g.fillRect(i * 16, 0, 1, 64); else g.fillRect(0, i * 16, 64, 1);
  }
}

function rot(g, r) {
  for (let i = 0; i < 10; i++) {
    g.fillStyle = rgba(20 + r() * 20, 25 + r() * 15, 12, 0.5 + r() * 0.3);
    g.beginPath(); g.ellipse(r() * 64, r() * 64, 1 + r() * 5, 2 + r() * 8, 0, 0, 7); g.fill();
  }
  // trous et clous rouillés
  g.fillStyle = '#050403';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(r() * 64, r() * 64, 1 + r() * 3, 1 + r() * 2, 0, 0, 7); g.fill(); }
  g.fillStyle = '#5a3420';
  for (let i = 0; i < 4; i++) for (const y of [6, 56]) g.fillRect(i * 16 + 7, y, 2, 2);
}

const gold = (g, x, y, w, h, t = 4) => {
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, '#8a6a20'); grd.addColorStop(0.5, '#e0c060'); grd.addColorStop(1, '#6a4a10');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.fillStyle = '#120c08'; g.fillRect(x + t, y + t, w - 2 * t, h - 2 * t);
};

// ——— Murs ———
H.stone = () => make(201, (g, r) => stoneBlocks(g, r), noise(14));
H.stoneMoss = () => make(202, (g, r) => { stoneBlocks(g, r, 200, 8, 28); moss(g, r, 22); }, noise(14));
H.stoneWeb = () => make(203, (g, r) => { stoneBlocks(g, r); cobweb(g, r() < 0.5 ? 0 : 1, 40); }, noise(10));
H.stoneBlood = () => make(204, (g, r) => { stoneBlocks(g, r, 10, 8, 27); blood(g, r, 1); }, noise(12));

H.bones = () => make(205, (g, r) => {
  g.fillStyle = '#16120e'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 16 + (row % 2 ? 8 : 0) - 4, y = row * 16 + 2;
    const v = 170 + r() * 40;
    g.fillStyle = rgba(v, v * 0.92, v * 0.78, 1);
    g.beginPath(); g.ellipse(x + 8, y + 6, 6.5, 6, 0, 0, 7); g.fill();       // crâne
    g.fillRect(x + 4, y + 9, 8, 5);                                          // mâchoire
    g.fillStyle = '#0d0907';
    g.beginPath(); g.ellipse(x + 5.5, y + 6, 1.8, 2.2, 0, 0, 7); g.ellipse(x + 10.5, y + 6, 1.8, 2.2, 0, 0, 7); g.fill();
    g.fillRect(x + 7.5, y + 8.5, 1, 2);
    for (let t = 0; t < 4; t++) g.fillRect(x + 5 + t * 1.8, y + 12, 0.8, 2);
  }
  // os longs entre les rangées
  g.fillStyle = 'rgba(200,185,150,.85)';
  for (let y = 15; y < 64; y += 16) g.fillRect(0, y, 64, 2);
}, noise(12));

H.rottenWood = () => make(206, (g, r) => { planks(g, r); rot(g, r); }, noise(12, false));
H.woodWeb = () => make(207, (g, r) => { planks(g, r, [50, 38, 28]); rot(g, r); cobweb(g, 1, 44); }, noise(10));

function wallpaper(g, r, c1 = '#2a1430', c2 = '#3d1f44') {
  g.fillStyle = c1; g.fillRect(0, 0, 64, 46);
  g.fillStyle = c2;
  for (let y = -8; y < 46; y += 16) for (let x = 0; x < 64; x += 16) {
    const ox = (y / 16) % 2 ? 8 : 0;
    g.beginPath(); g.moveTo(x + ox + 8, y); g.quadraticCurveTo(x + ox + 15, y + 8, x + ox + 8, y + 16); g.quadraticCurveTo(x + ox + 1, y + 8, x + ox + 8, y); g.fill();
    g.fillStyle = 'rgba(160,120,60,.25)'; g.fillRect(x + ox + 7, y + 6, 2, 4); g.fillStyle = c2;
  }
  // papier qui se décolle
  g.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < 4; i++) g.fillRect(r() * 64, 0, 1 + r() * 2, r() * 46);
  g.fillStyle = 'rgba(190,170,140,.25)'; g.beginPath(); g.moveTo(40, 10); g.lineTo(52, 10); g.lineTo(46, 30); g.fill();
  // lambris
  const grd = g.createLinearGradient(0, 46, 0, 64);
  grd.addColorStop(0, '#4a2e1c'); grd.addColorStop(1, '#22140c');
  g.fillStyle = grd; g.fillRect(0, 46, 64, 18);
  g.fillStyle = '#6e4a2a'; g.fillRect(0, 46, 64, 2);
  g.fillStyle = 'rgba(0,0,0,.4)'; for (let x = 0; x < 64; x += 16) g.fillRect(x + 2, 51, 12, 10);
}
H.wallpaper = () => make(208, (g, r) => wallpaper(g, r), noise(10, false));
H.wallpaperBlood = () => make(209, (g, r) => {
  wallpaper(g, r);
  blood(g, r, 1);
  // empreinte de main
  g.fillStyle = 'rgba(110,10,12,.85)';
  g.beginPath(); g.ellipse(22, 24, 5, 6, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) g.fillRect(17 + i * 3, 12, 2, 9);
  g.fillRect(27, 22, 6, 2);
}, noise(10, false));

H.portrait = () => make(210, (g, r) => {
  wallpaper(g, r);
  gold(g, 14, 4, 36, 40, 4);
  const grd = g.createRadialGradient(32, 22, 2, 32, 26, 18);
  grd.addColorStop(0, '#3a3028'); grd.addColorStop(1, '#0c0806');
  g.fillStyle = grd; g.fillRect(18, 8, 28, 32);
  g.fillStyle = '#c8b8a0'; g.beginPath(); g.ellipse(32, 20, 6, 8, 0, 0, 7); g.fill();     // visage
  g.fillStyle = '#1a1210'; g.fillRect(24, 28, 16, 12);                                    // habit
  g.fillStyle = '#ff2a1a'; g.fillRect(28, 18, 2, 2); g.fillRect(34, 18, 2, 2);           // yeux rouges
  g.fillStyle = '#3a1a14'; g.fillRect(29, 24, 6, 1);
}, chain(noise(8), emissive((r, g, b) => r > 230 && g < 80)));

H.bookshelf = () => make(211, (g, r) => {
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, 64, 64);
  for (let s = 0; s < 4; s++) {
    const y = s * 16;
    g.fillStyle = '#4a2e1c'; g.fillRect(0, y + 14, 64, 2);
    let x = 2;
    while (x < 62) {
      const w = 2 + r() * 4, hgt = 8 + r() * 5;
      const hue = [0, 20, 30, 120, 220, 280][(r() * 6) | 0];
      g.fillStyle = `hsl(${hue},${30 + r() * 30}%,${15 + r() * 15}%)`;
      if (r() < 0.12) { g.save(); g.translate(x, y + 14); g.rotate(-0.35); g.fillRect(0, -hgt, w, hgt); g.restore(); x += w + 3; continue; }
      g.fillRect(x, y + 14 - hgt, w, hgt);
      g.fillStyle = 'rgba(220,190,120,.35)'; g.fillRect(x, y + 14 - hgt + 2, w, 1);
      x += w + 0.5;
    }
  }
  cobweb(g, 0, 22);
}, noise(10, false));

H.stainedGlass = () => make(212, (g, r) => {
  stoneBlocks(g, r, 220, 5, 24);
  g.fillStyle = '#0a0a0e';
  g.beginPath(); g.moveTo(14, 60); g.lineTo(14, 22); g.quadraticCurveTo(32, -4, 50, 22); g.lineTo(50, 60); g.fill();
  const cols = ['#7a1a8a', '#c43a1a', '#1a5ac4', '#d4a020', '#2a8a4a'];
  for (let y = 10; y < 58; y += 7) for (let x = 17; x < 48; x += 7) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 1); g.lineTo(x + 5, y + 6); g.lineTo(x - 1, y + 5); g.fill();
  }
  g.save(); g.globalCompositeOperation = 'destination-in';
  g.restore();
  g.strokeStyle = '#0a0a0e'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(32, 8); g.lineTo(32, 60); g.moveTo(16, 34); g.lineTo(48, 34); g.stroke();
  // repeindre l'encadrement de pierre par-dessus les débords
  g.fillStyle = '#2b2c33'; g.fillRect(0, 0, 14, 64); g.fillRect(50, 0, 14, 64); g.fillRect(14, 60, 36, 4);
}, chain(noise(8), emissive((r, g, b, x, y) => x >= 15 && x < 49 && y > 4 && y < 59 && Math.max(r, g, b) > 60)));

H.fence = () => make(213, (g, r) => {
  // ciel nocturne derrière une grille en fer forgé
  const sky = g.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#05060f'); sky.addColorStop(1, '#1a1830');
  g.fillStyle = sky; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 18; i++) { const v = 150 + r() * 100; g.fillStyle = rgba(v, v, v + 20, 1); g.fillRect(r() * 64, r() * 40, 1, 1); }
  g.fillStyle = 'rgba(60,40,90,.5)'; g.beginPath(); g.ellipse(20, 28, 24, 5, 0, 0, 7); g.fill();
  // silhouettes de collines et d'arbres morts
  g.fillStyle = '#04040a'; g.beginPath(); g.moveTo(0, 50); g.quadraticCurveTo(20, 40, 40, 48); g.quadraticCurveTo(54, 52, 64, 44); g.lineTo(64, 64); g.lineTo(0, 64); g.fill();
  g.strokeStyle = '#04040a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(48, 50); g.lineTo(48, 34); g.lineTo(44, 28); g.moveTo(48, 40); g.lineTo(53, 33); g.stroke();
  // barreaux
  g.fillStyle = '#121216';
  for (let x = 2; x < 64; x += 8) { g.fillRect(x, 6, 2, 58); g.beginPath(); g.moveTo(x - 1, 7); g.lineTo(x + 1, 1); g.lineTo(x + 3, 7); g.fill(); }
  g.fillRect(0, 14, 64, 2); g.fillRect(0, 56, 64, 3);
}, emissive((r, g, b, x, y) => y < 56 && (Math.max(r, g, b) > 130 || (b > 20 && b > r + 6)) && !(x % 8 === 2 || x % 8 === 3)));

H.tombWall = () => make(214, (g, r) => {
  stoneBlocks(g, r, 30, 6, 30);
  g.fillStyle = '#1c1a18'; g.fillRect(14, 12, 36, 26);
  g.fillStyle = '#5a5650'; g.fillRect(16, 14, 32, 22);
  g.fillStyle = '#26221e'; g.font = 'bold 11px serif'; g.textAlign = 'center'; g.fillText('R.I.P', 32, 29);
  g.fillStyle = '#3a3630'; g.fillRect(20, 31, 24, 1);
  // crâne sculpté
  g.fillStyle = '#8a857a'; g.beginPath(); g.ellipse(32, 48, 6, 5.5, 0, 0, 7); g.fill(); g.fillRect(28, 51, 8, 4);
  g.fillStyle = '#1a1814'; g.beginPath(); g.ellipse(29.5, 48, 1.6, 2, 0, 0, 7); g.ellipse(34.5, 48, 1.6, 2, 0, 0, 7); g.fill();
  moss(g, r, 6);
}, noise(12));

H.candleWall = () => make(215, (g, r) => {
  stoneBlocks(g, r, 15, 10, 22);
  for (const [x, y] of [[10, 10], [38, 10], [24, 36], [52, 36]]) {
    g.fillStyle = '#060404'; g.fillRect(x - 2, y, 14, 18);
    g.fillStyle = '#e8dcc0'; g.fillRect(x + 3, y + 8, 4, 10);
    g.fillStyle = '#7a1a10'; g.fillRect(x + 3, y + 8, 4, 2);
    const grd = g.createRadialGradient(x + 5, y + 6, 0, x + 5, y + 6, 6);
    grd.addColorStop(0, '#fff6c0'); grd.addColorStop(0.4, '#ffb030'); grd.addColorStop(1, 'rgba(255,90,10,0)');
    g.fillStyle = grd; g.fillRect(x - 1, y, 12, 12);
    g.fillStyle = '#fffbe0'; g.fillRect(x + 4, y + 4, 2, 4);
    g.fillStyle = 'rgba(200,190,170,.6)'; g.fillRect(x + 2, y + 17, 6, 1); // cire coulée
  }
  blood(g, r, 0.4);
}, chain(noise(10), emissive((r, g, b) => r > 220 && g > 120 && b < 170)));

H.ironGrate = () => make(216, (g) => {
  g.fillStyle = '#050505'; g.fillRect(0, 0, 64, 64);
  const grd = g.createRadialGradient(32, 40, 2, 32, 40, 30);
  grd.addColorStop(0, '#2a0a06'); grd.addColorStop(1, '#050505');
  g.fillStyle = grd; g.fillRect(4, 4, 56, 56);
  g.fillStyle = '#3a2a22';
  for (let x = 6; x < 60; x += 9) g.fillRect(x, 0, 4, 64);
  g.fillRect(0, 0, 64, 5); g.fillRect(0, 30, 64, 4); g.fillRect(0, 59, 64, 5);
  g.fillStyle = '#6a3a20'; for (let x = 6; x < 60; x += 9) g.fillRect(x, 0, 1, 64);
  for (let x = 7; x < 64; x += 9) { rivet(g, x, 2); rivet(g, x, 31); rivet(g, x, 61); }
}, noise(14, false));

H.hedge = () => make(217, (g, r) => {
  g.fillStyle = '#0e1a0c'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) {
    const x = r() * 64, y = r() * 64, l = 12 + r() * 20;
    g.fillStyle = `hsl(${95 + r() * 30},${30 + r() * 25}%,${l}%)`;
    g.beginPath(); g.ellipse(x, y, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(r() * 64, r() * 64, 2 + r() * 4, 0, 7); g.fill(); }
  // quelques baies vénéneuses
  g.fillStyle = '#9a1a3a'; for (let i = 0; i < 4; i++) g.fillRect(r() * 62, r() * 62, 2, 2);
}, noise(10, false));

H.greenhouse = () => make(218, (g, r) => {
  g.fillStyle = '#0a0f10'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(80,110,110,.25)';
  for (let y = 0; y < 64; y += 21) for (let x = 0; x < 64; x += 16) if (r() > 0.2) g.fillRect(x + 2, y + 2, 12, 18);
  // vitres brisées
  g.strokeStyle = 'rgba(180,210,210,.4)'; g.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) { g.beginPath(); const x = r() * 64, y = r() * 64; g.moveTo(x, y); for (let k = 0; k < 3; k++) g.lineTo(x + r() * 16 - 8, y + r() * 16 - 8); g.stroke(); }
  g.fillStyle = '#2a2e30';
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 2, 64);
  for (let y = 0; y < 64; y += 21) g.fillRect(0, y, 64, 2);
  // lierre mort
  g.strokeStyle = '#2a3a1a'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { g.beginPath(); let x = r() * 64, y = 0; g.moveTo(x, y); while (y < 64) { x += r() * 10 - 5; y += 6; g.lineTo(x, y); } g.stroke(); }
}, noise(8, false));

const gate = (on) => make(on ? 220 : 219, (g, r) => {
  stoneBlocks(g, r, 270, 8, 24);
  g.fillStyle = '#060406'; g.beginPath(); g.moveTo(12, 64); g.lineTo(12, 22); g.quadraticCurveTo(32, 0, 52, 22); g.lineTo(52, 64); g.fill();
  g.fillStyle = '#2a1e18'; g.fillRect(14, 22, 36, 42);
  for (let x = 14; x < 50; x += 9) { g.fillStyle = '#1a120e'; g.fillRect(x, 22, 1, 42); }
  g.fillStyle = '#3a3a40'; g.fillRect(14, 30, 36, 3); g.fillRect(14, 52, 36, 3);
  const c = on ? '#3aff7a' : '#ff2a3a';
  // sceau magique
  g.strokeStyle = c; g.lineWidth = 1.5;
  g.beginPath(); g.arc(32, 41, 7, 0, 7); g.stroke();
  g.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; const x = 32 + Math.cos(a) * 7, y = 41 + Math.sin(a) * 7; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
  g.fillStyle = c; g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.fillText(on ? 'OUVERT' : 'SCELLÉ', 32, 19);
}, chain(noise(8), emissive((r, g, b) => (r > 200 && g < 90) || (g > 200 && r < 120))));
H.gateOff = () => gate(false);
H.gateOn = () => gate(true);

const woodDoor = (seed, lock) => make(seed, (g, r) => {
  planks(g, r, [74, 50, 32]);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 64, 64);
  // ferrures
  for (const y of [8, 50]) {
    g.fillStyle = '#26262a'; g.fillRect(2, y, 60, 6);
    g.fillStyle = '#4a4a52'; g.fillRect(2, y, 60, 1);
    for (let x = 6; x < 62; x += 12) rivet(g, x, y + 3);
  }
  const c = lock === 'blue' ? '#3a8cff' : lock === 'red' ? '#ff2a3a' : null;
  // serrure en forme de crâne
  g.fillStyle = '#b8a888'; g.beginPath(); g.ellipse(46, 34, 5, 5, 0, 0, 7); g.fill(); g.fillRect(43, 36, 6, 4);
  g.fillStyle = c || '#120c08'; g.beginPath(); g.ellipse(44.5, 34, 1.3, 1.6, 0, 0, 7); g.ellipse(47.5, 34, 1.3, 1.6, 0, 0, 7); g.fill();
  if (c) { g.fillStyle = c; g.fillRect(2, 22, 60, 2); g.fillRect(2, 44, 60, 2); }
  g.fillStyle = '#1a1210'; g.fillRect(16, 30, 3, 10);
}, chain(noise(10, false), emissive((r, g, b) => (b > 220 && r < 120) || (r > 230 && g < 70))));
H.doorWood = () => woodDoor(221);
H.doorWoodBlue = () => woodDoor(222, 'blue');
H.doorWoodRed = () => woodDoor(223, 'red');
H.doorSideStone = () => make(224, (g, r) => {
  stoneBlocks(g, r, 30, 5, 24);
  g.fillStyle = '#2a1e18'; g.fillRect(26, 0, 12, 64);
  g.fillStyle = '#3a3a40'; for (let y = 4; y < 64; y += 14) g.fillRect(26, y, 12, 3);
}, noise(10));

// ——— Sols ———
H.dirt = () => make(230, (g, r) => {
  g.fillStyle = '#1e1810'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) { g.fillStyle = rgba(35 + r() * 30, 28 + r() * 20, 18 + r() * 10, 0.8); g.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 30; i++) { // touffes d'herbe sèche
    const x = r() * 64, y = r() * 64;
    g.strokeStyle = rgba(60 + r() * 30, 70 + r() * 30, 30, 0.9); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1 + r() * 2, y - 3 - r() * 3); g.moveTo(x + 1, y); g.lineTo(x + 2 + r() * 2, y - 2 - r() * 3); g.stroke();
  }
  for (let i = 0; i < 7; i++) { // feuilles mortes
    g.fillStyle = ['#6a3a10', '#8a4a14', '#4a2a10'][(r() * 3) | 0];
    g.beginPath(); g.ellipse(r() * 64, r() * 64, 2.5, 1.3, r() * 3, 0, 7); g.fill();
  }
}, noise(10, false));

H.flagstone = () => make(231, (g, r) => {
  g.fillStyle = '#121214'; g.fillRect(0, 0, 64, 64);
  const cells = [[0, 0, 30, 22], [31, 0, 33, 30], [0, 23, 20, 41], [21, 23, 22, 20], [44, 31, 20, 33], [21, 44, 22, 20]];
  for (const [x, y, w, h] of cells) {
    const v = 26 + r() * 12;
    g.fillStyle = `hsl(220,5%,${v}%)`; g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1, y + 1, w - 2, 1);
  }
  moss(g, r, 6);
}, noise(12));

H.woodFloor = () => make(232, (g, r) => { planks(g, r, [64, 44, 28], false); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, 64, 64); rot(g, r); }, noise(10, false));

H.carpet = () => make(233, (g, r) => {
  g.fillStyle = '#4a0e12'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#7a5a20'; g.lineWidth = 2; g.strokeRect(4, 4, 56, 56);
  g.fillStyle = '#2a0608';
  for (let y = 12; y < 56; y += 16) for (let x = 12; x < 56; x += 16) { g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r() * 64, r() * 64, 3 + r() * 6, 2 + r() * 4, 0, 0, 7); g.fill(); }
}, noise(14, false));

// ——— Plafonds ———
H.nightSky = () => make(240, (g, r) => {
  const grd = g.createLinearGradient(0, 0, 64, 64);
  grd.addColorStop(0, '#04050c'); grd.addColorStop(1, '#0c0a18');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(70,50,110,.08)'; g.beginPath(); g.ellipse(32, 30, 34, 10, 0.6, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const v = 160 + r() * 95; g.fillStyle = rgba(v, v, v + 10, 1); g.fillRect(r() * 64, r() * 64, 1, 1); }
}, emissive((r, g, b) => Math.max(r, g, b) > 150));

H.vault = () => make(241, (g, r) => {
  stoneBlocks(g, r, 220, 4, 18);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2a2a30'; g.fillRect(29, 0, 6, 64); g.fillRect(0, 29, 64, 6);
  cobweb(g, 0, 26);
}, noise(10));

H.beams = () => make(242, (g, r) => {
  g.fillStyle = '#0e0a08'; g.fillRect(0, 0, 64, 64);
  for (const x of [0, 32]) {
    const grd = g.createLinearGradient(x, 0, x + 14, 0);
    grd.addColorStop(0, '#2a1a10'); grd.addColorStop(0.5, '#4a2e1c'); grd.addColorStop(1, '#1a100a');
    g.fillStyle = grd; g.fillRect(x, 0, 14, 64);
  }
  cobweb(g, 1, 30);
}, noise(10, false));

export function buildHalloweenTextures() {
  const out = {};
  for (const k in H) out[k] = H[k]();
  return out;
}
