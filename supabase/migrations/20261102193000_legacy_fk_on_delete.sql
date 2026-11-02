-- E. Suppression d'un compte non bloquee par l'ancien live/punitions.
alter table public.arena_rounds drop constraint if exists arena_rounds_winner_id_fkey;
alter table public.arena_rounds add constraint arena_rounds_winner_id_fkey
  foreign key (winner_id) references auth.users(id) on delete set null;

do $$
declare nn boolean;
begin
  select attnotnull into nn from pg_attribute where attrelid='public.punishment_logs'::regclass and attname='user_id';
  alter table public.punishment_logs drop constraint if exists punishment_logs_user_id_fkey;
  if nn then
    alter table public.punishment_logs add constraint punishment_logs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  else
    alter table public.punishment_logs add constraint punishment_logs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;
