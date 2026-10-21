// Point d'entrée : chargement, boucle principale, menus, HUD, sauvegarde.
import { LEVELS } from './levels.js';
import { buildTextures } from './textures.js';
import { buildSprites } from './sprites.js';
import { Renderer } from './renderer.js';
import { Game, WEAPONS, DIFFICULTY, newPlayerState } from './game.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { EMPTY, DOOR, MOVING } from './world.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const view = $('#view');

// ——— Sauvegarde locale ———
const SAVE_KEY = 'kryos-save-v1';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const defaults = {
  unlocked: 1, best: 0,
  opts: { sens: 1, fov: 70, sfx: 0.8, music: 0.5, quality: isTouch ? 270 : 360, minimap: true, touch: isTouch },
};
let save;
try { save = { ...defaults, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; save.opts = { ...defaults.opts, ...save.opts }; }
catch { save = structuredClone(defaults); }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* stockage indisponible */ } };

// ——— Ressources ———
const textures = buildTextures();
const texList = [null], texIndex = {};
for (const name of Object.keys(textures)) { texIndex[name] = texList.length; texList.push(textures[name]); }
const assets = { texList, texIndex, sprites: buildSprites() };
const renderer = new Renderer(view);
const input = new Input(view, $('#touch'));
$('#loading').remove();

// ——— État ———
let state = 'title';
let game = null, attract = null;
let session = null; // { difficulty, levelIndex, inventory, levelStartInv, totalTime }
let screenStack = [];
let showFullMap = false;

const ui = {
  message(text, kind = '') {
    const box = $('#messages');
    const el = document.createElement('div');
    el.textContent = text; if (kind) el.className = kind;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), 3000);
  },
  flash(kind, amount = 0.35) {
    const f = $('#flash');
    f.style.transition = 'none';
    f.style.background = kind === 'hurt' ? 'radial-gradient(ellipse at center, rgba(255,0,30,.15), rgba(255,0,30,.75))' : 'rgba(255,200,80,.25)';
    f.style.opacity = kind === 'hurt' ? Math.max(0.25, amount) : 0.6;
    requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = 0; });
  },
  hurtFrom(rel) {
    const h = $('#hurtdir');
    h.style.transition = 'none'; h.style.transform = `rotate(${rel + Math.PI / 2}rad)`; h.style.opacity = 1;
    requestAnimationFrame(() => { h.style.transition = 'opacity .8s'; h.style.opacity = 0; });
  },
  died() { setTimeout(() => showScreen('dead'), 50); input.unlock(); audio.stopMusic(); state = 'dead'; },
  levelComplete(res) { onLevelComplete(res); },
};

// ——— Écrans ———
function showScreen(name, push = false) {
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = true));
  if (push && screenStack.length) {} // pile gérée par les appelants
  if (name) $('#s-' + name).hidden = false;
  const btn = name && $('#s-' + name + ' nav button.primary, #s-' + name + ' nav button');
  if (btn && !isTouch) btn.focus({ preventScroll: true });
}
function go(name) { screenStack.push(currentScreen()); showScreen(name); audio.play('select'); }
function back() { const prev = screenStack.pop() || 'title'; showScreen(prev); audio.play('blip'); }
function currentScreen() { const s = [...document.querySelectorAll('.screen')].find((e) => !e.hidden); return s ? s.id.slice(2) : null; }

document.addEventListener('click', (e) => {
  audio.init();
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.go) { if (b.dataset.go === 'levels') buildLevelList(); go(b.dataset.go); }
  if (b.dataset.back !== undefined) back();
  if (b.dataset.diff !== undefined) newGame(+b.dataset.diff);
});
document.addEventListener('pointerdown', () => audio.init(), { once: true });

