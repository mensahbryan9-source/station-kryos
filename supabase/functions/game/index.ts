// Edge Function publique du concours.
//   POST /game/register        inscription (ou reconnexion avec les mêmes informations)
//   POST /game/session/start   début de partie → jeton de session signé
//   POST /game/level/end       fin de niveau → score recalculé et validé côté serveur
//   POST /game/session/end     fin de partie → détail du score et rang
//   GET  /game/leaderboard     top 20 public (pseudos uniquement), + rang du joueur si ?token=
import { CONFIG, HttpError, body, contestEnd, db, graceEnd, ipHash, isOpen, json, must, rateLimit, serve, sign, verify } from '../_shared/lib.ts';
import { LEVELS } from '../_shared/levels.js';
import { scoreLevel, validateLevel } from '../_shared/scoring.js';

const CONSENT = 'Mes données servent uniquement au concours et seront supprimées après la remise du lot.';
const RL = CONFIG.rateLimit;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max + 1) : '');

// Email en minuscules, ou téléphone en chiffres avec indicatif (Bénin +229 par défaut).
export function normalizeContact(raw: string): string | null {
  const v = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120) return 'e:' + v.toLowerCase();
  if (!/^[+\d][\d\s.\-()]{6,22}$/.test(v)) return null;
  let d = v.replace(/\D/g, '');
  if (v.startsWith('00')) d = d.slice(2);
  else if (!v.startsWith('+') && (d.length === 8 || (d.length === 10 && d.startsWith('01')))) d = '229' + d;
  return d.length >= 8 && d.length <= 15 ? 't:' + d : null;
}

const same = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

async function register(req: Request) {
  await rateLimit('reg:' + (await ipHash(req)), 10);
  if (!isOpen()) throw new HttpError(403, 'Le concours est terminé');
  const b = await body(req);
  const pseudo = clean(b.pseudo, 16), first = clean(b.firstName, 60), last = clean(b.lastName, 60), contact = clean(b.contact, 120);
  if (!/^[\p{L}\p{N} _.\-]{3,16}$/u.test(pseudo)) throw new HttpError(400, 'Pseudo : 3 à 16 caractères (lettres, chiffres, espace, _ . -)');
  if (!first || first.length > 60 || !last || last.length > 60) throw new HttpError(400, 'Nom et prénom obligatoires');
  const norm = normalizeContact(contact);
  if (!norm) throw new HttpError(400, 'Email ou numéro de téléphone invalide');
  if (b.consent !== true) throw new HttpError(400, 'Le consentement est obligatoire pour participer');

  const existing = must(await db().from('players').select('id, pseudo, first_name, last_name').eq('contact_norm', norm).maybeSingle(), 'players.select');
  if (existing) {
    // Reconnexion : mêmes contact, nom, prénom et pseudo.
    if (!same(existing.pseudo, pseudo) || !same(existing.first_name, first) || !same(existing.last_name, last)) {
      throw new HttpError(409, 'Ce contact est déjà inscrit avec un autre pseudo ou un autre nom');
    }
    return json(req, { token: await sign('player', existing.id), pseudo: existing.pseudo, returning: true });
  }
  const res = await db().from('players').insert({ pseudo, first_name: first, last_name: last, contact, contact_norm: norm, consent_text: CONSENT }).select('id, pseudo').single();
  if (res.error) {
    if (res.error.code === '23505') {
      throw new HttpError(409, /pseudo/.test(res.error.message) ? 'Ce pseudo est déjà pris' : 'Ce contact est déjà inscrit');
    }
    must(res, 'players.insert');
  }
  return json(req, { token: await sign('player', res.data!.id), pseudo: res.data!.pseudo, returning: false }, 201);
}

