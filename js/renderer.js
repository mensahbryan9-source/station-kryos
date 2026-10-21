// Moteur de raycasting logiciel : murs, portes, sol, plafond, sprites.
import { EMPTY, DOOR, MOVING } from './world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fov = 66;
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
    this.rowDist = new Float32Array(h * 2);
  }

  // Calcule l'ombrage pour une distance : renvoie [s, fogR, fogG, fogB] pré-multipliés.
  shade(d, out) {
    let s = 1 - d / this.fogDist;
    s = s < 0 ? 0 : s;
    s = (s * s * 0.85 + s * 0.15) * this.light;
    let si = (s * 256) | 0; if (si > 256) si = 256;
    const f = 256 - si;
    out[0] = si; out[1] = this.fogR * f; out[2] = this.fogG * f; out[3] = this.fogB * f;
  }

  render(game) {
    const { w, h, buf, zbuf } = this;
    const world = game.world, p = game.player, T = game.texList;
    const W = world.W, type = world.type, texOf = world.tex, explored = world.explored;
    const k = Math.tan((this.fov * Math.PI) / 360);
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    const planeX = -dirY * k, planeY = dirX * k;
    const proj = w / (2 * k);
    const horizon = (h >> 1) + (p.bobY * h) | 0;
    const px = p.x, py = p.y;
    const fog = game.level.fog;
    this.fogR = fog[0]; this.fogG = fog[1]; this.fogB = fog[2];
    this.fogDist = 11 * (1 + game.flash * 0.6);
    this.light = game.level.light * (1 + game.flash * 0.35);
    const sh = [0, 0, 0, 0];
    const floorT = T[game.floorTex], ceilT = T[game.ceilTex];
    const doorSide = T[game.doorSideTex];
    const mv = world.moving;

    // Pré-calcul par ligne pour le sol et le plafond.
    const rowS = this.rowS || (this.rowS = new Int32Array(h * 4 * 2));
    if (rowS.length < h * 4) this.rowS = new Int32Array(h * 4);
    const RS = this.rowS, RD = this.rowDist;
    for (let y = 0; y < h; y++) {
      const dy = Math.abs(y - horizon) + 0.5;
      const d = (0.5 * proj) / dy;
      RD[y] = d;
      this.shade(d, sh);
      RS[y * 4] = sh[0]; RS[y * 4 + 1] = sh[1]; RS[y * 4 + 2] = sh[2]; RS[y * 4 + 3] = sh[3];
    }

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
          let t1 = (mv.x - px) * ix, t2 = (mv.x + 1 - px) * ix;
          let t3 = (mv.y - py) * iy, t4 = (mv.y + 1 - py) * iy;
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
      let y0 = Math.floor(horizon - lineH / 2), y1 = Math.floor(horizon + lineH / 2);
      const step = 64 / lineH;
      let texPos = (Math.max(0, y0) - (horizon - lineH / 2)) * step;
      const ys = y0 < 0 ? 0 : y0, ye = y1 > h ? h : y1;
      this.shade(perp, sh);
      let s = sh[0]; if (side === 1) s = (s * 0.8) | 0;
      const fr = this.fogR * (256 - s), fg = this.fogG * (256 - s), fb = this.fogB * (256 - s);
      let o = ys * w + x;
      for (let y = ys; y < ye; y++) {
        const c = tex[((texPos & 63) << 6) | texX];
        texPos += step;
        if (c >>> 24 === 254) buf[o] = c | 0xff000000;
        else buf[o] = 0xff000000 | ((((c >> 16) & 255) * s + fb) >> 8) << 16 | ((((c >> 8) & 255) * s + fg) >> 8) << 8 | (((c & 255) * s + fr) >> 8);
        o += w;
      }

      // Sol
      for (let y = ye > horizon ? ye : horizon + 1; y < h; y++) {
        const d = RD[y];
        const fx = px + d * rdx, fy = py + d * rdy;
        const c = floorT[(((fy * 64) & 63) << 6) | ((fx * 64) & 63)];
        const r4 = y * 4, ss = RS[r4];
        const oo = y * w + x;
        if (c >>> 24 === 254) buf[oo] = c | 0xff000000;
        else buf[oo] = 0xff000000 | ((((c >> 16) & 255) * ss + RS[r4 + 3]) >> 8) << 16 | ((((c >> 8) & 255) * ss + RS[r4 + 2]) >> 8) << 8 | (((c & 255) * ss + RS[r4 + 1]) >> 8);
      }
      // Plafond
      const ce = ys < horizon ? ys : horizon;
      for (let y = 0; y < ce; y++) {
        const d = RD[y];
        const fx = px + d * rdx, fy = py + d * rdy;
        const c = ceilT[(((fy * 64) & 63) << 6) | ((fx * 64) & 63)];
        const r4 = y * 4, ss = RS[r4];
        const oo = y * w + x;
        if (c >>> 24 === 254) buf[oo] = c | 0xff000000;
        else buf[oo] = 0xff000000 | ((((c >> 16) & 255) * ss + RS[r4 + 3]) >> 8) << 16 | ((((c >> 8) & 255) * ss + RS[r4 + 2]) >> 8) << 8 | (((c & 255) * ss + RS[r4 + 1]) >> 8);
      }
    }

    this.drawSprites(game, dirX, dirY, planeX, planeY, proj, horizon, sh);
    this.ctx.putImageData(this.img, 0, 0);
  }

  drawSprites(game, dirX, dirY, planeX, planeY, proj, horizon, sh) {
    const { w, h, buf, zbuf } = this;
    const p = game.player;
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
      this.shade(depth, sh);
      let ss = sh[0];
      if (s.hurt) ss = 256;
      const fr = sh[1], fg = sh[2], fb = sh[3];
      const tint = s.tint || 0;
      const stepU = sw / size, stepV = shh / size;
      for (let x = x0; x < x1; x++) {
        if (zbuf[x] < depth) continue;
        const tu = ((x - left) * stepU) | 0;
        if (tu < 0 || tu >= sw) continue;
        let v = (y0 - top) * stepV;
        let o = y0 * w + x;
        for (let y = y0; y < y1; y++, o += w, v += stepV) {
          const c = data[(v | 0) * sw + tu];
          const a = c >>> 24;
          if (a === 0) continue;
          if (a === 254 || s.bright) { buf[o] = c | 0xff000000; continue; }
          let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
          if (tint) { r = Math.min(255, r + 120); g = g >> 1; b = b >> 1; }
          buf[o] = 0xff000000 | ((b * ss + fb) >> 8) << 16 | ((g * ss + fg) >> 8) << 8 | ((r * ss + fr) >> 8);
        }
      }
    }
  }
}
