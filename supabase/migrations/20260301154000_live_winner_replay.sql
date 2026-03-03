alter table public.live_events
  add column if not exists replay_url text;

create or replace function public.notify_live_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_winner text;
  v_body text;
begin
  if new.winner_id is not null and (old.winner_id is distinct from new.winner_id) then
    select coalesce(ct.name, 'Live Arena') into v_title
    from public.challenge_types ct
    where ct.id = new.challenge_type_id;

    select pseudo into v_winner
    from public.profiles
    where user_id = new.winner_id;

    v_body := format('Victoire de %s sur %s.', coalesce(v_winner, 'un joueur'), coalesce(v_title, 'Live Arena'));

    insert into public.notifications (user_id, actor_id, type, title, body, created_at)
    select p.user_id, new.winner_id, 'live_winner', coalesce(v_title, 'Live Arena'), v_body, now()
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_live_winner on public.live_events;
create trigger trg_notify_live_winner
after update on public.live_events
for each row
execute function public.notify_live_winner();
