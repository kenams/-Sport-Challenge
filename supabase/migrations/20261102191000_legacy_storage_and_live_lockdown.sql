-- B. Buckets heritage prives, politiques publiques retirees (aucun fichier supprime).
update storage.buckets set public = false where id in ('videos','challenge-videos') and public;

drop policy if exists "challenge videos read" on storage.objects;
drop policy if exists "challenge videos insert" on storage.objects;
drop policy if exists "challenge videos update" on storage.objects;
drop policy if exists "challenge videos delete" on storage.objects;
drop policy if exists "Allow authenticated upload to videos" on storage.objects;
-- "Allow authenticated read videos" (role authenticated) conserve : lecture par connectes uniquement.

-- C. Tables de l'ancien live/arene : RLS active, aucune politique, aucun droit anon/authenticated.
do $$
declare t text; pol record;
begin
  foreach t in array array['live_events','live_comments','live_votes','live_reactions','lives_schedule','arena_rooms',
    'arena_rounds','arena_signals','arena_reports','roulette_duels','punishment_logs','challenge_votes','challenge_response_votes']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Vue du classement d'origine : invoker + plus d'acces anon/authenticated (IMMORTAL utilise la fonction leaderboard()).
alter view public.leaderboard_view set (security_invoker = true);
revoke all on public.leaderboard_view from anon, authenticated;
