-- Une politique de group_members ne doit pas relire group_members : récursion RLS.
-- Le client lit uniquement sa propre adhésion. Le classement du groupe passe par
-- group_leaderboard(), qui vérifie déjà l'appartenance du demandeur côté serveur.
begin;
drop policy if exists "group_members_read_members" on public.group_members;
create policy "group_members_read_members" on public.group_members
  for select to authenticated
  using (user_id = (select auth.uid()));
commit;
