import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { levelManifest, scoreLevel, timeCoef, runTotal, validateLevel } from '../js/scoring.js';

// Niveau de test : 3 ennemis toujours présents, 1 boss, marqueurs de palier 2/3/4, 2 secrets.
const LEVEL = {
  map: [
    '########',
    '#P.g.s.#',
    '#..2.3.#',
    '#.4*.m.#',
    '#..O*..#',
    '########',
  ],
  extraEnemies: ['g', 's'],
};
const BOSS_LEVEL = { ...LEVEL, requireBoss: true };
const ev = (o = {}) => ({ kills: [], secrets: [], hpEnd: 50, deaths: 0, time: 200, ...o });

test('manifeste : identifiants stables et paliers de difficulté', () => {
  const easy = levelManifest(LEVEL, 0), night = levelManifest(LEVEL, 3);
  assert.equal(easy.enemies.length, 7);
  assert.deepEqual(easy.present.map((e) => e.id), [0, 1, 5, 6]);       // g s m O
  assert.deepEqual(levelManifest(LEVEL, 1).present.map((e) => e.id), [0, 1, 2, 5, 6]);
  assert.deepEqual(levelManifest(LEVEL, 2).present.map((e) => e.id), [0, 1, 2, 3, 5, 6]);
  assert.equal(night.present.length, 7);
  assert.deepEqual(night.enemies.filter((e) => 'gs'.includes(e.type) && [2, 3, 4].includes(e.id)).map((e) => e.type), ['g', 's', 'g']);
  assert.equal(easy.secrets, 2);
});

test('coefficient de temps borné entre 0,5 et 2,0', () => {
  const par = CONFIG.levels[0].par;
  assert.equal(timeCoef(0, par), 1);
  assert.equal(timeCoef(0, par / 4), 2);
  assert.equal(timeCoef(0, par * 4), 0.5);
  assert.equal(timeCoef(0, par * 2), 0.5);
  assert.equal(timeCoef(0, par / 1.5), 1.5);
});

test('score d\'un niveau = points × coef difficulté × coef temps', () => {
  const S = CONFIG.scoring, par = CONFIG.levels[0].par;
  // Normal (×1,5), tue g (id 0) et m (id 5), 1 secret, 60 PV, 1 mort, au temps de référence.
  const r = scoreLevel(LEVEL, 0, 1, ev({ kills: [0, 5], secrets: [1], hpEnd: 60, deaths: 1, time: par }));
  const points = S.enemy.g + S.enemy.m + S.secret + 60 * S.perHpLeft - S.deathPenalty;
  assert.equal(r.points, points);
  assert.equal(r.diffMult, 1.5);
  assert.equal(r.timeCoef, 1);
  assert.equal(r.score, Math.round(points * 1.5));
  // Cauchemar, deux fois plus vite : ×3 × 2.
  const r2 = scoreLevel(LEVEL, 0, 3, ev({ kills: [0], hpEnd: 100, time: par / 2 }));
  assert.equal(r2.score, Math.round((S.enemy.g + 100 * S.perHpLeft) * 3 * 2));
});

test('les points ne deviennent jamais négatifs', () => {
  const r = scoreLevel(LEVEL, 0, 0, ev({ hpEnd: 1, deaths: 20 }));
  assert.equal(r.points, 0);
  assert.equal(r.score, 0);
});

test('total de partie = somme des niveaux complétés', () => {
  assert.equal(runTotal([{ score: 1200 }, { score: 800 }]), 2000);
  assert.equal(runTotal([]), 0);
});

test('validation : rejets', () => {
  const min = CONFIG.levels[0].minTime;
  const bad = (e, ctx, lvl = LEVEL, d = 0) => validateLevel(lvl, 0, d, e, ctx);
  assert.match(bad(ev({ time: min - 1 })).reason, /temps impossible/);
  assert.match(bad(ev({ time: NaN })).reason, /temps invalide/);
  assert.match(bad(ev({ kills: [0, 0] })).reason, /deux fois/);
  assert.match(bad(ev({ kills: [2] })).reason, /absent/);                 // palier 2 absent en Facile
  assert.match(bad(ev({ kills: [0, 1, 5, 6, 2] })).reason, /plus d'éliminations/);
  assert.match(bad(ev({ secrets: [2] })).reason, /secrets/);
  assert.match(bad(ev({ hpEnd: 0 })).reason, /PV/);
  assert.match(bad(ev({ hpEnd: 101 })).reason, /PV/);
  assert.match(bad(ev({ deaths: -1 })).reason, /morts/);
  assert.match(bad(ev({ kills: [0] }), {}, BOSS_LEVEL).reason, /boss/);
  assert.match(bad(ev(), { serverElapsed: min - 5, previousMinTime: 0 }).reason, /trop courte/);
  assert.match(validateLevel(LEVEL, 99, 0, ev()).reason, /inconnu/);
});

test('validation : acceptations et signalements', () => {
  const par = CONFIG.levels[0].par, min = CONFIG.levels[0].minTime;
  const ok = validateLevel(LEVEL, 0, 3, ev({ kills: [0, 1, 2, 3, 4, 5, 6], secrets: [0, 1], time: 300 }), { serverElapsed: 400, previousMinTime: 0, previousTime: 0 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.flags, []);
  const fast = validateLevel(LEVEL, 0, 3, ev({ kills: [0, 1, 2, 3, 4, 5, 6], time: Math.max(min, par * 0.2) }), {});
  assert.equal(fast.ok, true);
  assert.ok(fast.flags.includes('niveau anormalement rapide'));
  const crowd = { map: ['#'.repeat(34), '#P' + 'g'.repeat(31) + '#', '#'.repeat(34)] };
  const spree = validateLevel(crowd, 0, 0, ev({ kills: [...Array(31).keys()], time: min }), {});
  assert.ok(spree.flags.some((f) => /cadence/.test(f)));
  const clock = validateLevel(LEVEL, 0, 0, ev({ time: 300 }), { serverElapsed: 200, previousMinTime: 0, previousTime: 0 });
  assert.ok(clock.flags.includes('temps de jeu supérieur au temps réel'));
});
