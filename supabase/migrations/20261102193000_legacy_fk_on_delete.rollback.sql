alter table public.arena_rounds drop constraint if exists arena_rounds_winner_id_fkey;
alter table public.arena_rounds add constraint arena_rounds_winner_id_fkey foreign key (winner_id) references auth.users(id);
alter table public.punishment_logs drop constraint if exists punishment_logs_user_id_fkey;
alter table public.punishment_logs add constraint punishment_logs_user_id_fkey foreign key (user_id) references auth.users(id);