function buildLevelList() {
  const nav = $('#level-list');
  nav.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.className = 'lvl' + (i === 0 ? ' primary' : '');
    b.innerHTML = `${i + 1}. ${L.name}<small>${i < save.unlocked ? L.subtitle : 'Verrouillé — terminez le secteur précédent'}</small>`;
    b.disabled = i >= save.unlocked;
    b.onclick = () => {
      const diff = session ? session.difficulty : 1;
      session = { difficulty: diff, levelIndex: i, inventory: newPlayerState(L.loadout), totalTime: 0 };
      session.inventory.score = 0;
      brief();
    };
    nav.appendChild(b);
  });
}

function newGame(diff) {
  session = { difficulty: diff, levelIndex: 0, inventory: newPlayerState(LEVELS[0].loadout), totalTime: 0 };
  brief();
}

function brief() {
  const L = LEVELS[session.levelIndex];
  $('#b-sub').textContent = L.subtitle.toUpperCase();
  $('#b-name').textContent = L.name;
  $('#b-text').textContent = L.briefing;
  screenStack = [];
  state = 'brief';
  showScreen('brief');
  audio.play('select');
}
$('#b-go').onclick = () => startLevel();

function startLevel() {
  const L = LEVELS[session.levelIndex];
  session.levelStartInv = JSON.parse(JSON.stringify(session.inventory));
  game = new Game({ level: L, levelIndex: session.levelIndex, assets, inventory: session.inventory, difficulty: session.difficulty, ui });
  attract = null;
  $('#messages').innerHTML = '';
  showScreen(null);
  setPlaying(true);
  audio.init();
  audio.startMusic(L.music);
  audio.muffle(false);
  $('#h-level').textContent = session.levelIndex + 1;
  ui.message(`${L.subtitle}`, 'secret');
  if (isTouch) {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }
}

function setPlaying(on) {
  state = on ? 'play' : state;
  input.enabled = on;
  app.classList.toggle('playing', on);
  $('#hud').hidden = !on && state !== 'pause';
  $('#touch').hidden = !(on && save.opts.touch);
  app.classList.toggle('touch', on && save.opts.touch);
  if (on) input.lock();
}

function pause() {
  if (state !== 'play') return;
  state = 'pause';
  input.enabled = false;
  input.unlock();
  app.classList.remove('playing');
  $('#touch').hidden = true;
  showFullMap = false; $('#fullmap').hidden = true;
  screenStack = [];
  showScreen('pause');
  audio.muffle(true);
}
function resume() {
  showScreen(null);
  audio.muffle(false);
  setPlaying(true);
}
$('#p-resume').onclick = resume;
$('#p-restart').onclick = () => { session.inventory = JSON.parse(JSON.stringify(session.levelStartInv)); startLevel(); };
$('#p-quit').onclick = () => toTitle();
$('#d-retry').onclick = () => { session.inventory = JSON.parse(JSON.stringify(session.levelStartInv)); startLevel(); };
$('#d-quit').onclick = () => toTitle();
$('#v-menu').onclick = () => toTitle();

function toTitle() {
  game = null; state = 'title';
  input.enabled = false; input.unlock();
  app.classList.remove('playing');
  $('#hud').hidden = true; $('#touch').hidden = true; $('#bossbar').hidden = true;
  audio.stopMusic();
  screenStack = [];
  showScreen('title');
  updateBest();
  startAttract();
}

function onLevelComplete(res) {
  input.unlock(); input.enabled = false;
  app.classList.remove('playing'); $('#touch').hidden = true;
  state = 'inter';
  session.totalTime += res.time;
  session.inventory = game.inventory();
  // un minimum de santé pour repartir
  session.inventory.health = Math.max(session.inventory.health, 50);
  const next = session.levelIndex + 1;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, next + 1));
  persist();
  $('#i-name').textContent = LEVELS[session.levelIndex].name;
  $('#i-kills').textContent = res.kills + ' %';
  $('#i-items').textContent = res.items + ' %';
  $('#i-secrets').textContent = res.secrets + ' %';
  $('#i-time').textContent = fmtTime(res.time);
  $('#i-score').textContent = res.score.toLocaleString('fr-FR');
  audio.muffle(true);
  showScreen('inter');
}
$('#i-next').onclick = () => {
  if (session.levelIndex + 1 >= LEVELS.length) return victory();
  session.levelIndex++;
  brief();
};

