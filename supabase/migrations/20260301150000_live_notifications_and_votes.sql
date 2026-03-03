alter table public.live_events
  add column if not exists finished_at timestamptz;

create or replace function public.set_live_finished_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished' and (old.status is distinct from new.status) then
    new.finished_at := coalesce(new.finished_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_live_finished_at on public.live_events;
create trigger trg_set_live_finished_at
before update on public.live_events
for each row
execute function public.set_live_finished_at();

create or replace function public.notify_live_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status = 'live' and (old.status is distinct from new.status) then
    select coalesce(ct.name, 'Live Arena') into v_title
    from public.challenge_types ct
    where ct.id = new.challenge_type_id;

    v_body := format('Un live vient de demarrer%s.', case when v_title is not null then ' : ' || v_title else '' end);

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, null, 'live_started', coalesce(v_title, 'Live Arena'), v_body, now()
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_live_started on public.live_events;
create trigger trg_notify_live_started
after update on public.live_events
for each row
execute function public.notify_live_started();

create or replace function public.finalize_live_votes(p_live_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished_at timestamptz;
  v_player1 uuid;
  v_player2 uuid;
  v_count1 integer := 0;
  v_count2 integer := 0;
begin
  select finished_at, player1_id, player2_id
  into v_finished_at, v_player1, v_player2
  from public.live_events
  where id = p_live_event_id
    and status = 'finished'
    and winner_id is null;

  if v_finished_at is null then
    return;
  end if;

  if v_finished_at + interval '24 hours' > now() then
    return;
  end if;

  select count(*) into v_count1
  from public.live_votes
  where live_event_id = p_live_event_id
    and voted_for = 'player1';

  select count(*) into v_count2
  from public.live_votes
  where live_event_id = p_live_event_id
    and voted_for = 'player2';

  if v_player1 is null or v_player2 is null then
    return;
  end if;

  update public.live_events
  set winner_id = case when v_count2 > v_count1 then v_player2 else v_player1 end
  where id = p_live_event_id
    and winner_id is null;
end;
$$;

create or replace function public.maybe_finalize_live_votes_after_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.finalize_live_votes(new.live_event_id);
  return new;
end;
$$;

drop trigger if exists trg_finalize_live_votes_on_insert on public.live_votes;
create trigger trg_finalize_live_votes_on_insert
after insert on public.live_votes
for each row
execute function public.maybe_finalize_live_votes_after_vote();

drop policy if exists "live_votes_insert" on public.live_votes;
create policy "live_votes_insert"
  on public.live_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.live_events e
      where e.id = live_event_id and e.status = 'finished'
    )
  );
