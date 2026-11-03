-- Défís directs : fenêtre de réponse de 48 h et date maximale à 14 jours.
-- Matchmaking : mise en relation de joueurs disponibles, sans classement automatique.

alter table public.duel_events
  add column if not exists proposal_expires_at timestamptz,
  add column if not exists proposed_slots timestamptz[] not null default '{}',
  add column if not exists is_matchmade boolean not null default false;

update public.duel_events set proposed_slots = array[scheduled_at]
where scheduled_at is not null and coalesce(cardinality(proposed_slots), 0) = 0;

alter table public.duel_events drop constraint if exists duel_events_status_check;
alter table public.duel_events add constraint duel_events_status_check
  check (status in ('proposed', 'accepted', 'scheduled', 'live', 'finished', 'cancelled', 'expired'));

update public.duel_events
set proposal_expires_at = created_at + interval '48 hours'
where status in ('proposed', 'accepted') and proposal_expires_at is null;

create table if not exists public.duel_matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  format_key text not null references public.challenge_formats(key),
  timezone text not null default 'Europe/Paris',
  local_only boolean not null default false,
  city_snapshot text,
  level_snapshot integer not null default 1 check (level_snapshot between 1 and 1000),
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled', 'expired')),
  matched_event_id uuid references public.duel_events(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);
create index if not exists duel_matchmaking_waiting_idx
  on public.duel_matchmaking_queue (format_key, created_at)
  where status = 'waiting';
alter table public.duel_matchmaking_queue enable row level security;
revoke all on public.duel_matchmaking_queue from anon, authenticated;
grant select on public.duel_matchmaking_queue to authenticated;
drop policy if exists duel_matchmaking_read_own on public.duel_matchmaking_queue;
create policy duel_matchmaking_read_own on public.duel_matchmaking_queue
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.expire_duel_proposals()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  update public.duel_events
  set status = 'expired'
  where status in ('proposed', 'accepted')
    and proposal_expires_at is not null
    and proposal_expires_at <= now();
  get diagnostics n = row_count;
  update public.duel_matchmaking_queue
  set status = 'expired'
  where status = 'waiting' and expires_at <= now();
  return n;
end;
$$;
revoke all on function public.expire_duel_proposals() from public, anon;
grant execute on function public.expire_duel_proposals() to authenticated;

create or replace function public.propose_event(
  p_opponent uuid,
  p_format text,
  p_scheduled_at timestamptz,
  p_timezone text default 'Europe/Paris'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
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
  if p_scheduled_at is null or p_scheduled_at < now() + interval '30 minutes' or p_scheduled_at > now() + interval '14 days' then
    raise exception 'duel_date_out_of_range' using errcode = 'P0001';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = 'P0001';
  end if;
  select coalesce(level, 1) into actor_level from public.players_stats where user_id = uid;
  select coalesce(level, 1) into opponent_level from public.players_stats where user_id = p_opponent;
  if abs(coalesce(actor_level, 1) - coalesce(opponent_level, 1)) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_events where player_a = uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.duel_events (format_key, discipline, player_a, player_b, scheduled_at, timezone, proposal_expires_at, proposed_slots)
  values (fmt.key, fmt.discipline, uid, p_opponent, p_scheduled_at, p_timezone, now() + interval '48 hours', array[p_scheduled_at])
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.propose_event_slots(p_opponent uuid, p_format text, p_slots timestamptz[], p_timezone text default 'Europe/Paris')
returns uuid
language plpgsql security definer set search_path = ''
as $$
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
  if p_slots is null or cardinality(p_slots) < 1 or cardinality(p_slots) > 3 then raise exception 'invalid_time_slots' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(p_slots) as slots(value) where value is null or value < now() + interval '30 minutes' or value > now() + interval '14 days') then
    raise exception 'duel_date_out_of_range' using errcode = 'P0001';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'invalid_timezone' using errcode = 'P0001'; end if;
  if (select count(distinct value) from unnest(p_slots) as slots(value)) <> cardinality(p_slots) then raise exception 'invalid_time_slots' using errcode = 'P0001'; end if;
  select coalesce(level, 1) into actor_level from public.players_stats where user_id = uid;
  select coalesce(level, 1) into opponent_level from public.players_stats where user_id = p_opponent;
  if abs(coalesce(actor_level, 1) - coalesce(opponent_level, 1)) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_events where player_a = uid and created_at > now() - interval '24 hours') >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  insert into public.duel_events(format_key, discipline, player_a, player_b, scheduled_at, timezone, proposal_expires_at, proposed_slots)
  values(fmt.key, fmt.discipline, uid, p_opponent, p_slots[1], p_timezone, now() + interval '48 hours', p_slots)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.accept_event_slot(p_id uuid, p_scheduled_at timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); e public.duel_events%rowtype; actor_level integer := 1; opponent_level integer := 1;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.expire_duel_proposals();
  select * into e from public.duel_events where id = p_id for update;
  if not found or e.player_b <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.status not in ('proposed', 'accepted') or e.proposal_expires_at <= now() then raise exception 'proposal_expired' using errcode = 'P0001'; end if;
  if p_scheduled_at is null or not p_scheduled_at = any(e.proposed_slots) then raise exception 'invalid_time_slot' using errcode = 'P0001'; end if;
  select coalesce(level, 1) into actor_level from public.players_stats where user_id = uid;
  select coalesce(level, 1) into opponent_level from public.players_stats where user_id = e.player_a;
  if abs(coalesce(actor_level, 1) - coalesce(opponent_level, 1)) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
  update public.duel_events set scheduled_at = p_scheduled_at, accepted_by_b = true,
    status = case when accepted_by_a then 'scheduled' else 'accepted' end,
    proposal_expires_at = case when accepted_by_a then null else proposal_expires_at end
  where id = p_id;
