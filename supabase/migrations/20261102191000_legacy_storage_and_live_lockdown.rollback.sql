-- Rejoue politiques et droits depuis la sauvegarde pre_immortal_backup_20261102.
update storage.buckets set public = true where id in ('videos','challenge-videos');
alter view public.leaderboard_view reset (security_invoker);
do $$
declare r record;
begin
  for r in select * from pre_immortal_backup_20261102.legacy_policy_defs loop
    if not exists (select 1 from pg_policies where schemaname=r.schema_name and tablename=r.table_name and policyname=r.policy_name) then
      execute r.definition;
    end if;
  end loop;
  for r in select * from pre_immortal_backup_20261102.legacy_grant_defs loop
    execute format('grant %s on public.%I to %I', r.privilege, r.table_name, r.grantee);
  end loop;
end $$;
