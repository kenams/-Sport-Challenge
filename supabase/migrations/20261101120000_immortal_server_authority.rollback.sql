-- Annulation de 20261101120000_immortal_server_authority.sql.
-- ATTENTION : supprime les tentatives, signalements, événements, droits Pro et groupes créés depuis la migration.
-- Les anciennes tables (challenges, challenge_responses, players_stats, wallets, ...) ne sont pas touchées par la migration, donc conservées.
-- Les politiques d'accès d'origine (permissives) ne sont PAS rétablies automatiquement : elles étaient dangereuses (voir la migration).

drop view if exists public.player_stats_v2, public.player_points, public.duel_results, public.attempt_points;

drop function if exists public.my_progress(text), public.set_card_theme(text), public.group_leaderboard(uuid, text),
  public.join_group(text), public.create_group(text),
  public.apply_entitlement_event(text, text, uuid, text, timestamptz, text, text, text, timestamptz, jsonb),
  public.is_pro(uuid), public.get_public_event(text), public.toggle_reminder(uuid), public.support_event(uuid, uuid),
  public.cancel_event(uuid), public.respond_event(uuid, boolean), public.propose_event(uuid, text, timestamptz, text),
  public.current_weekly_challenge(), public.my_stats(), public.leaderboard(text, text, text, integer),
  public.moderate_attempt(uuid, text, integer, text), public.report_attempt(uuid, text, text), public.withdraw_attempt(uuid),
  public.submit_attempt(text, integer, text, numeric, text, uuid, uuid), public.update_my_profile(text, text, text, text, text),
  public.ensure_player();

drop table if exists public.group_members, public.groups, public.payment_events, public.entitlements,
  public.event_reminders, public.event_supporters, public.duel_events, public.weekly_challenges,
  public.moderation_log, public.attempt_reports, public.attempts, public.challenge_formats, public.disciplines;

drop function if exists public.is_moderator(uuid);

alter table public.profiles drop column if exists city, drop column if exists region, drop column if exists country,
  drop column if exists locale, drop column if exists card_theme;

drop policy if exists "attempt videos insert own folder" on storage.objects;
drop policy if exists "attempt videos read allowed" on storage.objects;
drop policy if exists "attempt videos delete own pending" on storage.objects;
-- Le bucket 'attempt-videos' n'est pas supprimé automatiquement : vider puis supprimer manuellement si nécessaire.
