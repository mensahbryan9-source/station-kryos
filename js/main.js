// Point d'entrée : chargement, boucle principale, menus, HUD, sauvegarde.
import { LEVELS } from './levels.js';
import { buildTextures } from './textures.js';
import { buildSprites } from './sprites.js';
import { buildHalloweenTextures } from './textures-halloween.js';
import { buildHalloweenSprites } from './sprites-halloween.js';
import { CONFIG } from './config.js';
import { contest, countdown } from './contest.js';
import { Renderer } from './renderer.js';
import { Game, WEAPONS, DIFFICULTY, newPlayerState } from './game.js';
import { scoreLevel } from './scoring.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { EMPTY, DOOR, MOVING } from './world.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const view = $('#view');

// ——— Sauvegarde locale ———
const SAVE_KEY = 'manoir-save-v1';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const defaults = {
  unlocked: 1, best: 0,
  opts: { sens: 1, fov: 70, sfx: 0.8, music: 0.5, quality: 'auto', minimap: true, touch: isTouch, scares: true },
};
let save;
try { save = { ...defaults, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; save.opts = { ...defaults.opts, ...save.opts }; }
catch { save = structuredClone(defaults); }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* stockage indisponible */ } };

// ——— Ressources ———
const textures = { ...buildTextures(), ...buildHalloweenTextures() };
const texList = [null], texIndex = {};
for (const name of Object.keys(textures)) { texIndex[name] = texList.length; texList.push(textures[name]); }
// Thème Halloween par-dessus les sprites d'origine (conservés pour les clés non redéfinies).
const baseSprites = buildSprites(), halloween = buildHalloweenSprites();
const sprites = {};
for (const k of Object.keys(baseSprites)) sprites[k] = { ...baseSprites[k], ...halloween[k] };
const assets = { texList, texIndex, sprites };
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
  died() { if (session) session.deaths++; setTimeout(() => showScreen('dead'), 50); input.unlock(); audio.stopMusic(); audio.stopAmbience(); state = 'dead'; },
  levelComplete(res) { onLevelComplete(res); },
  get scaresEnabled() { return save.opts.scares; },
  scare(kind) {
    if (!save.opts.scares) return;
    const el = $('#scare');
    el.className = ''; void el.offsetWidth;
    if (kind === 'face') { drawScareFace(); el.className = 'face'; }
    else if (kind === 'ghost') el.className = 'white';
    else return;
    setTimeout(() => (el.className = ''), kind === 'face' ? 420 : 250);
  },
};

