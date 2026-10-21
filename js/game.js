// Logique de jeu : joueur, armes, ennemis, projectiles, objets, effets.
import { World, DOOR, PUSH, EXIT, EMPTY } from './world.js';
import { audio } from './audio.js';

export const WEAPONS = [
  { id: 'blade', name: 'Lame à arc', ammo: null, dmg: [28, 42], rate: 0.42, melee: true, auto: true, sound: 'blade', key: '1' },
  { id: 'pistol', name: 'Pistolet à impulsion', ammo: 'cells', cost: 1, dmg: [14, 22], rate: 0.3, spread: 0.012, sound: 'pistol', key: '2' },
  { id: 'rifle', name: 'Fusil plasma', ammo: 'cells', cost: 1, dmg: [12, 19], rate: 0.095, spread: 0.035, auto: true, sound: 'rifle', key: '3' },
  { id: 'scatter', name: 'Fusil à dispersion', ammo: 'shells', cost: 1, dmg: [9, 15], pellets: 8, rate: 0.72, spread: 0.12, sound: 'scatter', key: '4' },
  { id: 'arc', name: 'Canon à arc', ammo: 'cells', cost: 5, dmg: [95, 130], rate: 0.85, pierce: true, sound: 'arc', key: '5' },
];
export const MAX_AMMO = { cells: 200, shells: 50 };

const ENEMY = {
  g: { name: 'Drone', hp: 30, speed: 1.7, r: 0.3, sight: 14, range: 12, cd: [1.7, 2.8], points: 100, pain: 0.7, kind: 'proj', proj: 'plasma', pdmg: [6, 11], pspeed: 5.5 },
  s: { name: 'Sentinelle', hp: 55, speed: 1.35, r: 0.3, sight: 16, range: 13, cd: [1.5, 2.5], points: 200, pain: 0.5, kind: 'hitscan', dmg: [4, 9], shots: 2, drop: 'a' },
  m: { name: 'Broyeur', hp: 150, speed: 2.7, r: 0.38, sight: 12, range: 1.15, cd: [0.8, 1.1], points: 400, pain: 0.25, kind: 'melee', dmg: [14, 24] },
  O: { name: "L'Archonte", hp: 2000, speed: 1.05, r: 0.75, sight: 30, range: 22, cd: [1.4, 2.2], points: 5000, pain: 0.04, kind: 'boss', proj: 'orb', pdmg: [14, 22], pspeed: 5.2, scale: 1.9 },
};
export const DIFFICULTY = [
  { name: 'Recrue', dmg: 0.5, hp: 0.8, cd: 1.3 },
  { name: 'Vétéran', dmg: 1, hp: 1, cd: 1 },
  { name: 'Cauchemar', dmg: 1.45, hp: 1.25, cd: 0.8 },
];

const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function newPlayerState(loadout) {
  return {
    health: loadout.health, armor: loadout.armor,
    cells: loadout.cells, shells: loadout.shells,
    weapons: [...loadout.weapons], cur: loadout.weapons[loadout.weapons.length - 1],
    score: 0,
  };
}

