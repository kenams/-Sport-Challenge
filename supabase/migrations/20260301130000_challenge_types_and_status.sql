create table if not exists public.challenge_types (
  id bigserial primary key,
  name text not null unique,
  sport text not null,
  unit text not null,
  default_target integer,
  description text,
  created_at timestamptz not null default now()
);

alter table public.challenge_types enable row level security;

create policy "challenge_types_read" on public.challenge_types
  for select
  using (true);

alter table public.challenges
  add column if not exists status text default 'CREATED',
  add column if not exists type_id bigint references public.challenge_types(id) on delete set null;

alter table public.challenge_responses
  add column if not exists status text default 'UPLOADED';

create index if not exists challenges_type_id_idx on public.challenges(type_id);
