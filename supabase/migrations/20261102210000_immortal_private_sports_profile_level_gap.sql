create table if not exists public.player_private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm smallint check (height_cm between 100 and 250),
  weight_kg numeric(5,2) check (weight_kg between 25 and 350),
  updated_at timestamptz not null default now(),
  constraint player_private_profiles_birth_date_check check (
    birth_date is null or (birth_date <= current_date and birth_date >= current_date - interval '120 years')
  )
);
alter table public.player_private_profiles enable row level security;
revoke all on table public.player_private_profiles from anon, authenticated;
grant select, insert, update on table public.player_private_profiles to authenticated;
drop policy if exists player_private_profiles_select_own on public.player_private_profiles;
create policy player_private_profiles_select_own on public.player_private_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists player_private_profiles_insert_own on public.player_private_profiles;
create policy player_private_profiles_insert_own on public.player_private_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists player_private_profiles_update_own on public.player_private_profiles;
create policy player_private_profiles_update_own on public.player_private_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.submit_attempt(p_format text, p_declared integer, p_video_path text, p_duration numeric DEFAULT NULL::numeric, p_title text DEFAULT NULL::text, p_challenge_id uuid DEFAULT NULL::uuid, p_recipient uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  fmt public.challenge_formats%rowtype;
  parent public.attempts%rowtype;
  prof public.profiles%rowtype;
  new_id uuid;
  attempt_kind text;
  actor_level integer := 1;
  opponent_level integer := 1;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select level into actor_level from public.players_stats where user_id = uid;
  actor_level := coalesce(actor_level, 1);

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
    select level into opponent_level from public.players_stats where user_id = parent.user_id;
    opponent_level := coalesce(opponent_level, 1);
    if abs(actor_level - opponent_level) > 10 then
      raise exception 'level_gap_too_large' using errcode = 'P0001';
    end if;
    attempt_kind := 'response';
  else
    attempt_kind := 'challenge';
  end if;

  if p_recipient is not null then
    if p_recipient = uid then raise exception 'invalid_recipient' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.profiles where user_id = p_recipient) then raise exception 'recipient_not_found' using errcode = 'P0001'; end if;
    select level into opponent_level from public.players_stats where user_id = p_recipient;
    opponent_level := coalesce(opponent_level, 1);
    if abs(actor_level - opponent_level) > 10 then
      raise exception 'level_gap_too_large' using errcode = 'P0001';
    end if;
  end if;

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
$function$

CREATE OR REPLACE FUNCTION public.propose_event(p_opponent uuid, p_format text, p_scheduled_at timestamp with time zone, p_timezone text DEFAULT 'Europe/Paris'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  fmt public.challenge_formats%rowtype;
  new_id uuid;
  actor_level integer := 1;
  opponent_level integer := 1;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_opponent is null or p_opponent = uid then raise exception 'invalid_opponent' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where user_id = p_opponent) then raise exception 'opponent_not_found' using errcode = 'P0001'; end if;
  select level into actor_level from public.players_stats where user_id = uid;
  actor_level := coalesce(actor_level, 1);
  select level into opponent_level from public.players_stats where user_id = p_opponent;
  opponent_level := coalesce(opponent_level, 1);
  if abs(actor_level - opponent_level) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() then raise exception 'date_in_past' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_events where player_a = uid and created_at > now() - interval '24 hours') >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  insert into public.duel_events (format_key, discipline, player_a, player_b, scheduled_at, timezone)
  values (fmt.key, fmt.discipline, uid, p_opponent, p_scheduled_at, coalesce(p_timezone, 'Europe/Paris'))
  returning id into new_id;
  return new_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.respond_event(p_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
  actor_level integer := 1;
  opponent_level integer := 1;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from public.duel_events where id = p_id for update;
  if not found or e.player_b <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.status not in ('proposed', 'accepted') then raise exception 'event_not_open' using errcode = 'P0001'; end if;
  if p_accept then
    select level into actor_level from public.players_stats where user_id = uid;
    actor_level := coalesce(actor_level, 1);
    select level into opponent_level from public.players_stats where user_id = e.player_a;
    opponent_level := coalesce(opponent_level, 1);
    if abs(actor_level - opponent_level) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
    update public.duel_events set accepted_by_b = true,
      status = case when scheduled_at is not null and accepted_by_a then 'scheduled' else 'accepted' end
    where id = p_id;
  else
    update public.duel_events set status = 'cancelled' where id = p_id;
  end if;
end;
$function$
