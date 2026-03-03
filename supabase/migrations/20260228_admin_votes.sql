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

create index if not exists idx_response_votes_response on public.challenge_response_votes (response_id, created_at);

alter table public.admin_users enable row level security;
alter table public.challenge_response_votes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenges'
      and policyname = 'allow admin update challenges'
  ) then
    execute 'create policy "allow admin update challenges" on public.challenges for update using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_responses'
      and policyname = 'allow admin update responses'
  ) then
    execute 'create policy "allow admin update responses" on public.challenge_responses for update using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'allow read authenticated'
  ) then
    execute 'create policy "allow read authenticated" on public.admin_users for select using (auth.role() = ''authenticated'')';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_response_votes'
      and policyname = 'allow read authenticated'
  ) then
    execute 'create policy "allow read authenticated" on public.challenge_response_votes for select using (auth.role() = ''authenticated'')';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_response_votes'
      and policyname = 'allow insert own response votes'
  ) then
    execute 'create policy "allow insert own response votes" on public.challenge_response_votes for insert with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_responses'
      and policyname = 'allow challenge owner update responses'
  ) then
    execute 'create policy "allow challenge owner update responses" on public.challenge_responses for update using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = auth.uid()))';
  end if;
end $$;
