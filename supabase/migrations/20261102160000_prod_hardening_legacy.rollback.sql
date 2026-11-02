-- Annulation de 20261102160000_prod_hardening_legacy.sql (rétablit les droits par défaut Supabase ; search_path laissé fixé, sans risque).
grant insert, update, delete, truncate on public.players_stats, public.wallets, public.wallet_logs, public.battles, public.punishments,
  public.punishment_logs, public.daily_rewards, public.events, public.admin_logs, public.users to anon, authenticated;
grant execute on function public.arena_rooms_activity(), public.arena_rooms_finalize(), public.arena_rounds_validate(), public.decrease_fair_play(),
  public.maybe_finalize_votes_after_vote(), public.trg_check_level_up(), public.trg_notify_new_challenge(), public.trg_notify_response(),
  public.trg_update_active(), public.clean_comment_text(text) to authenticated;
