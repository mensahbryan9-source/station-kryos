-- Schéma du jeu-concours « Le Manoir des Ombres ».
-- Toutes les tables ont la RLS activée SANS policy : ni anon ni authenticated
-- ne peuvent lire ou écrire. Seules les Edge Functions (clé service_role) y accèdent.

create extension if not exists pgcrypto;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null,
  first_name text not null,
  last_name text not null,
  contact text not null,                 -- tel que saisi (email ou téléphone)
  contact_norm text not null unique,     -- e:email en minuscules ou t:chiffres avec indicatif
  consent_text text not null,
  consent_at timestamptz not null default now(),
  hidden boolean not null default false, -- pseudo masqué par l'admin (modération)
  created_at timestamptz not null default now(),
  constraint pseudo_len check (char_length(pseudo) between 3 and 16)
);
create unique index players_pseudo_unique on public.players (lower(pseudo));

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  difficulty smallint not null check (difficulty between 0 and 3),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  next_level smallint not null default 0,
  total_score integer not null default 0,
  client_time_total real not null default 0,
  flags text[] not null default '{}',
  suspicious boolean not null default false,
  ip_hash text,
  user_agent text,
  started_at timestamptz not null default now(),
  last_event_at timestamptz,
  ended_at timestamptz
);
create index game_sessions_player on public.game_sessions (player_id);

create table public.level_results (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  level smallint not null,
  kills integer[] not null,
  secrets integer[] not null,
  hp_end integer not null,
  deaths integer not null,
  client_time real not null,
  server_elapsed real not null,
  kill_points integer not null,
  secret_points integer not null,
  hp_points integer not null,
  death_penalty integer not null,
  points integer not null,
  diff_mult real not null,
  time_coef real not null,
  score integer not null,
  flags text[] not null default '{}',
  late boolean not null default false,   -- reçu pendant le délai de grâce après la fin
  received_at timestamptz not null default now(),
  unique (session_id, level)
);

-- Meilleure partie de chaque joueur (celle qui compte au classement).
create table public.scores (
  player_id uuid primary key references public.players (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  score integer not null,
  levels_completed smallint not null,
  difficulty smallint not null,
  achieved_at timestamptz not null,      -- départage : la plus ancienne gagne
  suspicious boolean not null default false
);
create index scores_ranking on public.scores (score desc, achieved_at asc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.level_results enable row level security;
alter table public.scores enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.players, public.game_sessions, public.level_results, public.scores, public.rate_limits from anon, authenticated;

-- ——— Limitation de débit : renvoie vrai si la requête est autorisée ———
create function public.rl_hit(p_key text, p_limit integer, p_window integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  c integer;
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window) * p_window);
begin
  insert into rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 hour';
  end if;
  return c <= p_limit;
end $$;

-- ——— Enregistrement atomique d'un niveau validé ———
-- Le score a déjà été recalculé et validé par l'Edge Function ; ici on garantit
-- l'ordre des niveaux, l'unicité et la mise à jour du meilleur score.
create function public.submit_level(
  p_session uuid, p_level integer, p_kills integer[], p_secrets integer[], p_hp integer, p_deaths integer,
  p_client_time real, p_server_elapsed real, p_kill_points integer, p_secret_points integer, p_hp_points integer,
  p_death_penalty integer, p_points integer, p_diff_mult real, p_time_coef real, p_score integer,
  p_flags text[], p_late boolean, p_levels_total integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s game_sessions;
  new_total integer;
  done boolean;
  sus boolean;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found then return jsonb_build_object('error', 'session inconnue'); end if;
  if s.status <> 'active' then return jsonb_build_object('error', 'session terminée'); end if;
  if s.next_level <> p_level then return jsonb_build_object('error', 'niveau inattendu', 'expected', s.next_level); end if;

  insert into level_results (session_id, level, kills, secrets, hp_end, deaths, client_time, server_elapsed,
    kill_points, secret_points, hp_points, death_penalty, points, diff_mult, time_coef, score, flags, late)
  values (p_session, p_level, p_kills, p_secrets, p_hp, p_deaths, p_client_time, p_server_elapsed,
    p_kill_points, p_secret_points, p_hp_points, p_death_penalty, p_points, p_diff_mult, p_time_coef, p_score, p_flags, p_late);

  new_total := s.total_score + p_score;
  done := p_level + 1 >= p_levels_total;
  sus := s.suspicious or cardinality(p_flags) > 0;
  update game_sessions set
    next_level = p_level + 1, total_score = new_total,
    client_time_total = client_time_total + p_client_time,
    flags = flags || p_flags, suspicious = sus, last_event_at = now(),
    status = case when done then 'finished' else 'active' end,
    ended_at = case when done then now() else ended_at end
  where id = p_session;

  insert into scores (player_id, session_id, score, levels_completed, difficulty, achieved_at, suspicious)
  values (s.player_id, p_session, new_total, p_level + 1, s.difficulty, now(), sus)
  on conflict (player_id) do update set
    session_id = excluded.session_id, score = excluded.score, levels_completed = excluded.levels_completed,
    difficulty = excluded.difficulty, achieved_at = excluded.achieved_at, suspicious = excluded.suspicious
  where excluded.score > scores.score
     or (scores.session_id = excluded.session_id and excluded.score >= scores.score);

  return jsonb_build_object('ok', true, 'total', new_total, 'finished', done);
end $$;

-- Rang d'un joueur (même ordre que le classement public).
create function public.player_rank(p_player uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when me.player_id is null then null else
    (select count(*) from scores o where o.score > me.score or (o.score = me.score and o.achieved_at < me.achieved_at))::int + 1
  end
  from (select * from scores where player_id = p_player) me
  right join (select 1) one on true;
$$;

-- Suppression de toutes les données du concours (après la remise du lot).
create function public.purge_all()
returns void language plpgsql security definer set search_path = public as $$
begin
  truncate level_results, scores, game_sessions, players, rate_limits;
end $$;

revoke execute on function public.rl_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.submit_level(uuid, integer, integer[], integer[], integer, integer, real, real, integer, integer, integer, integer, integer, real, real, integer, text[], boolean, integer) from public, anon, authenticated;
revoke execute on function public.player_rank(uuid) from public, anon, authenticated;
revoke execute on function public.purge_all() from public, anon, authenticated;
