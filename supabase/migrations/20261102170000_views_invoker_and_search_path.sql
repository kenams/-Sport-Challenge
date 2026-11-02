-- IMMORTAL — les vues de points étaient lisibles par anon (droits par défaut Supabase) et contournaient la RLS (SECURITY DEFINER par défaut).
-- Annulation : 20261102170000_views_invoker_and_search_path.rollback.sql
alter view public.attempt_points set (security_invoker = true);
alter view public.duel_results set (security_invoker = true);
alter view public.player_points set (security_invoker = true);
alter view public.player_stats_v2 set (security_invoker = true);
revoke all on public.attempt_points, public.duel_results, public.player_points, public.player_stats_v2, public.attempt_feed from anon, authenticated;
grant select on public.attempt_points, public.duel_results, public.player_points, public.player_stats_v2, public.attempt_feed to authenticated;
alter function public.clean_comment_text(text) set search_path = public;
alter function public.increment_points(uuid, integer) set search_path = public;
