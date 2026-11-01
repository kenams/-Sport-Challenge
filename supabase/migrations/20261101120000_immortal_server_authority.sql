-- IMMORTAL — couche serveur fiable : pompes et tractions, validation, points, classements, événements, droits Pro.
-- Additive : aucune table ni donnée existante n'est supprimée. Annulation : 20261101120000_immortal_server_authority.rollback.sql
-- Principe : le client ne décide jamais d'un score, de points, d'un titre ou d'un droit. Tout passe par des fonctions serveur.

------------------------------------------------------------------------------------------------
-- 0. Verrouillage des failles du schéma d'origine
------------------------------------------------------------------------------------------------

-- Points, niveau, pièces : plus aucune écriture directe par le client.
drop policy if exists "allow upsert own stats" on public.players_stats;
drop policy if exists "allow update own stats" on public.players_stats;
drop policy if exists "allow upsert own wallet" on public.wallets;
drop policy if exists "allow update own wallet" on public.wallets;
drop policy if exists "allow insert own wallet log" on public.wallet_logs;
drop policy if exists "allow upsert own daily rewards" on public.daily_rewards;
drop policy if exists "allow update own daily rewards" on public.daily_rewards;
drop policy if exists "allow read authenticated" on public.wallet_logs;
create policy "wallet_logs_read_own" on public.wallet_logs for select using (auth.uid() = user_id);
drop policy if exists "allow read authenticated" on public.wallets;
create policy "wallets_read_own" on public.wallets for select using (auth.uid() = user_id);