async function startSession(req: Request) {
  const b = await body(req);
  const playerId = await verify('player', b.token);
  const ip = await ipHash(req);
  await rateLimit('ip:' + ip, RL.perIpPerMinute);
  await rateLimit('pl:' + playerId, RL.perPlayerPerMinute);
  await rateLimit('start:' + playerId, 20, 3600); // au plus 20 parties par heure
  if (!isOpen()) throw new HttpError(403, 'Le concours est terminé : les nouvelles parties ne sont plus classées');
  const difficulty = b.difficulty;
  if (!Number.isInteger(difficulty) || (difficulty as number) < 0 || (difficulty as number) >= CONFIG.difficulties.length) throw new HttpError(400, 'Difficulté invalide');
  const player = must(await db().from('players').select('id').eq('id', playerId).maybeSingle(), 'players.select');
  if (!player) throw new HttpError(401, 'Joueur inconnu (données supprimées ?)');
  // Une seule partie active à la fois : les précédentes sont abandonnées (leurs niveaux restent comptés).
  must(await db().from('game_sessions').update({ status: 'abandoned', ended_at: new Date().toISOString() }).eq('player_id', playerId).eq('status', 'active'), 'sessions.abandon');
  const s = must(await db().from('game_sessions').insert({
    player_id: playerId, difficulty, ip_hash: ip, user_agent: (req.headers.get('user-agent') || '').slice(0, 200),
  }).select('id, started_at').single(), 'sessions.insert');
  return json(req, { session: await sign('session', s.id), startedAt: s.started_at, levels: CONFIG.levels.length }, 201);
}

async function levelEnd(req: Request) {
  const b = await body(req);
  const sessionId = await verify('session', b.session);
  const ip = await ipHash(req);
  await rateLimit('ip:' + ip, RL.perIpPerMinute);
  const s = must(await db().from('game_sessions').select('*').eq('id', sessionId).maybeSingle(), 'sessions.select');
  if (!s) throw new HttpError(404, 'Session inconnue');
  await rateLimit('pl:' + s.player_id, RL.perPlayerPerMinute);

  const now = Date.now(), started = new Date(s.started_at).getTime();
  // Après la fin : accepté seulement dans le délai de grâce, pour une partie commencée avant la fin.
  const late = !isOpen(now);
  if (late && (now > graceEnd() || started >= contestEnd())) {
    throw new HttpError(403, 'Le concours est terminé : ce résultat n\'est plus accepté');
  }
  const level = b.level;
  if (!Number.isInteger(level) || (level as number) < 0 || (level as number) >= LEVELS.length) throw new HttpError(400, 'Niveau invalide');
  // Résultat déjà enregistré (renvoi depuis la file d'attente) : réponse idempotente.
  const dup = must(await db().from('level_results').select('score, points, time_coef, diff_mult, kill_points, secret_points, hp_points, death_penalty').eq('session_id', sessionId).eq('level', level).maybeSingle(), 'results.dup');
  if (dup) return json(req, { ok: true, duplicate: true, level, result: dup, total: s.total_score });
  if (s.status !== 'active') throw new HttpError(409, 'Cette partie est terminée');
  if (s.next_level !== level) throw new HttpError(409, 'Niveau inattendu', { expected: s.next_level });

  const ev = b.events as Record<string, unknown>;
  if (!ev || typeof ev !== 'object') throw new HttpError(400, 'Événements manquants');
  const kills = Array.isArray(ev.kills) ? ev.kills.slice(0, 200) : ev.kills;
  const secrets = Array.isArray(ev.secrets) ? ev.secrets.slice(0, 20) : ev.secrets;
  const events = { kills, secrets, hpEnd: ev.hpEnd, deaths: ev.deaths, time: ev.time };
  const previousMinTime = CONFIG.levels.slice(0, level as number).reduce((sum, l) => sum + l.minTime, 0);
  const serverElapsed = (now - started) / 1000;
  const v = validateLevel(LEVELS[level as number], level, s.difficulty, events, { serverElapsed, previousMinTime, previousTime: s.client_time_total });
  if (!v.ok) {
    // Rejet : on garde une trace sur la session pour l'admin.
    await db().from('game_sessions').update({ flags: [...s.flags, `rejet niv.${(level as number) + 1} : ${v.reason}`], suspicious: true }).eq('id', sessionId);
    throw new HttpError(422, `Résultat refusé : ${v.reason}`);
  }
  const r = scoreLevel(LEVELS[level as number], level, s.difficulty, events);
  const flags = v.flags.map((f: string) => `niv.${(level as number) + 1} : ${f}`);
  if (late) flags.push(`niv.${(level as number) + 1} : reçu après la fin (délai de grâce)`);
  const out = must(await db().rpc('submit_level', {
    p_session: sessionId, p_level: level, p_kills: events.kills, p_secrets: events.secrets, p_hp: events.hpEnd, p_deaths: events.deaths,
    p_client_time: events.time, p_server_elapsed: serverElapsed, p_kill_points: r.killPoints, p_secret_points: r.secretPoints,
    p_hp_points: r.hpPoints, p_death_penalty: r.deathPenalty, p_points: r.points, p_diff_mult: r.diffMult, p_time_coef: r.timeCoef,
    p_score: r.score, p_flags: flags, p_late: late, p_levels_total: LEVELS.length,
  }), 'submit_level') as Record<string, unknown>;
  if (out.error) throw new HttpError(409, String(out.error), { expected: out.expected });
  return json(req, { ok: true, level, result: r, total: out.total, finished: out.finished });
}

