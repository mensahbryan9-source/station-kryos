// Calcul et validation du score. Module pur, partagé entre le jeu et les
// Edge Functions : le serveur recalcule tout à partir des événements bruts.
import { CONFIG } from './config.js';

const ENEMY_CHARS = 'gsmGO';
const TIER_CHARS = { 2: 1, 3: 2, 4: 3 }; // marqueur de carte → palier minimal

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isInt = (v) => Number.isInteger(v);

// Liste des ennemis et secrets d'un niveau pour une difficulté donnée.
// L'identifiant d'un ennemi est son rang parmi TOUS les marqueurs d'ennemis
// de la carte (lecture ligne par ligne), présents ou non à cette difficulté :
// il ne dépend donc pas de la difficulté.
export function levelManifest(level, difficulty) {
  const tier = CONFIG.difficulties[difficulty].spawnTier;
  const enemies = [];
  let id = 0, extra = 0, secrets = 0;
  level.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '*') secrets++;
      if (ENEMY_CHARS.includes(c)) {
        enemies.push({ id: id++, type: c, x, y, present: true });
      } else if (c in TIER_CHARS) {
        const pool = level.extraEnemies || ['g'];
        const type = pool[extra++ % pool.length];
        enemies.push({ id: id++, type, x, y, present: tier >= TIER_CHARS[c] });
      }
    }
  });
  return { enemies, present: enemies.filter((e) => e.present), secrets };
}

export function timeCoef(levelIndex, seconds) {
  const { min, max } = CONFIG.scoring.timeCoef;
  return clamp(CONFIG.levels[levelIndex].par / Math.max(1, seconds), min, max);
}

// Détail du score d'un niveau à partir des événements (supposés validés).
export function scoreLevel(level, levelIndex, difficulty, ev) {
  const S = CONFIG.scoring;
  const byId = new Map(levelManifest(level, difficulty).enemies.map((e) => [e.id, e]));
  const killPoints = ev.kills.reduce((sum, id) => sum + (S.enemy[byId.get(id).type] || 0), 0);
  const secretPoints = ev.secrets.length * S.secret;
  const hpPoints = ev.hpEnd * S.perHpLeft;
  const deathPenalty = ev.deaths * S.deathPenalty;
  const points = Math.max(0, killPoints + secretPoints + hpPoints - deathPenalty);
  const diffMult = CONFIG.difficulties[difficulty].scoreMult;
  const tCoef = timeCoef(levelIndex, ev.time);
  return {
    killPoints, secretPoints, hpPoints, deathPenalty, points,
    diffMult, timeCoef: Math.round(tCoef * 1000) / 1000,
    score: Math.round(points * diffMult * tCoef),
  };
}

export const runTotal = (levelScores) => levelScores.reduce((s, l) => s + l.score, 0);

// Validation d'un résultat de niveau.
// ctx.serverElapsed : secondes réelles écoulées depuis le début de la session (horloge serveur).
// ctx.previousMinTime : somme des temps minimaux des niveaux déjà validés de la session.
// Renvoie { ok: false, reason } pour un rejet, sinon { ok: true, flags: [...] }.
export function validateLevel(level, levelIndex, difficulty, ev, ctx = {}) {
  const L = CONFIG.levels[levelIndex];
  if (!L || !level) return { ok: false, reason: 'niveau inconnu' };
  if (!ev || typeof ev !== 'object') return { ok: false, reason: 'événements manquants' };
  const { kills, secrets, hpEnd, deaths, time } = ev;
  if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0 || time > 6 * 3600) return { ok: false, reason: 'temps invalide' };
  if (time < L.minTime) return { ok: false, reason: `temps impossible (${time.toFixed(1)} s < ${L.minTime} s)` };
  if (!Array.isArray(kills) || !kills.every(isInt)) return { ok: false, reason: 'liste des éliminations invalide' };
  if (!Array.isArray(secrets) || !secrets.every(isInt)) return { ok: false, reason: 'liste des secrets invalide' };
  if (!isInt(hpEnd) || hpEnd < 1 || hpEnd > CONFIG.player.maxHp) return { ok: false, reason: 'PV de fin invalides' };
  if (!isInt(deaths) || deaths < 0 || deaths > 999) return { ok: false, reason: 'nombre de morts invalide' };

  const manifest = levelManifest(level, difficulty);
  const present = new Set(manifest.present.map((e) => e.id));
  if (new Set(kills).size !== kills.length) return { ok: false, reason: 'élimination comptée deux fois' };
  if (kills.length > present.size) return { ok: false, reason: 'plus d\'éliminations que d\'ennemis présents' };
  if (!kills.every((id) => present.has(id))) return { ok: false, reason: 'ennemi absent du niveau' };
  if (new Set(secrets).size !== secrets.length || secrets.some((s) => s < 0 || s >= manifest.secrets)) return { ok: false, reason: 'secrets incohérents' };
  if (level.requireBoss) {
    const boss = manifest.present.find((e) => e.type === 'O');
    if (boss && !kills.includes(boss.id)) return { ok: false, reason: 'sortie sans avoir vaincu le boss' };
  }

  const AC = CONFIG.antiCheat;
  if (ctx.serverElapsed != null) {
    const needed = (ctx.previousMinTime || 0) + L.minTime;
    if (ctx.serverElapsed < needed) return { ok: false, reason: 'durée réelle de la session trop courte' };
  }
  const flags = [];
  if (time < L.par * AC.fastRatio) flags.push('niveau anormalement rapide');
  if (kills.length >= 6 && (kills.length / time) * 60 > AC.maxKillsPerMinute) flags.push('cadence d\'éliminations anormale');
  if (ctx.serverElapsed != null && ctx.previousTime != null && ctx.previousTime + time > ctx.serverElapsed + AC.clientClockTolerance) flags.push('temps de jeu supérieur au temps réel');
  return { ok: true, flags };
}
