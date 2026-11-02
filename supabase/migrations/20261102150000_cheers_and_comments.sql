-- IMMORTAL — « Encourager » (un seul par joueur et par performance, retirable) et commentaires courts sur les performances VALIDÉES.
-- Annulation : 20261102150000_cheers_and_comments.rollback.sql
-- Principe : les encouragements et commentaires n'influencent jamais les points ni les classements (aucune vue de points ne les lit).
-- Les tables ne sont pas lisibles directement par le client : tout passe par des fonctions serveur qui appliquent les règles.

create table if not exists public.attempt_cheers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (attempt_id, user_id)
);
create index if not exists attempt_cheers_user_idx on public.attempt_cheers (user_id, created_at desc);

create table if not exists public.attempt_comments (
  id bigserial primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  report_count integer not null default 0,
  hidden_by uuid references auth.users(id) on delete set null,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists attempt_comments_attempt_idx on public.attempt_comments (attempt_id, id desc);
create index if not exists attempt_comments_user_idx on public.attempt_comments (user_id, created_at desc);

create table if not exists public.comment_reports (
  id bigserial primary key,
  comment_id bigint not null references public.attempt_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create table if not exists public.comment_moderation_log (
  id bigserial primary key,
  comment_id bigint not null,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('hide', 'restore', 'dismiss_reports')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.attempt_cheers enable row level security;
alter table public.attempt_comments enable row level security;
alter table public.comment_reports enable row level security;
alter table public.comment_moderation_log enable row level security;
revoke all on public.attempt_cheers, public.attempt_comments, public.comment_reports, public.comment_moderation_log from anon, authenticated;
revoke all on sequence public.attempt_comments_id_seq, public.comment_reports_id_seq, public.comment_moderation_log_id_seq from anon, authenticated;

-- Texte nettoyé : caractères de contrôle et de direction invisibles retirés, espaces réduits, bords rognés.
create or replace function public.clean_comment_text(p_text text)
returns text
language sql immutable
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[\u0000-\u001F\u007F​-‏‪-‮⁠-⁩﻿]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- Encourager / retirer son encouragement. Renvoie le nombre total d'encouragements.
create or replace function public.set_cheer(p_attempt uuid, p_on boolean)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.attempts%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into a from public.attempts where id = p_attempt;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_on then
    if a.status <> 'validated' or a.video_removed then raise exception 'comment_not_allowed' using errcode = 'P0001'; end if;
    if a.user_id = uid then raise exception 'cannot_cheer_own_attempt' using errcode = 'P0001'; end if;
    if (select count(*) from public.attempt_cheers where user_id = uid and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    insert into public.attempt_cheers (attempt_id, user_id) values (p_attempt, uid) on conflict do nothing;
  else
    delete from public.attempt_cheers where attempt_id = p_attempt and user_id = uid;
  end if;
  return (select count(*)::integer from public.attempt_cheers where attempt_id = p_attempt);
end;
$$;

-- Compteurs dérivés côté serveur (jamais écrits par le client).
create or replace function public.attempt_social(p_attempt uuid)
returns table (cheer_count integer, comment_count integer, cheered_by_me boolean, can_interact boolean)
language sql stable security definer set search_path = public
as $$
  select (select count(*)::integer from public.attempt_cheers c where c.attempt_id = a.id),
         (select count(*)::integer from public.attempt_comments m where m.attempt_id = a.id and m.status = 'visible'),
         exists (select 1 from public.attempt_cheers c where c.attempt_id = a.id and c.user_id = auth.uid()),
         (a.status = 'validated' and not a.video_removed and auth.uid() is not null)
  from public.attempts a
  where a.id = p_attempt and a.status = 'validated' and auth.uid() is not null;
$$;

create or replace function public.post_comment(p_attempt uuid, p_body text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.attempts%rowtype;
  clean text := public.clean_comment_text(p_body);
  new_id bigint;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if clean = '' then raise exception 'comment_empty' using errcode = 'P0001'; end if;
  if char_length(clean) > 280 then raise exception 'comment_too_long' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where user_id = uid and nullif(btrim(pseudo), '') is not null) then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  select * into a from public.attempts where id = p_attempt;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if a.status <> 'validated' or a.video_removed then raise exception 'comment_not_allowed' using errcode = 'P0001'; end if;
  if (select count(*) from public.attempt_comments where user_id = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'comment_rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attempt_comments where user_id = uid and attempt_id = p_attempt and body = clean and created_at > now() - interval '10 minutes') then
    raise exception 'comment_duplicate' using errcode = 'P0001';
  end if;
  insert into public.attempt_comments (attempt_id, user_id, body) values (p_attempt, uid, clean) returning id into new_id;
  return new_id;
end;
$$;

-- Liste des commentaires visibles (les modérateurs voient aussi les masqués). Vide si la performance n'est plus validée.
create or replace function public.list_comments(p_attempt uuid, p_limit integer default 50, p_before bigint default null)
returns table (id bigint, user_id uuid, pseudo text, body text, created_at timestamptz, mine boolean, status text, report_count integer)
language sql stable security definer set search_path = public
as $$
  select m.id, m.user_id, p.pseudo, m.body, m.created_at, (m.user_id = auth.uid()), m.status,
         case when public.is_moderator() then m.report_count else 0 end
  from public.attempt_comments m
  join public.attempts a on a.id = m.attempt_id and a.status = 'validated'
  left join public.profiles p on p.user_id = m.user_id
  where m.attempt_id = p_attempt and auth.uid() is not null
    and (m.status = 'visible' or public.is_moderator())
    and (p_before is null or m.id < p_before)
  order by m.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.delete_comment(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.attempt_comments where id = p_id and user_id = uid;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.report_comment(p_id bigint, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_id uuid;
  inserted integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select user_id into owner_id from public.attempt_comments where id = p_id and status = 'visible';
  if owner_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if owner_id = uid then raise exception 'cannot_report_own_comment' using errcode = 'P0001'; end if;
  if (select count(*) from public.comment_reports where reporter_id = uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.comment_reports (comment_id, reporter_id, reason) values (p_id, uid, p_reason) on conflict (comment_id, reporter_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.attempt_comments set report_count = report_count + 1 where id = p_id;
  end if;
end;
$$;

-- Modération : commentaires signalés encore ouverts.
create or replace function public.list_reported_comments()
returns table (id bigint, attempt_id uuid, user_id uuid, pseudo text, body text, status text, open_reports integer, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select m.id, m.attempt_id, m.user_id, p.pseudo, m.body, m.status,
           (select count(*)::integer from public.comment_reports r where r.comment_id = m.id and r.status = 'open'),
           m.created_at
    from public.attempt_comments m
    left join public.profiles p on p.user_id = m.user_id
    where exists (select 1 from public.comment_reports r where r.comment_id = m.id and r.status = 'open')
    order by m.created_at asc
    limit 50;
end;
$$;

create or replace function public.moderate_comment(p_id bigint, p_action text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_moderator(uid) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.attempt_comments where id = p_id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_action = 'hide' then
    update public.attempt_comments set status = 'hidden', hidden_by = uid, hidden_at = now() where id = p_id;
    update public.comment_reports set status = 'actioned', handled_by = uid, handled_at = now() where comment_id = p_id and status = 'open';
  elsif p_action = 'restore' then
    update public.attempt_comments set status = 'visible', hidden_by = null, hidden_at = null where id = p_id;
  elsif p_action = 'dismiss_reports' then
    update public.comment_reports set status = 'dismissed', handled_by = uid, handled_at = now() where comment_id = p_id and status = 'open';
  else
    raise exception 'unknown_action' using errcode = 'P0001';
  end if;
  insert into public.comment_moderation_log (comment_id, moderator_id, action, reason) values (p_id, uid, p_action, left(p_reason, 500));
end;
$$;

revoke execute on function public.clean_comment_text(text), public.set_cheer(uuid, boolean), public.attempt_social(uuid), public.post_comment(uuid, text),
  public.list_comments(uuid, integer, bigint), public.delete_comment(bigint), public.report_comment(bigint, text),
  public.list_reported_comments(), public.moderate_comment(bigint, text, text) from public, anon;
grant execute on function public.set_cheer(uuid, boolean), public.attempt_social(uuid), public.post_comment(uuid, text),
  public.list_comments(uuid, integer, bigint), public.delete_comment(bigint), public.report_comment(bigint, text),
  public.list_reported_comments(), public.moderate_comment(bigint, text, text) to authenticated;
