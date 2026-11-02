-- IMMORTAL: opt-in local group recruitment and balanced group challenges.
-- Additive: does not remove or rewrite existing player data.
begin;

alter table public.groups
  add column if not exists description text,
  add column if not exists recruiting_scope text not null default 'private',
  add column if not exists recruiting_city text,
  add column if not exists recruiting_region text;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_recruiting_scope_check' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_recruiting_scope_check check (recruiting_scope in ('private', 'city', 'region'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_description_length_check' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_description_length_check check (description is null or char_length(description) <= 200);
  end if;
end
$constraints$;

create index if not exists groups_recruiting_region_idx on public.groups (recruiting_region, created_at desc) where recruiting_scope = 'region';
create index if not exists groups_recruiting_city_idx on public.groups (recruiting_city, created_at desc) where recruiting_scope = 'city';

create table if not exists public.group_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_group_id uuid not null references public.groups(id) on delete cascade,
  challenged_group_id uuid not null references public.groups(id) on delete cascade,
  format_key text not null references public.challenge_formats(key),
  participant_count integer not null check (participant_count between 1 and 5),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'finished')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  finished_at timestamptz,
  constraint group_challenges_different_groups check (challenger_group_id <> challenged_group_id)
);
create index if not exists group_challenges_challenger_created_idx on public.group_challenges (challenger_group_id, created_at desc);
create index if not exists group_challenges_challenged_created_idx on public.group_challenges (challenged_group_id, created_at desc);

create table if not exists public.group_challenge_participants (
  challenge_id uuid not null references public.group_challenges(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid unique references public.attempts(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists group_challenge_participants_side_idx on public.group_challenge_participants (challenge_id, group_id);

alter table public.group_challenges enable row level security;
alter table public.group_challenge_participants enable row level security;
drop policy if exists group_challenges_select_members on public.group_challenges;
create policy group_challenges_select_members on public.group_challenges for select to authenticated
  using (
    exists (select 1 from public.group_members gm where gm.group_id = challenger_group_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.group_members gm where gm.group_id = challenged_group_id and gm.user_id = (select auth.uid()))
  );
drop policy if exists group_challenge_participants_select_members on public.group_challenge_participants;
create policy group_challenge_participants_select_members on public.group_challenge_participants for select to authenticated
  using (
    exists (
      select 1 from public.group_challenges gc
      join public.group_members gm on gm.group_id in (gc.challenger_group_id, gc.challenged_group_id)
      where gc.id = challenge_id and gm.user_id = (select auth.uid())
    )
  );
revoke insert, update, delete on public.group_challenges, public.group_challenge_participants from anon, authenticated;
grant select on public.group_challenges, public.group_challenge_participants to authenticated;

create or replace function public.create_training_group(p_name text, p_description text default null, p_recruiting_scope text default 'private')
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid(); v_city text; v_region text; v_id uuid; v_limit integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(p_name)) > 40 then raise exception 'invalid_group_name'; end if;
  if p_description is not null and char_length(trim(p_description)) > 200 then raise exception 'invalid_group_description'; end if;
  if p_recruiting_scope not in ('private', 'city', 'region') then raise exception 'invalid_group_scope'; end if;
  select pr.city, pr.region into v_city, v_region from public.profiles pr where pr.user_id = v_uid;
  if p_recruiting_scope = 'city' and coalesce(trim(v_city), '') = '' then raise exception 'group_city_required'; end if;
  if p_recruiting_scope = 'region' and coalesce(trim(v_region), '') = '' then raise exception 'group_region_required'; end if;
  v_limit := case when public.is_pro(v_uid) then 5 else 1 end;
  if (select count(*) from public.groups g where g.owner_id = v_uid) >= v_limit then raise exception 'group_limit'; end if;
  insert into public.groups (owner_id, name, description, recruiting_scope, recruiting_city, recruiting_region)
  values (v_uid, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_recruiting_scope,
    case when p_recruiting_scope = 'city' then trim(v_city) else null end,
    case when p_recruiting_scope in ('city', 'region') then trim(v_region) else null end)
  returning id into v_id;
  insert into public.group_members (group_id, user_id) values (v_id, v_uid);
  return v_id;
end
$function$;

create or replace function public.discover_training_groups(p_scope text default 'region', p_query text default null)
returns table (group_id uuid, group_name text, group_description text, recruiting_scope text, territory text, owner_pseudo text, member_count bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_city text; v_region text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_scope not in ('city', 'region') then raise exception 'invalid_group_scope'; end if;
  select pr.city, pr.region into v_city, v_region from public.profiles pr where pr.user_id = v_uid;
  return query
  select g.id, g.name, g.description, g.recruiting_scope,
    case when g.recruiting_scope = 'city' then g.recruiting_city else g.recruiting_region end,
    pr.pseudo, (select count(*) from public.group_members gm2 where gm2.group_id = g.id), g.created_at
  from public.groups g left join public.profiles pr on pr.user_id = g.owner_id
  where g.recruiting_scope <> 'private'
    and g.id not in (select gm.group_id from public.group_members gm where gm.user_id = v_uid)
    and ((p_scope = 'city' and g.recruiting_scope = 'city' and v_city is not null and lower(g.recruiting_city) = lower(v_city))
      or (p_scope = 'region' and g.recruiting_region is not null and v_region is not null and lower(g.recruiting_region) = lower(v_region)))
    and (nullif(trim(coalesce(p_query, '')), '') is null or g.name ilike '%' || trim(p_query) || '%')
  order by g.created_at desc limit 30;
end
$function$;

create or replace function public.training_group_members(p_group uuid)
returns table (user_id uuid, pseudo text, avatar_url text, is_owner boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = auth.uid()) then raise exception 'forbidden'; end if;
  return query
  select gm.user_id, pr.pseudo, pr.avatar_url, (g.owner_id = gm.user_id), gm.joined_at
  from public.group_members gm join public.groups g on g.id = gm.group_id
  left join public.profiles pr on pr.user_id = gm.user_id
  where gm.group_id = p_group order by (g.owner_id = gm.user_id) desc, gm.joined_at asc;
end
$function$;

create or replace function public.create_group_challenge(p_challenger_group uuid, p_challenged_group uuid, p_format_key text, p_participant_count integer default 1)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_challenger_group = p_challenged_group then raise exception 'same_group'; end if;
  if p_participant_count < 1 or p_participant_count > 5 then raise exception 'invalid_participant_count'; end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_challenger_group and gm.user_id = v_uid) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.groups g where g.id = p_challenged_group) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.challenge_formats cf where cf.key = p_format_key and cf.active) then raise exception 'unknown_format'; end if;
  if (select count(*) from public.group_members gm where gm.group_id = p_challenger_group) < p_participant_count then raise exception 'group_roster_too_small'; end if;
  if (select count(*) from public.group_members gm where gm.group_id = p_challenged_group) < p_participant_count then raise exception 'opponent_roster_too_small'; end if;
  insert into public.group_challenges (challenger_group_id, challenged_group_id, format_key, participant_count, created_by)
  values (p_challenger_group, p_challenged_group, p_format_key, p_participant_count, v_uid) returning id into v_id;
  return v_id;
