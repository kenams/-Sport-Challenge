alter view public.attempt_points reset (security_invoker);
alter view public.duel_results reset (security_invoker);
alter view public.player_points reset (security_invoker);
alter view public.player_stats_v2 reset (security_invoker);
alter function public.clean_comment_text(text) reset search_path;
alter function public.increment_points(uuid, integer) reset search_path;