// Visage du jump scare, dessiné une fois à la demande.
let faceDrawn = false;
function drawScareFace() {
  if (faceDrawn) return;
  faceDrawn = true;
  const c = $('#scare canvas'), g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.5, W * 0.4);
  grd.addColorStop(0, '#d8d4c8'); grd.addColorStop(0.7, '#8a8678'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.beginPath(); g.ellipse(W / 2, H * 0.5, W * 0.24, H * 0.42, 0, 0, 7); g.fill();
  for (const s of [-1, 1]) {
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(W / 2 + s * W * 0.09, H * 0.4, W * 0.06, H * 0.09, s * 0.25, 0, 7); g.fill();
    g.fillStyle = '#ff1a1a'; g.beginPath(); g.arc(W / 2 + s * W * 0.09, H * 0.42, W * 0.008, 0, 7); g.fill();
  }
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(W / 2, H * 0.72, W * 0.07, H * 0.13, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(60,0,0,.8)'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(W / 2 + (i - 3) * 12, H * 0.62); g.lineTo(W / 2 + (i - 3) * 10, H * 0.85); g.stroke(); }
}

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

// ——— Concours : inscription, démarrage, classement ———
$('#play').onclick = () => {
  if (!contest.configured || !contest.open) return openDifficulty(false);
  if (!contest.player) return go('register');
  openDifficulty(true);
};
function openDifficulty(ranked) {
  $('#diff-err').textContent = ''; $('#diff-offline').hidden = true;
  $('#diff-note').innerHTML = ranked
    ? `Partie classée pour <b>${escapeHtml(contest.player.pseudo)}</b>. Le coefficient de difficulté multiplie votre score.`
    : !contest.configured ? 'Serveur du concours non configuré : partie hors concours.'
    : 'Le concours est terminé : cette partie ne sera pas classée.';
  pendingRanked = ranked;
  go('difficulty');
}
let pendingRanked = false;
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('#reg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, err = $('#reg-err'), btn = $('#reg-submit');
  const data = Object.fromEntries(new FormData(f));
  data.consent = f.consent.checked;
  if (!/^[\p{L}\p{N} _.\-]{3,16}$/u.test((data.pseudo || '').trim())) { err.textContent = 'Pseudo : 3 à 16 caractères (lettres, chiffres, espace, _ . -)'; return; }
  if (!data.firstName.trim() || !data.lastName.trim()) { err.textContent = 'Le prénom et le nom sont obligatoires.'; return; }
  if (!data.contact.trim()) { err.textContent = 'Indiquez un email ou un numéro de téléphone.'; return; }
  if (!data.consent) { err.textContent = 'Vous devez accepter l\'utilisation de vos données pour participer.'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Inscription…';
  try {
    const r = await contest.register(data);
    ui.message(r.returning ? `Bon retour, ${r.pseudo} !` : `Bienvenue, ${r.pseudo} !`, 'secret');
    screenStack = ['title'];
    openDifficulty(true);
  } catch (ex) {
    err.textContent = ex.status === 0 ? 'Connexion impossible. Vérifiez votre réseau et réessayez.' : ex.message;
  } finally { btn.disabled = false; btn.textContent = 'S\'inscrire et jouer'; }
});

$('#btn-board').onclick = () => { go('board'); loadBoard(); };
$('#board-refresh').onclick = () => loadBoard();
$('#run-board').onclick = $('#v-board').onclick = () => { toTitle(); go('board'); loadBoard(); };
$('#run-menu').onclick = () => toTitle();

async function loadBoard() {
  const t = $('#board-table');
  t.innerHTML = '<tr><td>Chargement…</td></tr>'; $('#board-me').textContent = '';
  try {
    const d = await contest.leaderboard();
    $('#board-status').textContent = d.frozen ? 'CONCOURS TERMINÉ — CLASSEMENT FIGÉ' : 'CLASSEMENT EN DIRECT';
    const me = d.me && d.me.pseudo;
    t.innerHTML = d.top.length
      ? '<tr><td>#</td><td>Pseudo</td><td>Niveaux</td><td>Difficulté</td><td>Score</td></tr>' + d.top.map((r) => `<tr class="${r.pseudo === me ? 'me' : ''}"><td>${r.rank}</td><td>${escapeHtml(r.pseudo)}</td><td>${r.levels}/5</td><td>${escapeHtml(r.difficulty)}</td><td>${r.score.toLocaleString('fr-FR')}</td></tr>`).join('')
      : '<tr><td>Aucun score pour l\'instant : soyez le premier !</td></tr>';
    if (d.me) $('#board-me').textContent = d.me.rank ? `${d.me.pseudo} : ${d.me.rank}${d.me.rank === 1 ? 'er' : 'e'} avec ${d.me.score.toLocaleString('fr-FR')} points` : `${d.me.pseudo} : pas encore de niveau terminé`;
  } catch (e) {
    t.innerHTML = `<tr><td>${e.status === 0 ? 'Classement indisponible hors connexion.' : escapeHtml(e.message)}</td></tr>`;
  }
}

$('#diff-practice').onclick = () => { pendingRanked = false; newGame(pendingDiff); };
let pendingDiff = 1;
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
      session = { difficulty: diff, levelIndex: i, inventory: newPlayerState(L.loadout), totalTime: 0, ranked: false, deaths: 0, played: 0 };
      session.inventory.score = 0;
      brief();
    };
    nav.appendChild(b);
  });
}

