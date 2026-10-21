// Participation au concours : compte joueur, session signée, envoi des niveaux
// avec file d'attente hors ligne (localStorage) et renvoi automatique.
import { request, apiBase } from './api.js';
import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { scoreLevel } from './scoring.js';

const K_PLAYER = 'manoir-player', K_QUEUE = 'manoir-queue', K_SESSION = 'manoir-session';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

// Erreurs « temporaires » : on garde le résultat et on réessaie plus tard.
const retryable = (e) => e.status === 0 || e.status === 429 || e.status >= 500;

class Contest extends EventTarget {
  constructor() {
    super();
    this.player = load(K_PLAYER, null);           // { token, pseudo }
    this.queue = load(K_QUEUE, []);               // [{ session, level, events, difficulty }]
    this.session = load(K_SESSION, null);         // { token, difficulty, results: { [level]: {...} } }
    this.flushing = false;
    addEventListener('online', () => this.flush());
    setInterval(() => this.flush(), 20000);
    setTimeout(() => this.flush(), 1500);
  }

  get configured() { return !!apiBase(); }
  get open() { return Date.now() < new Date(CONFIG.contest.end).getTime(); }
  get pending() { return this.queue.length; }
  emit() { this.dispatchEvent(new Event('change')); }

  async register(form) {
    const r = await request('game', 'register', { body: form });
    this.player = { token: r.token, pseudo: r.pseudo };
    save(K_PLAYER, this.player);
    this.emit();
    return r;
  }

  forget() {
    this.player = null; save(K_PLAYER, null);
    this.session = null; save(K_SESSION, null);
    this.emit();
  }

  // Démarre une partie classée ; lève une ApiError si impossible.
  async startRun(difficulty) {
    const r = await request('game', 'session/start', { body: { token: this.player.token, difficulty } });
    this.session = { token: r.session, difficulty, results: {} };
    save(K_SESSION, this.session);
    return this.session;
  }

  // Enregistre un niveau terminé : estimation locale immédiate, envoi en arrière-plan.
  submitLevel(level, events) {
    const s = this.session;
    const local = scoreLevel(LEVELS[level], level, s.difficulty, events);
    s.results[level] = { status: 'pending', local };
    save(K_SESSION, s);
    this.queue.push({ session: s.token, level, events, difficulty: s.difficulty });
    save(K_QUEUE, this.queue);
    this.emit();
    this.flush();
    return s.results[level];
  }

  result(level) { return this.session && this.session.results[level]; }

  async flush() {
    if (this.flushing || !this.queue.length || !this.configured) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        const res = this.session && this.session.token === item.session ? this.session.results[item.level] : null;
        try {
          const r = await request('game', 'level/end', { body: { session: item.session, level: item.level, events: item.events } });
          if (res) Object.assign(res, { status: 'ok', server: r.result, total: r.total });
        } catch (e) {
          if (retryable(e)) { if (res) res.status = 'offline'; break; }
          if (res) Object.assign(res, { status: 'rejected', error: e.message });
        }
        this.queue.shift();
        save(K_QUEUE, this.queue);
        if (this.session) save(K_SESSION, this.session);
        this.emit();
      }
    } finally {
      this.flushing = false;
      this.emit();
    }
  }

  // Termine la partie et renvoie le bilan serveur (ou une estimation locale si hors ligne).
  async endRun() {
    const s = this.session;
    if (!s) return null;
    await this.flush();
    const local = Object.entries(s.results).map(([lvl, r]) => ({ level: +lvl, ...(r.server || r.local), status: r.status, error: r.error }));
    if (this.queue.some((q) => q.session === s.token)) {
      return { offline: true, levels: local, total: local.filter((l) => l.status !== 'rejected').reduce((a, l) => a + l.score, 0) };
    }
    try {
      const r = await request('game', 'session/end', { body: { session: s.token } });
      this.session = null; save(K_SESSION, null);
      return { ...r, levels: r.levels.map((l) => ({ ...l, killPoints: l.kill_points, secretPoints: l.secret_points, hpPoints: l.hp_points, deathPenalty: l.death_penalty, diffMult: l.diff_mult, timeCoef: l.time_coef, status: 'ok' })) };
    } catch (e) {
      return { offline: true, error: e.message, levels: local, total: local.reduce((a, l) => a + l.score, 0) };
    }
  }

  async leaderboard() {
    const q = this.player ? `?token=${encodeURIComponent(this.player.token)}` : '';
    return request('game', 'leaderboard' + q);
  }
}

export const contest = new Contest();

export function countdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return d ? `${d} j ${pad(h)} h ${pad(m)} min` : `${pad(h)} h ${pad(m)} min ${pad(sec)} s`;
}
