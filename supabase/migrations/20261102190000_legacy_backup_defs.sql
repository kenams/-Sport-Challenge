-- Sauvegarde des definitions (fonctions, declencheurs, politiques, droits) de l'heritage avant nettoyage.
-- Idempotent. Aucun effet sur les donnees.
create schema if not exists pre_immortal_backup_20261102;
revoke all on schema pre_immortal_backup_20261102 from public, anon, authenticated;

create table if not exists pre_immortal_backup_20261102.legacy_function_defs (
  kind text not null, name text not null, definition text not null, saved_at timestamptz default now(),
  primary key (kind, name));
create table if not exists pre_immortal_backup_20261102.legacy_policy_defs (
  schema_name text not null, table_name text not null, policy_name text not null, definition text not null, saved_at timestamptz default now(),
  primary key (schema_name, table_name, policy_name));
create table if not exists pre_immortal_backup_20261102.legacy_grant_defs (
  table_name text not null, grantee text not null, privilege text not null, saved_at timestamptz default now(),
  primary key (table_name, grantee, privilege));
alter table pre_immortal_backup_20261102.legacy_function_defs enable row level security;
alter table pre_immortal_backup_20261102.legacy_policy_defs enable row level security;
alter table pre_immortal_backup_20261102.legacy_grant_defs enable row level security;
revoke all on pre_immortal_backup_20261102.legacy_function_defs, pre_immortal_backup_20261102.legacy_policy_defs, pre_immortal_backup_20261102.legacy_grant_defs from public, anon, authenticated;

insert into pre_immortal_backup_20261102.legacy_function_defs (kind, name, definition)
select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', pg_get_functiondef(p.oid)
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('arena_rooms_activity','arena_rooms_finalize','arena_rounds_validate','decrease_fair_play',
                    'finalize_challenge_votes','maybe_finalize_votes_after_vote','run_auto_engine',
                    'auto_create_daily_challenges','auto_inactivity_nudge','auto_matchmake_players')
on conflict (kind, name) do nothing;

insert into pre_immortal_backup_20261102.legacy_function_defs (kind, name, definition)
select 'trigger', c.relname || '.' || tg.tgname, pg_get_triggerdef(tg.oid)
from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
where not tg.tgisinternal and c.relnamespace = 'public'::regnamespace
on conflict (kind, name) do nothing;

insert into pre_immortal_backup_20261102.legacy_policy_defs (schema_name, table_name, policy_name, definition)
select schemaname, tablename, policyname,
  format('create policy %I on %I.%I as %s for %s to %s%s%s', policyname, schemaname, tablename,
    permissive, cmd, array_to_string(roles, ', '),
    case when qual is not null then ' using (' || qual || ')' else '' end,
    case when with_check is not null then ' with check (' || with_check || ')' else '' end)
from pg_policies
where (schemaname = 'public' and tablename in ('live_events','live_comments','live_votes','live_reactions','lives_schedule',
        'arena_rooms','arena_rounds','arena_signals','arena_reports','roulette_duels','punishment_logs','challenge_votes','challenge_response_votes'))
   or (schemaname = 'storage' and tablename = 'objects' and (policyname ilike '%videos%' and policyname not ilike 'attempt%'))
on conflict do nothing;

insert into pre_immortal_backup_20261102.legacy_grant_defs (table_name, grantee, privilege)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('live_events','live_comments','live_votes','live_reactions','lives_schedule','arena_rooms','arena_rounds',
        'arena_signals','arena_reports','roulette_duels','punishment_logs','challenge_votes','challenge_response_votes','leaderboard_view')
on conflict do nothing;
