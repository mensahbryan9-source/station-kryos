// Tests d'intégration de l'API (Supabase local : `npx supabase start` puis
// `npx supabase functions serve --env-file supabase/functions/.env`).
// Lancement : npm run test:api   (ignorés si API_URL n'est pas défini)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { LEVELS } from '../js/levels.js';
import { levelManifest, scoreLevel } from '../js/scoring.js';

const API = process.env.API_URL;            // ex. http://127.0.0.1:54321
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
const ADMIN = process.env.ADMIN_PASSWORD || (() => { try { return /ADMIN_PASSWORD=(.*)/.exec(readFileSync('supabase/functions/.env', 'utf8'))[1]; } catch { return ''; } })();
const skip = !API && 'API_URL non défini';
const LOCAL = /127\.0\.0\.1|localhost/.test(API || '');

let ipCounter = 0;
const freshIp = () => `10.0.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;
const uniq = () => Math.random().toString(36).slice(2, 8);

async function call(fn, route, { body, method = body ? 'POST' : 'GET', ip = '10.9.9.9', headers = {} } = {}) {
  const res = await fetch(`${API}/functions/v1/${fn}/${route}`, {
    // En local on simule plusieurs IP ; en production Cloudflare refuse cet en-tête (erreur 1000).
    method, headers: { 'content-type': 'application/json', ...(LOCAL ? { 'cf-connecting-ip': ip } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const game = (route, body, ip) => call('game', route, { body, ip });

// Vieillit une session directement en base (clé service_role) pour simuler le temps réel écoulé.
async function ageSession(sessionToken, seconds) {
  const id = sessionToken.split('.')[0];
  const r = await fetch(`${API}/rest/v1/game_sessions?id=eq.${id}`, {
    method: 'PATCH', headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ started_at: new Date(Date.now() - seconds * 1000).toISOString() }),
  });
  assert.ok(r.ok, 'vieillissement de la session');
}

async function newPlayer(ip = freshIp()) {
  const tag = uniq();
  const info = { pseudo: `Spectre_${tag}`, firstName: 'Ada', lastName: `Test${tag}`, contact: `${tag}@exemple.bj`, consent: true };
  const r = await game('register', info, ip);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { ...info, token: r.data.token, ip };
}

const allKills = (lvl, diff) => levelManifest(LEVELS[lvl], diff).present.map((e) => e.id);

test('RLS : la clé anon ne peut ni lire ni écrire les tables', { skip }, async () => {
  const h = { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' };
  for (const t of ['players', 'scores', 'game_sessions', 'level_results']) {
    const r = await fetch(`${API}/rest/v1/${t}?select=*`, { headers: h });
    assert.ok(r.status === 401 || r.status === 403 || (r.ok && (await r.json()).length === 0), `lecture ${t} : ${r.status}`);
  }
  const w = await fetch(`${API}/rest/v1/scores`, { method: 'POST', headers: h, body: JSON.stringify({ score: 999999 }) });
  assert.ok(w.status >= 400, `écriture scores refusée (${w.status})`);
  const rpc = await fetch(`${API}/rest/v1/rpc/purge_all`, { method: 'POST', headers: h, body: '{}' });
  assert.ok(rpc.status >= 400, `rpc purge_all refusée (${rpc.status})`);
});

test('inscription : validations, unicité et reconnexion', { skip }, async () => {
  const ip = freshIp();
  assert.equal((await game('register', { pseudo: 'Abc', firstName: 'A', lastName: 'B', contact: 'x@y.bj' }, ip)).status, 400, 'sans consentement');
  assert.equal((await game('register', { pseudo: 'A', firstName: 'A', lastName: 'B', contact: 'x@y.bj', consent: true }, ip)).status, 400, 'pseudo trop court');
  assert.equal((await game('register', { pseudo: 'Abcd', firstName: 'A', lastName: 'B', contact: 'pas-un-contact', consent: true }, ip)).status, 400, 'contact invalide');
  const p = await newPlayer(ip);
  const again = await game('register', { ...p, pseudo: p.pseudo.toUpperCase(), lastName: ` ${p.lastName} ` }, ip);
  assert.equal(again.status, 200); assert.equal(again.data.returning, true); assert.equal(again.data.token, p.token);
  assert.equal((await game('register', { ...p, pseudo: 'Autre_' + uniq() }, ip)).status, 409, 'même contact, autre pseudo');
  assert.equal((await game('register', { ...p, contact: uniq() + '@autre.bj' }, ip)).status, 409, 'pseudo déjà pris');
  // téléphone béninois : 01 97 00 00 00 et +229 01 97 00 00 00 désignent le même joueur
  const tag = uniq(), num = '01 9' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const t1 = await game('register', { pseudo: 'Tel_' + tag, firstName: 'Bio', lastName: 'Tel', contact: num, consent: true }, ip);
  assert.equal(t1.status, 201);
  const t2 = await game('register', { pseudo: 'Tel_' + tag, firstName: 'Bio', lastName: 'Tel', contact: '+229 ' + num, consent: true }, ip);
  assert.equal(t2.data.token, t1.data.token);
});

test('partie complète : score recalculé par le serveur, ordre et idempotence', { skip }, async () => {
  const p = await newPlayer();
  assert.equal((await game('session/start', { token: p.token, difficulty: 9 }, p.ip)).status, 400);
  assert.equal((await game('session/start', { token: p.token + 'x', difficulty: 1 }, p.ip)).status, 401, 'jeton falsifié');
  const s = await game('session/start', { token: p.token, difficulty: 2 }, p.ip);
  assert.equal(s.status, 201);
  const session = s.data.session;
  await ageSession(session, 3600);

  const ev0 = { kills: allKills(0, 2).slice(0, 5), secrets: [0], hpEnd: 80, deaths: 1, time: 140 };
  assert.equal((await game('level/end', { session, level: 1, events: ev0 }, p.ip)).status, 409, 'niveau 2 avant le 1');
  const r0 = await game('level/end', { session, level: 0, events: ev0 }, p.ip);
  assert.equal(r0.status, 200, JSON.stringify(r0.data));
  assert.equal(r0.data.result.score, scoreLevel(LEVELS[0], 0, 2, ev0).score, 'même score que le calcul partagé');
  const dup = await game('level/end', { session, level: 0, events: { ...ev0, hpEnd: 100 } }, p.ip);
  assert.equal(dup.data.duplicate, true); assert.equal(dup.data.result.score, r0.data.result.score, 'renvoi idempotent');

  const ev1 = { kills: allKills(1, 2), secrets: [], hpEnd: 55, deaths: 0, time: 200 };
  const r1 = await game('level/end', { session, level: 1, events: ev1 }, p.ip);
  assert.equal(r1.status, 200);
  assert.equal(r1.data.total, r0.data.result.score + r1.data.result.score);

  const end = await game('session/end', { session }, p.ip);
  assert.equal(end.status, 200);
  assert.equal(end.data.total, r1.data.total); assert.equal(end.data.levelsCompleted, 2); assert.equal(end.data.isBest, true);
  assert.ok(end.data.rank >= 1);
  assert.equal((await game('level/end', { session, level: 2, events: ev1 }, p.ip)).status, 409, 'session terminée = jeton inutilisable');

  const lb = await call('game', `leaderboard?token=${encodeURIComponent(p.token)}`, { ip: p.ip });
  assert.equal(lb.status, 200);
  assert.equal(lb.data.me.score, end.data.total);
  const row = lb.data.top.find((r) => r.pseudo === p.pseudo);
  if (row) assert.deepEqual(Object.keys(row).sort(), ['at', 'difficulty', 'levels', 'pseudo', 'rank', 'score'], 'aucune donnée personnelle');
  assert.ok(!JSON.stringify(lb.data).includes(p.contact), 'le contact n\'apparaît pas');
});

test('anti-triche : rejets côté serveur', { skip }, async () => {
  const p = await newPlayer();
  const session = (await game('session/start', { token: p.token, difficulty: 0 }, p.ip)).data.session;
  const ok = { kills: [0], secrets: [], hpEnd: 50, deaths: 0, time: 100 };
  // Session qui vient de commencer : le temps réel est insuffisant, quel que soit le temps annoncé.
  const fast = await game('level/end', { session, level: 0, events: ok }, p.ip);
  assert.equal(fast.status, 422); assert.match(fast.data.error, /trop courte/);
  await ageSession(session, 3600);
  const bad = async (events, re) => { const r = await game('level/end', { session, level: 0, events }, p.ip); assert.equal(r.status, 422, JSON.stringify(r.data)); assert.match(r.data.error, re); };
  await bad({ ...ok, time: CONFIG.levels[0].minTime - 1 }, /temps impossible/);
  await bad({ ...ok, kills: [...Array(60).keys()] }, /plus d'éliminations|absent/);
  await bad({ ...ok, kills: [0, 0] }, /deux fois/);
  // ennemi qui n'existe qu'à partir de Normal : impossible à tuer en Facile
  const easyIds = new Set(levelManifest(LEVELS[0], 0).present.map((e) => e.id));
  const tierOnly = levelManifest(LEVELS[0], 3).present.find((e) => !easyIds.has(e.id)).id;
  await bad({ ...ok, kills: [tierOnly] }, /absent/);
  await bad({ ...ok, hpEnd: 250 }, /PV/);
  await bad({ ...ok, secrets: [7] }, /secrets/);
  // Résultat valide mais très rapide : accepté et marqué suspect.
  const quick = await game('level/end', { session, level: 0, events: { ...ok, time: CONFIG.levels[0].minTime + 1 } }, p.ip);
  assert.equal(quick.status, 200);
  const adm = await call('admin', 'overview', { headers: { 'x-admin-password': ADMIN } });
  const sus = adm.data.suspicious.find((s) => s.id === session.split('.')[0]);
  assert.ok(sus && sus.flags.some((f) => /rapide/.test(f)), 'partie marquée suspecte');
  assert.ok(sus.flags.some((f) => /rejet/.test(f)), 'rejets tracés');
});

test('limite de requêtes par IP', { skip }, async () => {
  const ip = freshIp();
  let last;
  for (let i = 0; i < 12; i++) last = await game('register', { pseudo: 'x' }, ip);
  assert.equal(last.status, 429);
});

test('admin : mot de passe, classement complet, export, masquage', { skip }, async () => {
  const p = await newPlayer();
  const session = (await game('session/start', { token: p.token, difficulty: 1 }, p.ip)).data.session;
  await ageSession(session, 3600);
  await game('level/end', { session, level: 0, events: { kills: allKills(0, 1), secrets: [], hpEnd: 90, deaths: 0, time: 150 } }, p.ip);
  assert.equal((await call('admin', 'overview', { headers: { 'x-admin-password': 'mauvais' }, ip: freshIp() })).status, 401);
  const o = await call('admin', 'overview', { headers: { 'x-admin-password': ADMIN } });
  assert.equal(o.status, 200);
  const me = o.data.ranking.find((r) => r.pseudo === p.pseudo);
  assert.equal(me.contact, p.contact); assert.equal(me.lastName, p.lastName);
  const d = await call('admin', `session?id=${me.sessionId}`, { headers: { 'x-admin-password': ADMIN } });
  assert.equal(d.data.levels.length, 1);
  const csv = await call('admin', 'export', { headers: { 'x-admin-password': ADMIN } });
  assert.ok(typeof csv.data === 'string' && csv.data.includes(p.contact) && csv.data.includes('rang;pseudo'));
  assert.equal((await call('admin', 'hide', { body: { playerId: me.playerId, hidden: true }, headers: { 'x-admin-password': ADMIN } })).status, 200);
  const lb = await call('game', 'leaderboard', { ip: freshIp() });
  assert.ok(!lb.data.top.some((r) => r.pseudo === p.pseudo), 'pseudo masqué');
  assert.equal((await call('admin', 'purge', { body: { confirm: 'non' }, headers: { 'x-admin-password': ADMIN } })).status, 400, 'purge sans confirmation');
});
