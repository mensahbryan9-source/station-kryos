// Sprites du thème Halloween : fantôme, citrouille, zombie, Gardien de la
// crypte, Roi Citrouille, objets, décor, projectiles et armes.
import { sprite, ell, shadow, sparks, bright, enemyFrames, weaponCanvas, flash, body, lerp } from './sprites.js';

// ——— Spectre (g) : linceul en lambeaux, visage décharné qui hurle (rendu translucide) ———
function drawGhost(g, r, pose) {
  if (pose.startsWith('die')) {
    const k = +pose[3];
    if (k === 2) { ell(g, 32, 60, 15, 3, 'rgba(20,30,40,.9)'); ell(g, 30, 59, 8, 1.5, '#5a7a88'); return; }
    // le spectre se déchire en lambeaux
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.28 + k * 0.7, d = 8 + k * 12 + (i % 3) * 5;
      g.strokeStyle = `rgba(190,205,215,${0.8 - k * 0.3})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(32 + Math.cos(a) * d * 0.4, 28 + Math.sin(a) * d * 0.3); g.lineTo(32 + Math.cos(a) * d, 28 + Math.sin(a) * d * 0.8); g.stroke();
    }
    ell(g, 32, 24 + k * 8, 7 - k * 2, 9 - k * 3, '#cfd8dc');
    ell(g, 32, 28 + k * 8, 3, 5 - k, '#000');
    return;
  }
  const sway = pose === 'walk1' ? 2 : 0;
  // linceul en lambeaux
  const grd = g.createLinearGradient(0, 8, 0, 62);
  grd.addColorStop(0, '#9aa8b0'); grd.addColorStop(0.5, '#4a5660'); grd.addColorStop(1, 'rgba(20,26,32,.9)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(50, 6, 54, 30, 52, 48);
  for (let i = 0; i < 7; i++) g.lineTo(52 - i * 6.6 + (i % 2 ? sway : -sway), i % 2 ? 62 : 50 + (i % 3) * 3);
  g.bezierCurveTo(10, 30, 14, 6, 32, 4); g.fill();
  // longs cheveux pendants
  g.strokeStyle = '#0c0e10'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const x = 20 + i * 3; g.beginPath(); g.moveTo(x, 8); g.quadraticCurveTo(x - 2 + sway, 26, x + (i % 2 ? 3 : -3), 44 + (i % 3) * 4); g.stroke(); }
  // visage étiré, peau tendue sur l'os
  const face = g.createRadialGradient(32, 20, 1, 32, 22, 12);
  face.addColorStop(0, '#e8ecee'); face.addColorStop(1, '#8c989e');
  g.fillStyle = face; g.beginPath(); g.ellipse(32, 22, 8, 13, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(40,50,56,.6)'; g.fillRect(25, 25, 2, 6); g.fillRect(37, 25, 2, 6); // joues creuses
  // orbites vides avec pupilles minuscules
  const glow = pose === 'attack' ? '#ff2020' : '#e8f4ff';
  for (const x of [28, 36]) { ell(g, x, 17, 3, 4, '#000'); g.fillStyle = glow; g.fillRect(x - 0.5, 17, 1.5, 1.5); }
  // bouche béante qui hurle
  const open = pose === 'attack' ? 11 : 7;
  ell(g, 32, 29 + open / 3, 3.5, open, '#000');
  g.fillStyle = '#c8c4b0'; g.fillRect(30, 26, 1, 2); g.fillRect(33, 26, 1, 2);
  // bras décharnés et griffes
  const reach = pose === 'attack' ? -10 : 0;
  g.strokeStyle = '#7c8890'; g.lineWidth = 2.2;
  for (const s of [-1, 1]) {
    const sx = 32 + s * 12, ex = 32 + s * 26, ey = 34 + reach;
    g.beginPath(); g.moveTo(sx, 30); g.quadraticCurveTo(32 + s * 20, 38, ex, ey); g.stroke();
    g.lineWidth = 1;
    for (let f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + s * 5, ey + f * 4 - 3); g.stroke(); }
    g.lineWidth = 2.2;
  }
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(12, 4, 40, 56); }
}

// ——— Citrouille pourrie (s) : tête moisie à crocs sur un épouvantail de ronces ———
function pumpkinHead(g, cx, cy, rx, ry, mouthOpen, lit = true) {
  const grd = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 2, cx, cy, rx * 1.2);
  grd.addColorStop(0, '#b8581a'); grd.addColorStop(0.6, '#7a3008'); grd.addColorStop(1, '#2a0e04');
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
  // pourriture et moisissure
  for (const [dx, dy, s] of [[-0.6, -0.4, 0.22], [0.55, 0.3, 0.18], [-0.2, 0.6, 0.15], [0.4, -0.55, 0.12]]) {
    ell(g, cx + dx * rx, cy + dy * ry, rx * s, ry * s * 0.8, 'rgba(40,50,20,.85)');
    ell(g, cx + dx * rx + 1, cy + dy * ry, rx * s * 0.5, ry * s * 0.4, 'rgba(120,140,90,.6)');
  }
  g.strokeStyle = 'rgba(30,10,2,.8)'; g.lineWidth = 1;
  for (const k of [-0.55, 0, 0.55]) { g.beginPath(); g.ellipse(cx + k * rx * 0.6, cy, rx * 0.35, ry * 0.98, 0, 0, 7); g.stroke(); }
  g.fillStyle = '#1a2208'; g.fillRect(cx - 2, cy - ry - 5, 4, 7);
  const fire = lit ? '#ff3a10' : '#120402';
  const core = lit ? '#ffd040' : '#120402';
  // yeux fendus et inclinés (regard furieux)
  for (const s of [-1, 1]) {
    g.fillStyle = fire;
    g.beginPath(); g.moveTo(cx + s * rx * 0.12, cy - ry * 0.02); g.lineTo(cx + s * rx * 0.62, cy - ry * 0.42); g.lineTo(cx + s * rx * 0.5, cy + ry * 0.05); g.fill();
    g.fillStyle = core; g.fillRect(cx + s * rx * 0.38 - 1, cy - ry * 0.12, 2, 2);
  }
  // gueule béante pleine de crocs
  const mh = ry * (mouthOpen ? 0.7 : 0.42);
  const top = cy + ry * 0.18, w = rx * 0.72;
  g.fillStyle = fire;
  g.beginPath(); g.moveTo(cx - w, top); g.quadraticCurveTo(cx, top + mh * 2, cx + w, top); g.fill();
  g.fillStyle = lit ? '#ffb030' : '#220a04';
  g.beginPath(); g.ellipse(cx, top + mh * 0.5, w * 0.5, mh * 0.35, 0, 0, 7); g.fill();
  g.fillStyle = '#e8dcb0';
  for (let i = 0; i < 7; i++) {
    const x = cx - w + 2 + (i * (2 * w - 4)) / 6;
    g.beginPath(); g.moveTo(x - 1.6, top); g.lineTo(x + 1.6, top); g.lineTo(x, top + mh * 0.55); g.fill();
    if (i % 2) { g.beginPath(); g.moveTo(x - 1.4, top + mh * 0.95); g.lineTo(x + 1.4, top + mh * 0.95); g.lineTo(x, top + mh * 0.5); g.fill(); }
  }
  // jus noirâtre qui coule de la gueule
  g.fillStyle = '#3a0a04'; g.fillRect(cx - 4, top + mh * 0.9, 1.5, ry * 0.5); g.fillRect(cx + 5, top + mh * 0.8, 1.2, ry * 0.4);
}
function drawPumpkin(g, r, pose) {
  if (pose.startsWith('die')) {
    const k = +pose[3];
    shadow(g, 32, 18);
    if (k < 2) { pumpkinHead(g, 32, 34 + k * 14, 15, 12 - k * 2, true, k === 0); sparks(g, r, 22, 32, 34 + k * 14, 16, ['#ff3a10', '#ffd040', '#3a0a04']); return; }
    for (let i = 0; i < 6; i++) ell(g, 14 + i * 7, 58 + (i % 2), 5, 3, i % 2 ? '#6a2808' : '#3a1404');
    ell(g, 32, 61, 18, 2, '#2a0804');
    g.fillStyle = '#d8c890'; for (let i = 0; i < 8; i++) g.fillRect(12 + r() * 40, 56 + r() * 5, 2, 1);
    return;
  }
  shadow(g, 32, 13);
  const step = pose === 'walk1' ? 1 : 0;
  // jambes de ronces
  g.strokeStyle = '#1a1a0a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(27, 62); g.quadraticCurveTo(23 + step * 4, 50, 29, 36); g.stroke();
  g.beginPath(); g.moveTo(37, 62); g.quadraticCurveTo(41 - step * 4, 50, 35, 36); g.stroke();
  g.fillStyle = '#2a2a10'; for (let i = 0; i < 6; i++) g.fillRect(24 + (i % 2) * 14 + step, 40 + i * 3.5, 2, 1);
  // cape noire déchiquetée
  g.fillStyle = '#0c080a';
  g.beginPath(); g.moveTo(18, 28); g.lineTo(46, 28); g.lineTo(50, 54); for (let i = 0; i < 6; i++) g.lineTo(48 - i * 6.5, i % 2 ? 58 : 47); g.lineTo(14, 54); g.fill();
  // bras-ronces terminés par des griffes
  const up = pose === 'attack' ? -12 : 0;
  g.strokeStyle = '#1e200c'; g.lineWidth = 2.5;
  for (const s of [-1, 1]) {
    const ex = 32 + s * 25, ey = 24 + up;
    g.beginPath(); g.moveTo(32 + s * 11, 30); g.quadraticCurveTo(32 + s * 22, 36 + up, ex, ey); g.stroke();
    g.strokeStyle = '#c8c0a0'; g.lineWidth = 1;
    for (let f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + s * 4, ey - 5 + f * 3); g.stroke(); }
    g.strokeStyle = '#1e200c'; g.lineWidth = 2.5;
  }
  pumpkinHead(g, 32, 17, 15, 12, pose === 'attack');
  if (pose === 'attack') ell(g, 32, 24, 11, 7, 'rgba(255,60,20,.4)');
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(14, 2, 36, 56); }
}

// ——— Zombie (m) : cadavre décharné, mâchoire pendante, œil arraché ———
function drawZombie(g, r, pose) {
  if (pose.startsWith('die')) {
    const k = +pose[3];
    shadow(g, 32, 20);
    if (k < 2) {
      g.save(); g.translate(32, 62); g.rotate(k ? 1.25 : 0.5); g.translate(-32, -62);
      drawZombieBody(g, r, 'pain', 0); g.restore();
      ell(g, 30, 60, 10 + k * 6, 2 + k, '#3a0406');
      return;
    }
    ell(g, 34, 58, 24, 5, '#2a0204');
    ell(g, 30, 58, 14, 3, '#4a0608');
    g.fillStyle = '#4a5240'; g.fillRect(12, 54, 28, 6);
    g.fillStyle = '#c8c0a0'; for (let i = 0; i < 4; i++) g.fillRect(16 + i * 5, 52, 2, 5);
    ell(g, 48, 55, 6, 5, '#5a6450');
    g.fillStyle = '#000'; g.fillRect(45, 53, 3, 3); g.fillRect(50, 54, 2, 2);
    return;
  }
  shadow(g, 32, 14);
  drawZombieBody(g, r, pose, pose === 'walk1' ? 1 : 0);
}
function drawZombieBody(g, r, pose, step) {
  const skin = '#6e7a64', dark = '#3e4638', blood = '#5a0406';
  // jambes maigres, une traîne
  g.fillStyle = '#22222a';
  g.fillRect(25 - step * 2, 42, 6, 20); g.fillRect(34 + step * 3, 42, 6, 18 + step * 2);
  g.fillStyle = skin; g.fillRect(25 - step * 2, 52, 6, 4); // chair visible par la déchirure
  g.fillStyle = blood; g.fillRect(26 - step * 2, 54, 4, 2);
  // torse voûté, chemise en lambeaux
  g.fillStyle = '#3a3428';
  g.beginPath(); g.moveTo(19, 20); g.lineTo(45, 18); g.lineTo(43, 44); for (let i = 0; i < 5; i++) g.lineTo(41 - i * 5, i % 2 ? 46 : 41); g.lineTo(21, 44); g.fill();
  // cage thoracique ouverte
  g.fillStyle = '#2a0a08'; g.beginPath(); g.ellipse(32, 30, 7, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#d8d0b0'; for (let i = 0; i < 4; i++) { g.fillRect(26, 24 + i * 3.5, 5, 1.2); g.fillRect(33, 24 + i * 3.5, 5, 1.2); }
  g.fillStyle = blood; g.fillRect(24, 34, 3, 10); g.fillRect(38, 22, 2, 14); g.fillRect(30, 38, 6, 3);
  // bras décharnés tendus, longues griffes
  const lift = pose === 'attack' ? -0.6 : step * 0.12;
  for (const s of [-1, 1]) {
    g.save(); g.translate(32 + s * 12, 22); g.rotate(s * (1.3 - lift));
    g.fillStyle = skin; g.fillRect(-2.5, 0, 5, 20);
    g.fillStyle = dark; g.fillRect(-2.5, 8, 5, 2);
    g.strokeStyle = '#e0d8b8'; g.lineWidth = 1;
    for (let f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(f * 1.5, 20); g.lineTo(f * 2.5, 26); g.stroke(); }
    g.restore();
  }
  // tête penchée, cheveux arrachés
  g.save(); g.translate(33, 11); g.rotate(0.25);
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, 0, 7, 8.5, 0, 0, 7); g.fill();
  g.fillStyle = '#1a1612'; g.fillRect(-7, -9, 9, 3); g.fillRect(3, -8, 3, 2);
  // orbite vide à gauche, œil laiteux à droite
  ell(g, -3, -1, 2.4, 2.8, '#000');
  ell(g, 3, -1, 2, 2, pose === 'pain' ? '#ffffff' : '#d8e0c0'); g.fillStyle = '#ff2a10'; g.fillRect(3, -1, 1, 1);
  g.fillStyle = blood; g.fillRect(-4, 1, 1.2, 5); // larme de sang
  // mâchoire pendante pleine de dents
  const jaw = pose === 'attack' ? 7 : 4;
  g.fillStyle = '#0a0202'; g.fillRect(-4, 4, 8, jaw);
  g.fillStyle = '#d8d0a8'; for (let i = 0; i < 4; i++) { g.fillRect(-3.5 + i * 2, 4, 1, 1.5); g.fillRect(-3.5 + i * 2, 3 + jaw, 1, 1.5); }
  g.fillStyle = blood; g.fillRect(-2, 4 + jaw, 1.2, 4); g.fillRect(2, 4 + jaw, 1, 3);
  g.restore();
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(16, 0, 32, 46); }
}

// ——— Gardien de la crypte (G, 128 px) : crâne géant couronné de bougies ———
function drawGuardian(g, r, pose) {
  g.save(); g.scale(2, 2);
  if (pose.startsWith('die')) {
    const k = +pose[3];
    if (k === 2) {
      for (let i = 0; i < 10; i++) ell(g, 10 + r() * 44, 56 + r() * 6, 3 + r() * 4, 2, '#cfc6b0');
      ell(g, 32, 58, 8, 4, '#d8d0b8'); g.fillStyle = '#1a1410'; g.fillRect(29, 57, 2, 2); g.fillRect(33, 57, 2, 2);
      g.restore(); return;
    }
    sparks(g, r, 60, 32, 30 + k * 10, 26, ['#c080ff', '#ffffff', '#d8d0b8']);
    ell(g, 32, 30 + k * 10, 16 - k * 5, 14 - k * 5, '#d8d0b8');
    g.restore(); return;
  }
  shadow(g, 32, 16);
  const y = 28 + (pose === 'walk1' ? 2 : 0);
  // aura
  const aura = g.createRadialGradient(32, y, 4, 32, y, 30);
  aura.addColorStop(0, 'rgba(150,60,255,.35)'); aura.addColorStop(1, 'rgba(80,0,160,0)');
  g.fillStyle = aura; g.fillRect(0, 0, 64, 64);
  // chaînes
  g.strokeStyle = '#4a4a50'; g.lineWidth = 1.5;
  for (const x of [14, 50]) { g.beginPath(); for (let k = 0; k < 7; k++) g.rect(x - 1.5, y + 10 + k * 4, 3, 3); g.stroke(); }
  // crâne
  const grd = g.createRadialGradient(28, y - 6, 2, 32, y, 22);
  grd.addColorStop(0, '#f2ead6'); grd.addColorStop(0.7, '#c8bc9e'); grd.addColorStop(1, '#6a604a');
  g.fillStyle = grd; g.beginPath(); g.ellipse(32, y - 2, 18, 17, 0, 0, 7); g.fill();
  g.fillRect(22, y + 10, 20, 8);
  // mâchoire flottante
  const jaw = pose === 'attack' ? 8 : 2;
  g.fillStyle = '#b8ac8e'; g.fillRect(22, y + 18 + jaw, 20, 6);
  g.fillStyle = '#efe6d0'; for (let i = 0; i < 6; i++) { g.fillRect(23 + i * 3.2, y + 15, 2, 4); g.fillRect(23 + i * 3.2, y + 17 + jaw, 2, 3); }
  // orbites à flamme violette
  const eye = pose === 'attack' ? '#ffffff' : pose === 'pain' ? '#ffd0ff' : '#c060ff';
  for (const x of [25, 39]) {
    ell(g, x, y - 1, 5, 6, '#0c0610');
    const fl = g.createRadialGradient(x, y - 1, 0, x, y - 1, 4);
    fl.addColorStop(0, '#ffffff'); fl.addColorStop(0.4, eye); fl.addColorStop(1, 'rgba(100,0,200,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(x, y - 1, 4, 0, 7); g.fill();
  }
  g.fillStyle = '#1a1010'; g.beginPath(); g.moveTo(32, y + 5); g.lineTo(29, y + 10); g.lineTo(35, y + 10); g.fill();
  // fissure
  g.strokeStyle = '#4a4030'; g.lineWidth = 1; g.beginPath(); g.moveTo(36, y - 18); g.lineTo(34, y - 12); g.lineTo(37, y - 8); g.stroke();
  // couronne de bougies
  for (let i = 0; i < 5; i++) {
    const x = 18 + i * 7, by = y - 16 - (i === 2 ? 3 : i % 2 ? 1 : 0);
    g.fillStyle = '#e8dcc0'; g.fillRect(x, by - 6, 3, 7);
    ell(g, x + 1.5, by - 8, 1.8, 3, '#ffcf40'); ell(g, x + 1.5, by - 8, 0.8, 1.5, '#ffffff');
  }
  if (pose === 'pain') sparks(g, r, 25, 32, y, 18, ['#ffffff', '#c080ff']);
  g.restore();
}

// ——— Roi Citrouille (O, 128 px) : boss final ———
function drawKing(g, r, pose) {
  g.save(); g.scale(2, 2);
  if (pose.startsWith('die')) {
    const k = +pose[3];
    if (k === 2) {
      ell(g, 32, 59, 26, 5, '#120a10');
      for (let i = 0; i < 7; i++) ell(g, 10 + i * 7, 58, 5, 3, i % 2 ? '#c85a10' : '#8a3a08');
      g.fillStyle = '#d8b040'; g.fillRect(40, 54, 10, 4);
      g.restore(); return;
    }
    ell(g, 32, 30 + k * 10, 24, 22, '#ffb040'); ell(g, 32, 30 + k * 10, 14, 13, '#fff8d0');
    sparks(g, r, 80, 32, 30 + k * 10, 30, ['#ffffff', '#ff8020', '#ffd040']);
    g.restore(); return;
  }
  shadow(g, 32, 20);
  const sway = pose === 'walk1' ? 2 : 0;
  // cape
  g.fillStyle = '#0e0a12';
  g.beginPath(); g.moveTo(14, 26); g.lineTo(50, 26); g.lineTo(58, 62);
  for (let i = 0; i < 8; i++) g.lineTo(56 - i * 7, i % 2 ? 62 : 56);
  g.lineTo(6, 62); g.fill();
  g.fillStyle = '#4a0a1a'; g.beginPath(); g.moveTo(20, 26); g.lineTo(44, 26); g.lineTo(40, 44); g.lineTo(24, 44); g.fill();
  // bras squelettiques
  const up = pose === 'attack' ? -16 : 0;
  g.strokeStyle = '#d8d0b8'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(16, 30); g.lineTo(8, 40 + up); g.lineTo(4 + sway, 30 + up); g.stroke();
  g.beginPath(); g.moveTo(48, 30); g.lineTo(56, 40 + up); g.lineTo(60 - sway, 30 + up); g.stroke();
  if (pose === 'attack') { ell(g, 4, 28 + up, 5, 5, 'rgba(255,140,30,.8)'); ell(g, 60, 28 + up, 5, 5, 'rgba(255,140,30,.8)'); }
  // tête et couronne
  pumpkinHead(g, 32, 16 + sway * 0.5, 15, 12, pose === 'attack');
  g.fillStyle = '#d8b040';
  g.beginPath(); g.moveTo(21, 6); for (let i = 0; i < 5; i++) { g.lineTo(23 + i * 4.5, i % 2 ? 2 : -3); g.lineTo(25 + i * 4.5, 4); } g.lineTo(43, 6); g.fill();
  ell(g, 32, 0, 1.5, 1.5, '#ff2a3a');
  if (pose === 'pain') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(6, 0, 52, 62); }
  g.restore();
}

// ——— Objets ———
const ITEMS = {
  h: (g) => { shadow(g, 32, 9); g.fillStyle = '#ff4a8a'; g.beginPath(); g.ellipse(32, 52, 7, 5, 0, 0, 7); g.fill(); g.fillStyle = '#ffd0e0'; g.beginPath(); g.moveTo(25, 52); g.lineTo(18, 47); g.lineTo(18, 57); g.fill(); g.beginPath(); g.moveTo(39, 52); g.lineTo(46, 47); g.lineTo(46, 57); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(29, 49, 4, 2); },
  H: (g) => { shadow(g, 32, 11); g.fillStyle = '#c8d8e0'; g.fillRect(29, 34, 6, 8); g.fillStyle = '#7a4a2a'; g.fillRect(28, 31, 8, 4); const grd = g.createRadialGradient(30, 48, 2, 32, 50, 12); grd.addColorStop(0, '#ff8aa0'); grd.addColorStop(1, '#c8102a'); g.fillStyle = grd; g.beginPath(); g.arc(32, 51, 11, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(26, 45, 3, 6); },
  r: (g) => { shadow(g, 32, 14); g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(18, 38); g.lineTo(46, 38); g.lineTo(44, 61); g.lineTo(20, 61); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(22, 42, 20, 6); g.fillRect(22, 51, 20, 6); g.fillStyle = '#a8a8b0'; for (let i = 0; i < 4; i++) { g.fillRect(24 + i * 5, 43, 2, 2); g.fillRect(24 + i * 5, 52, 2, 2); } },
  a: (g) => { shadow(g, 32, 10); g.fillStyle = '#3a2a1a'; g.fillRect(22, 46, 20, 15); g.fillStyle = '#d8b040'; for (let i = 0; i < 4; i++) { g.fillRect(24 + i * 5, 40, 3, 7); } g.fillStyle = '#a07a20'; for (let i = 0; i < 4; i++) g.fillRect(24 + i * 5, 40, 3, 2); g.fillStyle = '#e8d8b0'; g.font = 'bold 6px monospace'; g.fillText('.38', 26, 56); },
  c: (g) => { shadow(g, 32, 12); g.fillStyle = '#4a1a10'; g.fillRect(20, 48, 24, 13); g.fillStyle = '#c82a1a'; for (let i = 0; i < 4; i++) g.fillRect(22 + i * 6, 41, 4, 8); g.fillStyle = '#d8b040'; for (let i = 0; i < 4; i++) g.fillRect(22 + i * 6, 47, 4, 2); },
  k: (g) => skullKey(g, '#3a8cff'),
  K: (g) => skullKey(g, '#ff2a3a'),
  t: (g) => { shadow(g, 32, 8); const grd = g.createRadialGradient(30, 44, 1, 32, 48, 10); grd.addColorStop(0, '#fff6c0'); grd.addColorStop(1, '#b08010'); g.fillStyle = grd; g.beginPath(); g.ellipse(32, 47, 8, 8, 0, 0, 7); g.fill(); g.fillRect(27, 51, 10, 6); g.fillStyle = '#3a2a08'; g.beginPath(); g.ellipse(29, 47, 2, 2.5, 0, 0, 7); g.ellipse(35, 47, 2, 2.5, 0, 0, 7); g.fill(); },
  b: (g) => { shadow(g, 32, 9); for (const x of [24, 33]) { g.fillStyle = '#1b1f24'; g.fillRect(x, 44, 8, 17); g.fillStyle = '#e8b21c'; g.fillRect(x, 44, 8, 6); g.fillStyle = '#c9d2dc'; g.fillRect(x + 2, 41, 4, 3); g.fillStyle = '#ffffff'; g.fillRect(x + 1, 52, 2, 7); } },
  w: (g) => { shadow(g, 32, 18); g.fillStyle = '#5a3a1e'; g.fillRect(36, 50, 18, 7); g.fillStyle = '#2a2a30'; g.fillRect(10, 49, 30, 4); g.fillStyle = '#1a1a1e'; g.fillRect(26, 53, 6, 7); },
  W: (g) => { shadow(g, 32, 18); g.fillStyle = '#5a3a1e'; g.fillRect(36, 50, 18, 7); g.fillStyle = '#3a3a40'; g.fillRect(10, 48, 30, 4); g.fillRect(10, 53, 30, 4); },
  Z: (g) => { shadow(g, 32, 20); g.fillStyle = '#7a1a10'; g.beginPath(); g.ellipse(46, 52, 8, 8, 0, 0, 7); g.fill(); g.fillStyle = '#3a3a40'; g.fillRect(10, 48, 32, 6); g.fillStyle = '#ff9a20'; g.fillRect(8, 49, 4, 4); g.fillStyle = '#d8b040'; g.fillRect(44, 44, 4, 3); },
};
function skullKey(g, c) {
  shadow(g, 32, 9);
  g.fillStyle = '#d8d0b8'; g.beginPath(); g.ellipse(26, 49, 6, 6, 0, 0, 7); g.fill();
  g.fillStyle = c; g.beginPath(); g.ellipse(24, 48, 1.6, 2, 0, 0, 7); g.ellipse(28, 48, 1.6, 2, 0, 0, 7); g.fill();
  g.fillStyle = '#d8d0b8'; g.fillRect(31, 48, 14, 3); g.fillRect(40, 51, 2, 4); g.fillRect(44, 51, 2, 3);
  g.fillStyle = c; g.fillRect(31, 46, 14, 1);
}

const DECOR = {
  l: (g) => { g.fillStyle = '#1a1a1e'; g.fillRect(31, 0, 2, 5); g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(24, 5); g.lineTo(40, 5); g.lineTo(37, 22); g.lineTo(27, 22); g.fill(); const grd = g.createRadialGradient(32, 14, 0, 32, 14, 7); grd.addColorStop(0, '#fffbe0'); grd.addColorStop(0.5, '#ffb030'); grd.addColorStop(1, 'rgba(255,120,20,.2)'); g.fillStyle = grd; g.fillRect(27, 7, 10, 14); g.fillStyle = '#1a1a1e'; g.fillRect(31, 7, 2, 14); g.fillRect(26, 22, 12, 2); },
  o: (g) => { shadow(g, 32, 13); g.fillStyle = '#5a3a1e'; g.beginPath(); g.ellipse(32, 46, 12, 16, 0, 0, 7); g.fill(); g.fillStyle = '#2a2a30'; g.fillRect(19, 36, 26, 3); g.fillRect(19, 54, 26, 3); g.fillStyle = '#e8dcc0'; g.font = 'bold 7px serif'; g.textAlign = 'center'; g.fillText('POUDRE', 32, 48); g.fillStyle = '#c82a1a'; g.fillRect(29, 50, 6, 2); },
  y: (g) => { shadow(g, 32, 12); g.fillStyle = '#4a4a50'; g.beginPath(); g.moveTo(22, 62); g.lineTo(22, 44); g.quadraticCurveTo(32, 32, 42, 44); g.lineTo(42, 62); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(22, 44, 2, 18); g.fillStyle = '#1e1e22'; g.fillRect(31, 42, 3, 10); g.fillRect(28, 45, 9, 3); g.fillStyle = 'rgba(60,90,40,.6)'; g.fillRect(22, 58, 20, 4); g.fillRect(38, 50, 4, 6); },
  n: (g) => { shadow(g, 32, 18); g.fillStyle = '#2a1a12'; g.beginPath(); g.moveTo(12, 62); g.lineTo(10, 48); g.lineTo(18, 40); g.lineTo(46, 40); g.lineTo(54, 48); g.lineTo(52, 62); g.fill(); g.fillStyle = '#4a2e1c'; g.beginPath(); g.moveTo(14, 46); g.lineTo(20, 41); g.lineTo(44, 41); g.lineTo(50, 46); g.fill(); g.fillStyle = '#b8a060'; g.fillRect(30, 44, 4, 12); g.fillRect(27, 48, 10, 3); },
  q: (g) => { shadow(g, 32, 14); g.fillStyle = '#3a3a40'; g.fillRect(20, 52, 24, 10); g.fillStyle = '#55555c'; g.beginPath(); g.moveTo(22, 52); g.lineTo(24, 30); g.lineTo(18, 22); g.lineTo(26, 24); g.lineTo(32, 14); g.lineTo(38, 24); g.lineTo(46, 22); g.lineTo(40, 30); g.lineTo(42, 52); g.fill(); g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(16, 30); g.lineTo(4, 16); g.lineTo(18, 36); g.fill(); g.beginPath(); g.moveTo(48, 30); g.lineTo(60, 16); g.lineTo(46, 36); g.fill(); g.fillStyle = '#ff3a2a'; g.fillRect(28, 22, 2, 2); g.fillRect(34, 22, 2, 2); },
  f: (g) => { ell(g, 32, 60, 20, 3.5, '#3a0608'); ell(g, 28, 60, 12, 2, '#5a0a0c'); ell(g, 42, 61, 3, 1, '#7a1014'); },
  u: (g) => { shadow(g, 32, 10); g.strokeStyle = '#1a1410'; g.lineCap = 'round'; const br = (x, y, a, len, w) => { if (w < 0.8) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - 0.5, len * 0.7, w * 0.65); br(x2, y2, a + 0.45, len * 0.65, w * 0.6); }; br(32, 62, -Math.PI / 2, 22, 6); },
  j: (g) => { shadow(g, 32, 10); const grd = g.createRadialGradient(30, 50, 2, 32, 52, 12); grd.addColorStop(0, '#ffa040'); grd.addColorStop(1, '#8a3a06'); g.fillStyle = grd; g.beginPath(); g.ellipse(32, 52, 11, 9, 0, 0, 7); g.fill(); g.fillStyle = '#3a5a14'; g.fillRect(31, 41, 3, 4); g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(26, 50); g.lineTo(30, 50); g.lineTo(28, 46); g.fill(); g.beginPath(); g.moveTo(34, 50); g.lineTo(38, 50); g.lineTo(36, 46); g.fill(); g.fillRect(26, 54, 12, 3); },
  v: (g) => { for (const [x, h] of [[24, 12], [31, 18], [38, 9], [44, 14]]) { g.fillStyle = '#e8dcc0'; g.fillRect(x, 62 - h, 4, h); ell(g, x + 2, 59 - h, 1.8, 3, '#ffcf40'); ell(g, x + 2, 59 - h, 0.8, 1.4, '#ffffff'); } ell(g, 34, 62, 14, 1.5, 'rgba(232,220,192,.7)'); },
  e: (g) => { ell(g, 32, 60, 16, 2.5, 'rgba(0,0,0,.4)'); g.fillStyle = '#d8d0b8'; g.beginPath(); g.ellipse(22, 55, 5, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#1a1410'; g.fillRect(19, 54, 2, 2); g.fillRect(23, 54, 2, 2); g.fillStyle = '#d8d0b8'; g.fillRect(28, 57, 20, 2); for (let i = 0; i < 4; i++) g.fillRect(31 + i * 4, 53, 1.5, 6); g.save(); g.translate(40, 60); g.rotate(-0.4); g.fillRect(0, -1, 12, 2); g.restore(); },
};

const MISC = {
  ecto: (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 10); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.4, '#5dff8a'); grd.addColorStop(1, 'rgba(0,160,60,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fill(); },
  seed: (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 9); grd.addColorStop(0, '#fff8c0'); grd.addColorStop(0.45, '#ff8a20'); grd.addColorStop(1, 'rgba(200,40,0,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 9, 0, 7); g.fill(); },
  skullfire: (g) => { const grd = g.createRadialGradient(32, 30, 0, 32, 30, 14); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, '#c060ff'); grd.addColorStop(1, 'rgba(80,0,160,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 30, 14, 0, 7); g.fill(); },
  fireball: (g) => { const grd = g.createRadialGradient(32, 30, 0, 32, 30, 14); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, '#ffd040'); grd.addColorStop(0.7, '#ff5a10'); grd.addColorStop(1, 'rgba(160,20,0,0)'); g.fillStyle = grd; g.beginPath(); g.arc(32, 30, 14, 0, 7); g.fill(); },
  flame: (g, r) => sparks(g, r, 40, 32, 32, 14, ['#ffffff', '#ffd040', '#ff8a20', '#ff4010']),
};

// ——— Armes ———
function sleeve(g, x, y, w = 30, flip = false) {
  const grd = g.createLinearGradient(x, y, x + w, y);
  grd.addColorStop(0, '#1a120c'); grd.addColorStop(0.5, '#3a2618'); grd.addColorStop(1, '#140e0a');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + w - 4, y); g.quadraticCurveTo(x + w + 2, y + 6, x + w, y + 40); g.lineTo(x, y + 40); g.quadraticCurveTo(x - 2, y + 6, x + 4, y); g.fill();
  g.fillStyle = '#4a3020'; for (let i = 0; i < 3; i++) g.fillRect(x + 4 + i * ((w - 8) / 3), y + 2, (w - 8) / 3 - 2, 6);
  g.fillStyle = '#5a1a1a'; g.fillRect(x + 1, y + 16, w - 2, 3);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(flip ? x + w - 8 : x + 3, y + 10, 4, 26);
}
const WOOD = ['#a06a3a', '#6a4220', '#2a180c'], IRON = ['#8a8a92', '#4a4a52', '#16161a'];

function machete(g, swing) {
  g.save(); if (swing) g.translate(-34, 6);
  const hx = swing ? 70 : 100, hy = swing ? 80 : 78, rot = swing ? -1.15 : -0.32;
  g.save(); g.translate(hx + 10, hy); g.rotate(rot);
  const len = swing ? 74 : 60;
  const bl = g.createLinearGradient(-6, 0, 6, 0);
  bl.addColorStop(0, '#5a5a62'); bl.addColorStop(0.5, '#d8d8e0'); bl.addColorStop(1, '#6a6a72');
  g.fillStyle = bl; g.beginPath(); g.moveTo(-4, 0); g.lineTo(5, 0); g.lineTo(7, -len + 10); g.quadraticCurveTo(4, -len, -3, -len + 4); g.fill();
  g.fillStyle = 'rgba(110,10,12,.8)'; g.fillRect(-2, -len + 12, 5, 10);
  g.fillStyle = '#2a1a10'; g.fillRect(-5, -2, 11, 5); g.fillStyle = '#4a2e1c'; g.fillRect(-4, 3, 8, 18);
  g.restore();
  sleeve(g, hx - 4, hy + 10, 30);
  g.restore();
  if (swing) { g.strokeStyle = 'rgba(220,220,230,.35)'; g.lineWidth = 6; g.beginPath(); g.arc(80, 120, 80, -2.6, -1.2); g.stroke(); }
}
function revolver(g, fire) {
  const dy = fire ? -8 : 0;
  if (fire) flash(g, 80, 46 + dy, 26, '#ffffff', '#ffb040');
  body(g, 80, 50 + dy, 100 + dy, 12, 22, ...IRON);
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(80, 53 + dy, 3, 0, 7); g.fill();
  g.fillStyle = '#3a3a40'; g.beginPath(); g.ellipse(80, 76 + dy, 13, 8, 0, 0, 7); g.fill();
  g.fillStyle = '#1a1a1e'; for (let i = 0; i < 4; i++) g.fillRect(70 + i * 6, 72 + dy, 3, 8);
  body(g, 80, 84 + dy, 112 + dy, 16, 22, ...WOOD);
  sleeve(g, 64, 94 + dy, 32);
}
function carbine(g, fire) {
  const dy = fire ? -4 : 0, sx = fire ? (Math.random() * 2 - 1) : 0;
  g.save(); g.translate(sx, 0);
  if (fire) flash(g, 80, 30 + dy, 28, '#ffffff', '#ffb040');
  body(g, 80, 34 + dy, 120, 10, 30, ...IRON);
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(80, 37 + dy, 3, 0, 7); g.fill();
  body(g, 80, 70 + dy, 120, 30, 64, ...WOOD);
  g.fillStyle = '#16161a'; g.fillRect(75, 58 + dy, 10, 14);
  g.restore();
  sleeve(g, 40, 92 + dy, 34); sleeve(g, 88, 96 + dy, 34, true);
}
function doubleBarrel(g, fire) {
  const dy = fire ? -11 : 0;
  if (fire) { flash(g, 70, 40 + dy, 28, '#ffffff', '#ffb030'); flash(g, 90, 40 + dy, 28, '#ffffff', '#ffb030'); }
  body(g, 70, 44 + dy, 120, 13, 28, ...IRON);
  body(g, 90, 44 + dy, 120, 13, 28, ...IRON);
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(70, 47 + dy, 4.5, 0, 7); g.arc(90, 47 + dy, 4.5, 0, 7); g.fill();
  const fg = g.createLinearGradient(0, 76 + dy, 0, 96 + dy);
  fg.addColorStop(0, '#a06a3a'); fg.addColorStop(1, '#4a2a10');
  g.fillStyle = fg; g.beginPath(); g.moveTo(56, 76 + dy); g.lineTo(104, 76 + dy); g.lineTo(108, 96 + dy); g.lineTo(52, 96 + dy); g.fill();
  g.fillStyle = 'rgba(0,0,0,.3)'; for (let x = 58; x < 104; x += 5) g.fillRect(x, 80 + dy, 1, 12);
  sleeve(g, 44, 96 + dy, 34); sleeve(g, 84, 98 + dy, 34, true);
}
function flamer(g, fire) {
  const dy = fire ? -3 : 0;
  if (fire) {
    for (let i = 0; i < 6; i++) flash(g, 80 + (Math.random() - 0.5) * 20, 26 - i * 4 + dy, 22 - i * 2, '#ffffff', i % 2 ? '#ff8a20' : '#ffd040');
  }
  body(g, 80, 34 + dy, 120, 14, 40, ...IRON);
  g.fillStyle = '#ff7a20'; g.beginPath(); g.arc(80, 38 + dy, 3, 0, 7); g.fill();
  // réservoir
  const tk = g.createLinearGradient(60, 0, 100, 0);
  tk.addColorStop(0, '#4a0a08'); tk.addColorStop(0.5, '#a82a1a'); tk.addColorStop(1, '#3a0806');
  g.fillStyle = tk; g.beginPath(); g.ellipse(80, 92 + dy, 22, 16, 0, 0, 7); g.fill();
  g.fillStyle = '#e8dcc0'; g.font = 'bold 8px serif'; g.textAlign = 'center'; g.fillText('☠', 80, 96 + dy);
  g.strokeStyle = '#2a2a30'; g.lineWidth = 3; g.beginPath(); g.moveTo(66, 82 + dy); g.quadraticCurveTo(70, 60 + dy, 76, 56 + dy); g.stroke();
  sleeve(g, 30, 96 + dy, 36); sleeve(g, 94, 96 + dy, 36, true);
}
const WEAPON_DRAW = {
  blade: [(g) => machete(g, false), (g) => machete(g, true)],
  pistol: [(g) => revolver(g, false), (g) => revolver(g, true)],
  rifle: [(g) => carbine(g, false), (g) => carbine(g, true)],
  scatter: [(g) => doubleBarrel(g, false), (g) => doubleBarrel(g, true)],
  arc: [(g) => flamer(g, false), (g) => flamer(g, true)],
};

export function buildHalloweenSprites() {
  const warm = (r, g, b) => bright(r, g, b) || (r > 230 && g > 150 && b < 120);
  const S = {
    enemy: {
      g: enemyFrames(drawGhost, 64, (r, g, b) => (r > 230 && g < 60) || (r > 225 && g > 235 && b > 245)),
      s: enemyFrames(drawPumpkin, 64, (r, g, b) => r > 240 && b < 100 && (g < 80 || g > 150)),
      m: enemyFrames(drawZombie, 64, (r, g, b) => r > 240 && g < 60),
      G: enemyFrames(drawGuardian, 128, (r, g, b) => bright(r, g, b) || (r > 160 && b > 220 && g < 140) || (r > 240 && g > 180 && b < 120)),
      O: enemyFrames(drawKing, 128, warm),
    },
    item: {}, decor: {}, misc: {}, weapon: {},
  };
  for (const k in ITEMS) S.item[k] = sprite(64, ITEMS[k], (r, g, b) => (b > 230 && r < 120) || (r > 240 && g < 80) || (r > 250 && g > 230 && b > 150), k.charCodeAt(0) + 300);
  for (const k in DECOR) S.decor[k] = sprite(64, DECOR[k], (r, g, b) => warm(r, g, b) || (r > 240 && g < 80), k.charCodeAt(0) + 300);
  for (const k in MISC) S.misc[k] = sprite(64, MISC[k], () => true, k.length * 37);
  for (const k in WEAPON_DRAW) S.weapon[k] = WEAPON_DRAW[k].map(weaponCanvas);
  return S;
}

export { lerp };