export class Game {
  constructor({ level, levelIndex, assets, inventory, difficulty, ui }) {
    this.level = level; this.levelIndex = levelIndex;
    this.assets = assets; this.ui = ui;
    this.diff = DIFFICULTY[difficulty];
    this.texList = assets.texList;
    const ti = assets.texIndex;
    this.floorTex = ti[level.floor]; this.ceilTex = ti[level.ceiling]; this.doorSideTex = ti.doorSide;
    const world = (this.world = new World(level, ti));
    world.onDoorSound = (d) => audio.play('door', { x: d.x + 0.5, y: d.y + 0.5 }, 0.7);
    this.flash = 0;
    this.time = 0;
    this.over = false;
    const inv = JSON.parse(JSON.stringify(inventory));
    this.player = {
      x: world.start.x, y: world.start.y, a: level.angle || 0,
      ...inv, keys: { blue: false, red: false },
      cooldown: 0, fireAnim: 0, switchAnim: 0, bob: 0, bobY: 0, moving: 0, dead: false, deadT: 0, stepAcc: 0,
      hurtDir: 0,
    };
    this.enemies = []; this.items = []; this.decor = []; this.projectiles = []; this.effects = [];
    this.stats = { kills: 0, totalKills: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: world.totalSecrets };
    for (const s of world.spawns) {
      const c = s.ch;
      if (ENEMY[c]) {
        const d = ENEMY[c];
        this.enemies.push({
          t: c, d, x: s.x, y: s.y, a: Math.random() * 6.28, hp: d.hp * this.diff.hp,
          state: 'idle', timer: 0, anim: 0, cd: rnd(0.4, 1.2), react: 0, summon: 10, moved: 0,
          spr: assets.sprites.enemy[c],
        });
        this.stats.totalKills++;
      } else if ('hHrackKtwWZ'.includes(c)) {
        this.items.push({ t: c, x: s.x, y: s.y, spr: assets.sprites.item[c] });
        if (c === 't') this.stats.totalItems++;
      } else if (assets.sprites.decor[c]) {
        this.decor.push({ t: c, x: s.x, y: s.y, spr: assets.sprites.decor[c], hp: c === 'o' ? 20 : Infinity });
      }
    }
    this.boss = this.enemies.find((e) => e.t === 'O');
  }

  get weapon() { return WEAPONS[this.player.cur]; }

  inventory() {
    const p = this.player;
    return { health: p.health, armor: p.armor, cells: p.cells, shells: p.shells, weapons: [...p.weapons], cur: p.cur, score: p.score };
  }

