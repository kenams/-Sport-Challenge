create table if not exists public.live_comments (
  id bigserial primary key,
  live_event_id bigint not null references public.live_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  pseudo text,
  avatar_url text,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_votes (
  id bigserial primary key,
  live_event_id bigint not null references public.live_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  voted_for text not null check (voted_for in ('player1','player2')),
  created_at timestamptz not null default now(),
  unique (live_event_id, user_id)
);

alter table public.live_events
  add column if not exists finished_at timestamptz,
  add column if not exists replay_url text;

create index if not exists idx_live_events_scheduled_at on public.live_events (scheduled_at desc);
create index if not exists idx_live_events_status on public.live_events (status);
create index if not exists idx_live_comments_event on public.live_comments (live_event_id, created_at);
create index if not exists idx_live_votes_event on public.live_votes (live_event_id, created_at);

alter table public.live_events enable row level security;
alter table public.live_comments enable row level security;
alter table public.live_votes enable row level security;

drop policy if exists "live_events_read" on public.live_events;
create policy "live_events_read"
  on public.live_events for select
  using (true);

drop policy if exists "live_events_admin_insert" on public.live_events;
create policy "live_events_admin_insert"
  on public.live_events for insert
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "live_events_admin_update" on public.live_events;
create policy "live_events_admin_update"
  on public.live_events for update
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "live_comments_read" on public.live_comments;
create policy "live_comments_read"
  on public.live_comments for select
  using (true);

drop policy if exists "live_comments_insert" on public.live_comments;
create policy "live_comments_insert"
  on public.live_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "live_votes_read" on public.live_votes;
create policy "live_votes_read"
  on public.live_votes for select
  using (true);

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

create or replace function public.notify_live_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body_finish text;
  v_body_vote text;
begin
  if new.status = 'finished' and (old.status is distinct from new.status) then
    select coalesce(ct.name, 'Live Arena') into v_title
    from public.challenge_types ct
    where ct.id = new.challenge_type_id;

    v_body_finish := format('Le live est termine%s.', case when v_title is not null then ' : ' || v_title else '' end);
    v_body_vote := format('Le vote est ouvert pour%s.', case when v_title is not null then ' : ' || v_title else ' ce live' end);

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, null, 'live_finished', coalesce(v_title, 'Live Arena'), v_body_finish, now()
    from public.profiles p;

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, null, 'live_vote_open', coalesce(v_title, 'Live Arena'), v_body_vote, now()
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_live_finished on public.live_events;
create trigger trg_notify_live_finished
after update on public.live_events
for each row
execute function public.notify_live_finished();

create or replace function public.finalize_live_votes_batch()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id
    from public.live_events
    where status = 'finished'
      and winner_id is null
      and finished_at is not null
      and finished_at + interval '24 hours' <= now()
  loop
    perform public.finalize_live_votes(v_row.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.notify_live_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_winner text;
  v_body text;
begin
  if new.winner_id is not null and (old.winner_id is distinct from new.winner_id) then
    select coalesce(ct.name, 'Live Arena') into v_title
    from public.challenge_types ct
    where ct.id = new.challenge_type_id;

    select pseudo into v_winner
    from public.profiles
    where user_id = new.winner_id;

    v_body := format('Victoire de %s sur %s.', coalesce(v_winner, 'un joueur'), coalesce(v_title, 'Live Arena'));

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, new.winner_id, 'live_winner', coalesce(v_title, 'Live Arena'), v_body, now()
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_live_winner on public.live_events;
create trigger trg_notify_live_winner
after update on public.live_events
for each row
execute function public.notify_live_winner();

insert into storage.buckets (id, name, public)
values ('challenge-videos', 'challenge-videos', true)
on conflict (id) do update
set public = true;

drop policy if exists "challenge videos read" on storage.objects;
create policy "challenge videos read"
on storage.objects
for select
using (bucket_id = 'challenge-videos');

drop policy if exists "challenge videos insert" on storage.objects;
create policy "challenge videos insert"
on storage.objects
for insert
with check (
  bucket_id = 'challenge-videos'
  and auth.role() = 'authenticated'
);

drop policy if exists "challenge videos update" on storage.objects;
create policy "challenge videos update"
on storage.objects
for update
using (
  bucket_id = 'challenge-videos'
  and auth.uid() = owner
);

drop policy if exists "challenge videos delete" on storage.objects;
create policy "challenge videos delete"
on storage.objects
for delete
using (
  bucket_id = 'challenge-videos'
  and auth.uid() = owner
);