async function sessionEnd(req: Request) {
  const b = await body(req);
  const sessionId = await verify('session', b.session);
  await rateLimit('ip:' + (await ipHash(req)), RL.perIpPerMinute);
  const s = must(await db().from('game_sessions').select('*').eq('id', sessionId).maybeSingle(), 'sessions.select');
  if (!s) throw new HttpError(404, 'Session inconnue');
  if (s.status === 'active') {
    must(await db().from('game_sessions').update({ status: s.next_level >= LEVELS.length ? 'finished' : 'abandoned', ended_at: new Date().toISOString() }).eq('id', sessionId), 'sessions.end');
  }
  const levels = must(await db().from('level_results').select('level, kill_points, secret_points, hp_points, death_penalty, points, diff_mult, time_coef, score, client_time, kills, secrets, deaths').eq('session_id', sessionId).order('level'), 'results.select');
  const best = must(await db().from('scores').select('score, session_id').eq('player_id', s.player_id).maybeSingle(), 'scores.select');
  const rank = must(await db().rpc('player_rank', { p_player: s.player_id }), 'player_rank');
  return json(req, {
    total: s.total_score, levelsCompleted: s.next_level, difficulty: s.difficulty,
    levels, best: best ? best.score : 0, isBest: best ? best.session_id === sessionId : false, rank,
  });
}

async function leaderboard(req: Request, url: URL) {
  await rateLimit('lb:' + (await ipHash(req)), 60);
  const rows = must(await db().from('scores')
    .select('score, levels_completed, difficulty, achieved_at, players!inner(pseudo, hidden)')
    .order('score', { ascending: false }).order('achieved_at', { ascending: true }).limit(20), 'leaderboard');
  const top = (rows as any[]).map((r, i) => ({
    rank: i + 1,
    pseudo: r.players.hidden ? 'Joueur masqué' : r.players.pseudo,
    score: r.score, levels: r.levels_completed,
    difficulty: CONFIG.difficulties[r.difficulty].name, at: r.achieved_at,
  }));
  let me = null;
  const token = url.searchParams.get('token');
  if (token) {
    try {
      const id = await verify('player', token);
      const mine = must(await db().from('scores').select('score, levels_completed').eq('player_id', id).maybeSingle(), 'scores.me');
      const p = must(await db().from('players').select('pseudo').eq('id', id).maybeSingle(), 'players.me');
      if (p) me = { pseudo: p.pseudo, score: mine?.score ?? 0, levels: mine?.levels_completed ?? 0, rank: mine ? must(await db().rpc('player_rank', { p_player: id }), 'rank') : null };
    } catch { /* jeton invalide : classement public seul */ }
  }
  return json(req, { top, me, end: new Date(contestEnd()).toISOString(), frozen: !isOpen() }, 200, { 'cache-control': 'public, max-age=15' });
}

serve(async (req, path) => {
  const url = new URL(req.url);
  switch (path) {
    case 'register': return register(req);
    case 'session/start': return startSession(req);
    case 'level/end': return levelEnd(req);
    case 'session/end': return sessionEnd(req);
    case 'leaderboard': return leaderboard(req, url);
    case 'health': return json(req, { ok: true, open: isOpen(), end: new Date(contestEnd()).toISOString() });
    default: throw new HttpError(404, 'Route inconnue');
  }
});