function victory() {
  state = 'victory';
  audio.stopMusic();
  audio.play('exit');
  const score = session.inventory.score;
  save.best = Math.max(save.best, score); persist();
  $('#v-score').textContent = score.toLocaleString('fr-FR');
  $('#v-time').textContent = fmtTime(session.totalTime);
  $('#v-diff').textContent = DIFFICULTY[session.difficulty].name;
  showScreen('victory');
  startAttract(2);
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function updateBest() { $('#best').textContent = save.best ? `Meilleur score : ${save.best.toLocaleString('fr-FR')}` : 'Une station minière. Un signal perdu. Aucun renfort.'; }

// ——— Touches globales ———
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' || e.code === 'KeyM') { e.preventDefault(); if (state === 'play') toggleMap(); }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'play') pause();
    else if (state === 'pause' && currentScreen() === 'pause') resume();
    else if (screenStack.length) back();
  }
});
input.onAction = (a) => { if (a === 'pause') pause(); if (a === 'map') toggleMap(); };
function toggleMap() { showFullMap = !showFullMap; $('#fullmap').hidden = !showFullMap; }
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'play' && !save.opts.touch) pause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

// ——— Options ———
function bindOption(id, key, fmt = (v) => v) {
  const el = $(id), out = el.parentElement.querySelector('output');
  const apply = () => {
    let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : +el.value;
    save.opts[key] = v; if (out) out.textContent = fmt(v);
    applyOptions(); persist();
  };
  if (el.type === 'checkbox') el.checked = save.opts[key]; else el.value = save.opts[key];
  if (out) out.textContent = fmt(save.opts[key]);
  el.addEventListener('input', apply);
}
bindOption('#o-sens', 'sens', (v) => v.toFixed(1));
bindOption('#o-fov', 'fov', (v) => v + '°');
bindOption('#o-sfx', 'sfx', (v) => Math.round(v * 100) + ' %');
bindOption('#o-music', 'music', (v) => Math.round(v * 100) + ' %');
bindOption('#o-quality', 'quality');
bindOption('#o-minimap', 'minimap');
bindOption('#o-touch', 'touch');
function applyOptions() {
  input.sensitivity = save.opts.sens;
  renderer.fov = save.opts.fov;
  audio.setVolumes(save.opts.sfx, save.opts.music);
  $('#minimap').classList.toggle('on', save.opts.minimap);
}
applyOptions();

// ——— Installation PWA ———
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#install').hidden = true; };
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ——— Rendu de l'arme ———
function drawWeapon(ctx, w, h) {
  const p = game.player, wp = WEAPONS[p.cur];
  const frames = assets.sprites.weapon[wp.id];
  const img = p.fireAnim > 0 ? frames[1] : frames[0];
  const wh = h * 0.6, ww = (wh * 160) / 120;
  const bx = Math.cos(p.bob) * w * 0.018 * Math.min(1, p.moving);
  const by = Math.abs(Math.sin(p.bob)) * h * 0.03 * Math.min(1, p.moving);
  const sw = p.switchAnim > 0 ? (p.switchAnim / 0.25) * wh * 0.6 : 0;
  const dead = p.dead ? Math.min(1, p.deadT) * wh : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(w / 2 - ww / 2 + bx), Math.round(h - wh + by + sw + dead + h * 0.02), Math.round(ww), Math.round(wh));
}

