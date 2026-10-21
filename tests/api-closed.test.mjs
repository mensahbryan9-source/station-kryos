// Test de la clôture du concours. Les fonctions doivent tourner avec un secret
// CONTEST_END proche (ex. maintenant + 45 s), transmis aussi à ce test :
//   CONTEST_END=… npm run test:api:closed
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.js';
import { levelManifest } from '../js/scoring.js';

const API = process.env.API_URL, SERVICE = process.env.SERVICE_ROLE_KEY, END = process.env.CONTEST_END;
const skip = (!API || !END) && 'API_URL ou CONTEST_END non défini';

const game = async (route, body, ip = '10.8.0.1') => {
  const r = await fetch(`${API}/functions/v1/game/${route}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

test('clôture : délai de grâce, refus des nouvelles parties, classement figé', { skip, timeout: 180_000 }, async () => {
  const tag = Math.random().toString(36).slice(2, 8);
  const reg = await game('register', { pseudo: 'Fin_' + tag, firstName: 'Zoe', lastName: 'Fin', contact: tag + '@fin.bj', consent: true });
  assert.equal(reg.status, 201);
  const s = await game('session/start', { token: reg.data.token, difficulty: 1 });
  assert.equal(s.status, 201);
  const id = s.data.session.split('.')[0];
  await fetch(`${API}/rest/v1/game_sessions?id=eq.${id}`, { method: 'PATCH', headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' }, body: JSON.stringify({ started_at: new Date(Date.now() - 600_000).toISOString() }) });

  const wait = new Date(END).getTime() - Date.now() + 1500;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  assert.equal((await game('health')).data.open, false);
  assert.equal((await game('register', { pseudo: 'Tard_' + tag, firstName: 'A', lastName: 'B', contact: tag + '@tard.bj', consent: true }, '10.8.0.2')).status, 403, 'inscription refusée');
  assert.equal((await game('session/start', { token: reg.data.token, difficulty: 1 })).status, 403, 'nouvelle partie refusée');
  const kills = levelManifest(LEVELS[0], 1).present.map((e) => e.id).slice(0, 3);
  const late = await game('level/end', { session: s.data.session, level: 0, events: { kills, secrets: [], hpEnd: 60, deaths: 0, time: 160 } });
  assert.equal(late.status, 200, 'partie commencée avant la fin : acceptée pendant le délai de grâce');
  const lb = await game('leaderboard');
  assert.equal(lb.data.frozen, true);
});
