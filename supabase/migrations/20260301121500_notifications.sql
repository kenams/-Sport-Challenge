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

alter table public.notifications enable row level security;

create policy "notifications_read" on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "notifications_insert" on public.notifications
  for insert
  with check (auth.uid() = actor_id);

create policy "notifications_update" on public.notifications
  for update
  using (auth.uid() = user_id);