// ——— HUD ———
const H = { health: $('#h-health'), armor: $('#h-armor'), ammo: $('#h-ammo'), wname: $('#h-wname'), score: $('#h-score'), kb: $('#k-blue'), kr: $('#k-red'), bossbar: $('#bossbar'), bossfill: $('#bossbar i') };
const last = {};
function setText(el, key, v) { if (last[key] !== v) { last[key] = v; el.textContent = v; } }
function updateHud() {
  const p = game.player, wp = WEAPONS[p.cur];
  setText(H.health, 'h', p.health);
  H.health.classList.toggle('low', p.health <= 25);
  setText(H.armor, 'a', p.armor);
  setText(H.wname, 'w', wp.name.toUpperCase());
  setText(H.ammo, 'am', wp.ammo ? p[wp.ammo] : '∞');
  H.ammo.classList.toggle('low', !!wp.ammo && p[wp.ammo] < wp.cost * 5);
  setText(H.score, 's', p.score.toLocaleString('fr-FR'));
  H.kb.classList.toggle('on', p.keys.blue);
  H.kr.classList.toggle('on', p.keys.red);
  const b = game.boss;
  const showBoss = b && b.state !== 'idle' && b.state !== 'dead';
  H.bossbar.hidden = !showBoss;
  if (showBoss) H.bossfill.style.width = Math.max(0, (b.hp / (b.d.hp * DIFFICULTY[session.difficulty].hp)) * 100) + '%';
}

// Moniteur cardiaque animé
const ecg = $('#ecg').getContext('2d');
let ecgX = 0, ecgPhase = 0;
function drawEcg(dt) {
  const p = game.player;
  const rate = p.dead ? 0 : 1.2 + (100 - p.health) / 40;
  const col = p.health > 60 ? '#36ff9a' : p.health > 25 ? '#ffb02e' : '#ff3b4e';
  const W = 120, Hh = 40;
  ecg.fillStyle = 'rgba(5,10,16,.25)'; ecg.fillRect(0, 0, W, Hh);
  const steps = Math.max(1, Math.round(dt * 70));
  for (let i = 0; i < steps; i++) {
    ecgPhase += rate / 70;
    const t = ecgPhase % 1;
    let y = Hh / 2;
    if (!p.dead) {
      if (t > 0.1 && t < 0.14) y -= 4;
      else if (t > 0.2 && t < 0.23) y += 5;
      else if (t > 0.23 && t < 0.27) y -= 16;
      else if (t > 0.27 && t < 0.3) y += 8;
      else if (t > 0.45 && t < 0.55) y -= 3;
    }
    ecg.fillStyle = 'rgba(5,10,16,1)'; ecg.fillRect(ecgX, 0, 4, Hh);
    ecg.fillStyle = col; ecg.fillRect(ecgX, y, 2, 2);
    ecgX = (ecgX + 1) % W;
  }
}

// ——— Cartes ———
const mm = $('#minimap'), mmc = mm.getContext('2d');
function drawMap(ctx, cw, ch, cx, cy, scale, round) {
  const w = game.world, p = game.player;
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  if (round) { ctx.beginPath(); ctx.arc(cw / 2, ch / 2, cw / 2, 0, 7); ctx.clip(); }
  ctx.translate(cw / 2 - cx * scale, ch / 2 - cy * scale);
  const x0 = Math.max(0, Math.floor(cx - cw / 2 / scale) - 1), x1 = Math.min(w.W, Math.ceil(cx + cw / 2 / scale) + 1);
  const y0 = Math.max(0, Math.floor(cy - ch / 2 / scale) - 1), y1 = Math.min(w.H, Math.ceil(cy + ch / 2 / scale) + 1);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w.W + x;
    if (!w.explored[i]) continue;
    const t = w.type[i];
    if (t === EMPTY || t === MOVING) { ctx.fillStyle = 'rgba(54,224,255,.10)'; }
    else if (t === DOOR) { const d = w.doors.get(i); ctx.fillStyle = d.lock === 'blue' ? '#2f8cff' : d.lock === 'red' ? '#ff3b4e' : '#e8b21c'; }
    else if (t === 4) ctx.fillStyle = '#36ff9a';
    else ctx.fillStyle = 'rgba(160,200,225,.75)';
    if (t === DOOR) { const d = w.doors.get(i); if (d.ns) ctx.fillRect(x * scale, (y + 0.35) * scale, scale, scale * 0.3); else ctx.fillRect((x + 0.35) * scale, y * scale, scale * 0.3, scale); }
    else ctx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
  }
  for (const it of game.items) {
    if (!w.explored[Math.floor(it.y) * w.W + Math.floor(it.x)]) continue;
    ctx.fillStyle = it.t === 'k' ? '#2f8cff' : it.t === 'K' ? '#ff3b4e' : 'rgba(255,176,46,.7)';
    const s = 'kK'.includes(it.t) ? 0.5 : 0.25;
    ctx.fillRect((it.x - s / 2) * scale, (it.y - s / 2) * scale, s * scale, s * scale);
  }
  for (const e of game.enemies) {
    if (e.state === 'dead' || e.state === 'dying' || !e.sees) continue;
    ctx.fillStyle = '#ff3b4e';
    ctx.beginPath(); ctx.arc(e.x * scale, e.y * scale, Math.max(2, scale * 0.25 * (e.d.scale || 1)), 0, 7); ctx.fill();
  }
  ctx.translate(p.x * scale, p.y * scale); ctx.rotate(p.a);
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#36e0ff'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(scale * 0.7, 0); ctx.lineTo(-scale * 0.45, scale * 0.38); ctx.lineTo(-scale * 0.25, 0); ctx.lineTo(-scale * 0.45, -scale * 0.38); ctx.fill();
  ctx.restore();
}
const fm = $('#fullmap canvas'), fmc = fm.getContext('2d');

