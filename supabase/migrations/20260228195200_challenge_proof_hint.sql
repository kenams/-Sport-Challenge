alter table public.challenges
  add column if not exists proof_hint text;
