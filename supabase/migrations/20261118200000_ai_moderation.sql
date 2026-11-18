-- Modération automatique par IA.
-- Chaque nouvelle tentative est envoyée à la fonction ai-moderate, qui regarde la vidéo.
-- L'IA décide seule les cas nets (score validé = répétitions qu'elle compte) ; les cas
-- douteux restent « pending » pour un modérateur humain. Toute décision est journalisée.

alter table public.attempts
  add column if not exists ai_status text check (ai_status in ('queued', 'needs_human', 'decided', 'error')),
  add column if not exists ai_score integer,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_summary text,
  add column if not exists ai_verdict jsonb,
  add column if not exists ai_checked_at timestamptz;

-- Décision prise par l'IA (appelable uniquement par le service, jamais par un joueur).
create or replace function public.ai_decide_attempt(
  p_id uuid,
  p_action text,            -- 'validate' | 'reject' | 'needs_human' | 'error'
  p_score integer default null,
  p_reason text default null,
  p_confidence numeric default null,
  p_summary text default null,
  p_verdict jsonb default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  a public.attempts%rowtype;
  fmt public.challenge_formats%rowtype;
begin
  select * into a from public.attempts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  update public.attempts set
    ai_score = p_score, ai_confidence = p_confidence, ai_summary = left(p_summary, 1000),
    ai_verdict = p_verdict, ai_checked_at = now(),
    ai_status = case when p_action in ('validate', 'reject') then 'decided' when p_action = 'error' then 'error' else 'needs_human' end
  where id = p_id;

  -- Un humain a déjà tranché, ou le joueur a retiré sa tentative : l'IA ne touche à rien.
  if a.status <> 'pending' or p_action not in ('validate', 'reject') then
    return 'recorded';
  end if;

  select * into fmt from public.challenge_formats where key = a.format_key;
  if p_action = 'validate' then
    if p_score is null or p_score < 0 or p_score > fmt.max_score then raise exception 'invalid_score' using errcode = 'P0001'; end if;
    update public.attempts set status = 'validated', decided_score = p_score,
      decision_reason = left(coalesce(p_reason, 'Validé par l''IA IMMORTAL'), 500), decided_by = null, decided_at = now()
    where id = p_id;
  else
    if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.attempts set status = 'rejected', decided_score = null,
      decision_reason = left(p_reason, 500), decided_by = null, decided_at = now()
    where id = p_id;
  end if;

  insert into public.moderation_log (attempt_id, moderator_id, action, previous_status, new_status, decided_score, reason)
  select p_id, null, 'ai_' || p_action, 'pending', status, decided_score, left(p_reason, 500) from public.attempts where id = p_id;
  return p_action;
end;
$$;

revoke all on function public.ai_decide_attempt(uuid, text, integer, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.ai_decide_attempt(uuid, text, integer, text, numeric, text, jsonb) to service_role;

-- Déclenchement : à chaque nouvelle tentative, appel asynchrone de la fonction ai-moderate.
-- L'URL et le secret sont lus dans le coffre (vault) : rien n'est écrit en clair ici.
create or replace function public.queue_ai_moderation()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  fn_url text;
  fn_secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'ai_moderation_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'ai_moderation_secret';
  if fn_url is null or fn_secret is null then
    return new;
  end if;
  update public.attempts set ai_status = 'queued' where id = new.id;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('attempt_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ai-secret', fn_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Ne jamais bloquer l'envoi d'une performance à cause de l'IA.
  return new;
end;
$$;

drop trigger if exists attempts_queue_ai_moderation on public.attempts;
create trigger attempts_queue_ai_moderation
  after insert on public.attempts
  for each row execute function public.queue_ai_moderation();

-- Le journal accepte aussi les décisions de l'IA.
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('validate', 'reject', 'restore', 'remove_video', 'restore_video', 'dismiss_reports', 'ai_validate', 'ai_reject'));

-- Avis de l'IA visible dans le fil (joueur et modération).
create or replace view public.attempt_feed with (security_invoker = true) as
select a.id, a.user_id, a.kind, a.challenge_id, a.recipient_user_id, a.title, a.format_key, a.discipline,
  a.rules_version, a.declared_score, a.video_path, a.video_duration_seconds, a.video_removed, a.status,
  a.decided_score, a.decision_reason, a.decided_by, a.decided_at, a.city_declared, a.region_declared,
  a.country_declared, a.report_count, a.created_at, p.pseudo, p.avatar_url,
  a.ai_status, a.ai_score, a.ai_summary
from public.attempts a
left join public.profiles p on p.user_id = a.user_id;