-- Duels et punitions : réservés à la modération.
drop policy if exists "allow insert battle" on public.battles;
drop policy if exists "allow update battle" on public.battles;
drop policy if exists "allow read authenticated" on public.battles;
create policy "battles_read_participants" on public.battles for select
  using (auth.uid() in (player1_id, player2_id) or exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
drop policy if exists "allow insert punishment" on public.punishments;
drop policy if exists "allow update punishment" on public.punishments;
drop policy if exists "allow read authenticated" on public.punishments;
create policy "punishments_read_admin" on public.punishments for select
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
drop policy if exists "allow insert punishment log" on public.punishment_logs;
drop policy if exists "allow read authenticated" on public.punishment_logs;
create policy "punishment_logs_read_admin" on public.punishment_logs for select
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Jetons de notification : propriétaire uniquement.
drop policy if exists "allow read authenticated" on public.push_tokens;
drop policy if exists "allow upsert push tokens" on public.push_tokens;
drop policy if exists "allow update push tokens" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens for select using (auth.uid() = user_id);
create policy "push_tokens_insert_own" on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "push_tokens_update_own" on public.push_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Table users : propriétaire uniquement, pas de modification par le client.
drop policy if exists "allow read authenticated" on public.users;
drop policy if exists "allow insert users" on public.users;
drop policy if exists "allow update users" on public.users;
create policy "users_read_own" on public.users for select using (auth.uid() = id);

-- Journaux et télémétrie : plus d'écriture libre.
drop policy if exists "allow insert admin logs" on public.admin_logs;
drop policy if exists "allow read authenticated" on public.admin_logs;
create policy "admin_logs_read_admin" on public.admin_logs for select
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
drop policy if exists "allow insert events" on public.events;
drop policy if exists "allow read authenticated" on public.events;
create policy "events_read_admin" on public.events for select
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Anciens défis et réponses : lecture seule pour le client (l'historique reste visible), toute nouvelle activité passe par les tentatives.
drop policy if exists "allow insert own challenge" on public.challenges;
drop policy if exists "allow update own challenge" on public.challenges;
drop policy if exists "allow insert own response" on public.challenge_responses;
drop policy if exists "allow challenge owner update responses" on public.challenge_responses;
drop policy if exists "allow insert own response votes" on public.challenge_response_votes;

-- add_points ne doit jamais être appelable par un joueur.
revoke execute on function public.add_points(uuid, integer) from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- 1. Disciplines et formats d'épreuve (règles versionnées)
------------------------------------------------------------------------------------------------

create table if not exists public.disciplines (
  key text primary key,
  label_fr text not null,
  unit text not null default 'reps',
  active boolean not null default true,
  sort integer not null default 0
);

create table if not exists public.challenge_formats (
  key text primary key,
  discipline text not null references public.disciplines(key),
  label_fr text not null,
  description_fr text not null,
  duration_seconds integer,
  rules_version integer not null default 1,
  rules_fr text not null,
  framing_fr text not null,
  success_fr text not null,
  max_score integer not null check (max_score > 0),
  max_video_seconds integer not null default 180,
  active boolean not null default true
);

insert into public.disciplines (key, label_fr, unit, sort) values
  ('pushups', 'Pompes', 'répétitions', 1),
  ('pullups', 'Tractions', 'répétitions', 2)
on conflict (key) do update set label_fr = excluded.label_fr, unit = excluded.unit, sort = excluded.sort, active = true;

insert into public.challenge_formats
  (key, discipline, label_fr, description_fr, duration_seconds, rules_version, rules_fr, framing_fr, success_fr, max_score, max_video_seconds)
values
  ('pushups_60s', 'pushups', 'Pompes — 60 secondes', 'Un maximum de pompes complètes en 60 secondes.', 60, 1,
   'Départ en planche, bras tendus, genoux au sol interdits. À chaque répétition : poitrine à moins d''un poing du sol (coudes à 90° minimum), puis extension complète des bras, corps aligné (pas de bassin affaissé, pas de fesses en l''air). Une répétition incomplète ne compte pas. Une pause est permise en position haute. Durée : 60 secondes.',
   'Caméra de profil posée au sol, corps entier visible du premier au dernier mouvement, vidéo continue (pas de montage). Un chronomètre visible, ou la vidéo dure 60 s.',
   'Le score retenu est le nombre de répétitions complètes comptées par un modérateur pendant les 60 secondes.',
   200, 120),
  ('pullups_max', 'pullups', 'Tractions — maximum strict', 'Un maximum de tractions strictes en une seule série.', null, 1,
   'Départ suspendu bras tendus. À chaque répétition : menton au-dessus de la barre, puis redescente bras tendus. Pas d''élan (kipping interdit). Une seule série : elle s''arrête quand tu lâches la barre ou touches le sol. Une répétition incomplète ne compte pas.',
   'Caméra de face ou de profil, corps entier et barre visibles, vidéo continue de la prise de barre au dernier mouvement.',
   'Le score retenu est le nombre de tractions strictes complètes comptées par un modérateur dans la série.',
   100, 180)
on conflict (key) do update set
  label_fr = excluded.label_fr, description_fr = excluded.description_fr, duration_seconds = excluded.duration_seconds,
  rules_fr = excluded.rules_fr, framing_fr = excluded.framing_fr, success_fr = excluded.success_fr,
  max_score = excluded.max_score, max_video_seconds = excluded.max_video_seconds, active = true;

alter table public.disciplines enable row level security;
alter table public.challenge_formats enable row level security;
drop policy if exists "disciplines_read" on public.disciplines;
create policy "disciplines_read" on public.disciplines for select using (true);
drop policy if exists "formats_read" on public.challenge_formats;
create policy "formats_read" on public.challenge_formats for select using (true);

------------------------------------------------------------------------------------------------
-- 2. Profil : territoire déclaré (non vérifié) et langue
------------------------------------------------------------------------------------------------

alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists locale text default 'fr';
alter table public.profiles add column if not exists card_theme text;

------------------------------------------------------------------------------------------------
-- 3. Modération : qui est modérateur
------------------------------------------------------------------------------------------------

create or replace function public.is_moderator(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users au where au.user_id = p_user); $$;

------------------------------------------------------------------------------------------------
-- 4. Tentatives (défis et réponses)
------------------------------------------------------------------------------------------------

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('challenge', 'response', 'solo')),
  challenge_id uuid references public.attempts(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  title text check (title is null or char_length(title) <= 80),
  format_key text not null references public.challenge_formats(key),
  discipline text not null references public.disciplines(key),
  rules_version integer not null,
  declared_score integer not null check (declared_score >= 0),
  video_path text not null unique,
  video_duration_seconds numeric(6, 2),
  video_removed boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected', 'withdrawn')),
  decided_score integer check (decided_score is null or decided_score >= 0),
  decision_reason text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  city_declared text,
  region_declared text,
  country_declared text,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint attempts_response_has_challenge check (kind <> 'response' or challenge_id is not null),
  constraint attempts_validated_has_score check (status <> 'validated' or (decided_score is not null and decided_at is not null)),
  constraint attempts_rejected_has_reason check (status <> 'rejected' or (decision_reason is not null and char_length(decision_reason) > 0))
);

create unique index if not exists attempts_one_response_per_user on public.attempts (challenge_id, user_id) where kind = 'response' and status <> 'withdrawn';
create index if not exists attempts_format_status_idx on public.attempts (format_key, status, decided_score desc);
create index if not exists attempts_user_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_challenge_idx on public.attempts (challenge_id);

alter table public.attempts enable row level security;
drop policy if exists "attempts_read" on public.attempts;
create policy "attempts_read" on public.attempts for select to authenticated using (true);
revoke insert, update, delete on public.attempts from anon, authenticated;

create table if not exists public.attempt_reports (
  id bigserial primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('wrong_count', 'not_the_exercise', 'fake_or_edited', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, reporter_id)
);
alter table public.attempt_reports enable row level security;
drop policy if exists "attempt_reports_read" on public.attempt_reports;
create policy "attempt_reports_read" on public.attempt_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
revoke insert, update, delete on public.attempt_reports from anon, authenticated;

create table if not exists public.moderation_log (
  id bigserial primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  moderator_id uuid not null references auth.users(id) on delete set null,
  action text not null check (action in ('validate', 'reject', 'restore', 'remove_video', 'restore_video', 'dismiss_reports')),
  previous_status text,
  new_status text,
  decided_score integer,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
drop policy if exists "moderation_log_read" on public.moderation_log;
create policy "moderation_log_read" on public.moderation_log for select to authenticated
  using (
    public.is_moderator()
    or exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );
revoke insert, update, delete on public.moderation_log from anon, authenticated;

------------------------------------------------------------------------------------------------
-- 5. Fonctions serveur : profil, soumission, retrait, signalement, modération
------------------------------------------------------------------------------------------------

create or replace function public.ensure_player()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;
  insert into public.players_stats (user_id) values (uid) on conflict (user_id) do nothing;
end;
$$;

create or replace function public.update_my_profile(p_pseudo text, p_city text, p_region text, p_country text, p_locale text default 'fr')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_pseudo is null or char_length(trim(p_pseudo)) < 2 or char_length(trim(p_pseudo)) > 24 then
    raise exception 'invalid_pseudo' using errcode = 'P0001';
  end if;
  if p_locale not in ('fr', 'en') then raise exception 'invalid_locale' using errcode = 'P0001'; end if;
  insert into public.profiles (user_id, pseudo, city, region, country, locale)
  values (uid, trim(p_pseudo), nullif(trim(p_city), ''), nullif(trim(p_region), ''), nullif(trim(p_country), ''), p_locale)
  on conflict (user_id) do update set
    pseudo = excluded.pseudo, city = excluded.city, region = excluded.region, country = excluded.country, locale = excluded.locale;
  insert into public.players_stats (user_id) values (uid) on conflict (user_id) do nothing;
end;
$$;

create or replace function public.submit_attempt(
  p_format text,
  p_declared integer,
  p_video_path text,
  p_duration numeric default null,
  p_title text default null,
  p_challenge_id uuid default null,
  p_recipient uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fmt public.challenge_formats%rowtype;
  parent public.attempts%rowtype;
  prof public.profiles%rowtype;
  new_id uuid;
  attempt_kind text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.disciplines d where d.key = fmt.discipline and d.active) then
    raise exception 'discipline_disabled' using errcode = 'P0001';
  end if;

  if p_declared is null or p_declared < 1 or p_declared > fmt.max_score then
    raise exception 'invalid_score' using errcode = 'P0001';
  end if;
  if p_video_path is null or p_video_path not like uid::text || '/%' or char_length(p_video_path) > 200 then
    raise exception 'invalid_video_path' using errcode = 'P0001';
  end if;
  if p_duration is not null and (p_duration <= 0 or p_duration > fmt.max_video_seconds) then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;
  if p_title is not null and char_length(p_title) > 80 then
    raise exception 'invalid_title' using errcode = 'P0001';
  end if;

  if (select count(*) from public.attempts where user_id = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_challenge_id is not null then
    select * into parent from public.attempts where id = p_challenge_id;
    if not found or parent.kind <> 'challenge' or parent.status = 'withdrawn' or parent.status = 'rejected' then
      raise exception 'challenge_unavailable' using errcode = 'P0001';
    end if;
    if parent.user_id = uid then raise exception 'cannot_answer_own_challenge' using errcode = 'P0001'; end if;
    if parent.format_key <> p_format then raise exception 'format_mismatch' using errcode = 'P0001'; end if;
    if parent.recipient_user_id is not null and parent.recipient_user_id <> uid then
      raise exception 'challenge_reserved' using errcode = 'P0001';
    end if;
    attempt_kind := 'response';
  else
    attempt_kind := 'challenge';
  end if;

  if p_recipient is not null and p_recipient = uid then raise exception 'invalid_recipient' using errcode = 'P0001'; end if;

  select * into prof from public.profiles where user_id = uid;

  insert into public.attempts (
    user_id, kind, challenge_id, recipient_user_id, title, format_key, discipline, rules_version,
    declared_score, video_path, video_duration_seconds, city_declared, region_declared, country_declared
  ) values (
    uid, attempt_kind, p_challenge_id, case when attempt_kind = 'challenge' then p_recipient else null end,
    nullif(trim(p_title), ''), fmt.key, fmt.discipline, fmt.rules_version,
    p_declared, p_video_path, p_duration, prof.city, coalesce(prof.region, prof.department), prof.country
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.withdraw_attempt(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.attempts%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_id;
  if not found or a.user_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'pending' then raise exception 'only_pending_can_be_withdrawn' using errcode = 'P0001'; end if;
  update public.attempts set status = 'withdrawn' where id = p_id;
end;
$$;

create or replace function public.report_attempt(p_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_id uuid;
  inserted integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select user_id into owner_id from public.attempts where id = p_id;
  if owner_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if owner_id = uid then raise exception 'cannot_report_own_attempt' using errcode = 'P0001'; end if;
  if (select count(*) from public.attempt_reports where reporter_id = uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.attempt_reports (attempt_id, reporter_id, reason, details)
  values (p_id, uid, p_reason, left(p_details, 500))
  on conflict (attempt_id, reporter_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.attempts set report_count = report_count + 1 where id = p_id;
  end if;
end;
$$;

create or replace function public.moderate_attempt(p_id uuid, p_action text, p_score integer default null, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.attempts%rowtype;
  fmt public.challenge_formats%rowtype;
  prev text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_moderator(uid) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from public.attempts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if a.user_id = uid then raise exception 'moderator_cannot_decide_own_attempt' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = a.format_key;
  prev := a.status;

  if p_action = 'validate' then
    if a.status = 'withdrawn' then raise exception 'attempt_withdrawn' using errcode = 'P0001'; end if;
    if p_score is null or p_score < 0 or p_score > fmt.max_score then raise exception 'invalid_score' using errcode = 'P0001'; end if;
    update public.attempts set status = 'validated', decided_score = p_score, decision_reason = left(p_reason, 500),
      decided_by = uid, decided_at = now() where id = p_id;
  elsif p_action = 'reject' then
    if a.status = 'withdrawn' then raise exception 'attempt_withdrawn' using errcode = 'P0001'; end if;
    if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.attempts set status = 'rejected', decided_score = null, decision_reason = left(p_reason, 500),
      decided_by = uid, decided_at = now() where id = p_id;
  elsif p_action = 'restore' then
    update public.attempts set status = 'pending', decided_score = null, decision_reason = null, decided_by = null, decided_at = null
      where id = p_id and status in ('validated', 'rejected');
  elsif p_action = 'remove_video' then
    if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.attempts set video_removed = true where id = p_id;
  elsif p_action = 'restore_video' then
    update public.attempts set video_removed = false where id = p_id;
  elsif p_action = 'dismiss_reports' then
    update public.attempt_reports set status = 'dismissed', handled_by = uid, handled_at = now() where attempt_id = p_id and status = 'open';
  else
    raise exception 'unknown_action' using errcode = 'P0001';
  end if;

  if p_action in ('validate', 'reject') then
    update public.attempt_reports set status = 'actioned', handled_by = uid, handled_at = now() where attempt_id = p_id and status = 'open';
  end if;

  insert into public.moderation_log (attempt_id, moderator_id, action, previous_status, new_status, decided_score, reason)
  select p_id, uid, p_action, prev, status, decided_score, left(p_reason, 500) from public.attempts where id = p_id;
end;
$$;

------------------------------------------------------------------------------------------------
-- 6. Points, niveaux, duels, classements (calculés, donc jamais falsifiables ni comptés deux fois)
------------------------------------------------------------------------------------------------

-- Points d'une tentative validée : 10 points (3 tentatives par jour au plus), +5 si record personnel, +25 pour la toute première validation.
create or replace view public.attempt_points as
with validated as (
  select a.*,
         row_number() over (partition by a.user_id, (a.decided_at at time zone 'UTC')::date order by a.decided_at, a.id) as day_rank,
         row_number() over (partition by a.user_id order by a.decided_at, a.id) as nth_validated,
         coalesce(max(a.decided_score) over (partition by a.user_id, a.format_key order by a.decided_at, a.id
                  rows between unbounded preceding and 1 preceding), 0) as previous_best
  from public.attempts a
  where a.status = 'validated'
)
select user_id, id as attempt_id, format_key, decided_at,
       (case when day_rank <= 3 then 10 else 0 end
        + case when day_rank <= 3 and decided_score > previous_best then 5 else 0 end
        + case when nth_validated = 1 then 25 else 0 end) as points
from validated;

-- Résultat d'un duel : seulement quand les deux tentatives sont validées et qu'aucun signalement n'est ouvert.
create or replace view public.duel_results as
select c.id as challenge_id, c.user_id as challenger_id, r.id as response_id, r.user_id as responder_id, c.format_key,
       c.decided_score as challenger_score, r.decided_score as responder_score,
       case when c.decided_score > r.decided_score then c.user_id
            when r.decided_score > c.decided_score then r.user_id
            else null end as winner_id,
       (c.decided_score = r.decided_score) as is_draw,
       greatest(c.decided_at, r.decided_at) as decided_at
from public.attempts c
join public.attempts r on r.challenge_id = c.id and r.kind = 'response' and r.status = 'validated'
where c.kind = 'challenge' and c.status = 'validated'
  and not exists (
    select 1 from public.attempt_reports ar
    where ar.attempt_id in (c.id, r.id) and ar.status = 'open'
  );

create or replace view public.player_points as
select user_id, sum(points)::integer as points from (
  select user_id, points from public.attempt_points
  union all
  select winner_id as user_id, 20 from public.duel_results where winner_id is not null
  union all
  select challenger_id, 10 from public.duel_results where is_draw
  union all
  select responder_id, 10 from public.duel_results where is_draw
) t
group by user_id;

create or replace view public.player_stats_v2 as
select p.user_id,
       coalesce(pp.points, 0) as points,
       1 + floor(sqrt(coalesce(pp.points, 0) / 25.0))::integer as level,
       (select count(*) from public.attempts a where a.user_id = p.user_id and a.status = 'validated') as validated_count
from public.profiles p
left join public.player_points pp on pp.user_id = p.user_id;

-- Classement : meilleur score validé par joueur ; à score égal, le premier à l'avoir réalisé est classé devant.
create or replace function public.leaderboard(p_format text, p_scope text default 'world', p_value text default null, p_limit integer default 50)
returns table (rank bigint, user_id uuid, pseudo text, best_score integer, attempt_id uuid, achieved_at timestamptz, city text, region text, country text)
language sql stable security definer set search_path = public
as $$
  with best as (
    select distinct on (a.user_id)
           a.user_id, a.decided_score, a.id, a.decided_at, a.city_declared, a.region_declared, a.country_declared
    from public.attempts a
    where a.status = 'validated' and a.format_key = p_format
      and (
        p_scope = 'world'
        or (p_scope = 'country' and lower(a.country_declared) = lower(p_value))
        or (p_scope = 'region' and lower(a.region_declared) = lower(p_value))
        or (p_scope = 'city' and lower(a.city_declared) = lower(p_value))
      )
    order by a.user_id, a.decided_score desc, a.decided_at asc
  )
  select row_number() over (order by b.decided_score desc, b.decided_at asc, b.user_id) as rank,
         b.user_id, pr.pseudo, b.decided_score, b.id, b.decided_at, b.city_declared, b.region_declared, b.country_declared
  from best b
  left join public.profiles pr on pr.user_id = b.user_id
  where p_scope in ('world', 'country', 'region', 'city')
  order by rank
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.my_stats()
returns table (points integer, level integer, validated_count bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(pp.points, 0), 1 + floor(sqrt(coalesce(pp.points, 0) / 25.0))::integer,
         (select count(*) from public.attempts a where a.user_id = auth.uid() and a.status = 'validated')
  from (select auth.uid() as uid) me
  left join public.player_points pp on pp.user_id = me.uid;
$$;

------------------------------------------------------------------------------------------------
-- 7. Défi de la semaine
------------------------------------------------------------------------------------------------

create table if not exists public.weekly_challenges (
  week_start date primary key,
  format_key text not null references public.challenge_formats(key),
  note_fr text
);
alter table public.weekly_challenges enable row level security;
drop policy if exists "weekly_read" on public.weekly_challenges;
create policy "weekly_read" on public.weekly_challenges for select using (true);

create or replace function public.current_weekly_challenge()
returns table (week_start date, format_key text, note_fr text)
language sql stable security definer set search_path = public
as $$
  select w.week_start, w.format_key, w.note_fr from public.weekly_challenges w
  where w.week_start <= (now() at time zone 'UTC')::date
  order by w.week_start desc limit 1;
$$;

------------------------------------------------------------------------------------------------
-- 8. Événements (affrontements annoncés), soutiens et rappels
------------------------------------------------------------------------------------------------

create table if not exists public.duel_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  format_key text not null references public.challenge_formats(key),
  discipline text not null references public.disciplines(key),
  player_a uuid not null references auth.users(id) on delete cascade,
  player_b uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz,
  timezone text not null default 'Europe/Paris',
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'scheduled', 'live', 'finished', 'cancelled')),
  accepted_by_a boolean not null default true,
  accepted_by_b boolean not null default false,
  result_attempt_a uuid references public.attempts(id) on delete set null,
  result_attempt_b uuid references public.attempts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint duel_events_distinct_players check (player_a <> player_b)
);
alter table public.duel_events enable row level security;
drop policy if exists "duel_events_read" on public.duel_events;
create policy "duel_events_read" on public.duel_events for select to authenticated using (true);
revoke insert, update, delete on public.duel_events from anon, authenticated;

create table if not exists public.event_supporters (
  event_id uuid not null references public.duel_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  supported_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_supporters enable row level security;
drop policy if exists "event_supporters_read_own" on public.event_supporters;
create policy "event_supporters_read_own" on public.event_supporters for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.event_supporters from anon, authenticated;

create table if not exists public.event_reminders (
  event_id uuid not null references public.duel_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_reminders enable row level security;
drop policy if exists "event_reminders_read_own" on public.event_reminders;
create policy "event_reminders_read_own" on public.event_reminders for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.event_reminders from anon, authenticated;

create or replace function public.propose_event(p_opponent uuid, p_format text, p_scheduled_at timestamptz, p_timezone text default 'Europe/Paris')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fmt public.challenge_formats%rowtype;
  new_id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_opponent is null or p_opponent = uid then raise exception 'invalid_opponent' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where user_id = p_opponent) then raise exception 'opponent_not_found' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() then raise exception 'date_in_past' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_events where player_a = uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.duel_events (format_key, discipline, player_a, player_b, scheduled_at, timezone)
  values (fmt.key, fmt.discipline, uid, p_opponent, p_scheduled_at, coalesce(p_timezone, 'Europe/Paris'))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.respond_event(p_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id for update;
  if not found or e.player_b <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.status not in ('proposed', 'accepted') then raise exception 'event_not_open' using errcode = 'P0001'; end if;
  if p_accept then
    update public.duel_events set accepted_by_b = true,
      status = case when scheduled_at is not null and accepted_by_a then 'scheduled' else 'accepted' end
    where id = p_id;
  else
    update public.duel_events set status = 'cancelled' where id = p_id;
  end if;
end;
$$;

create or replace function public.cancel_event(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id for update;
  if not found or uid not in (e.player_a, e.player_b) then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.status in ('finished', 'cancelled') then raise exception 'event_closed' using errcode = 'P0001'; end if;
  update public.duel_events set status = 'cancelled' where id = p_id;
end;
$$;

create or replace function public.support_event(p_id uuid, p_supported uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id;
  if not found or e.status not in ('scheduled', 'live') then raise exception 'event_not_open_for_support' using errcode = 'P0001'; end if;
  if p_supported not in (e.player_a, e.player_b) then raise exception 'invalid_supported_player' using errcode = 'P0001'; end if;
  insert into public.event_supporters (event_id, user_id, supported_user_id) values (p_id, uid, p_supported)
  on conflict (event_id, user_id) do update set supported_user_id = excluded.supported_user_id;
end;
$$;

create or replace function public.toggle_reminder(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id;
  if not found or e.status not in ('scheduled', 'live') then raise exception 'event_not_open_for_reminder' using errcode = 'P0001'; end if;
  if exists (select 1 from public.event_reminders where event_id = p_id and user_id = uid) then
    delete from public.event_reminders where event_id = p_id and user_id = uid;
    return false;
  end if;
  insert into public.event_reminders (event_id, user_id) values (p_id, uid);
  return true;
end;
$$;

-- Page publique d'un duel : consultable sans compte (aucune vidéo, aucune donnée privée).
create or replace function public.get_public_event(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'slug', e.slug,
    'status', e.status,
    'scheduled_at', e.scheduled_at,
    'timezone', e.timezone,
    'discipline', d.label_fr,
    'format', f.label_fr,
    'player_a', jsonb_build_object('id', e.player_a, 'pseudo', pa.pseudo, 'city', pa.city, 'region', pa.region, 'country', pa.country),
    'player_b', jsonb_build_object('id', e.player_b, 'pseudo', pb.pseudo, 'city', pb.city, 'region', pb.region, 'country', pb.country),
    'supporters_a', (select count(*) from public.event_supporters s where s.event_id = e.id and s.supported_user_id = e.player_a),
    'supporters_b', (select count(*) from public.event_supporters s where s.event_id = e.id and s.supported_user_id = e.player_b),
    'result', case when e.status = 'finished' then (
        select jsonb_build_object('score_a', aa.decided_score, 'score_b', ab.decided_score)
        from public.attempts aa, public.attempts ab
        where aa.id = e.result_attempt_a and ab.id = e.result_attempt_b and aa.status = 'validated' and ab.status = 'validated'
      ) else null end
  )
  from public.duel_events e
  join public.disciplines d on d.key = e.discipline
  join public.challenge_formats f on f.key = e.format_key
  left join public.profiles pa on pa.user_id = e.player_a
  left join public.profiles pb on pb.user_id = e.player_b
  where e.slug = p_slug and e.status <> 'cancelled';
$$;

------------------------------------------------------------------------------------------------
-- 9. Droits Pro (alimentés uniquement par le serveur de paiement) et avantages
------------------------------------------------------------------------------------------------

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'none' check (status in ('none', 'active', 'billing_issue', 'cancelled_pending', 'expired', 'refunded')),
  source text check (source in ('apple', 'google', 'stripe', 'manual')),
  product_id text,
  current_period_end timestamptz,
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "entitlements_read_own" on public.entitlements;
create policy "entitlements_read_own" on public.entitlements for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.entitlements from anon, authenticated;

create table if not exists public.payment_events (
  event_id text primary key,
  source text not null,
  user_id uuid,
  event_type text not null,
  event_time timestamptz not null,
  outcome text not null,
  payload jsonb,
  received_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

create or replace function public.is_pro(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user and e.plan = 'pro'
      and e.status in ('active', 'cancelled_pending', 'billing_issue')
      and (e.current_period_end is null or e.current_period_end > now())
  );
$$;

-- Appelée uniquement par le serveur de paiement (clé de service) : dédoublonne, ignore les événements plus anciens que le dernier appliqué.
create or replace function public.apply_entitlement_event(
  p_event_id text, p_source text, p_user_id uuid, p_type text, p_event_time timestamptz,
  p_plan text, p_status text, p_product_id text, p_period_end timestamptz, p_payload jsonb default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  last_time timestamptz;
  inserted integer;
begin
  insert into public.payment_events (event_id, source, user_id, event_type, event_time, outcome, payload)
  values (p_event_id, p_source, p_user_id, p_type, p_event_time, 'received', p_payload)
  on conflict (event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;

  select last_event_at into last_time from public.entitlements where user_id = p_user_id;
  if last_time is not null and p_event_time <= last_time then
    update public.payment_events set outcome = 'stale' where event_id = p_event_id;
    return 'stale';
  end if;

  insert into public.entitlements (user_id, plan, status, source, product_id, current_period_end, last_event_at, updated_at)
  values (p_user_id, p_plan, p_status, p_source, p_product_id, p_period_end, p_event_time, now())
  on conflict (user_id) do update set plan = excluded.plan, status = excluded.status, source = excluded.source,
    product_id = excluded.product_id, current_period_end = excluded.current_period_end,
    last_event_at = excluded.last_event_at, updated_at = now();

  update public.payment_events set outcome = 'applied' where event_id = p_event_id;
  return 'applied';
end;
$$;
revoke execute on function public.apply_entitlement_event(text, text, uuid, text, timestamptz, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_entitlement_event(text, text, uuid, text, timestamptz, text, text, text, timestamptz, jsonb) to service_role;

-- Groupes privés : l'organisateur doit être Pro, les membres peuvent être gratuits.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
drop policy if exists "groups_read_members" on public.groups;
create policy "groups_read_members" on public.groups for select to authenticated
  using (owner_id = auth.uid() or exists (select 1 from public.group_members m where m.group_id = id and m.user_id = auth.uid()));
drop policy if exists "group_members_read_members" on public.group_members;
create policy "group_members_read_members" on public.group_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.group_members m where m.group_id = group_id and m.user_id = auth.uid()));
revoke insert, update, delete on public.groups from anon, authenticated;
revoke insert, update, delete on public.group_members from anon, authenticated;

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_pro(uid) then raise exception 'pro_required' using errcode = 'P0001'; end if;
  if (select count(*) from public.groups where owner_id = uid) >= 5 then raise exception 'group_limit' using errcode = 'P0001'; end if;
  insert into public.groups (owner_id, name) values (uid, trim(p_name)) returning id into new_id;
  insert into public.group_members (group_id, user_id) values (new_id, uid);
  return new_id;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.groups%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into g from public.groups where invite_code = p_code;
  if not found then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if (select count(*) from public.group_members where group_id = g.id) >= 100 then raise exception 'group_full' using errcode = 'P0001'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  return g.id;
end;
$$;

create or replace function public.group_leaderboard(p_group uuid, p_format text)
returns table (rank bigint, user_id uuid, pseudo text, best_score integer, achieved_at timestamptz)
language sql stable security definer set search_path = public
as $$
  with allowed as (
    select 1 from public.group_members m where m.group_id = p_group and m.user_id = auth.uid()
  ), best as (
    select distinct on (a.user_id) a.user_id, a.decided_score, a.decided_at
    from public.attempts a
    join public.group_members gm on gm.group_id = p_group and gm.user_id = a.user_id
    where a.status = 'validated' and a.format_key = p_format and exists (select 1 from allowed)
    order by a.user_id, a.decided_score desc, a.decided_at asc
  )
  select row_number() over (order by b.decided_score desc, b.decided_at asc, b.user_id), b.user_id, pr.pseudo, b.decided_score, b.decided_at
  from best b left join public.profiles pr on pr.user_id = b.user_id
  order by 1;
$$;

-- Statistiques de progression avancées (Pro) : meilleur score et nombre de tentatives validées par semaine.
create or replace function public.my_progress(p_format text)
returns table (week_start date, best_score integer, validated_count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_pro(auth.uid()) then raise exception 'pro_required' using errcode = 'P0001'; end if;
  return query
    select date_trunc('week', a.decided_at)::date, max(a.decided_score)::integer, count(*)
    from public.attempts a
    where a.user_id = auth.uid() and a.status = 'validated' and a.format_key = p_format
    group by 1 order by 1;
end;
$$;

create or replace function public.set_card_theme(p_theme text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_pro(auth.uid()) then raise exception 'pro_required' using errcode = 'P0001'; end if;
  if p_theme not in ('gold', 'steel', 'crimson', 'emerald') then raise exception 'invalid_theme' using errcode = 'P0001'; end if;
  update public.profiles set card_theme = p_theme where user_id = auth.uid();
end;
$$;

------------------------------------------------------------------------------------------------
-- 10. Vidéos : bucket privé, dossier de l'utilisateur, taille et types limités, retrait respecté
------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attempt-videos', 'attempt-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm'];

drop policy if exists "attempt videos insert own folder" on storage.objects;
create policy "attempt videos insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'attempt-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attempt videos read allowed" on storage.objects;
create policy "attempt videos read allowed" on storage.objects for select to authenticated
  using (
    bucket_id = 'attempt-videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_moderator()
      or exists (
        select 1 from public.attempts a
        where a.video_path = name and a.video_removed = false and a.status in ('pending', 'validated')
      )
    )
  );

drop policy if exists "attempt videos delete own pending" on storage.objects;
create policy "attempt videos delete own pending" on storage.objects for delete to authenticated
  using (
    bucket_id = 'attempt-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.attempts a where a.video_path = name and a.status in ('pending', 'validated'))
  );

------------------------------------------------------------------------------------------------
-- 11. Droits d'exécution : tout est refusé par défaut, puis ouvert explicitement
------------------------------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function public.ensure_player() to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text) to authenticated;
grant execute on function public.submit_attempt(text, integer, text, numeric, text, uuid, uuid) to authenticated;
grant execute on function public.withdraw_attempt(uuid) to authenticated;
grant execute on function public.report_attempt(uuid, text, text) to authenticated;
grant execute on function public.moderate_attempt(uuid, text, integer, text) to authenticated;
grant execute on function public.leaderboard(text, text, text, integer) to anon, authenticated;
grant execute on function public.my_stats() to authenticated;
grant execute on function public.current_weekly_challenge() to anon, authenticated;
grant execute on function public.propose_event(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.respond_event(uuid, boolean) to authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;
grant execute on function public.support_event(uuid, uuid) to authenticated;
grant execute on function public.toggle_reminder(uuid) to authenticated;
grant execute on function public.get_public_event(text) to anon, authenticated;
grant execute on function public.is_pro(uuid) to authenticated;
grant execute on function public.is_moderator(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.group_leaderboard(uuid, text) to authenticated;
grant execute on function public.my_progress(text) to authenticated;
grant execute on function public.set_card_theme(text) to authenticated;

grant select on public.attempt_points, public.duel_results, public.player_points, public.player_stats_v2 to authenticated;