  // ——— Boucle de mise à jour ———
  update(dt, input) {
    if (this.over) return;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    const p = this.player;
    if (!p.dead) this.updatePlayer(dt, input);
    else {
      p.deadT += dt; p.bobY = Math.min(0.35, p.deadT * 0.3);
      if (p.deadT > 2.2 && !this.over) { this.over = true; this.ui.died(); }
    }
    this.world.update(dt, (x, y) => this.actorInCell(x, y));
    this.world.updateFlow(p.x, p.y, dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.separateEnemies();
    this.updateProjectiles(dt);
    for (const f of this.effects) f.t += dt;
    this.effects = this.effects.filter((f) => f.t < f.life);
    audio.listener = { x: p.x, y: p.y, a: p.a };
  }

  actorInCell(x, y) {
    const inCell = (o) => Math.floor(o.x) === x && Math.floor(o.y) === y;
    if (inCell(this.player)) return true;
    // évite de refermer une porte sur un acteur à cheval sur la cellule
    const p = this.player;
    if (Math.abs(p.x - (x + 0.5)) < 0.85 && Math.abs(p.y - (y + 0.5)) < 0.85) return true;
    return this.enemies.some((e) => e.state !== 'dead' && e.state !== 'dying' && Math.abs(e.x - (x + 0.5)) < 0.5 + e.d.r && Math.abs(e.y - (y + 0.5)) < 0.5 + e.d.r);
  }

  updatePlayer(dt, input) {
    const p = this.player, w = this.world;
    p.a += input.turn;
    const speed = 3.3 * (input.run ? 1.45 : 1);
    const cos = Math.cos(p.a), sin = Math.sin(p.a);
    let mx = (cos * input.forward - sin * input.strafe) * speed * dt;
    let my = (sin * input.forward + cos * input.strafe) * speed * dt;
    const len = Math.hypot(mx, my), maxLen = speed * dt;
    if (len > maxLen) { mx *= maxLen / len; my *= maxLen / len; }
    const r = 0.24;
    const ox = p.x, oy = p.y;
    if (!w.collides(p.x + mx, p.y, r) && !this.decorBlocks(p.x + mx, p.y, r)) p.x += mx;
    if (!w.collides(p.x, p.y + my, r) && !this.decorBlocks(p.x, p.y + my, r)) p.y += my;
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.moving = moved / dt / speed;
    p.bob += moved * 3.2;
    p.bobY = Math.sin(p.bob * 2) * 0.006 * Math.min(1, p.moving);
    p.stepAcc += moved;
    if (p.stepAcc > 1.1) { p.stepAcc = 0; audio.play('step', null, 0.6); }

    p.cooldown -= dt; p.fireAnim = Math.max(0, p.fireAnim - dt); p.switchAnim = Math.max(0, p.switchAnim - dt);
    if (input.weapon != null) this.selectWeapon(input.weapon);
    if (input.nextWeapon) this.cycleWeapon(input.nextWeapon);
    if (input.use) this.use();
    const wpn = this.weapon;
    if (input.fire && p.cooldown <= 0 && p.switchAnim <= 0 && (input.firePressed || wpn.auto)) this.fire();
    this.pickups();
  }

  decorBlocks(x, y, r) {
    for (const d of this.decor) {
      if (!this.world.solidDecor[this.world.idx(Math.floor(d.x), Math.floor(d.y))]) continue;
      if (Math.abs(d.x - x) < 0.3 + r && Math.abs(d.y - y) < 0.3 + r) return true;
    }
    return false;
  }

  selectWeapon(i) {
    const p = this.player;
    if (!p.weapons.includes(i) || p.cur === i) return;
    p.cur = i; p.switchAnim = 0.25; audio.play('switchW');
  }
  cycleWeapon(dir) {
    const p = this.player, list = [...p.weapons].sort((a, b) => a - b);
    const k = list.indexOf(p.cur);
    this.selectWeapon(list[(k + dir + list.length) % list.length]);
  }

  hasAmmo(wp) { return !wp.ammo || this.player[wp.ammo] >= wp.cost; }

  fire() {
    const p = this.player, wp = this.weapon;
    if (!this.hasAmmo(wp)) {
      audio.play('dry'); p.cooldown = 0.35;
      // bascule automatique vers la meilleure arme disponible
      const best = [...p.weapons].sort((a, b) => b - a).find((i) => this.hasAmmo(WEAPONS[i]));
      if (best != null) this.selectWeapon(best);
      return;
    }
    if (wp.ammo) p[wp.ammo] -= wp.cost;
    p.cooldown = wp.rate; p.fireAnim = Math.min(0.12, wp.rate * 0.8);
    audio.play(wp.sound, null, 0.9);
    if (wp.melee) { this.melee(wp); return; }
    this.flash = wp.id === 'arc' ? 1 : 0.6;
    this.alertBySound(wp.id === 'arc' || wp.id === 'scatter' ? 20 : 15);
    const n = wp.pellets || 1;
    for (let i = 0; i < n; i++) this.hitscan(p.a + (Math.random() - 0.5) * 2 * (wp.spread || 0), wp);
  }

  melee(wp) {
    const p = this.player;
    let best = null, bd = 1.35;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'dying') continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) - e.d.r;
      if (d < bd && Math.abs(angDiff(Math.atan2(dy, dx), p.a)) < 0.5) { best = e; bd = d; }
    }
    if (best) { this.damageEnemy(best, rnd(...wp.dmg) * (best.state === 'idle' ? 3 : 1)); audio.play('hit', best); }
    else this.alertBySound(3);
  }

  // Tir instantané : touche le premier ennemi (ou tous avec `pierce`) avant le mur.
  hitscan(a, wp) {
    const p = this.player, dx = Math.cos(a), dy = Math.sin(a);
    const wallD = this.world.rayDist(p.x, p.y, dx, dy, 40);
    const hits = [];
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'dying') continue;
      const rx = e.x - p.x, ry = e.y - p.y, along = rx * dx + ry * dy;
      if (along <= 0 || along > wallD) continue;
      if (Math.abs(rx * dy - ry * dx) < e.d.r) hits.push({ e, along });
    }
    for (const d of this.decor) {
      if (d.t !== 'o' || d.hp <= 0) continue;
      const rx = d.x - p.x, ry = d.y - p.y, along = rx * dx + ry * dy;
      if (along <= 0 || along > wallD) continue;
      if (Math.abs(rx * dy - ry * dx) < 0.3) hits.push({ barrel: d, along });
    }
    hits.sort((u, v) => u.along - v.along);
    const targets = wp.pierce ? hits : hits.slice(0, 1);
    for (const h of targets) {
      const fall = h.along < 4 ? 1 : Math.max(0.45, 1 - (h.along - 4) / 18);
      const dmg = rnd(...wp.dmg) * (wp.pierce ? 1 : fall);
      if (h.e) this.damageEnemy(h.e, dmg);
      else this.damageBarrel(h.barrel, dmg);
    }
    if (wp.pierce) {
      for (let s = 0.6; s < wallD; s += 0.9) this.effect('arc0', p.x + dx * s, p.y + dy * s, 0.25, 0.4);
    }
    if (!targets.length || wp.pierce) {
      const d = wallD - 0.06;
      this.effect('puff', p.x + dx * d, p.y + dy * d, 0.3, 0.45);
    }
  }

  effect(kind, x, y, life, z = 0, scale = 1) {
    this.effects.push({ kind, x, y, t: 0, life, z, scale });
  }

  alertBySound(range) {
    const cells = this.world.soundCells(this.player.x, this.player.y, range);
    for (const e of this.enemies) {
      if (e.state !== 'idle') continue;
      if (cells.has(this.world.idx(Math.floor(e.x), Math.floor(e.y)))) this.alert(e);
    }
  }

  alert(e) {
    if (e.state !== 'idle') return;
    e.state = 'chase'; e.react = rnd(0.5, 1.1) * this.diff.cd;
    audio.play('alert_' + e.t, e);
    if (e.t === 'O') this.ui.message("L'ARCHONTE S'ÉVEILLE", 'boss');
  }

  damageEnemy(e, dmg) {
    if (e.state === 'dead' || e.state === 'dying') return;
    e.hp -= dmg;
    e.hurtT = 0.08;
    if (e.hp <= 0) {
      e.state = 'dying'; e.timer = 0;
      this.stats.kills++; this.player.score += e.d.points;
      audio.play('die_' + e.t, e);
      if (e.t === 'g') this.effect('boom', e.x, e.y, 0.5, 0.2);
      if (e.t === 'O') {
        for (let i = 0; i < 6; i++) setTimeout(() => this.effect('boom', e.x + rnd(-1, 1), e.y + rnd(-1, 1), 0.6, rnd(0, 0.8), 1.6), i * 180);
        this.world.tex[this.exitIndex()] = this.assets.texIndex.exitOn;
        this.ui.message("ARCHONTE DÉTRUIT — L'ARRÊT D'URGENCE EST DÉVERROUILLÉ", 'boss');
        // les drones invoqués s'effondrent avec leur maître
        for (const o of this.enemies) if (o.summoned && o.state !== 'dead' && o.state !== 'dying') { o.hp = 0; o.state = 'dying'; o.timer = 0; }
      }
      if (e.d.drop) this.items.push({ t: e.d.drop, x: e.x, y: e.y, spr: this.assets.sprites.item[e.d.drop], dropped: true });
      return;
    }
    if (e.state === 'idle') this.alert(e);
    if (e.state !== 'attack' && Math.random() < e.d.pain) {
      e.state = 'pain'; e.timer = 0.22;
      audio.play('pain_' + e.t, e);
    }
  }

  exitIndex() {
    const w = this.world;
    for (let i = 0; i < w.type.length; i++) if (w.type[i] === EXIT) return i;
    return 0;
  }

  damageBarrel(b, dmg) {
    if (b.hp <= 0) return;
    b.hp -= dmg;
    if (b.hp > 0) return;
    this.world.solidDecor[this.world.idx(Math.floor(b.x), Math.floor(b.y))] = 0;
    this.decor = this.decor.filter((d) => d !== b);
    audio.play('boom', b);
    this.effect('boom', b.x, b.y, 0.55, 0, 1.3);
    this.flash = 1;
    this.explode(b.x, b.y, 2.4, 110);
  }

  explode(x, y, radius, power) {
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius && this.world.lineOfSight(x, y, e.x, e.y)) this.damageEnemy(e, power * (1 - d / radius));
    }
    for (const b of [...this.decor]) {
      if (b.t !== 'o' || b.hp <= 0) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < radius && d > 0.01) setTimeout(() => this.damageBarrel(b, 50), 120);
    }
    const p = this.player, d = Math.hypot(p.x - x, p.y - y);
    if (d < radius && this.world.lineOfSight(x, y, p.x, p.y)) this.hurtPlayer(power * 0.6 * (1 - d / radius), x, y, true);
    this.alertBySound(12);
  }

  hurtPlayer(dmg, fx, fy, raw = false) {
    const p = this.player;
    if (p.dead) return;
    if (!raw) dmg *= this.diff.dmg;
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    p.health -= Math.round(dmg - absorbed);
    p.armor = Math.round(p.armor);
    this.ui.flash('hurt', Math.min(0.75, dmg / 30));
    if (fx != null) this.ui.hurtFrom(angDiff(Math.atan2(fy - p.y, fx - p.x), p.a));
    if (p.health <= 0) {
      p.health = 0; p.dead = true; audio.play('die');
    } else audio.play('hurt', null, 0.8);
  }

  use() {
    const p = this.player, w = this.world;
    const tx = Math.floor(p.x + Math.cos(p.a) * 0.9), ty = Math.floor(p.y + Math.sin(p.a) * 0.9);
    const t = w.cellType(tx, ty);
    if (t === DOOR) {
      const d = w.door(tx, ty);
      if (d.lock && !p.keys[d.lock]) {
        audio.play('locked');
        this.ui.message(d.lock === 'blue' ? 'Carte d\'accès BLEUE requise' : 'Carte d\'accès ROUGE requise', d.lock);
        return;
      }
      if (w.openDoor(d)) audio.play('door', { x: tx + 0.5, y: ty + 0.5 });
    } else if (t === PUSH) {
      const dx = Math.abs(Math.cos(p.a)) > Math.abs(Math.sin(p.a)) ? Math.sign(Math.cos(p.a)) : 0;
      const dy = dx ? 0 : Math.sign(Math.sin(p.a));
      if (w.push(tx, ty, dx, dy)) {
        this.stats.secrets++;
        audio.play('push', { x: tx + 0.5, y: ty + 0.5 }); audio.play('secret');
        this.ui.message('Passage secret découvert !', 'secret');
      }
    } else if (t === EXIT) {
      if (this.level.requireBoss && this.boss && this.boss.state !== 'dead' && this.boss.state !== 'dying') {
        audio.play('locked'); this.ui.message("Verrouillé par l'Archonte. Détruisez-le !", 'red');
        return;
      }
      w.tex[w.idx(tx, ty)] = this.assets.texIndex.exitOn;
      audio.play('exit');
      this.over = true;
      this.player.score += Math.max(0, 1000 - Math.floor(this.time) * 5);
      setTimeout(() => this.ui.levelComplete(this.results()), 700);
    } else {
      audio.play('dry', null, 0.4);
    }
  }

  results() {
    const s = this.stats;
    return {
      time: this.time,
      kills: s.totalKills ? Math.round((100 * s.kills) / s.totalKills) : 100,
      items: s.totalItems ? Math.round((100 * s.items) / s.totalItems) : 100,
      secrets: s.totalSecrets ? Math.round((100 * s.secrets) / s.totalSecrets) : 100,
      score: this.player.score,
    };
  }

  pickups() {
    const p = this.player;
    for (const it of this.items) {
      if (it.taken || Math.abs(it.x - p.x) > 0.55 || Math.abs(it.y - p.y) > 0.55) continue;
      if (this.take(it.t)) it.taken = true;
    }
    this.items = this.items.filter((i) => !i.taken);
  }

  take(t) {
    const p = this.player, ui = this.ui;
    const ammo = (kind, n, label) => {
      if (p[kind] >= MAX_AMMO[kind]) return false;
      p[kind] = Math.min(MAX_AMMO[kind], p[kind] + n); ui.message(label); audio.play('pickup'); ui.flash('pick'); return true;
    };
    const weapon = (i, kind, n) => {
      const had = p.weapons.includes(i);
      if (!had) { p.weapons.push(i); this.selectWeapon(i); }
      p[kind] = Math.min(MAX_AMMO[kind], p[kind] + n);
      ui.message(had ? `Munitions : ${WEAPONS[i].name}` : `Nouvelle arme : ${WEAPONS[i].name} [${WEAPONS[i].key}]`, 'weapon');
      audio.play('weapon'); ui.flash('pick'); return true;
    };
    switch (t) {
      case 'h': if (p.health >= 100) return false; p.health = Math.min(100, p.health + 15); ui.message('Trousse de soin +15'); audio.play('health'); ui.flash('pick'); return true;
      case 'H': if (p.health >= 100) return false; p.health = Math.min(100, p.health + 40); ui.message('Médikit +40'); audio.play('health'); ui.flash('pick'); return true;
      case 'r': if (p.armor >= 100) return false; p.armor = Math.min(100, p.armor + 50); ui.message('Plastron composite +50'); audio.play('armor'); ui.flash('pick'); return true;
      case 'a': return ammo('cells', 20, 'Cellules d\'énergie +20');
      case 'c': return ammo('shells', 8, 'Cartouches +8');
      case 'k': p.keys.blue = true; ui.message('Carte d\'accès BLEUE', 'blue'); audio.play('key'); ui.flash('pick'); return true;
      case 'K': p.keys.red = true; ui.message('Carte d\'accès ROUGE', 'red'); audio.play('key'); ui.flash('pick'); return true;
      case 't': p.score += 500; this.stats.items++; ui.message('Cristal de données +500'); audio.play('treasure'); ui.flash('pick'); return true;
      case 'w': return weapon(2, 'cells', 30);
      case 'W': return weapon(3, 'shells', 12);
      case 'Z': return weapon(4, 'cells', 40);
    }
    return false;
  }

  // ——— Ennemis ———
  updateEnemy(e, dt) {
    const p = this.player, w = this.world, d = e.d;
    e.hurtT = Math.max(0, (e.hurtT || 0) - dt);
    if (e.state === 'dead') return;
    if (e.state === 'dying') { e.timer += dt; if (e.timer > 0.6) e.state = 'dead'; return; }
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
    e.anim += dt;
    e.seeT = (e.seeT || 0) - dt;
    if (e.seeT <= 0) {
      e.seeT = 0.18;
      e.sees = dist < d.sight && !p.dead && w.lineOfSight(e.x, e.y, p.x, p.y);
    }
    if (e.state === 'idle') {
      if (e.sees && (dist < 3 || Math.abs(angDiff(Math.atan2(dy, dx), e.a)) < 1.9)) this.alert(e);
      return;
    }
    if (e.state === 'pain') { e.timer -= dt; if (e.timer <= 0) e.state = 'chase'; return; }
    if (e.state === 'attack') {
      e.timer -= dt;
      if (!e.fired && e.timer <= e.fireAt) { e.fired = true; this.enemyAttack(e, dist); }
      if (e.timer <= 0) { e.state = 'chase'; e.cd = rnd(...d.cd) * this.diff.cd; }
      return;
    }
    // chase
    e.cd -= dt; e.react -= dt;
    if (p.dead) return;
    if (d.kind === 'boss') {
      e.summon -= dt;
      if (e.summon <= 0 && this.enemies.filter((o) => o.summoned && o.state !== 'dead' && o.state !== 'dying').length < 3) {
        e.summon = 13;
        this.summonDrone(e);
      }
    }
    const canAttack = e.sees && e.react <= 0 && e.cd <= 0 && dist < d.range;
    if (canAttack && (d.kind !== 'melee' || dist < d.range)) {
      e.state = 'attack'; e.fired = false;
      e.timer = d.kind === 'melee' ? 0.45 : d.kind === 'boss' ? 0.8 : 0.55;
      e.fireAt = d.kind === 'melee' ? 0.2 : 0.25;
      e.a = Math.atan2(dy, dx);
      return;
    }
    // Déplacement : direct si en vue, sinon via le champ de distances.
    let tx, ty;
    const keepAway = d.kind !== 'melee' && e.sees && dist < (d.kind === 'boss' ? 4 : 2.6);
    if (e.sees && d.kind === 'melee') { tx = p.x; ty = p.y; }
    else if (keepAway) { tx = e.x - dx; ty = e.y - dy; }
    else if (e.sees && dist > 5) { tx = p.x; ty = p.y; }
    else {
      const cx = Math.floor(e.x), cy = Math.floor(e.y);
      const here = w.flow[w.idx(cx, cy)];
      let best = null, bv = here < 0 ? 1e9 : here;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = w.inside(cx + ox, cy + oy) ? w.flow[w.idx(cx + ox, cy + oy)] : -1;
        if (v >= 0 && v < bv) { bv = v; best = [cx + ox, cy + oy]; }
      }
      if (best) { tx = best[0] + 0.5; ty = best[1] + 0.5; }
      else if (e.sees) { tx = p.x; ty = p.y; }
      else return;
      // recentre sur l'axe de la cellule pour passer les portes proprement
      if (best && best[0] !== cx) ty = cy + 0.5; else if (best && best[1] !== cy) tx = cx + 0.5;
      if (best && w.cellType(best[0], best[1]) === DOOR) {
        const door = w.door(best[0], best[1]);
        if (!door.lock || p.keys[door.lock] || door.open > 0) w.openDoor(door);
      }
    }
    const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my);
    if (ml < 0.01) return;
    const sp = d.speed * dt * (e.t === 'm' && e.sees ? 1.25 : 1);
    const vx = (mx / ml) * sp, vy = (my / ml) * sp;
    e.a = Math.atan2(my, mx);
    let movedAny = false;
    if (!w.collides(e.x + vx, e.y, d.r * 0.9, true) && !this.decorBlocks(e.x + vx, e.y, d.r * 0.8)) { e.x += vx; movedAny = true; }
    if (!w.collides(e.x, e.y + vy, d.r * 0.9, true) && !this.decorBlocks(e.x, e.y + vy, d.r * 0.8)) { e.y += vy; movedAny = true; }
    if (Math.hypot(e.x - p.x, e.y - p.y) < d.r + 0.25) { e.x -= vx; e.y -= vy; }
    if (!movedAny) {
      // ouvre la porte qui bloque, le cas échéant
      const fx = Math.floor(e.x + Math.cos(e.a) * 0.6), fy = Math.floor(e.y + Math.sin(e.a) * 0.6);
      if (w.cellType(fx, fy) === DOOR) { const door = w.door(fx, fy); if (!door.lock) w.openDoor(door); }
    }
    e.moved = movedAny;
  }

  summonDrone(boss) {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * 6.28, x = boss.x + Math.cos(a) * 1.4, y = boss.y + Math.sin(a) * 1.4;
      if (this.world.collides(x, y, 0.3)) continue;
      const d = ENEMY.g;
      this.enemies.push({ t: 'g', d, x, y, a, hp: d.hp * this.diff.hp, state: 'chase', timer: 0, anim: 0, cd: 1.5, react: 0.5, summon: 0, spr: this.assets.sprites.enemy.g, summoned: true });
      this.effect('arc0', x, y, 0.5, 0.3, 1.5);
    }
    audio.play('alert_g', boss);
  }

  enemyAttack(e, dist) {
    const p = this.player, d = e.d;
    if (!e.sees && d.kind !== 'boss') return;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (d.kind === 'melee') {
      audio.play('claw', e);
      if (dist < d.range + 0.3) this.hurtPlayer(rnd(...d.dmg), e.x, e.y);
    } else if (d.kind === 'hitscan') {
      for (let i = 0; i < d.shots; i++) {
        setTimeout(() => {
          if (e.state === 'dead' || e.state === 'dying' || p.dead) return;
          audio.play('sentShot', e);
          const dd = Math.hypot(p.x - e.x, p.y - e.y);
          const hitChance = Math.max(0.2, 0.85 - dd * 0.06 - p.moving * 0.3);
          if (Math.random() < hitChance && this.world.lineOfSight(e.x, e.y, p.x, p.y)) this.hurtPlayer(rnd(...d.dmg), e.x, e.y);
        }, i * 140);
      }
    } else if (d.kind === 'proj') {
      this.spawnProj(e, a, d);
      audio.play('plasma', e);
    } else if (d.kind === 'boss') {
      audio.play('orb', e);
      const pattern = Math.random();
      if (pattern < 0.65) for (let i = -2; i <= 2; i++) this.spawnProj(e, a + i * 0.16, d);
      else for (let i = 0; i < 12; i++) this.spawnProj(e, (i / 12) * Math.PI * 2, d, 0.8);
    }
  }

  spawnProj(e, a, d, speedMul = 1) {
    this.projectiles.push({
      x: e.x + Math.cos(a) * (e.d.r + 0.1), y: e.y + Math.sin(a) * (e.d.r + 0.1),
      dx: Math.cos(a), dy: Math.sin(a), speed: d.pspeed * speedMul, dmg: rnd(...d.pdmg), kind: d.proj,
      z: d.proj === 'orb' ? 0.25 : 0.3, life: 6,
    });
  }

  updateProjectiles(dt) {
    const p = this.player, w = this.world;
    for (const pr of this.projectiles) {
      pr.life -= dt;
      const steps = 3;
      for (let s = 0; s < steps && !pr.dead; s++) {
        pr.x += (pr.dx * pr.speed * dt) / steps; pr.y += (pr.dy * pr.speed * dt) / steps;
        if (w.blocksAt(pr.x, pr.y)) { pr.dead = true; this.effect('puff', pr.x - pr.dx * 0.1, pr.y - pr.dy * 0.1, 0.3, pr.z); audio.play('wallhit', pr, 0.6); break; }
        if (!p.dead && Math.hypot(pr.x - p.x, pr.y - p.y) < 0.32) { pr.dead = true; this.hurtPlayer(pr.dmg, pr.x - pr.dx, pr.y - pr.dy); this.effect('puff', pr.x, pr.y, 0.3, pr.z); }
      }
      if (pr.life <= 0) pr.dead = true;
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  separateEnemies() {
    const list = this.enemies.filter((e) => e.state !== 'dead' && e.state !== 'dying');
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.d.r + b.d.r) * 0.8;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        if (!this.world.collides(a.x - ux * push, a.y - uy * push, a.d.r * 0.9)) { a.x -= ux * push; a.y -= uy * push; }
        if (!this.world.collides(b.x + ux * push, b.y + uy * push, b.d.r * 0.9)) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }

  // ——— Liste des sprites à afficher ———
  collectSprites() {
    const S = this.assets.sprites, out = [];
    for (const d of this.decor) out.push({ x: d.x, y: d.y, spr: d.spr });
    for (const it of this.items) {
      const bob = 'kKt'.includes(it.t) ? Math.sin(this.time * 3 + it.x) * 0.05 + 0.05 : 0;
      out.push({ x: it.x, y: it.y, spr: it.spr, z: bob });
    }
    for (const e of this.enemies) {
      const f = e.spr;
      let spr;
      if (e.state === 'dead') spr = f.death[2];
      else if (e.state === 'dying') spr = f.death[Math.min(2, Math.floor((e.timer / 0.6) * 3))];
      else if (e.state === 'attack') spr = e.fired || e.timer < e.fireAt + 0.15 ? f.attack : f.walk[0];
      else if (e.state === 'pain') spr = f.pain;
      else if (e.state === 'chase' && e.moved !== false) spr = f.walk[Math.floor(e.anim * 4) & 1];
      else spr = f.walk[e.t === 'g' || e.t === 'O' ? Math.floor(e.anim * 2) & 1 : 0];
      out.push({ x: e.x, y: e.y, spr, scale: e.d.scale || 1, hurt: e.hurtT > 0 && e.state !== 'dead' });
    }
    for (const pr of this.projectiles) out.push({ x: pr.x, y: pr.y, spr: S.misc[pr.kind], z: pr.z - 0.2, scale: pr.kind === 'orb' ? 0.9 : 0.6, bright: true });
    for (const f of this.effects) {
      let spr;
      const k = f.t / f.life;
      if (f.kind === 'puff') spr = S.misc[k < 0.5 ? 'puff0' : 'puff1'];
      else if (f.kind === 'boom') spr = S.misc['boom' + Math.min(2, Math.floor(k * 3))];
      else spr = S.misc[f.kind];
      out.push({ x: f.x, y: f.y, spr, z: f.z - (f.kind === 'boom' ? 0 : 0.25), scale: (f.kind === 'puff' ? 0.5 : 1) * f.scale, bright: true });
    }
    return out;
  }
}