end
$function$;

create or replace function public.respond_group_challenge(p_challenge uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_group_id uuid; v_participant_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select gc.challenged_group_id, gc.participant_count into v_group_id, v_participant_count
  from public.group_challenges gc where gc.id = p_challenge and gc.status = 'proposed';
  if v_group_id is null then raise exception 'not_found'; end if;
  if not exists (select 1 from public.groups g where g.id = v_group_id and g.owner_id = v_uid) then raise exception 'forbidden'; end if;
  if p_accept and (select count(*) from public.group_members gm where gm.group_id = v_group_id) < v_participant_count then raise exception 'opponent_roster_too_small'; end if;
  update public.group_challenges set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_challenge;
end
$function$;

create or replace function public.join_group_challenge(p_challenge uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_group_id uuid; v_required integer; v_status text; v_existing uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select gc.status, gc.participant_count into v_status, v_required from public.group_challenges gc where gc.id = p_challenge;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'accepted' then raise exception 'group_challenge_not_open'; end if;
  select gm.group_id into v_group_id from public.group_members gm
  join public.group_challenges gc on gm.group_id in (gc.challenger_group_id, gc.challenged_group_id)
  where gc.id = p_challenge and gm.user_id = v_uid;
  if v_group_id is null then raise exception 'forbidden'; end if;
  select p.group_id into v_existing from public.group_challenge_participants p where p.challenge_id = p_challenge and p.user_id = v_uid;
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.group_challenge_participants p where p.challenge_id = p_challenge and p.group_id = v_group_id) >= v_required then raise exception 'group_challenge_full'; end if;
  insert into public.group_challenge_participants (challenge_id, group_id, user_id) values (p_challenge, v_group_id, v_uid);
  return v_group_id;
end
$function$;

create or replace function public.set_group_challenge_attempt(p_challenge uuid, p_attempt uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_group_id uuid; v_format text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select p.group_id, gc.format_key into v_group_id, v_format
  from public.group_challenge_participants p join public.group_challenges gc on gc.id = p.challenge_id
  where p.challenge_id = p_challenge and p.user_id = v_uid and gc.status = 'accepted';
  if v_group_id is null then raise exception 'group_challenge_not_open'; end if;
  if not exists (select 1 from public.attempts a where a.id = p_attempt and a.user_id = v_uid and a.status = 'validated' and a.video_removed = false and a.format_key = v_format) then
    raise exception 'invalid_group_attempt';
  end if;
  update public.group_challenge_participants set attempt_id = p_attempt where challenge_id = p_challenge and user_id = v_uid;
  update public.group_challenges gc set status = 'finished', finished_at = now()
  where gc.id = p_challenge and gc.status = 'accepted'
    and (select count(*) from public.group_challenge_participants p where p.challenge_id = gc.id and p.group_id = gc.challenger_group_id) = gc.participant_count
    and (select count(*) from public.group_challenge_participants p where p.challenge_id = gc.id and p.group_id = gc.challenged_group_id) = gc.participant_count
    and not exists (select 1 from public.group_challenge_participants p where p.challenge_id = gc.id and p.attempt_id is null);
end
$function$;

create or replace function public.get_group_challenges(p_group uuid)
returns table (id uuid, challenger_group_id uuid, challenger_group_name text, challenged_group_id uuid, challenged_group_name text, created_by_pseudo text, format_key text, participant_count integer, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = auth.uid()) then raise exception 'forbidden'; end if;
  return query
  select gc.id, gc.challenger_group_id, ga.name, gc.challenged_group_id, gb.name, pr.pseudo, gc.format_key, gc.participant_count, gc.status, gc.created_at
  from public.group_challenges gc join public.groups ga on ga.id = gc.challenger_group_id join public.groups gb on gb.id = gc.challenged_group_id
  left join public.profiles pr on pr.user_id = gc.created_by
  where gc.challenger_group_id = p_group or gc.challenged_group_id = p_group order by gc.created_at desc limit 30;
end
$function$;

create or replace function public.get_group_challenge_participation(p_challenge uuid)
returns table (group_id uuid, attempt_id uuid)
language sql stable security definer set search_path = ''
as $function$
  select p.group_id, p.attempt_id from public.group_challenge_participants p where p.challenge_id = p_challenge and p.user_id = auth.uid()
$function$;

create or replace function public.get_group_challenge_board(p_challenge uuid)
returns table (group_id uuid, group_name text, required_count integer, joined_count bigint, submitted_count bigint, total_score bigint, complete boolean)
language plpgsql stable security definer set search_path = ''
as $function$
declare v_a uuid; v_b uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select gc.challenger_group_id, gc.challenged_group_id into v_a, v_b from public.group_challenges gc where gc.id = p_challenge;
  if v_a is null then raise exception 'not_found'; end if;
  if not exists (select 1 from public.group_members gm where gm.group_id in (v_a, v_b) and gm.user_id = auth.uid()) then raise exception 'forbidden'; end if;
  return query
  select g.id, g.name, gc.participant_count, count(p.user_id), count(p.attempt_id), coalesce(sum(a.decided_score), 0)::bigint,
    count(p.user_id) = gc.participant_count and count(p.attempt_id) = gc.participant_count
  from public.group_challenges gc join public.groups g on g.id in (gc.challenger_group_id, gc.challenged_group_id)
  left join public.group_challenge_participants p on p.challenge_id = gc.id and p.group_id = g.id
  left join public.attempts a on a.id = p.attempt_id
  where gc.id = p_challenge group by g.id, g.name, gc.participant_count
  order by case when g.id = gc.challenger_group_id then 0 else 1 end;
end
$function$;

revoke all on function public.create_training_group(text, text, text) from public, anon;
revoke all on function public.discover_training_groups(text, text) from public, anon;
revoke all on function public.training_group_members(uuid) from public, anon;
revoke all on function public.create_group_challenge(uuid, uuid, text, integer) from public, anon;
revoke all on function public.respond_group_challenge(uuid, boolean) from public, anon;
revoke all on function public.join_group_challenge(uuid) from public, anon;
revoke all on function public.set_group_challenge_attempt(uuid, uuid) from public, anon;
revoke all on function public.get_group_challenges(uuid) from public, anon;
revoke all on function public.get_group_challenge_participation(uuid) from public, anon;
revoke all on function public.get_group_challenge_board(uuid) from public, anon;
grant execute on function public.create_training_group(text, text, text) to authenticated;
grant execute on function public.discover_training_groups(text, text) to authenticated;
grant execute on function public.training_group_members(uuid) to authenticated;
grant execute on function public.create_group_challenge(uuid, uuid, text, integer) to authenticated;
grant execute on function public.respond_group_challenge(uuid, boolean) to authenticated;
grant execute on function public.join_group_challenge(uuid) to authenticated;
grant execute on function public.set_group_challenge_attempt(uuid, uuid) to authenticated;
grant execute on function public.get_group_challenges(uuid) to authenticated;
grant execute on function public.get_group_challenge_participation(uuid) to authenticated;
grant execute on function public.get_group_challenge_board(uuid) to authenticated;

commit;