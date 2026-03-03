create table if not exists public.live_events (
  id bigserial primary key,
  challenge_type_id bigint references public.challenge_types(id) on delete set null,
  player1_id uuid references auth.users(id) on delete set null,
  player2_id uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','canceled')),
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_events_scheduled_at on public.live_events (scheduled_at desc);
create index if not exists idx_live_events_status on public.live_events (status);

alter table public.live_events enable row level security;

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