end;
$$;

create or replace function public.respond_event(p_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e public.duel_events%rowtype;
  actor_level integer := 1;
  opponent_level integer := 1;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.expire_duel_proposals();
  select * into e from public.duel_events where id = p_id for update;
  if not found or uid not in (e.player_a, e.player_b) then raise exception 'forbidden' using errcode = '42501'; end if;
  if e.status not in ('proposed', 'accepted') then raise exception 'event_not_open' using errcode = 'P0001'; end if;
  if e.proposal_expires_at is not null and e.proposal_expires_at <= now() then raise exception 'proposal_expired' using errcode = 'P0001'; end if;
  if p_accept then
    select coalesce(level, 1) into actor_level from public.players_stats where user_id = uid;
    if uid = e.player_a then select coalesce(level, 1) into opponent_level from public.players_stats where user_id = e.player_b;
    else select coalesce(level, 1) into opponent_level from public.players_stats where user_id = e.player_a; end if;
    if abs(coalesce(actor_level, 1) - coalesce(opponent_level, 1)) > 10 then raise exception 'level_gap_too_large' using errcode = 'P0001'; end if;
    update public.duel_events set
      accepted_by_a = accepted_by_a or uid = e.player_a,
      accepted_by_b = accepted_by_b or uid = e.player_b,
      status = case when (accepted_by_a or uid = e.player_a) and (accepted_by_b or uid = e.player_b) then 'scheduled' else 'accepted' end,
      proposal_expires_at = case when (accepted_by_a or uid = e.player_a) and (accepted_by_b or uid = e.player_b) then null else proposal_expires_at end
    where id = p_id;
  else
    update public.duel_events set status = 'cancelled', proposal_expires_at = null where id = p_id;
    update public.duel_matchmaking_queue set status = 'cancelled'
      where matched_event_id = p_id and status = 'matched';
  end if;
end;
$$;

create or replace function public.join_duel_matchmaking(p_format text, p_timezone text default 'Europe/Paris', p_local_only boolean default false)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fmt public.challenge_formats%rowtype;
  my_level integer := 1;
  my_city text;
  opponent public.duel_matchmaking_queue%rowtype;
  event_id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.expire_duel_proposals();
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'invalid_timezone' using errcode = 'P0001'; end if;
  select * into fmt from public.challenge_formats where key = p_format and active;
  if not found then raise exception 'unknown_format' using errcode = 'P0001'; end if;
  select coalesce(s.level, 1), nullif(trim(p.city), '') into my_level, my_city
    from public.profiles p left join public.players_stats s on s.user_id = p.user_id where p.user_id = uid;
  if p_local_only and my_city is null then raise exception 'city_required_for_local' using errcode = 'P0001'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists (select 1 from public.duel_matchmaking_queue q join public.duel_events e on e.id = q.matched_event_id
      where q.user_id = uid and q.status = 'matched' and e.status in ('proposed', 'accepted', 'scheduled', 'live')) then
    raise exception 'already_matched' using errcode = 'P0001';
  end if;
  insert into public.duel_matchmaking_queue(user_id, format_key, timezone, local_only, city_snapshot, level_snapshot, status, matched_event_id, created_at, expires_at)
  values(uid, fmt.key, p_timezone, coalesce(p_local_only, false), my_city, coalesce(my_level, 1), 'waiting', null, now(), now() + interval '2 hours')
  on conflict (user_id) do update set format_key = excluded.format_key, timezone = excluded.timezone,
    local_only = excluded.local_only, city_snapshot = excluded.city_snapshot, level_snapshot = excluded.level_snapshot,
    status = 'waiting', matched_event_id = null, created_at = now(), expires_at = now() + interval '2 hours';

  select q.* into opponent
  from public.duel_matchmaking_queue q
  where q.user_id <> uid and q.status = 'waiting' and q.expires_at > now() and q.format_key = fmt.key
    and abs(q.level_snapshot - coalesce(my_level, 1)) <= 10
    and (not (q.local_only or coalesce(p_local_only, false)) or (my_city is not null and lower(q.city_snapshot) = lower(my_city)))
  order by q.created_at asc
  for update skip locked
  limit 1;
  if not found then return null; end if;

  insert into public.duel_events(format_key, discipline, player_a, player_b, scheduled_at, timezone, status,
    accepted_by_a, accepted_by_b, proposal_expires_at, is_matchmade, proposed_slots)
  values(fmt.key, fmt.discipline, opponent.user_id, uid, now() + interval '30 minutes', opponent.timezone, 'proposed', false, false, now() + interval '15 minutes', true, array[now() + interval '30 minutes'])
  returning id into event_id;
  update public.duel_matchmaking_queue set status = 'matched', matched_event_id = event_id where user_id in (uid, opponent.user_id);
  return event_id;
end;
$$;

create or replace function public.get_duel_matchmaking_status()
returns table(status text, matched_event_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform public.expire_duel_proposals();
  return query select q.status, q.matched_event_id, q.expires_at
    from public.duel_matchmaking_queue q where q.user_id = uid;
end;
$$;

create or replace function public.leave_duel_matchmaking()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.duel_matchmaking_queue set status = 'cancelled'
    where user_id = uid and status = 'waiting';
  if not found and exists (select 1 from public.duel_matchmaking_queue where user_id = uid and status = 'matched') then
    raise exception 'already_matched' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.propose_event(uuid, text, timestamptz, text) from public, anon;
revoke all on function public.propose_event_slots(uuid, text, timestamptz[], text) from public, anon;
revoke all on function public.accept_event_slot(uuid, timestamptz) from public, anon;
revoke all on function public.respond_event(uuid, boolean) from public, anon;
revoke all on function public.join_duel_matchmaking(text, text, boolean) from public, anon;
revoke all on function public.get_duel_matchmaking_status() from public, anon;
revoke all on function public.leave_duel_matchmaking() from public, anon;
grant execute on function public.propose_event(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.propose_event_slots(uuid, text, timestamptz[], text) to authenticated;
grant execute on function public.accept_event_slot(uuid, timestamptz) to authenticated;
grant execute on function public.respond_event(uuid, boolean) to authenticated;
grant execute on function public.join_duel_matchmaking(text, text, boolean) to authenticated;
grant execute on function public.get_duel_matchmaking_status() to authenticated;
grant execute on function public.leave_duel_matchmaking() to authenticated;
