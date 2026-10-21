// Utilitaires communs aux Edge Functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CONFIG } from './config.js';

export { CONFIG };

const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allow = ORIGINS.includes('*') ? '*' : ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-admin-password',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req), ...extra },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(what, res.error);
    throw new HttpError(500, 'Erreur serveur');
  }
  return res.data;
}

// ——— Signatures HMAC (jetons joueur et session) ———
const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;
function secretKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SESSION_SECRET');
  if (!secret || secret.length < 32) throw new HttpError(500, 'SESSION_SECRET manquant ou trop court (32 caractères minimum)');
  keyPromise ||= crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return keyPromise;
}
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function hmac(data: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await secretKey(), enc.encode(data)));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Jeton de la forme « <id>.<signature> » lié à un usage (player / session).
export async function sign(kind: string, id: string): Promise<string> {
  return `${id}.${await hmac(`${kind}:${id}`)}`;
}
export async function verify(kind: string, token: unknown): Promise<string> {
  if (typeof token !== 'string' || token.length > 200) throw new HttpError(401, 'Jeton invalide');
  const i = token.lastIndexOf('.');
  const id = token.slice(0, i), sig = token.slice(i + 1);
  if (i < 1 || !/^[0-9a-f-]{36}$/.test(id) || !safeEqual(sig, await hmac(`${kind}:${id}`))) throw new HttpError(401, 'Jeton invalide');
  return id;
}

// ——— Origine de la requête (adresse IP hachée, jamais stockée en clair) ———
// cf-connecting-ip est réécrit par Cloudflare (devant Supabase) : le client ne peut pas le falsifier,
// contrairement au début de x-forwarded-for. On ne garde de ce dernier que l'entrée ajoutée par le proxy.
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = (h.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return h.get('cf-connecting-ip') || h.get('x-real-ip') || fwd[fwd.length - 1] || 'inconnue';
}
export async function ipHash(req: Request): Promise<string> {
  return (await hmac(`ip:${clientIp(req)}`)).slice(0, 22);
}

export async function rateLimit(key: string, limit: number, windowSeconds = 60): Promise<void> {
  const { data, error } = await db().rpc('rl_hit', { p_key: key, p_limit: limit, p_window: windowSeconds });
  if (error) { console.error('rl_hit', error); return; } // en cas de panne, ne pas bloquer le jeu
  if (data === false) throw new HttpError(429, 'Trop de requêtes, réessayez dans une minute');
}

// ——— Fenêtre du concours ———
// CONTEST_END (secret facultatif) permet de tester la clôture en local sans toucher à la config.
export const contestEnd = () => new Date(Deno.env.get('CONTEST_END') || CONFIG.contest.end).getTime();
export const graceEnd = () => contestEnd() + CONFIG.contest.lateGraceMinutes * 60_000;
export const isOpen = (now = Date.now()) => now < contestEnd();

export async function body(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée');
  const text = await req.text();
  if (text.length > 20_000) throw new HttpError(413, 'Requête trop volumineuse');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch { throw new HttpError(400, 'JSON invalide'); }
}

// Exécute un gestionnaire en convertissant les erreurs en réponses JSON.
export function serve(handler: (req: Request, path: string) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
    const url = new URL(req.url);
    // /functions/v1/<nom>/<route> en production, /<nom>/<route> en local
    const path = url.pathname.replace(/^\/functions\/v1/, '').split('/').slice(2).join('/');
    try {
      return await handler(req, path);
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json(req, { error: 'Erreur serveur' }, 500);
    }
  });
}
