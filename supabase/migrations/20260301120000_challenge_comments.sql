create table if not exists public.challenge_comments (
  id bigserial primary key,
  challenge_id bigint references public.challenges(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  pseudo text,
  avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.challenge_comments enable row level security;

create policy "comments_read" on public.challenge_comments
  for select
  using (true);

create policy "comments_insert" on public.challenge_comments
  for insert
  with check (auth.uid() = user_id);
