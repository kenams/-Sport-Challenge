alter table public.challenges
  add column if not exists ai_status text,
  add column if not exists ai_score real,
  add column if not exists ai_duration real,
  add column if not exists ai_reason text,
  add column if not exists ai_needs_review boolean default false;

alter table public.challenge_responses
  add column if not exists ai_status text,
  add column if not exists ai_score real,
  add column if not exists ai_duration real,
  add column if not exists ai_reason text,
  add column if not exists ai_needs_review boolean default false;
