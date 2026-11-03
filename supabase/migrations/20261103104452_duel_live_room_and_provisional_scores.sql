-- Live duel scores are deliberately provisional. Final scores still come from
-- moderator-validated attempts; this table only drives the live progress UI.

create table if not exists public.duel_live_scores (
  event_id uuid not null references public.duel_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repetitions integer not null default 0 check (repetitions between 0 and 200),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.duel_live_results (
  event_id uuid primary key references public.duel_events(id) on delete cascade,
  score_a integer not null check (score_a between 0 and 200),
  score_b integer not null check (score_b between 0 and 200),
  moderator_id uuid not null references auth.users(id),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
alter table public.duel_live_results enable row level security;
revoke all on public.duel_live_results from anon, authenticated;
grant select on public.duel_live_results to authenticated;
drop policy if exists "duel_live_results_read_participants" on public.duel_live_results;
create policy "duel_live_results_read_participants"
  on public.duel_live_results for select to authenticated
  using (
    public.is_moderator()
    or exists (
      select 1 from public.duel_events e
      where e.id = event_id and auth.uid() in (e.player_a, e.player_b)
    )
  );

alter table public.duel_live_scores enable row level security;
revoke all on public.duel_live_scores from anon, authenticated;
grant select on public.duel_live_scores to authenticated;

drop policy if exists "duel_live_scores_read_live" on public.duel_live_scores;
create policy "duel_live_scores_read_live"
  on public.duel_live_scores for select to authenticated
  using (exists (
    select 1 from public.duel_events e
    where e.id = event_id and e.status = 'live'
  ));

create or replace function public.start_duel_live(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_event public.duel_events%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_event from public.duel_events where id = p_event_id for update;
  if not found or v_user not in (v_event.player_a, v_event.player_b) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_event.status = 'live' then return; end if;
  if v_event.status <> 'scheduled' then raise exception 'event_not_scheduled' using errcode = 'P0001'; end if;
  if v_event.scheduled_at is null
     or now() < v_event.scheduled_at - interval '30 minutes'
     or now() > v_event.scheduled_at + interval '2 hours' then
    raise exception 'outside_live_window' using errcode = 'P0001';
  end if;
  update public.duel_events set status = 'live' where id = p_event_id;
end;
$$;

create or replace function public.increment_duel_live_rep(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reps integer;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.duel_events e
    where e.id = p_event_id and e.status = 'live'
      and v_user in (e.player_a, e.player_b)
  ) then raise exception 'not_live_participant' using errcode = '42501'; end if;

  insert into public.duel_live_scores (event_id, user_id, repetitions)
  values (p_event_id, v_user, 1)
  on conflict (event_id, user_id) do update
    set repetitions = public.duel_live_scores.repetitions + 1,
        updated_at = now()
    where public.duel_live_scores.repetitions < 200
      and public.duel_live_scores.updated_at < now() - interval '250 milliseconds'
  returning repetitions into v_reps;

  if v_reps is null then raise exception 'rep_rate_or_limit' using errcode = 'P0001'; end if;
  return v_reps;
end;
$$;

create or replace function public.moderate_live_duel(
  p_event_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_event public.duel_events%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_moderator(v_user) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_event from public.duel_events where id = p_event_id for update;
  if not found or v_event.status <> 'live' then raise exception 'event_not_live' using errcode = 'P0001'; end if;
  if v_user in (v_event.player_a, v_event.player_b) then raise exception 'moderator_cannot_decide_own_duel' using errcode = 'P0001'; end if;
  if p_score_a is null or p_score_b is null or p_score_a not between 0 and 200 or p_score_b not between 0 and 200 then
    raise exception 'invalid_score' using errcode = 'P0001';
  end if;
  insert into public.duel_live_results (event_id, score_a, score_b, moderator_id, note)
  values (p_event_id, p_score_a, p_score_b, v_user, nullif(left(trim(coalesce(p_note, '')), 500), ''));
  update public.duel_events set status = 'finished' where id = p_event_id;
end;
$$;

revoke all on function public.start_duel_live(uuid) from public, anon;
revoke all on function public.increment_duel_live_rep(uuid) from public, anon;
revoke all on function public.moderate_live_duel(uuid, integer, integer, text) from public, anon;
grant execute on function public.start_duel_live(uuid) to authenticated;
grant execute on function public.increment_duel_live_rep(uuid) to authenticated;
grant execute on function public.moderate_live_duel(uuid, integer, integer, text) to authenticated;

create or replace function public.get_public_event(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
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
    'result', case when e.status = 'finished' then coalesce(
      (select jsonb_build_object('score_a', lr.score_a, 'score_b', lr.score_b) from public.duel_live_results lr where lr.event_id = e.id),
      (select jsonb_build_object('score_a', aa.decided_score, 'score_b', ab.decided_score)
        from public.attempts aa, public.attempts ab
        where aa.id = e.result_attempt_a and ab.id = e.result_attempt_b
          and aa.status = 'validated' and ab.status = 'validated')
    ) else null end
  )
  from public.duel_events e
  join public.disciplines d on d.key = e.discipline
  join public.challenge_formats f on f.key = e.format_key
  left join public.profiles pa on pa.user_id = e.player_a
  left join public.profiles pb on pb.user_id = e.player_b
  where e.slug = p_slug and e.status <> 'cancelled';
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_live_scores'
  ) then
    alter publication supabase_realtime add table public.duel_live_scores;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_live_results'
  ) then
    alter publication supabase_realtime add table public.duel_live_results;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_events'
  ) then
    alter publication supabase_realtime add table public.duel_events;
  end if;
end $$;