async function newGame(diff) {
  pendingDiff = diff;
  let ranked = pendingRanked && contest.player && contest.open && contest.configured;
  if (ranked) {
    $('#diff-err').textContent = 'Connexion au serveur du concours…';
    try { await contest.startRun(diff); }
    catch (e) {
      $('#diff-err').textContent = e.status === 0 ? 'Serveur injoignable : impossible de démarrer une partie classée.' : e.message;
      if (e.status === 401) contest.forget();
      $('#diff-offline').hidden = false;
      return;
    }
  }
  session = { difficulty: diff, levelIndex: 0, inventory: newPlayerState(LEVELS[0].loadout), totalTime: 0, ranked: !!ranked, deaths: 0, played: 0 };
  brief();
}

function brief() {
  const L = LEVELS[session.levelIndex];
  session.deaths = 0;
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
  audio.startAmbience(L.ceiling === 'nightSky' ? 'outdoor' : 'indoor');
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
// Recommencer volontairement un niveau compte comme une mort (pas de reprise gratuite).
$('#p-restart').onclick = () => { session.deaths++; session.inventory = JSON.parse(JSON.stringify(session.levelStartInv)); startLevel(); };
$('#p-quit').onclick = () => quitRun();
$('#d-retry').onclick = () => { session.inventory = JSON.parse(JSON.stringify(session.levelStartInv)); startLevel(); };
$('#d-quit').onclick = () => quitRun();
$('#v-menu').onclick = () => toTitle();

// Quitter une partie classée : les niveaux déjà terminés comptent, on affiche le bilan.
async function quitRun() {
  if (!session || !session.ranked || !session.played) {
    if (session && session.ranked) contest.endRun();
    return toTitle();
  }
  toTitle();
  showScreen('run');
  $('#run-body').innerHTML = '<p class="status">Calcul du score final…</p>';
  renderRun($('#run-body'), await contest.endRun());
}

function toTitle() {
  game = null; state = 'title';
  input.enabled = false; input.unlock();
  app.classList.remove('playing');
  $('#hud').hidden = true; $('#touch').hidden = true; $('#bossbar').hidden = true;
  audio.stopMusic(); audio.stopAmbience();
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
  // Événements bruts du niveau : c'est à partir d'eux que le serveur recalcule le score.
  const events = { kills: [...game.stats.killIds], secrets: [...game.stats.secretIds], hpEnd: Math.max(1, Math.round(game.player.health)), deaths: session.deaths, time: Math.round(res.time * 100) / 100 };
  session.played++;
  interLevel = session.levelIndex;
  if (session.ranked) contest.submitLevel(session.levelIndex, events);
  else practiceResult = { status: 'practice', local: scoreLevel(LEVELS[session.levelIndex], session.levelIndex, session.difficulty, events) };
  renderInter();
  audio.muffle(true);
  showScreen('inter');
}
$('#i-next').onclick = () => {
  if (session.levelIndex + 1 >= LEVELS.length) return victory();
  session.levelIndex++;
  brief();
};

async function victory() {
  state = 'victory';
  audio.stopMusic(); audio.stopAmbience();
  audio.play('exit');
  showScreen('victory');
  startAttract(4);
  const box = $('#v-run');
  if (!session.ranked) { box.innerHTML = `<p class="status">Partie d'entraînement en ${escapeHtml(DIFFICULTY[session.difficulty].name)}, terminée en ${fmtTime(session.totalTime)} — non classée.</p>`; return; }
  box.innerHTML = '<p class="status">Calcul du score final…</p>';
  const r = await contest.endRun();
  renderRun(box, r);
  if (r && !r.offline) { save.best = Math.max(save.best, r.best || 0); persist(); }
}

// ——— Affichage du détail du score ———
let interLevel = 0, practiceResult = null;
const nf = (n) => Math.round(n).toLocaleString('fr-FR');
function formula(r, level) {
  const par = CONFIG.levels[level].par;
  return `<div class="formula">
    Ennemis +${nf(r.killPoints)} · Secrets +${nf(r.secretPoints)} · PV restants +${nf(r.hpPoints)} · Morts −${nf(r.deathPenalty)}
    = <b>${nf(r.points)}</b> points<br>
    × difficulté ${r.diffMult} × temps ${Number(r.timeCoef).toFixed(2)} <span style="color:var(--dim)">(référence ${fmtTime(par)})</span>
    = <b>${nf(r.score)}</b></div>`;
}
function renderInter() {
  const box = $('#i-breakdown');
  const r = session.ranked ? contest.result(interLevel) : practiceResult;
  if (!r) { box.innerHTML = ''; return; }
  const data = r.server || r.local;
  const status = {
    pending: 'Envoi au serveur…',
    ok: `Score validé par le serveur. Total de la partie : ${nf(r.total ?? 0)}`,
    offline: 'Hors connexion : résultat en attente, il sera envoyé automatiquement (estimation affichée).',
    rejected: `Résultat refusé par le serveur : ${escapeHtml(r.error || '')}`,
    practice: 'Entraînement : score indicatif, non classé.',
  }[r.status];
  box.innerHTML = formula(data, interLevel) + `<p class="status ${r.status === 'rejected' ? 'bad' : ''}">${status}</p>`;
}
contest.addEventListener('change', () => { if (state === 'inter') renderInter(); updateTitleInfo(); });

function renderRun(box, r) {
  if (!r) { box.innerHTML = ''; return; }
  const rows = r.levels.map((l) => `<tr><td>${l.level + 1}. ${escapeHtml(LEVELS[l.level].name)}</td><td>${nf(l.points)}</td><td>×${l.diffMult}</td><td>×${Number(l.timeCoef).toFixed(2)}</td><td>${l.status === 'rejected' ? 'refusé' : nf(l.score)}</td></tr>`).join('');
  const rank = r.offline
    ? '<p class="status">Hors connexion : le score sera validé dès le retour du réseau. Consultez ensuite le classement.</p>'
    : `<p class="rank">${r.isBest ? 'Nouveau record personnel ! ' : ''}Votre rang : <b>${r.rank ?? '—'}${r.rank === 1 ? 'er' : 'e'}</b>${r.isBest ? '' : ` · meilleur score : ${nf(r.best)}`}</p>`;
  box.innerHTML = `<table><thead><tr><th>Niveau</th><th>Points</th><th>Difficulté</th><th>Temps</th><th>Score</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td>Total (${r.levels.length}/5 niveaux)</td><td></td><td></td><td></td><td>${nf(r.total)}</td></tr></tfoot></table>
    <p class="status">Score d'un niveau = points × coefficient de difficulté × coefficient de temps (entre 0,5 et 2 selon le temps de référence).</p>${rank}`;
}

// ——— Écran-titre : compte à rebours et joueur connecté ———
function updateTitleInfo() {
  const left = new Date(CONFIG.contest.end).getTime() - Date.now();
  const c = countdown(left);
  const txt = c ? `⏳ Fin du concours dans ${c}` : '🏁 Concours terminé — classement figé';
  $('#countdown').textContent = txt; $('#board-countdown').textContent = txt;
  const who = $('#whoami');
  if (contest.player) {
    who.innerHTML = `Joueur : <b>${escapeHtml(contest.player.pseudo)}</b>${contest.pending ? ` · ${contest.pending} résultat(s) en attente d'envoi` : ''} · <a href="#" id="logout">changer</a>`;
  } else who.textContent = contest.configured ? 'Inscription gratuite avant de jouer — 1 lot à gagner.' : '';
}
document.addEventListener('click', (e) => { if (e.target.id === 'logout') { e.preventDefault(); contest.forget(); updateTitleInfo(); } });
setInterval(updateTitleInfo, 1000);
updateTitleInfo();

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function updateBest() { $('#best').textContent = save.best ? `Meilleur score : ${save.best.toLocaleString('fr-FR')}` : 'Une nuit. Un manoir. Aucune issue.'; }

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
    let v = el.type === 'checkbox' ? el.checked : el.value === 'auto' ? 'auto' : +el.value;
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
bindOption('#o-scares', 'scares');
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
const weaponBuf = Object.assign(document.createElement('canvas'), { width: 160, height: 120 });
function drawWeapon(ctx, w, h) {
  const p = game.player, wp = WEAPONS[p.cur];
  const frames = assets.sprites.weapon[wp.id];
  const img = p.fireAnim > 0 ? frames[1] : frames[0];
  const wh = h * 0.6, ww = (wh * 160) / 120;
  const bx = Math.cos(p.bob) * w * 0.018 * Math.min(1, p.moving);
  const by = Math.abs(Math.sin(p.bob)) * h * 0.03 * Math.min(1, p.moving);
  const sw = p.switchAnim > 0 ? (p.switchAnim / 0.25) * wh * 0.6 : 0;
  const dead = p.dead ? Math.min(1, p.deadT) * wh : 0;
  // L'arme est assombrie selon la lumière reçue (ambiance + lampe).
  const L = game.lighting();
  const lum = Math.max(0.12, Math.min(1, L.ambient + L.flash * 0.8));
  let src = img;
  if (lum < 0.98) {
    const g = weaponBuf.getContext('2d');
    g.globalCompositeOperation = 'copy'; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${1 - lum})`; g.fillRect(0, 0, 160, 120);
    src = weaponBuf;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, Math.round(w / 2 - ww / 2 + bx), Math.round(h - wh + by + sw + dead + h * 0.02), Math.round(ww), Math.round(wh));
}

// ——— HUD ———
const H = { bat: $('#h-bat'), health: $('#h-health'), armor: $('#h-armor'), ammo: $('#h-ammo'), wname: $('#h-wname'), score: $('#h-score'), kb: $('#k-blue'), kr: $('#k-red'), bossbar: $('#bossbar'), bossfill: $('#bossbar i'), bossname: $('#bossbar span') };
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
  const bat = Math.ceil(p.battery);
  if (last.bat !== bat) { last.bat = bat; H.bat.style.width = bat + '%'; }
  H.bat.classList.toggle('low', p.battery < 20);
  H.bat.classList.toggle('off', !p.lamp);
  H.kb.classList.toggle('on', p.keys.blue);
  H.kr.classList.toggle('on', p.keys.red);
  const b = game.boss;
  const showBoss = b && b.state !== 'idle' && b.state !== 'dead';
  H.bossbar.hidden = !showBoss;
  if (showBoss) setText(H.bossname, 'bn', b.d.name.toUpperCase());
  if (showBoss) H.bossfill.style.width = Math.max(0, (b.hp / (b.d.hp * DIFFICULTY[session.difficulty].hp)) * 100) + '%';
}

// Moniteur cardiaque animé
const ecg = $('#ecg').getContext('2d');
let ecgX = 0, ecgPhase = 0;
function drawEcg(dt) {
  const p = game.player;
  const rate = p.dead ? 0 : 1.2 + (100 - p.health) / 40 + (game.fear || 0) * 1.6;
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
  if (levelIndex === 0) { p.x = 21.5; p.y = 5.5; } else { p.x = 17.5; p.y = 8.5; }
  attract.enemies = attract.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) > 4 && e.d.kind !== 'boss');
  p.a = -Math.PI / 2;
}

// ——— Résolution ———
// Résolution interne : fixe, ou adaptée en continu pour tenir ~60 i/s.
const AUTO_STEPS = [160, 200, 240, 300, 360];
let autoQ = isTouch ? 2 : 3, frameAvg = 1 / 60, lastQChange = 0;
function adaptQuality(dt, now) {
  if (save.opts.quality !== 'auto' || state !== 'play') return;
  frameAvg = frameAvg * 0.95 + dt * 0.05;
  if (now - lastQChange < 1500) return;
  if (frameAvg > 1 / 48 && autoQ > 0) { autoQ--; lastQChange = now; resize(); }
  else if (frameAvg < 1 / 58 && autoQ < AUTO_STEPS.length - 1 && now - lastQChange > 8000) { autoQ++; lastQChange = now; resize(); }
}
function resize() {
  const dpr = 1;
  const hTarget = save.opts.quality === 'auto' ? AUTO_STEPS[autoQ] : save.opts.quality;
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
  adaptQuality((t - lastT) / 1000, t);
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
window.__manoir = window.__kryos = { get game() { return game; }, get state() { return state; }, startLevel: (i, d = 1) => { session = { difficulty: d, levelIndex: i, inventory: newPlayerState(LEVELS[i].loadout), totalTime: 0, ranked: false, deaths: 0, played: 0 }; startLevel(); }, LEVELS, contest, get session() { return session; } };
