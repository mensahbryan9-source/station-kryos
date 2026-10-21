// Client de l'API du concours (Edge Functions Supabase).
import { CONFIG } from './config.js';

// URL des fonctions : ?api=… pour tester, Supabase local en développement, sinon la config.
export function apiBase() {
  const q = new URLSearchParams(location.search).get('api');
  if (q) return q.replace(/\/$/, '');
  if (['localhost', '127.0.0.1'].includes(location.hostname) && !CONFIG.api.forceRemote) return 'http://127.0.0.1:54321/functions/v1';
  return CONFIG.api.url.replace(/\/$/, '');
}
export const apiConfigured = () => !!apiBase();

export class ApiError extends Error {
  constructor(status, message, data = {}) { super(message); this.status = status; this.data = data; }
}

// Requête JSON avec délai maximal. status 0 = réseau indisponible.
export async function request(fn, route, { body, headers = {}, timeout = 12000, raw = false } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError(0, 'Serveur du concours non configuré');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${base}/${fn}/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible');
  } finally { clearTimeout(t); }
  if (raw && res.ok) return res;
  let data = {};
  try { data = await res.json(); } catch { /* réponse vide */ }
  if (!res.ok) throw new ApiError(res.status, data.error || `Erreur ${res.status}`, data);
  return data;
}
