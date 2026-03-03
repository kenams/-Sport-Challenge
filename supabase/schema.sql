create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudo text,
  avatar_url text,
  gender text,
  allow_mixed boolean default true,
  department text,
  allow_inter_department boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.players_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  level integer not null default 1,
  title text,
  fair_play_score integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_claimed_at timestamptz,
  streak integer not null default 0
);

create table if not exists public.challenges (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text,
  avatar_url text,
  title text not null,
  description text not null,
  sport text not null,
  target_value integer not null,
  unit text not null,
  video_url text not null,
  bet_enabled boolean default false,
  bet_amount integer default 0,
  min_level integer default 1,
  level_required integer,
  ranked boolean default false,
  proof_hint text,
  ai_status text,
  ai_score real,
  ai_duration real,
  ai_reason text,
  ai_needs_review boolean default false,
  status text default 'CREATED',
  type_id bigint references public.challenge_types(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_responses (
  id bigserial primary key,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text,
  avatar_url text,
  video_url text not null,
  votes integer default 0,
  is_winner boolean default false,
  ai_status text,
  ai_score real,
  ai_duration real,
  ai_reason text,
  ai_needs_review boolean default false,
  status text default 'UPLOADED',
  created_at timestamptz not null default now()
);

create table if not exists public.battles (
  id bigserial primary key,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  player1_id uuid not null references auth.users(id) on delete cascade,
  player2_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null default 0,
  commission integer not null default 0,
  winner_id uuid references auth.users(id),
  loser_id uuid references auth.users(id),
  completed boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text,
  avatar_url text,
  type text not null,
  challenge_id bigint references public.challenges(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_comments (
  id bigserial primary key,
  challenge_id bigint references public.challenges(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  pseudo text,
  avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_types (
  id bigserial primary key,
  name text not null unique,
  sport text not null,
  unit text not null,
  default_target integer,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text,
  title text not null,
  body text not null,
  challenge_id bigint references public.challenges(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.punishments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  battle_id bigint references public.battles(id) on delete set null,
  ads_remaining integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.punishment_logs (
  id bigserial primary key,
  punishment_id bigint not null references public.punishments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text,
  seen boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.arena_reports (
  id bigserial primary key,
  offender_id uuid not null references auth.users(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.arena_rooms (
  id uuid primary key default gen_random_uuid(),
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','live','finished','canceled')),
  stake integer not null default 0,
  level_required integer not null default 5,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.arena_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  round_number integer not null,
  repetitions integer not null,
  status text not null default 'pending' check (status in ('pending','running','validated','failed')),
  deadline timestamptz,
  winner_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.arena_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target text not null check (target in ('host','guest','all')),
  type text not null check (type in ('offer','answer','candidate','data')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lives_schedule (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_events (
  id bigserial primary key,
  challenge_type_id bigint references public.challenge_types(id) on delete set null,
  player1_id uuid references auth.users(id) on delete set null,
  player2_id uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','canceled')),
  winner_id uuid references auth.users(id) on delete set null,
  finished_at timestamptz,
  replay_url text,
  created_at timestamptz not null default now()
);

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

create table if not exists public.push_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigserial primary key,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  object_type text,
  object_id text,
  action text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_response_votes (
  id bigserial primary key,
  response_id bigint not null references public.challenge_responses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (response_id, user_id)
);

create or replace function public.finalize_challenge_votes(p_challenge_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_winner_id bigint;
  v_winner_user uuid;
  v_winner_pseudo text;
begin
  select created_at + interval '24 hours'
  into v_deadline
  from public.challenges
  where id = p_challenge_id;

  if v_deadline is null or v_deadline > now() then
    return;
  end if;

  if exists (
    select 1
    from public.challenge_responses
    where challenge_id = p_challenge_id
      and is_winner is true
  ) then
    return;
  end if;

  select r.id, r.user_id, r.pseudo
  into v_winner_id, v_winner_user, v_winner_pseudo
  from public.challenge_responses r
  left join (
    select response_id, count(*) as votes
    from public.challenge_response_votes
    where response_id in (
      select id from public.challenge_responses where challenge_id = p_challenge_id
    )
    group by response_id
  ) v on v.response_id = r.id
  where r.challenge_id = p_challenge_id
    and (r.ai_status is null or r.ai_status <> 'rejected')
  order by coalesce(v.votes, 0) desc, r.created_at asc
  limit 1;

  if v_winner_id is null then
    return;
  end if;

  update public.challenge_responses
  set is_winner = true
  where id = v_winner_id;

  insert into public.activities (
    user_id,
    pseudo,
    type,
    challenge_id,
    message
  ) values (
    v_winner_user,
    v_winner_pseudo,
    'challenge_winner',
    p_challenge_id,
    'Victoire par votes du public (auto).'
  );
end;
$$;

create or replace function public.maybe_finalize_votes_after_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge_id bigint;
begin
  select challenge_id into v_challenge_id
  from public.challenge_responses
  where id = new.response_id;

  if v_challenge_id is null then
    return new;
  end if;

  perform public.finalize_challenge_votes(v_challenge_id);
  return new;
end;
$$;

drop trigger if exists trg_finalize_votes_on_insert
  on public.challenge_response_votes;

create trigger trg_finalize_votes_on_insert
after insert on public.challenge_response_votes
for each row
execute function public.maybe_finalize_votes_after_vote();

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

create table if not exists public.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_created_at on public.activities (created_at desc);
create index if not exists idx_challenges_created_at on public.challenges (created_at desc);
create index if not exists idx_challenge_responses_challenge on public.challenge_responses (challenge_id);
create index if not exists idx_arena_rooms_status on public.arena_rooms (status);
create index if not exists idx_arena_signals_room on public.arena_signals (room_id, created_at);
create index if not exists idx_wallet_logs_user on public.wallet_logs (user_id, created_at);
create index if not exists idx_response_votes_response on public.challenge_response_votes (response_id, created_at);
create index if not exists idx_live_events_scheduled_at on public.live_events (scheduled_at desc);
create index if not exists idx_live_events_status on public.live_events (status);
create index if not exists idx_live_comments_event on public.live_comments (live_event_id, created_at);
create index if not exists idx_live_votes_event on public.live_votes (live_event_id, created_at);

alter table public.profiles enable row level security;
alter table public.players_stats enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_logs enable row level security;
alter table public.daily_rewards enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_responses enable row level security;
alter table public.battles enable row level security;
alter table public.activities enable row level security;
alter table public.challenge_comments enable row level security;
alter table public.challenge_types enable row level security;
alter table public.notifications enable row level security;
alter table public.punishments enable row level security;
alter table public.punishment_logs enable row level security;
alter table public.coach_notifications enable row level security;
alter table public.arena_reports enable row level security;
alter table public.arena_rooms enable row level security;
alter table public.arena_rounds enable row level security;
alter table public.arena_signals enable row level security;
alter table public.lives_schedule enable row level security;
alter table public.live_events enable row level security;
alter table public.live_comments enable row level security;
alter table public.live_votes enable row level security;
alter table public.push_tokens enable row level security;
alter table public.events enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_users enable row level security;
alter table public.challenge_response_votes enable row level security;
alter table public.users enable row level security;

create policy "allow read authenticated"
  on public.challenges for select
  using (auth.role() = 'authenticated');
create policy "allow insert own challenge"
  on public.challenges for insert
  with check (auth.uid() = user_id);
create policy "allow update own challenge"
  on public.challenges for update
  using (auth.uid() = user_id);
create policy "allow admin update challenges"
  on public.challenges for update
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "allow read authenticated"
  on public.challenge_responses for select
  using (auth.role() = 'authenticated');
create policy "allow insert own response"
  on public.challenge_responses for insert
  with check (auth.uid() = user_id);
create policy "allow admin update responses"
  on public.challenge_responses for update
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
create policy "allow challenge owner update responses"
  on public.challenge_responses for update
  using (
    exists (
      select 1
      from public.challenges c
      where c.id = challenge_id
        and c.user_id = auth.uid()
    )
  );

create policy "allow read authenticated"
  on public.activities for select
  using (auth.role() = 'authenticated');
create policy "allow insert own activity"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "allow read comments"
  on public.challenge_comments for select
  using (true);
create policy "allow insert own comment"
  on public.challenge_comments for insert
  with check (auth.uid() = user_id);

create policy "challenge_types_read"
  on public.challenge_types for select
  using (true);

create policy "notifications_read"
  on public.notifications for select
  using (auth.uid() = user_id);
create policy "notifications_insert"
  on public.notifications for insert
  with check (auth.uid() = actor_id);
create policy "notifications_update"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');
create policy "allow upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);
create policy "allow update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.players_stats for select
  using (auth.role() = 'authenticated');
create policy "allow upsert own stats"
  on public.players_stats for insert
  with check (auth.uid() = user_id);
create policy "allow update own stats"
  on public.players_stats for update
  using (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.wallets for select
  using (auth.role() = 'authenticated');
create policy "allow upsert own wallet"
  on public.wallets for insert
  with check (auth.uid() = user_id);
create policy "allow update own wallet"
  on public.wallets for update
  using (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.wallet_logs for select
  using (auth.role() = 'authenticated');
create policy "allow insert own wallet log"
  on public.wallet_logs for insert
  with check (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.daily_rewards for select
  using (auth.role() = 'authenticated');
create policy "allow upsert own daily rewards"
  on public.daily_rewards for insert
  with check (auth.uid() = user_id);
create policy "allow update own daily rewards"
  on public.daily_rewards for update
  using (auth.uid() = user_id);

create policy "allow read authenticated"
  on public.battles for select
  using (auth.role() = 'authenticated');
create policy "allow insert battle"
  on public.battles for insert
  with check (auth.role() = 'authenticated');
create policy "allow update battle"
  on public.battles for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.punishments for select
  using (auth.role() = 'authenticated');
create policy "allow insert punishment"
  on public.punishments for insert
  with check (auth.role() = 'authenticated');
create policy "allow update punishment"
  on public.punishments for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.punishment_logs for select
  using (auth.role() = 'authenticated');
create policy "allow insert punishment log"
  on public.punishment_logs for insert
  with check (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.coach_notifications for select
  using (auth.role() = 'authenticated');
create policy "allow insert coach notifications"
  on public.coach_notifications for insert
  with check (auth.role() = 'authenticated');
create policy "allow update coach notifications"
  on public.coach_notifications for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.arena_reports for select
  using (auth.role() = 'authenticated');
create policy "allow insert arena report"
  on public.arena_reports for insert
  with check (auth.role() = 'authenticated');
create policy "allow update arena report"
  on public.arena_reports for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.arena_rooms for select
  using (auth.role() = 'authenticated');
create policy "allow insert arena room"
  on public.arena_rooms for insert
  with check (auth.role() = 'authenticated');
create policy "allow update arena room"
  on public.arena_rooms for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.arena_rounds for select
  using (auth.role() = 'authenticated');
create policy "allow insert arena rounds"
  on public.arena_rounds for insert
  with check (auth.role() = 'authenticated');
create policy "allow update arena rounds"
  on public.arena_rounds for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.arena_signals for select
  using (auth.role() = 'authenticated');
create policy "allow insert arena signals"
  on public.arena_signals for insert
  with check (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.lives_schedule for select
  using (auth.role() = 'authenticated');
create policy "allow insert live schedule"
  on public.lives_schedule for insert
  with check (auth.role() = 'authenticated');
create policy "allow update live schedule"
  on public.lives_schedule for update
  using (auth.role() = 'authenticated');

create policy "live_events_read"
  on public.live_events for select
  using (true);
create policy "live_events_admin_insert"
  on public.live_events for insert
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
create policy "live_events_admin_update"
  on public.live_events for update
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "live_comments_read"
  on public.live_comments for select
  using (true);
create policy "live_comments_insert"
  on public.live_comments for insert
  with check (auth.uid() = user_id);

create policy "live_votes_read"
  on public.live_votes for select
  using (true);
create policy "live_votes_insert"
  on public.live_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.live_events e
      where e.id = live_event_id and e.status = 'finished'
    )
  );

create policy "allow read authenticated"
  on public.push_tokens for select
  using (auth.role() = 'authenticated');
create policy "allow upsert push tokens"
  on public.push_tokens for insert
  with check (auth.role() = 'authenticated');
create policy "allow update push tokens"
  on public.push_tokens for update
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.events for select
  using (auth.role() = 'authenticated');
create policy "allow insert events"
  on public.events for insert
  with check (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.admin_logs for select
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.admin_users for select
  using (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.challenge_response_votes for select
  using (auth.role() = 'authenticated');
create policy "allow insert own response votes"
  on public.challenge_response_votes for insert
  with check (auth.uid() = user_id);
create policy "allow insert admin logs"
  on public.admin_logs for insert
  with check (auth.role() = 'authenticated');

create policy "allow read authenticated"
  on public.users for select
  using (auth.role() = 'authenticated');
create policy "allow insert users"
  on public.users for insert
  with check (auth.role() = 'authenticated');
create policy "allow update users"
  on public.users for update
  using (auth.role() = 'authenticated');

create or replace function public.add_points(p_user_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_points integer := 0;
  next_points integer := 0;
begin
  select points into current_points
  from public.players_stats
  where user_id = p_user_id;

  next_points := coalesce(current_points, 0) + p_points;

  insert into public.players_stats (user_id, points)
  values (p_user_id, next_points)
  on conflict (user_id)
  do update set points = excluded.points;
end;
$$;