// ——— Écran-titre animé : la station en arrière-plan ———
function startAttract(levelIndex = 0) {
  const L = LEVELS[levelIndex];
  attract = new Game({ level: L, levelIndex, assets, inventory: newPlayerState(L.loadout), difficulty: 1, ui: { message() {}, flash() {}, hurtFrom() {}, died() {}, levelComplete() {} } });
  const p = attract.player;
  // point de vue : le hangar du niveau 1 ou l'arène finale
  if (levelIndex === 0) { p.x = 21.5; p.y = 5.5; } else { p.x = 23.5; p.y = 9.5; }
  attract.enemies = attract.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) > 4 && e.t !== 'O');
  p.a = -Math.PI / 2;
}

// ——— Résolution ———
function resize() {
  const dpr = 1;
  const hTarget = save.opts.quality;
  const aspect = innerWidth / innerHeight;
  renderer.resize(Math.round(hTarget * aspect * dpr), hTarget * dpr);
  const s = Math.min(2, devicePixelRatio || 1);
  mm.width = mm.height = Math.round(mm.clientWidth * s) || 150;
}
addEventListener('resize', resize);
const qSel = $('#o-quality'); qSel.addEventListener('input', resize);

// ——— Boucle principale ———
let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (state === 'play' && game) {
    const inp = input.poll(dt);
    game.update(dt, inp);
  } else if (input.enabled === false) input.poll(0);

  const g = game || attract;
  if (!g) return;
  if (g === attract) {
    attract.time += dt;
    attract.player.a += dt * 0.12;
    for (const e of attract.enemies) e.anim += dt;
  }
  renderer.render(g);
  if (game) {
    drawWeapon(renderer.ctx, renderer.w, renderer.h);
    if (state === 'play' || state === 'pause') {
      updateHud();
      drawEcg(dt);
      if (save.opts.minimap) drawMap(mmc, mm.width, mm.height, game.player.x, game.player.y, mm.width / 18, true);
      if (showFullMap) {
        const sc = Math.floor(Math.min(fm.width / game.world.W, fm.height / game.world.H));
        drawMap(fmc, fm.width, fm.height, game.world.W / 2, game.world.H / 2, sc, false);
      }
    }
  }
}

resize();
updateBest();
startAttract();
showScreen('title');
requestAnimationFrame(frame);

// Point d'accès pour les tests automatisés.
window.__kryos = { get game() { return game; }, get state() { return state; }, startLevel: (i, d = 1) => { session = { difficulty: d, levelIndex: i, inventory: newPlayerState(LEVELS[i].loadout), totalTime: 0 }; startLevel(); }, LEVELS };
