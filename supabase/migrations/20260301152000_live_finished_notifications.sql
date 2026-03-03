create or replace function public.notify_live_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body_finish text;
  v_body_vote text;
begin
  if new.status = 'finished' and (old.status is distinct from new.status) then
    select coalesce(ct.name, 'Live Arena') into v_title
    from public.challenge_types ct
    where ct.id = new.challenge_type_id;

    v_body_finish := format('Le live est termine%s.', case when v_title is not null then ' : ' || v_title else '' end);
    v_body_vote := format('Le vote est ouvert pour%s.', case when v_title is not null then ' : ' || v_title else ' ce live' end);

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, null, 'live_finished', coalesce(v_title, 'Live Arena'), v_body_finish, now()
    from public.profiles p;

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, null, 'live_vote_open', coalesce(v_title, 'Live Arena'), v_body_vote, now()
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_live_finished on public.live_events;
create trigger trg_notify_live_finished
after update on public.live_events
for each row
execute function public.notify_live_finished();

create or replace function public.finalize_live_votes_batch()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id
    from public.live_events
    where status = 'finished'
      and winner_id is null
      and finished_at is not null
      and finished_at + interval '24 hours' <= now()
  loop
    perform public.finalize_live_votes(v_row.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
