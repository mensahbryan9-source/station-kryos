// Vérifie la cohérence des cartes : dimensions, bordures, portes, accessibilité.
// Usage : node tools/validate-levels.mjs
import { LEVELS, WALL_CHARS } from '../js/levels.js';

const isWall = (c) => c in WALL_CHARS || c === '*';
const BLOCK_DECOR = 'oynq';
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
  const reach = (keys) => {
    const seen = new Set([start.join()]); const q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, c = at(nx, ny), k = nx + ',' + ny;
        if (seen.has(k) || isWall(c) || BLOCK_DECOR.includes(c)) continue;
        if (c === 'B' && !keys.blue) continue;
        if (c === 'R' && !keys.red) continue;
        seen.add(k); q.push([nx, ny]);
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
  const en = (counts.g || 0) + (counts.s || 0) + (counts.m || 0) + (counts.O || 0);
  console.log(`Niveau ${li + 1} « ${L.name} » : ${W}×${H}, ${en} ennemis, ${counts.t || 0} cristaux, ${counts['*'] || 0} secret(s)`);
});

if (errors) { console.error(`${errors} erreur(s)`); process.exit(1); }
console.log('Toutes les cartes sont valides.');
