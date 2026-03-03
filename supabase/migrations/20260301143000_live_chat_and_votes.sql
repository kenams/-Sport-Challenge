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

create index if not exists idx_live_comments_event on public.live_comments (live_event_id, created_at);
create index if not exists idx_live_votes_event on public.live_votes (live_event_id, created_at);

alter table public.live_comments enable row level security;
alter table public.live_votes enable row level security;

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
  with check (auth.uid() = user_id);
