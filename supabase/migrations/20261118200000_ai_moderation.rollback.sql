drop trigger if exists attempts_queue_ai_moderation on public.attempts;
drop function if exists public.queue_ai_moderation();
drop function if exists public.ai_decide_attempt(uuid, text, integer, text, numeric, text, jsonb);
alter table public.attempts
  drop column if exists ai_status, drop column if exists ai_score, drop column if exists ai_confidence,
  drop column if exists ai_summary, drop column if exists ai_verdict, drop column if exists ai_checked_at;
