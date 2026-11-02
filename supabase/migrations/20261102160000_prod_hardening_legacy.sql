-- IMMORTAL — durcissement des objets d'origine du projet de production (02/11/2026).
-- Annulation : 20261102160000_prod_hardening_legacy.rollback.sql
-- 1. Plus aucun droit d'écriture de table pour anon/authenticated sur les tables de points, pièces, duels, punitions, journaux (RLS les bloquait déjà ; défense en profondeur).
do $$
declare t text;
begin
  foreach t in array array['players_stats', 'wallets', 'wallet_logs', 'battles', 'punishments', 'punishment_logs', 'daily_rewards', 'events', 'admin_logs', 'users'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 2. Fonctions de déclencheurs et moteur d'origine : plus d'exécution directe par un joueur (les déclencheurs ne vérifient pas ce droit).
do $$
declare f text;
begin
  foreach f in array array['public.arena_rooms_activity()', 'public.arena_rooms_finalize()', 'public.arena_rounds_validate()',
    'public.decrease_fair_play()', 'public.maybe_finalize_votes_after_vote()', 'public.trg_check_level_up()',
    'public.trg_notify_new_challenge()', 'public.trg_notify_response()', 'public.trg_update_active()', 'public.clean_comment_text(text)'] loop
    if to_regprocedure(f) is not null then
      execute 'revoke execute on function ' || f || ' from public, anon, authenticated';
    end if;
  end loop;
end $$;

-- 3. search_path fixé sur les fonctions SECURITY DEFINER d'origine (toutes qualifient déjà leurs objets avec public.).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
