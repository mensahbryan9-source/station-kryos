// Edge Function d'administration, protégée par le secret ADMIN_PASSWORD
// (en-tête x-admin-password). Utilisée par la page statique admin.html.
//   GET  /admin/overview          classement complet avec coordonnées + parties suspectes
//   GET  /admin/session?id=…      détail d'une partie (niveau par niveau)
//   GET  /admin/export            export CSV du classement
//   POST /admin/hide              { playerId, hidden } : masquer / afficher un pseudo
//   POST /admin/purge             { confirm: "SUPPRIMER TOUT" } : effacer toutes les données
import { CONFIG, HttpError, body, corsHeaders, db, ipHash, json, must, rateLimit, safeEqual, serve } from '../_shared/lib.ts';

async function authenticate(req: Request) {
  const ip = await ipHash(req);
  await rateLimit('admin:' + ip, 120);
  const expected = Deno.env.get('ADMIN_PASSWORD') || '';
  if (expected.length < 12) throw new HttpError(500, 'ADMIN_PASSWORD manquant ou trop court (12 caractères minimum)');
  const given = req.headers.get('x-admin-password') || '';
  if (!safeEqual(given, expected)) {
    await rateLimit('adminfail:' + ip, 8, 900); // 8 essais ratés par quart d'heure
    throw new HttpError(401, 'Mot de passe incorrect');
  }
}

async function ranking() {
  const rows = must(await db().from('scores')
    .select('player_id, session_id, score, levels_completed, difficulty, achieved_at, suspicious, players!inner(pseudo, first_name, last_name, contact, hidden, created_at)')
    .order('score', { ascending: false }).order('achieved_at', { ascending: true }), 'admin.ranking');
  return (rows as any[]).map((r, i) => ({
    rank: i + 1, playerId: r.player_id, sessionId: r.session_id,
    pseudo: r.players.pseudo, firstName: r.players.first_name, lastName: r.players.last_name, contact: r.players.contact,
    hidden: r.players.hidden, registeredAt: r.players.created_at,
    score: r.score, levels: r.levels_completed, difficulty: CONFIG.difficulties[r.difficulty].name,
    achievedAt: r.achieved_at, suspicious: r.suspicious,
  }));
}

async function overview(req: Request) {
  const rank = await ranking();
  const suspicious = must(await db().from('game_sessions')
    .select('id, player_id, difficulty, status, total_score, next_level, flags, started_at, players!inner(pseudo)')
    .eq('suspicious', true).order('started_at', { ascending: false }).limit(200), 'admin.suspicious');
  const { count: players } = await db().from('players').select('*', { count: 'exact', head: true });
  const { count: sessions } = await db().from('game_sessions').select('*', { count: 'exact', head: true });
  return json(req, {
    contest: CONFIG.contest, ranking: rank,
    suspicious: (suspicious as any[]).map((s) => ({ ...s, pseudo: s.players.pseudo, players: undefined, difficulty: CONFIG.difficulties[s.difficulty].name })),
    stats: { players, sessions },
  });
}

async function sessionDetail(req: Request, url: URL) {
  const id = url.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, 'Identifiant invalide');
  const s = must(await db().from('game_sessions').select('*, players!inner(pseudo, first_name, last_name, contact)').eq('id', id).maybeSingle(), 'admin.session');
  if (!s) throw new HttpError(404, 'Partie introuvable');
  const levels = must(await db().from('level_results').select('*').eq('session_id', id).order('level'), 'admin.levels');
  const others = must(await db().from('game_sessions').select('id, difficulty, status, total_score, next_level, suspicious, started_at').eq('player_id', s.player_id).order('started_at', { ascending: false }), 'admin.others');
  return json(req, { session: s, levels, otherSessions: others });
}

const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise les formules dans les tableurs
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function exportCsv(req: Request) {
  const rows = await ranking();
  const head = ['rang', 'pseudo', 'prénom', 'nom', 'contact', 'score', 'niveaux', 'difficulté', 'obtenu le', 'suspect', 'masqué', 'partie'];
  const lines = [head, ...rows.map((r) => [r.rank, r.pseudo, r.firstName, r.lastName, r.contact, r.score, r.levels, r.difficulty, r.achievedAt, r.suspicious ? 'oui' : 'non', r.hidden ? 'oui' : 'non', r.sessionId])];
  const csv = '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="classement-manoir.csv"', 'cache-control': 'no-store', ...corsHeaders(req) } });
}

async function hide(req: Request) {
  const b = await body(req);
  if (typeof b.playerId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.playerId)) throw new HttpError(400, 'Identifiant invalide');
  must(await db().from('players').update({ hidden: b.hidden === true }).eq('id', b.playerId), 'admin.hide');
  return json(req, { ok: true });
}

async function purge(req: Request) {
  const b = await body(req);
  if (b.confirm !== 'SUPPRIMER TOUT') throw new HttpError(400, 'Confirmation manquante : envoyer { "confirm": "SUPPRIMER TOUT" }');
  must(await db().rpc('purge_all'), 'admin.purge');
  return json(req, { ok: true, purgedAt: new Date().toISOString() });
}

serve(async (req, path) => {
  await authenticate(req);
  const url = new URL(req.url);
  switch (path) {
    case 'overview': return overview(req);
    case 'session': return sessionDetail(req, url);
    case 'export': return exportCsv(req);
    case 'hide': return hide(req);
    case 'purge': return purge(req);
    default: throw new HttpError(404, 'Route inconnue');
  }
});
