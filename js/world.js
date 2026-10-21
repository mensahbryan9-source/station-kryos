// Représentation d'un niveau en cours de partie.
import { WALL_CHARS } from './levels.js';

export const EMPTY = 0, WALL = 1, DOOR = 2, PUSH = 3, EXIT = 4, MOVING = 5;
const SOLID_DECOR = 'oynq';
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class World {
  constructor(def, texIndex) {
    const m = def.map;
    this.def = def;
    this.H = m.length; this.W = m[0].length;
    const N = this.W * this.H;
    this.type = new Uint8Array(N);
    this.tex = new Uint16Array(N);
    this.solidDecor = new Uint8Array(N);
    this.explored = new Uint8Array(N);
    this.doors = new Map();
    this.moving = null;
    this.spawns = []; // {ch, x, y}
    this.texIndex = texIndex;
    this.exitOn = false;
    this.totalSecrets = 0;
    this.flow = new Int16Array(N);
    this.flowCell = -1; this.flowTimer = 0;

    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const c = m[y][x], i = y * this.W + x;
      if (c === 'X') { this.type[i] = EXIT; this.tex[i] = texIndex.exitOff; }
      else if (c in WALL_CHARS) {
        this.type[i] = WALL;
        const v = def.variants && def.variants[c];
        const name = v ? v[(((x * 73856093) ^ (y * 19349663)) >>> 0) % v.length] : WALL_CHARS[c];
        this.tex[i] = texIndex[name];
      } else if (c === '*') {
        this.type[i] = PUSH; this.tex[i] = texIndex[def.secretTex]; this.totalSecrets++;
      } else if (c === 'D' || c === 'B' || c === 'R') {
        this.type[i] = DOOR;
        this.tex[i] = texIndex[c === 'B' ? 'doorBlue' : c === 'R' ? 'doorRed' : 'door'];
      } else {
        if (c === 'P') this.start = { x: x + 0.5, y: y + 0.5 };
        else if (c !== '.' && c !== ' ') this.spawns.push({ ch: c, x: x + 0.5, y: y + 0.5 });
        if (SOLID_DECOR.includes(c)) this.solidDecor[i] = 1;
      }
    }
    // Orientation des portes (une fois tous les murs connus).
    for (let i = 0; i < N; i++) if (this.type[i] === DOOR) {
      const x = i % this.W, y = (i / this.W) | 0, c = m[y][x];
      this.doors.set(i, {
        x, y, open: 0, state: 0, timer: 0,
        // ns = le panneau est parallèle à l'axe X (passage nord-sud)
        ns: this.isWallType(x - 1, y) && this.isWallType(x + 1, y),
        lock: c === 'B' ? 'blue' : c === 'R' ? 'red' : null,
      });
    }
  }

  idx(x, y) { return y * this.W + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  cellType(x, y) { return this.inside(x, y) ? this.type[y * this.W + x] : WALL; }
  isWallType(x, y) { const t = this.cellType(x, y); return t === WALL || t === PUSH || t === EXIT; }
  door(x, y) { return this.doors.get(y * this.W + x); }

  // Une cellule bloque-t-elle le déplacement au point (px,py) ?
  blocksAt(px, py, forEnemy = false) {
    const x = Math.floor(px), y = Math.floor(py);
    if (!this.inside(x, y)) return true;
    const i = y * this.W + x, t = this.type[i];
    if (t === EMPTY) return this.solidDecor[i] === 1;
    if (t === DOOR) return this.doors.get(i).open < 0.9;
    if (t === MOVING) {
      const mv = this.moving;
      return px > mv.x && px < mv.x + 1 && py > mv.y && py < mv.y + 1;
    }
    return true;
  }

  // Test de collision d'un cercle de rayon r.
  collides(px, py, r, forEnemy) {
    return this.blocksAt(px - r, py - r, forEnemy) || this.blocksAt(px + r, py - r, forEnemy) ||
      this.blocksAt(px - r, py + r, forEnemy) || this.blocksAt(px + r, py + r, forEnemy);
  }

  // Bloque la vue / les tirs ?
  opaque(x, y) {
    if (!this.inside(x, y)) return true;
    const i = y * this.W + x, t = this.type[i];
    if (t === EMPTY) return false;
    if (t === DOOR) return this.doors.get(i).open < 0.6;
    if (t === MOVING) return true;
    return true;
  }

  // Parcours DDA : renvoie la distance jusqu'au premier obstacle opaque.
  rayDist(x0, y0, dx, dy, maxD = 64) {
    let mx = Math.floor(x0), my = Math.floor(y0);
    const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let tx = (dx < 0 ? x0 - mx : mx + 1 - x0) * ddx;
    let ty = (dy < 0 ? y0 - my : my + 1 - y0) * ddy;
    let t = 0;
    while (t < maxD) {
      if (tx < ty) { t = tx; tx += ddx; mx += sx; } else { t = ty; ty += ddy; my += sy; }
      if (this.opaque(mx, my)) return t;
    }
    return maxD;
  }

  lineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 0.01) return true;
    return this.rayDist(x0, y0, dx / d, dy / d, d + 0.01) >= d - 0.05;
  }

  update(dt, actorsInCell) {
    for (const [i, d] of this.doors) {
      if (d.state === 1) { d.open = Math.min(1, d.open + dt * 2.2); if (d.open >= 1) { d.state = 2; d.timer = 4; } }
      else if (d.state === 2) {
        d.timer -= dt;
        if (d.timer <= 0) {
          if (actorsInCell(d.x, d.y)) d.timer = 0.5;
          else { d.state = 3; this.onDoorSound && this.onDoorSound(d); }
        }
      } else if (d.state === 3) {
        if (actorsInCell(d.x, d.y)) { d.state = 1; }
        else { d.open = Math.max(0, d.open - dt * 2.2); if (d.open <= 0) d.state = 0; }
      }
    }
    const mv = this.moving;
    if (mv) {
      const step = Math.min(mv.left, dt * 1.25);
      mv.x += mv.dx * step; mv.y += mv.dy * step; mv.left -= step;
      if (mv.left <= 0) {
        for (const c of mv.cells) { this.type[c] = EMPTY; }
        const fx = Math.round(mv.x), fy = Math.round(mv.y), fi = fy * this.W + fx;
        this.type[fi] = WALL; this.tex[fi] = mv.tex;
        this.moving = null;
      }
    }
  }

  openDoor(d) {
    if (d.state === 0 || d.state === 3) { d.state = 1; return true; }
    if (d.state === 2) d.timer = 4;
    return false;
  }

  // Lance la translation d'un mur secret ; renvoie vrai si ça a marché.
  push(x, y, dx, dy) {
    if (this.moving) return false;
    let n = 0;
    while (n < 2 && this.cellType(x + dx * (n + 1), y + dy * (n + 1)) === EMPTY && !this.solidDecor[this.idx(x + dx * (n + 1), y + dy * (n + 1))]) n++;
    if (!n) return false;
    const i = this.idx(x, y);
    const cells = [i];
    for (let k = 1; k <= n; k++) cells.push(this.idx(x + dx * k, y + dy * k));
    for (const c of cells) this.type[c] = MOVING;
    this.moving = { x, y, dx, dy, left: n, tex: this.tex[i], cells };
    return true;
  }

  passable(i) {
    const t = this.type[i];
    if (t === EMPTY) return !this.solidDecor[i];
    if (t === DOOR) { const d = this.doors.get(i); return !d.lock || d.open > 0.5; }
    return false;
  }

  // Champ de distances (BFS) depuis la cellule du joueur, pour la poursuite.
  updateFlow(px, py, dt) {
    const cell = this.idx(Math.floor(px), Math.floor(py));
    this.flowTimer -= dt;
    if (cell === this.flowCell && this.flowTimer > 0) return;
    this.flowCell = cell; this.flowTimer = 0.35;
    const f = this.flow; f.fill(-1);
    const q = new Int32Array(this.W * this.H); let h = 0, t = 0;
    f[cell] = 0; q[t++] = cell;
    while (h < t) {
      const c = q[h++], cx = c % this.W, cy = (c / this.W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inside(nx, ny)) continue;
        const n = ny * this.W + nx;
        if (f[n] !== -1 || !this.passable(n)) continue;
        f[n] = f[c] + 1; q[t++] = n;
      }
    }
  }

  // Propagation du bruit : cellules atteignables par l'air libre jusqu'à `range`.
  soundCells(px, py, range) {
    const start = this.idx(Math.floor(px), Math.floor(py));
    const dist = new Map([[start, 0]]); const q = [start];
    while (q.length) {
      const c = q.shift(), d = dist.get(c);
      if (d >= range) continue;
      const cx = c % this.W, cy = (c / this.W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inside(nx, ny)) continue;
        const n = ny * this.W + nx, t = this.type[n];
        if (dist.has(n)) continue;
        if (t === DOOR ? this.doors.get(n).open < 0.3 : t !== EMPTY) continue;
        dist.set(n, d + 1); q.push(n);
      }
    }
    return dist;
  }
}
