// Moteur de raycasting logiciel : murs, portes, sol, plafond, sprites.
// Éclairage : lumière ambiante + lampe torche (cône centré sur l'écran,
// atténuée avec la distance) ; brouillard selon la distance ; pixels émissifs
// modulés par un facteur de scintillement.
import { EMPTY, DOOR, MOVING } from './world.js';

const CONE_SIZE = 4096;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fov = 66;
    this.brightness = 1; // réglage de luminosité des options
    // Profil du cône de la lampe : 0..256 selon r² (r = distance au centre / rayon).
    this.cone = new Int32Array(CONE_SIZE);
    for (let i = 0; i < CONE_SIZE; i++) {
      const r = Math.sqrt(i / 1024);
      let v = r < 1 ? Math.pow(1 - r * r, 0.9) * 0.88 + 0.12 : r < 1.7 ? 0.12 * (1 - (r - 1) / 0.7) : 0;
      this.cone[i] = (v * 256) | 0;
    }
    this.resize(320, 180);
  }

  resize(w, h) {
    w = Math.max(160, w | 0); h = Math.max(90, h | 0);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(w);
    this.rowDist = new Float32Array(h);
    this.rowBase = new Int32Array(h);
    this.rowFlash = new Int32Array(h);
    this.rowFog = new Int32Array(h * 3);
    this.colTerm = new Int32Array(w);
    this.rowTerm = new Int32Array(h);
  }

  // Lumière pour une distance d : visibilité (brouillard), part ambiante et part lampe.
  light(d, out) {
    let vis = 1 - d / this.fogDist;
    vis = vis <= 0 ? 0 : Math.pow(vis, 1.25);
    const att = 1 / (1 + 0.07 * d * d);
    out[0] = (this.ambient * vis * 256) | 0;
    out[1] = (this.flash * att * vis * 256) | 0;
    const f = 256 - ((vis * 256) | 0);
    out[2] = this.fogR * f; out[3] = this.fogG * f; out[4] = this.fogB * f;
    out[5] = (this.emissive * (vis < 0.35 ? 0.35 : vis) * 256) | 0;
  }

  render(game) {
    const { w, h, buf, zbuf } = this;
    const world = game.world, p = game.player, T = game.texList;
    const W = world.W, type = world.type, texOf = world.tex, explored = world.explored;
    const k = Math.tan((this.fov * Math.PI) / 360);
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    const planeX = -dirY * k, planeY = dirX * k;
    const proj = w / (2 * k);
    // Visée verticale par cisaillement : l'horizon monte ou descend avec p.pitch.
    const horizon = (h >> 1) + ((p.bobY + (p.pitch || 0)) * h) | 0;
    const px = p.x, py = p.y;
    const L = game.lighting();
    this.fogR = L.fog[0]; this.fogG = L.fog[1]; this.fogB = L.fog[2];
    this.fogDist = L.fogDist; this.ambient = L.ambient * this.brightness; this.flash = L.flash * this.brightness; this.emissive = L.emissive;
    const lt = [0, 0, 0, 0, 0, 0];
    const floorT = T[game.floorTex], ceilT = T[game.ceilTex];
    const doorSide = T[game.doorSideTex];
    const mv = world.moving;
    const cone = this.cone, CT = this.colTerm, RT = this.rowTerm;

    // Termes du cône (r² × 1024) par colonne et par ligne, centrés sur le viseur.
    const R = h * 0.62, R2 = 1024 / (R * R), cx = w / 2;
    for (let x = 0; x < w; x++) { const v = ((x - cx) * (x - cx) * R2) | 0; CT[x] = v > 2047 ? 2047 : v; }
    // le faisceau de la lampe reste centré sur le viseur (milieu de l'écran)
    const cy = h >> 1;
    for (let y = 0; y < h; y++) { const v = ((y - cy) * (y - cy) * R2) | 0; RT[y] = v > 2047 ? 2047 : v; }

    // Pré-calcul par ligne pour le sol et le plafond.
    const RD = this.rowDist, RB = this.rowBase, RF = this.rowFlash, RG = this.rowFog;
    for (let y = 0; y < h; y++) {
      const d = (0.5 * proj) / (Math.abs(y - horizon) + 0.5);
      RD[y] = d;
      this.light(d, lt);
      RB[y] = lt[0]; RF[y] = lt[1]; RG[y * 3] = lt[2]; RG[y * 3 + 1] = lt[3]; RG[y * 3 + 2] = lt[4];
    }
    const eFloor = (this.emissive * 0.8 * 256) | 0;

    for (let x = 0; x < w; x++) {
      const camX = (2 * x) / w - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mapX = px | 0, mapY = py | 0;
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const stepX = rdx < 0 ? -1 : 1, stepY = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? px - mapX : mapX + 1 - px) * ddx;
      let sdy = (rdy < 0 ? py - mapY : mapY + 1 - py) * ddy;
      let side = 0, perp = 0, u = 0, tex = null, tEnter = 0, prevDoor = null, guard = 0;
      explored[mapY * W + mapX] = 1;

      while (guard++ < 256) {
        if (sdx < sdy) { tEnter = sdx; sdx += ddx; mapX += stepX; side = 0; }
        else { tEnter = sdy; sdy += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= W || mapY >= world.H) { perp = tEnter; tex = T[1]; break; }
        const ci = mapY * W + mapX, t = type[ci];
        explored[ci] = 1;
        if (t === EMPTY) { prevDoor = null; continue; }
        const tExit = sdx < sdy ? sdx : sdy;
        if (t === DOOR) {
          const d = world.doors.get(ci);
          let tp, hu;
          if (d.ns) { tp = (mapY + 0.5 - py) / rdy; hu = px + tp * rdx - mapX; }
          else { tp = (mapX + 0.5 - px) / rdx; hu = py + tp * rdy - mapY; }
          if (tp >= tEnter && tp <= tExit && hu >= d.open && hu <= 1) {
            perp = tp; u = hu - d.open; side = d.ns ? 1 : 0; tex = T[texOf[ci]];
            break;
          }
          prevDoor = d; continue;
        }
        if (t === MOVING) {
          // intersection rayon / boîte du mur en mouvement
          const ix = 1 / rdx, iy = 1 / rdy;
          const t1 = (mv.x - px) * ix, t2 = (mv.x + 1 - px) * ix;
          const t3 = (mv.y - py) * iy, t4 = (mv.y + 1 - py) * iy;
          const tminX = Math.min(t1, t2), tmaxX = Math.max(t1, t2);
          const tminY = Math.min(t3, t4), tmaxY = Math.max(t3, t4);
          const tmin = Math.max(tminX, tminY), tmax = Math.min(tmaxX, tmaxY);
          if (tmax >= tmin && tmin >= tEnter - 1e-6 && tmin <= tExit + 1e-6) {
            perp = tmin;
            if (tminX > tminY) { side = 0; u = py + tmin * rdy - mv.y; }
            else { side = 1; u = px + tmin * rdx - mv.x; }
            tex = T[mv.tex];
            break;
          }
          prevDoor = null; continue;
        }
        perp = tEnter;
        u = side === 0 ? py + perp * rdy : px + perp * rdx;
        u -= Math.floor(u);
        tex = prevDoor && (prevDoor.ns ? side === 0 : side === 1) ? doorSide : T[texOf[ci]];
        break;
      }
      if (perp < 0.01) perp = 0.01;
      zbuf[x] = perp;

      let texX = (u * 64) | 0;
      if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) texX = 63 - texX;
      texX &= 63;

      const lineH = proj / perp;
      const y0 = Math.floor(horizon - lineH / 2), y1 = Math.floor(horizon + lineH / 2);
      const step = 64 / lineH;
      let texPos = (Math.max(0, y0) - (horizon - lineH / 2)) * step;
      const ys = y0 < 0 ? 0 : y0, ye = y1 > h ? h : y1;
      this.light(perp, lt);
      let base = lt[0], fl = lt[1];
      if (side === 1) { base = (base * 0.8) | 0; fl = (fl * 0.85) | 0; }
      const fr = lt[2], fg = lt[3], fb = lt[4], eg = lt[5];
      const ctx_ = CT[x];
      let o = ys * w + x;
      for (let y = ys; y < ye; y++) {
        const c = tex[((texPos & 63) << 6) | texX];
        texPos += step;
        if (c >>> 24 === 254) {
          buf[o] = 0xff000000 | ((((c >> 16) & 255) * eg) >> 8) << 16 | ((((c >> 8) & 255) * eg) >> 8) << 8 | (((c & 255) * eg) >> 8);
        } else {
          let s = base + ((fl * cone[ctx_ + RT[y]]) >> 8); if (s > 256) s = 256;
          buf[o] = 0xff000000 | ((((c >> 16) & 255) * s + fb) >> 8) << 16 | ((((c >> 8) & 255) * s + fg) >> 8) << 8 | (((c & 255) * s + fr) >> 8);
        }
        o += w;
      }

      // Sol puis plafond (même calcul, ligne par ligne)
      for (let pass = 0; pass < 2; pass++) {
        const from = pass ? 0 : (ye > horizon ? ye : horizon + 1);
        const to = pass ? (ys < horizon ? ys : horizon) : h;
        const T2 = pass ? ceilT : floorT;
        for (let y = from; y < to; y++) {
          const d = RD[y];
          const fx = px + d * rdx, fy = py + d * rdy;
          const c = T2[(((fy * 64) & 63) << 6) | ((fx * 64) & 63)];
          const oo = y * w + x;
          if (c >>> 24 === 254) {
            buf[oo] = 0xff000000 | ((((c >> 16) & 255) * eFloor) >> 8) << 16 | ((((c >> 8) & 255) * eFloor) >> 8) << 8 | (((c & 255) * eFloor) >> 8);
            continue;
          }
          let s = RB[y] + ((RF[y] * cone[ctx_ + RT[y]]) >> 8); if (s > 256) s = 256;
          const r3 = y * 3;
          buf[oo] = 0xff000000 | ((((c >> 16) & 255) * s + RG[r3 + 2]) >> 8) << 16 | ((((c >> 8) & 255) * s + RG[r3 + 1]) >> 8) << 8 | (((c & 255) * s + RG[r3]) >> 8);
        }
      }
    }

    this.drawSprites(game, dirX, dirY, planeX, planeY, proj, horizon, lt);
    this.ctx.putImageData(this.img, 0, 0);
  }

  drawSprites(game, dirX, dirY, planeX, planeY, proj, horizon, lt) {
    const { w, h, buf, zbuf } = this;
    const p = game.player;
    const cone = this.cone, CT = this.colTerm, RT = this.rowTerm;
    const list = game.collectSprites();
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const s of list) {
      const rx = s.x - p.x, ry = s.y - p.y;
      s.tx = invDet * (dirY * rx - dirX * ry);
      s.ty = invDet * (-planeY * rx + planeX * ry);
    }
    list.sort((a, b) => b.ty - a.ty);
    for (const s of list) {
      const depth = s.ty;
      if (depth < 0.15) continue;
      const spr = s.spr, sw = spr.w, shh = spr.h, data = spr.data;
      const scale = s.scale || 1;
      const sx = (w / 2) * (1 + s.tx / depth);
      const size = (proj / depth) * scale;
      const bottom = horizon + (0.5 * proj) / depth - (s.z || 0) * (proj / depth);
      const top = bottom - size;
      const left = sx - size / 2;
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(w, Math.ceil(left + size));
      if (x0 >= x1) continue;
      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(h, Math.ceil(bottom));
      if (y0 >= y1) continue;
      this.light(depth, lt);
      let base = lt[0], fl = lt[1];
      if (s.hurt) { base = 256; fl = 0; }
      const fr = lt[2], fg = lt[3], fb = lt[4], eg = lt[5];
      const tint = s.tint || 0, ghost = s.ghost || 0;
      const stepU = sw / size, stepV = shh / size;
      for (let x = x0; x < x1; x++) {
        if (zbuf[x] < depth) continue;
        const tu = ((x - left) * stepU) | 0;
        if (tu < 0 || tu >= sw) continue;
        const cxv = CT[x];
        let v = (y0 - top) * stepV;
        let o = y0 * w + x;
        for (let y = y0; y < y1; y++, o += w, v += stepV) {
          const c = data[(v | 0) * sw + tu];
          const a = c >>> 24;
          if (a === 0) continue;
          let out;
          if (a === 254 || s.bright) {
            out = s.bright ? c | 0xff000000 : 0xff000000 | ((((c >> 16) & 255) * eg) >> 8) << 16 | ((((c >> 8) & 255) * eg) >> 8) << 8 | (((c & 255) * eg) >> 8);
          } else {
            let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
            if (tint) { r = Math.min(255, r + 120); g = g >> 1; b = b >> 1; }
            let ss = base + ((fl * cone[cxv + RT[y]]) >> 8); if (ss > 256) ss = 256;
            out = 0xff000000 | ((b * ss + fb) >> 8) << 16 | ((g * ss + fg) >> 8) << 8 | ((r * ss + fr) >> 8);
          }
          if (ghost) {
            // Fantômes : ~1/3 d'opacité par-dessus le décor.
            const bg = buf[o];
            buf[o] = 0xff000000 | (((((bg >> 16) & 255) * 11 + ((out >> 16) & 255) * 5) >> 4) << 16) |
              (((((bg >> 8) & 255) * 11 + ((out >> 8) & 255) * 5) >> 4) << 8) | ((((bg & 255) * 11 + (out & 255) * 5) >> 4));
          } else buf[o] = out;
        }
      }
    }
  }
}
