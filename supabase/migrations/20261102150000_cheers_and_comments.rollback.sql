-- Annule 20261102150000_cheers_and_comments.sql (supprime encouragements et commentaires).
drop function if exists public.moderate_comment(bigint, text, text), public.list_reported_comments(), public.report_comment(bigint, text),
  public.delete_comment(bigint), public.list_comments(uuid, integer, bigint), public.post_comment(uuid, text),
  public.attempt_social(uuid), public.set_cheer(uuid, boolean), public.clean_comment_text(text);
drop table if exists public.comment_moderation_log, public.comment_reports, public.attempt_comments, public.attempt_cheers;
