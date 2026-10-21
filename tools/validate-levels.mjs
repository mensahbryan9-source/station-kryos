// Vérifie la cohérence des cartes : dimensions, bordures, portes, accessibilité.
// Usage : node tools/validate-levels.mjs
import { LEVELS, WALL_CHARS } from '../js/levels.js';
import { CONFIG } from '../js/config.js';
import { levelManifest } from '../js/scoring.js';

// Vitesse de course maximale du joueur (cases/s) et marge pour les trajectoires en diagonale.
const RUN_SPEED = 3.3 * 1.45, DIAGONAL_MARGIN = 0.6;

const isWall = (c) => c in WALL_CHARS || c === '*';
const BLOCK_DECOR = 'oynqu';
let errors = 0;
const err = (lvl, msg) => { errors++; console.error(`[niveau ${lvl + 1}] ${msg}`); };

LEVELS.forEach((L, li) => {
  const m = L.map, H = m.length, W = m[0].length;
  m.forEach((row, y) => { if (row.length !== W) err(li, `ligne ${y} : longueur ${row.length} ≠ ${W}`); });
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? '#' : m[y][x]);
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!isWall(at(x, y))) err(li, `bordure ouverte en ${x},${y}`);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!isWall(at(x, y))) err(li, `bordure ouverte en ${x},${y}`);

  let start = null; const counts = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    counts[c] = (counts[c] || 0) + 1;
    if (c === 'P') start = [x, y];
    if ('DBR'.includes(c)) {
      const ew = isWall(at(x - 1, y)) && isWall(at(x + 1, y)) && !isWall(at(x, y - 1)) && !isWall(at(x, y + 1));
      const ns = isWall(at(x, y - 1)) && isWall(at(x, y + 1)) && !isWall(at(x - 1, y)) && !isWall(at(x + 1, y));
      if (!ew && !ns) err(li, `porte mal encadrée en ${x},${y}`);
    }
    if (c === 'X') {
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isWall(at(x + dx, y + dy)));
      if (!open) err(li, `interrupteur de sortie inaccessible en ${x},${y}`);
    }
  }
  if (!start) err(li, 'pas de point de départ P');

  // Accessibilité progressive : clés bleue puis rouge, murs secrets ignorés.
  const reach = (keys, from = start) => {
    const seen = new Map([[from.join(), 0]]); const q = [from];
    while (q.length) {
      const [x, y] = q.shift(), d = seen.get(x + ',' + y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, c = at(nx, ny), k = nx + ',' + ny;
        if (seen.has(k) || isWall(c) || BLOCK_DECOR.includes(c)) continue;
        if (c === 'B' && !keys.blue) continue;
        if (c === 'R' && !keys.red) continue;
        seen.set(k, d + 1); q.push([nx, ny]);
      }
    }
    return seen;
  };
  const find = (ch) => { const r = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === ch) r.push(x + ',' + y); return r; };
  const keys = { blue: false, red: false };
  let s = reach(keys);
  if (find('B').length) { if (!find('k').some((p) => s.has(p))) err(li, 'carte bleue inaccessible'); keys.blue = true; s = reach(keys); }
  if (find('R').length) { if (!find('K').some((p) => s.has(p))) err(li, 'carte rouge inaccessible'); keys.red = true; s = reach(keys); }
  const exitOk = find('X').some((p) => { const [x, y] = p.split(',').map(Number); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.has(x + dx + ',' + (y + dy))); });
  if (!exitOk) err(li, 'sortie inaccessible');
  for (const p of find('*')) {
    const [x, y] = p.split(',').map(Number);
    const pushable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.has(x - dx + ',' + (y - dy)) && !isWall(at(x + dx, y + dy)));
    if (!pushable) err(li, `mur secret ${p} impossible à pousser`);
  }
  // Chemin le plus court : départ → clé bleue → clé rouge → sortie.
  const dist = (from, keysNow, targets) => {
    const s2 = reach(keysNow, from);
    let best = null;
    for (const t of targets) if (s2.has(t) && (best === null || s2.get(t) < s2.get(best))) best = t;
    return best === null ? [Infinity, null] : [s2.get(best), best.split(',').map(Number)];
  };
  let pos = start, path = 0;
  const kk = { blue: false, red: false };
  if (find('B').length) { const [d, p] = dist(pos, kk, find('k')); path += d; pos = p; kk.blue = true; }
  if (find('R').length) { const [d, p] = dist(pos, kk, find('K')); path += d; pos = p; kk.red = true; }
  const exitCells = find('X').flatMap((p) => { const [x, y] = p.split(',').map(Number); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => x + dx + ',' + (y + dy)); });
  path += dist(pos, kk, exitCells)[0];
  const C = CONFIG.levels[li];
  if (!C) err(li, 'pas d\'entrée correspondante dans CONFIG.levels');
  const bound = Math.floor((path / RUN_SPEED) * DIAGONAL_MARGIN);
  if (C && C.minTime > bound) err(li, `minTime ${C.minTime} s trop élevé : un joueur parfait peut finir en ~${bound} s`);
  for (const sc of L.scares || []) if (!s.has(sc.x + ',' + sc.y)) err(li, `case de frayeur ${sc.x},${sc.y} inaccessible`);
  const perDiff = CONFIG.difficulties.map((_, d) => levelManifest(L, d).present.length).join('/');
  console.log(`Niveau ${li + 1} « ${L.name} » : ${W}×${H}, ennemis ${perDiff} (F/N/D/C), ${counts['*'] || 0} secret(s), chemin ${path} cases, minTime ${C && C.minTime} s (borne ${bound} s), par ${C && C.par} s`);
});

if (errors) { console.error(`${errors} erreur(s)`); process.exit(1); }
console.log('Toutes les cartes sont valides.');
